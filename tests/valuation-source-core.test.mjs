import assert from "node:assert/strict";
import test from "node:test";
import { positivePriceNumber, priceRangeFor } from "../scripts/lib/valuation-source-core.mjs";

test("price coercion accepts decimal text but not JavaScript object coercions", () => {
  for (const value of [4000, "4000", " 4000.50 "]) assert.equal(positivePriceNumber(value), Number(value));
  for (const value of [true, false, [], [4000], {}, null, "", " ", "4k", "4,000", "0x100", "4e3", "4000元", -1, Infinity, NaN]) {
    assert.equal(positivePriceNumber(value), null);
    assert.equal(priceRangeFor({ price_twd: value }), null);
  }
  assert.equal(positivePriceNumber("4000", false), null);
  assert.deepEqual(priceRangeFor({ price_twd_low: "3000", price_twd_high: "4000" }), { low: 3000, high: 4000 });
  assert.equal(priceRangeFor({ price_twd_low: true, price_twd_high: [4000] }), null);
});

test("package bounds constrain exact counts and supersede stale derived tiers", () => {
  for (const row of [
    { paid_package_min: 60, paid_package_count: 20 },
    { paid_package_min: 60, paid_package_max: 80, paid_package_count: 90 },
    { paid_package_min: 80, paid_package_max: 60, paid_package_count: 70 },
    { paid_package_max: 10, computed_package_tier: "few" },
    { paid_package_min: "60", paid_package_count: 70 },
  ]) assert.equal(packageTierFor(row), null, JSON.stringify(row));
  assert.equal(packageTierFor({ paid_package_min: 60, paid_package_count: "70" }), "many");
  assert.equal(packageTierFor({ paid_package_min: 60, paid_package_max: 80, computed_package_tier: "hundred" }), "many");
  assert.equal(packageTierFor({ paid_package_min: 60, computed_package_tier: "many" }), null);
});

test("package intervals can inform a tier without requiring an exact package count", () => {
  assert.equal(packageTierFor({ paid_package_min: 100, paid_package_max: null }), "hundred");
  assert.equal(packageTierFor({ paid_package_min: 60, paid_package_max: 80 }), "many");
  assert.equal(packageTierFor({ paid_package_min: 60, paid_package_max: null }), null);
  assert.equal(packageTierFor({ paid_package_min: 0, paid_package_max: 10 }), "few");
  assert.equal(packageTierFor({ paid_package_min: 80, paid_package_max: 60 }), null);
  assert.equal(packageTierFor({ paid_package_min: null }), null);
});
import {
  breakClassFor,
  marketExclusionReason,
  holdoutSplitCommitmentFor,
  hasCompleteModelEvidence,
  inHoldout,
  packageTierFor,
  preferredRow,
  preferredSample,
  modelEvidenceSignatureFor,
  stableRowKey,
  timeWeightFor,
  valuationDatasetDigestFor,
} from "../scripts/lib/valuation-source-core.mjs";

test("an observation today does not make an undated historical listing recent", () => {
  const reference = new Date("2026-09-10T00:00:00Z");
  const row = { published_at: null, published_relative: "4 年前", observed_at: reference.toISOString() };
  assert.equal(timeWeightFor(row, reference), 0.45);
  assert.equal(timeWeightFor({ ...row, published_at: "" }, reference), 0.45);
  assert.equal(timeWeightFor({ ...row, published_at: "not-a-date" }, reference), 0.45);
  assert.equal(timeWeightFor({ ...row, published_at: reference.toISOString() }, reference), 1);
  assert.equal(timeWeightFor({ ...row, published_at: "2022-08-30T00:00:00Z" }, reference), 0.25);
});

test("freezes source content independently of row order", () => {
  const rows = [{ id: 1, price: 100 }, { id: 2, price: 200 }];
  assert.equal(
    valuationDatasetDigestFor(rows),
    valuationDatasetDigestFor([...rows].reverse()),
  );
  assert.notEqual(
    valuationDatasetDigestFor(rows),
    valuationDatasetDigestFor([{ id: 1, price: 101 }, rows[1]]),
  );
});

test("headline fallback content participates in row identity and stable tie breaking", () => {
  const a = { price_twd: 6000, listing_text: "表演大斷簡號" };
  const b = { price_twd: 6000, listing_text: "魔法無斷百禮號" };
  assert.notEqual(stableRowKey(a), stableRowKey(b));
  assert.deepEqual(preferredRow(a, b), preferredRow(b, a));
});

test("headline and interval evidence use protected extended signatures", () => {
  const salt = "test-headline-evidence-salt-32-characters";
  const base = { price_twd: 5000 };
  const original = modelEvidenceSignatureFor(base, salt);
  for (const field of ["title", "listing_title", "paid_package_min", "paid_package_max"]) {
    const extended = { ...base, [field]: field.includes("package") ? 100 : "魔法無斷" };
    assert.notEqual(modelEvidenceSignatureFor(extended, salt), original);
    assert.notEqual(modelEvidenceSignatureFor({ ...extended, [field]: null }, salt), modelEvidenceSignatureFor(extended, salt));
  }
  assert.equal(modelEvidenceSignatureFor({ ...base, title: undefined }, salt), original);
});

test("private split commitments change the holdout assignment", () => {
  const first = "first-private-holdout-secret-32-characters";
  const second = "second-private-holdout-secret-32-characters";
  assert.notEqual(
    holdoutSplitCommitmentFor("sky-valuation-v3", first),
    holdoutSplitCommitmentFor("sky-valuation-v3", second),
  );
  const assignments = Array.from({ length: 100 }, (_, index) => {
    const identity = index.toString(16).padStart(64, "0");
    return [
      inHoldout(identity, "sky-valuation-v3", { splitSecret: first }),
      inHoldout(identity, "sky-valuation-v3", { splitSecret: second }),
    ];
  });
  assert.ok(assignments.some(([left, right]) => left !== right));
});

const completeModel = {
  baseLow: 1000,
  baseHigh: 2000,
  breakMultiplier: 1,
  partialDiscountLow: 0,
  partialDiscountHigh: 0,
  packageLow: 0,
  packageHigh: 0,
  packageMarketMultiplier: 1,
  limitedLow: 0,
  limitedHigh: 0,
  resourceLow: 0,
  resourceHigh: 0,
  accountStyleMultiplier: 1,
  bindingRisk: 1,
  transferHighMultiplier: 1,
  confidence: "low",
};

test("classifies normalized break fields consistently for audit and validation", () => {
  assert.equal(breakClassFor({ computed_break_class: "big" }), "big");
  assert.equal(
    breakClassFor({ missing_season_count: 0, completion_ratio: 1 }),
    "none",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 2, completion_ratio: 0.8 }),
    "slight",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 5, completion_ratio: 0.4 }),
    "medium",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 6, completion_ratio: 0.4 }),
    "big",
  );
  assert.equal(
    breakClassFor({ missing_season_count: "unknown", completion_ratio: 1 }),
    null,
  );
  assert.equal(breakClassFor({ seller_break_label: "微斷" }), null);
});

test("classifies normalized paid-package counts consistently for audit and validation", () => {
  assert.equal(packageTierFor({ computed_package_tier: "many" }), "many");
  assert.equal(packageTierFor({ paid_package_count: 14 }), "few");
  assert.equal(packageTierFor({ paid_package_count: 15 }), "medium");
  assert.equal(packageTierFor({ paid_package_count: 40 }), "many");
  assert.equal(packageTierFor({ paid_package_count: 100 }), "hundred");
  assert.equal(packageTierFor({ paid_package_count: -1 }), null);
  assert.equal(
    packageTierFor({ paid_package_count: 1, computed_package_tier: "hundred" }),
    "few",
  );
  assert.equal(packageTierFor({ computed_package_tier: "medium" }), "medium");
  assert.equal(
    packageTierFor({ paid_package_count: null, computed_package_tier: "many" }),
    "many",
  );
  assert.equal(
    packageTierFor({ paid_package_count: "", computed_package_tier: "hundred" }),
    "hundred",
  );
  assert.equal(
    packageTierFor({ paid_package_count: "invalid", computed_package_tier: "many" }),
    null,
  );
  assert.equal(
    packageTierFor({ paid_package_count: -1, computed_package_tier: "many" }),
    null,
  );
  assert.equal(
    packageTierFor({ paid_package_count: "  ", computed_package_tier: "many" }),
    null,
  );
  assert.equal(
    packageTierFor({ paid_package_count: false, computed_package_tier: "many" }),
    null,
  );
  assert.equal(packageTierFor({ paid_package_count: 1.5 }), null);
});

test("missing and invalid break counts never become unbroken accounts", () => {
  for (const missing of [null, undefined, "", " ", false, -1, 0.5]) {
    assert.equal(breakClassFor({ missing_season_count: missing, completion_ratio: 1 }), null);
  }
  for (const ratio of [null, undefined, "", " ", false, -0.1, 1.1]) {
    assert.equal(breakClassFor({ missing_season_count: 0, completion_ratio: ratio }), null);
  }
  assert.equal(breakClassFor({ missing_season_count: "0", completion_ratio: "1" }), "none");
});

test("converted foreign prices remain outside the Taiwan absolute-price model", () => {
  for (const key of ["original_currency", "currency_original"]) {
    for (const currency of ["HKD", "CNY", "USD", "MYR", "RUB"]) {
      assert.equal(marketExclusionReason({ currency: "TWD", [key]: currency, price_twd: 3500 }), "foreign_currency");
    }
  }
  assert.equal(marketExclusionReason({ currency: "TWD", original_currency: "TWD" }), null);
  assert.equal(marketExclusionReason({ currency: "twd", region: "international" }), null);
  assert.equal(marketExclusionReason({ currency: "TWD", region: "china" }), "china");
});

test("same-time deduplication retains the richer replay snapshot", () => {
  const fullProgress = {
    moments: "畢",
    revival: "畢",
    "nine-colored-deer": "畢",
    nesting: "畢",
    duets: "畢",
    moomin: "畢",
    radiance: "畢",
    "blue-bird": "畢",
    "two-embers-part-1": "畢",
    migration: "畢",
    lightmending: "畢",
    carnival: "畢",
  };
  const incomplete = {
    evidence_kind: "professional_estimate",
    observed_at: "2026-09-05T16:00:00.000Z",
    start_season_slug: "moments",
    season_progress: fullProgress,
    valuation_model: completeModel,
  };
  const replayable = {
    ...incomplete,
    season_progress_end_slug: "carnival",
  };

  assert.equal(preferredRow(incomplete, replayable), replayable);
  assert.equal(
    preferredSample(
      { row: incomplete, evidenceKind: "professional_estimate", publishedAt: 1 },
      { row: replayable, evidenceKind: "professional_estimate", publishedAt: 1 },
    ).row,
    replayable,
  );
});

test("invalid replay metadata does not outrank a valid same-time snapshot", () => {
  const valid = {
    evidence_kind: "ask",
    published_at: "2026-09-05T16:00:00.000Z",
    start_season_slug: "carnival",
    season_progress: { carnival: "畢" },
    season_progress_end_slug: "carnival",
    valuation_model: completeModel,
  };
  const invalid = {
    ...valid,
    season_progress_end_slug: "not-a-season",
  };

  assert.equal(preferredRow(invalid, valid), valid);
});

test("newer evidence still wins over an older richer replay snapshot", () => {
  const older = {
    evidence_kind: "ask",
    published_at: "2026-09-05T16:00:00.000Z",
    season_progress: { moments: "畢" },
    season_progress_end_slug: "carnival",
    valuation_model: completeModel,
  };
  const newer = {
    evidence_kind: "ask",
    published_at: "2026-09-06T16:00:00.000Z",
  };

  assert.equal(preferredRow(older, newer), newer);
});

test("newer observed backup evidence wins when publication dates are unavailable", () => {
  const older = {
    evidence_kind: "professional_estimate",
    observed_at: "2026-09-05T16:00:00.000Z",
    season_progress: { moments: "畢" },
    season_progress_end_slug: "carnival",
    valuation_model: completeModel,
  };
  const newer = {
    evidence_kind: "professional_estimate",
    observed_at: "2026-09-06T16:00:00.000Z",
  };

  assert.equal(preferredRow(older, newer), newer);
});

test("same-time predictor ties resolve deterministically regardless of source order", () => {
  const common = {
    evidence_kind: "professional_estimate",
    observed_at: "2026-09-06T16:00:00.000Z",
    account_fingerprint: "a".repeat(64),
    snapshot_hash: "b".repeat(64),
    identity_namespace: "c".repeat(64),
    account_identity_scheme: "stable-hmac-v1",
    inventory_complete: true,
    bindings_complete: true,
    valuation_model_schema_version: 4,
    season_progress: { carnival: "畢" },
    season_progress_end_slug: "carnival",
  };
  const first = { ...common, valuation_model: completeModel };
  const second = {
    ...common,
    valuation_model: { ...completeModel, packageHigh: 100 },
  };

  assert.equal(preferredRow(first, second), preferredRow(second, first));
});

test("schema v3 evidence is not accepted as a complete v4 predictor", () => {
  const salt = "schema-v4-test-salt-that-is-at-least-32-characters";
  const current = {
    account_fingerprint: "a".repeat(64),
    snapshot_hash: "b".repeat(64),
    identity_namespace: "c".repeat(64),
    account_identity_scheme: "stable-hmac-v1",
    inventory_complete: true,
    bindings_complete: true,
    valuation_model_schema_version: 4,
    model_evidence: {
      bindings: {
        google: "none", nintendo: "none", gameCenter: "none", facebook: "none",
        steam: "none", twitch: "none", playstation: "none",
      },
      resources: { candles: 0, hearts: 0, ascended: 0, passes: 0 },
    },
  };
  const signedCurrent = {
    ...current,
    evidence_signature: modelEvidenceSignatureFor(current, salt),
  };
  const legacy = {
    ...current,
    valuation_model_schema_version: 3,
  };
  const signedLegacy = {
    ...legacy,
    evidence_signature: modelEvidenceSignatureFor(legacy, salt),
  };
  assert.equal(hasCompleteModelEvidence(signedCurrent, { hashSalt: salt }), true);
  assert.equal(hasCompleteModelEvidence(signedLegacy, { hashSalt: salt }), false);
});
