import assert from "node:assert/strict";
import test from "node:test";
import { runJsonlScript } from "./helpers/run-jsonl-script.mjs";
import { valuationModelInputKeys } from "../app/valuation-model-core.js";
import {
  modelEvidenceSignatureFor,
} from "../scripts/lib/valuation-source-core.mjs";
import {
  replaySeasonProgressEndSlug,
  seasonBandSeeds,
} from "../app/valuation-season-band-core.js";

const script = new URL("../scripts/audit-valuation-source.mjs", import.meta.url);
const recent = new Date().toISOString();

test("audit keeps partial-start samples without borrowing a later season's break claim", async () => {
  const base = { post_hash: "partial-start", published_at: recent, price_twd: 6000, evidence_kind: "ask", evidence_quality: "high", start_season_slug: "duets", season_progress: { duets: "2/3", radiance: "1/2" } };
  for (const title of ["姆明大斷少禮簡號", "姆明大斷少禮簡號｜九色鹿、姆明全禮"]) {
    const result = await audit([{ ...base, title, seller_break_label: "大斷" }]);
    assert.equal(result.eligibleRows, 1);
    assert.equal(result.segments.startSeason.duets.sampleCount, 1);
    assert.equal(result.segments.breakClass.big.sampleCount, 0);
    assert.equal(result.segments.accountStyle.simple.sampleCount, 1);
  }
  for (const extra of [{ title: "大斷少禮簡號" }, { title: "協奏大斷少禮簡號" }, { title: "姆明大斷少禮簡號", computed_break_class: "big" }]) {
    const result = await audit([{ ...base, ...extra }]);
    assert.equal(result.segments.breakClass.big.sampleCount, 1);
  }
});

test("graduation count and a few-gifts label do not fabricate package or account classes", async () => {
  const result = await audit([{
    source: "8591_tw", post_hash: "three-graduated-seasons", published_at: recent,
    currency: "TWD", region: "international", price_twd: 4200, evidence_kind: "ask", evidence_quality: "high",
    title: "測試用帳號：3季畢業，少禮", paid_package_count: null, seller_package_label: "few",
    start_season_slug: "performance",
    season_progress: { performance: "complete", shattering: "complete", aurora: "complete" },
  }]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.segments.startSeason.performance.sampleCount, 1);
  assert.equal(result.segments.packageTier.few.sampleCount, 0);
  assert.equal(result.segments.accountStyle.simple.sampleCount, 0);
  assert.equal(result.segments.breakClass.big.sampleCount, 0);
});

test("zero and invalid progress cannot masquerade as an early graduation", async () => {
  const base = { published_at: recent, price_twd: 9000, evidence_kind: "ask", evidence_quality: "high" };
  for (const value of ["0", "0/3", { selected: 0, expected: 3 }, { selected: 3, expected: 0 }, "4/3", {}, "unknown", []]) {
    const result = await audit([{ ...base, post_hash: "zero", season_progress: { rhythm: value, enchantment: { selected: 1, expected: 2 } } }]);
    assert.equal(result.segments.startSeason.rhythm.sampleCount, 0, JSON.stringify(value));
    assert.equal(result.segments.startSeason.enchantment.sampleCount, 1, JSON.stringify(value));
    const onlyZero = await audit([{ ...base, post_hash: "only-zero", season_progress: { rhythm: value } }]);
    assert.equal(onlyZero.segments.startSeason.rhythm.sampleCount, 0, JSON.stringify(value));
  }
});

test("page-marker fallbacks retain usable titles without mixing foreign markets", async () => {
  const base = { source: "google_drive", published_at: recent, currency: "TWD", region: "international", price_twd: 6000, evidence_kind: "ask", evidence_quality: "high" };
  const result = await audit([
    { ...base, post_hash: "page", title: " ", listing_text: "分頁 1\n預言八季禮包號" },
    { ...base, post_hash: "china", title: "國服狂歡禮包號" },
    { ...base, post_hash: "hkd", listing_title: "狂歡禮包號 300港幣" },
  ]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.segments.startSeason.prophecy.sampleCount, 1);
  assert.equal(result.segments.startSeason.carnival.sampleCount, 0);
});

test("headline-only accounts contribute reduced-weight season evidence without full inventories", async () => {
  const base = { source: "google_drive", published_at: recent, currency: "TWD", region: "international", price_twd: 6000, evidence_kind: "ask", evidence_quality: "high" };
  const headline = await audit([{ ...base, post_hash: "headline", title: "表演大斷簡號" }]);
  const explicit = await audit([{ ...base, post_hash: "structured", start_season_slug: "performance" }]);
  assert.equal(headline.segments.startSeason.performance.sampleCount, 1);
  assert(headline.segments.startSeason.performance.effectiveWeight < explicit.segments.startSeason.performance.effectiveWeight);
  assert.equal(headline.segments.breakClass.big.sampleCount, 1);
  assert.equal(headline.segments.accountStyle.simple.sampleCount, 1);
  assert.equal(headline.segments.packageTier.few.sampleCount, 0);
});

test("headline package intervals retain usable tier evidence without fabricating counts", async () => {
  const base = { source: "google_drive", published_at: recent, currency: "TWD", region: "international", price_twd: 20000, evidence_kind: "ask", evidence_quality: "medium" };
  const result = await audit([
    { ...base, post_hash: "lower", title: "魔法無斷60+禮號" },
    { ...base, post_hash: "hundred", title: "魔法無斷百禮號" },
    { ...base, post_hash: "interval", title: "魔法無斷60～80禮號" },
  ]);
  assert.equal(result.segments.startSeason.enchantment.sampleCount, 3);
  assert.equal(result.segments.packageTier.hundred.sampleCount, 1);
  assert.equal(result.segments.packageTier.many.sampleCount, 1);
});
test("audit accepts measured lower bounds without inventing exact counts or cross-tier classes", async () => {
  const base = { source: "google_drive", published_at: recent, currency: "TWD", region: "international", price_twd: 20000, evidence_kind: "ask", evidence_quality: "medium" };
  const result = await audit([
    { ...base, post_hash: "measured-sixty", title: "魔法起60+個禮包" },
    { ...base, post_hash: "measured-hundred", title: "魔法起１００＋个礼包" },
    { ...base, post_hash: "measured-conflict", title: "魔法起60+個禮包 90個禮包" },
  ]);
  assert.equal(result.eligibleRows, 3);
  assert.equal(result.segments.startSeason.enchantment.sampleCount, 3);
  assert.equal(result.segments.packageTier.hundred.sampleCount, 1);
  assert.equal(result.segments.packageTier.many.sampleCount, 0);
  assert.equal(result.segments.packageTier.medium.sampleCount, 0);
  assert.equal(result.segments.packageTier.few.sampleCount, 0);
});

const testHashSalt = "audit-test-hash-salt-32-characters-minimum";
const testHoldoutSecret = "audit-test-holdout-secret-32-characters-minimum";
const signEvidenceRow = (row) => {
  const completeRow = {
    ...row,
    model_evidence: {
      bindings: {
        google: "none",
        nintendo: "none",
        gameCenter: "none",
        facebook: "none",
        steam: "none",
        twitch: "none",
        playstation: "none",
      },
      resources: { candles: 100, hearts: 10, ascended: 5, passes: 0 },
    },
  };
  return {
    ...completeRow,
    evidence_signature: modelEvidenceSignatureFor(completeRow, testHashSalt),
  };
};
const completeSeasonProgress = (startSlug) => {
  const startIndex = seasonBandSeeds.findIndex((seed) => seed.slug === startSlug);
  const endIndex = seasonBandSeeds.findIndex(
    (seed) => seed.slug === replaySeasonProgressEndSlug,
  );
  return Object.fromEntries(
    seasonBandSeeds
      .slice(startIndex, endIndex + 1)
      .map(({ slug }) => [slug, "畢"]),
  );
};
const audit = async (rows, { splitSeed } = {}) => {
  const args = splitSeed ? [`--split-seed=${splitSeed}`] : [];
  const { stdout } = await runJsonlScript({
    script,
    lines: rows.map(JSON.stringify),
    args,
    env: {
      ...process.env,
      VALUATION_HASH_SALT: testHashSalt,
      VALUATION_HOLDOUT_SECRET: testHoldoutSecret,
    },
    temporaryPrefix: "sky-valuation-audit-",
  });
  return JSON.parse(stdout);
};

test("weights structured seasonal samples by evidence and quality", async () => {
  const result = await audit([
    { post_hash: "a", published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { rhythm: "畢" } },
    { post_hash: "b", published_at: recent, price_twd: 20000, evidence_kind: "professional_estimate", evidence_quality: "high", seasons: [{ slug: "rhythm" }] },
    { post_hash: "c", published_at: recent, price_twd: 30000, evidence_kind: "comment", evidence_quality: "medium", season_progress: { rhythm: "1/2" } },
  ]);
  const rhythm = result.seasons.rhythm;
  assert.equal(rhythm.sampleCount, 3);
  assert.equal(rhythm.effectiveWeight, 1.813);
  assert.deepEqual(rhythm.evidenceBreakdown, {
    ask: 1,
    quick_sale: 0,
    sold: 0,
    professional_estimate: 1,
    comment: 1,
  });
  assert.deepEqual([rhythm.p25, rhythm.median, rhythm.p75], [10000, 10000, 20000]);
});

test("deduplicates hashes and excludes foreign, China, and invalid records", async () => {
  const result = await audit([
    { post_hash: "same", published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_hash: "same", published_at: recent, price_twd: 90000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_hash: "cn", price_twd: 12000, evidence_kind: "ask", evidence_quality: "high", region: "國服", season_progress: { aurora: "畢" } },
    { post_hash: "china", price_twd: 12000, evidence_kind: "ask", evidence_quality: "high", region: "china", season_progress: { aurora: "畢" } },
    { post_hash: "usd", price_twd: 12000, evidence_kind: "ask", evidence_quality: "high", currency: "USD", season_progress: { aurora: "畢" } },
    { post_hash: "bad", price_twd: null, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
  ]);
  assert.deepEqual([result.eligibleRows, result.excludedRows, result.duplicateRows], [1, 4, 1]);
  assert.equal(result.seasons.aurora.sampleCount, 1);
  assert.deepEqual([result.seasons.aurora.excludedCount, result.seasons.aurora.duplicateCount], [4, 1]);
});

test("filters an invalid relist before deduplicating the same post", async () => {
  const result = await audit([
    { post_hash: "same-post", published_at: "2026-09-01T00:00:00.000Z", price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_hash: "same-post", published_at: "2026-09-02T00:00:00.000Z", price_twd: 90000, evidence_kind: "ask", evidence_quality: "high", region: "國服", season_progress: { aurora: "畢" } },
  ]);

  assert.deepEqual([result.eligibleRows, result.excludedRows, result.duplicateRows], [1, 1, 0]);
  assert.equal(result.seasons.aurora.median, 10000);
});

test("excludes converted HKD prices and leaves unknown break progress unclassified", async () => {
  const common = { price_twd: 3500, currency: "TWD", evidence_kind: "ask", start_season_slug: "moments" };
  const result = await audit([
    { ...common, post_hash: "hk", original_currency: "HKD" },
    { ...common, post_hash: "tw", missing_season_count: null, completion_ratio: null },
  ]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.excludedRows, 1);
  assert.equal(result.segments.startSeason.moments.sampleCount, 1);
  assert.equal(result.segments.breakClass.none.sampleCount, 0);
});

test("deduplicates the legacy post fingerprint alias", async () => {
  const result = await audit([
    { post_fingerprint: "legacy-post", published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_fingerprint: "legacy-post", published_at: recent, price_twd: 90000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
  ]);

  assert.deepEqual([result.eligibleRows, result.duplicateRows], [1, 1]);
});

test("deduplicates the same inventory snapshot even under different account ids", async () => {
  const snapshotHash = "d".repeat(64);
  const result = await audit([
    { post_hash: "snapshot-one", account_fingerprint: "a".repeat(64), snapshot_hash: snapshotHash, published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", start_season_slug: "gratitude" },
    { post_hash: "snapshot-two", account_fingerprint: "b".repeat(64), snapshot_hash: snapshotHash, published_at: recent, price_twd: 90000, evidence_kind: "ask", evidence_quality: "high", start_season_slug: "gratitude" },
  ]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.duplicateSnapshotRows, 1);
});

test("rejects numeric-string point prices at the same strict boundary as validation", async () => {
  const result = await audit([{
    post_hash: "string-price",
    published_at: recent,
    price_twd: "10000",
    evidence_kind: "ask",
    evidence_quality: "high",
    season_progress: { assembly: "畢" },
  }]);
  assert.equal(result.eligibleRows, 0);
  assert.equal(result.excludedRows, 1);
});

test("hard-excludes a confounded listing even when its price is otherwise valid", async () => {
  const result = await audit([{
    post_hash: "badges-bundled",
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "nesting",
    exclude_from_model: true,
  }]);
  assert.equal(result.eligibleRows, 0);
  assert.equal(result.excludedRows, 1);
  assert.equal(result.segments.startSeason.nesting.sampleCount, 0);
});

test("reports strict predictor gaps by field and source", async () => {
  const completePredictor = Object.fromEntries(
    valuationModelInputKeys.map((field) => [field, 1]),
  );
  completePredictor.confidence = "low";
  const result = await audit([
    signEvidenceRow({
      source: "manual_backup",
      post_hash: "complete-predictor",
      account_fingerprint: "a".repeat(64),
      snapshot_hash: "b".repeat(64),
      identity_namespace: "c".repeat(64),
      account_identity_scheme: "stable-hmac-v1",
      inventory_complete: true,
      bindings_complete: true,
      valuation_model_schema_version: 3,
      published_at: recent,
      price_twd: 4000,
      evidence_kind: "professional_estimate",
      evidence_quality: "medium",
      start_season_slug: "moments",
      season_progress: completeSeasonProgress("moments"),
      season_progress_end_slug: replaySeasonProgressEndSlug,
      valuation_model: completePredictor,
    }),
    {
      source: "facebook",
      post_hash: "partial-predictor",
      account_fingerprint: "partial-account",
      published_at: recent,
      price_twd: 3500,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "performance",
      valuation_model: { ...completePredictor, packageLow: "1" },
    },
    {
      source: "facebook",
      post_hash: "missing-predictor",
      account_fingerprint: "missing-account",
      published_at: recent,
      price_twd: 3000,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "flight",
    },
  ]);
  assert.deepEqual(
    {
      eligibleRows: result.predictorCoverage.eligibleRows,
      completeRows: result.predictorCoverage.completeRows,
      missingRows: result.predictorCoverage.missingRows,
      coverage: result.predictorCoverage.coverage,
    },
    { eligibleRows: 3, completeRows: 1, missingRows: 2, coverage: 0.3333 },
  );
  assert.equal(
    result.predictorCoverage.scope,
    "identified accounts with structured start-season evidence",
  );
  assert.equal(result.predictorCoverage.missingByField.packageLow, 2);
  assert.equal(result.predictorCoverage.missingByField.confidence, 1);
  assert.deepEqual(result.predictorCoverage.bySource, {
    facebook: { eligibleRows: 2, completeRows: 0, missingRows: 2, coverage: 0 },
    manual_backup: { eligibleRows: 1, completeRows: 1, missingRows: 0, coverage: 1 },
  });
});

test("uses the shared predictor semantics instead of counting invalid numeric ranges", async () => {
  const invalidPredictor = Object.fromEntries(
    valuationModelInputKeys.map((field) => [field, 1]),
  );
  invalidPredictor.baseLow = 2;
  invalidPredictor.baseHigh = 1;
  invalidPredictor.confidence = "low";
  const result = await audit([{
    source: "manual_backup",
    post_hash: "invalid-semantic-predictor",
    account_fingerprint: "a".repeat(64),
    snapshot_hash: "b".repeat(64),
    identity_namespace: "c".repeat(64),
    account_identity_scheme: "stable-hmac-v1",
    inventory_complete: true,
    bindings_complete: true,
    valuation_model_schema_version: 3,
    published_at: recent,
    price_twd: 4000,
    evidence_kind: "professional_estimate",
    evidence_quality: "medium",
    start_season_slug: "moments",
    season_progress: completeSeasonProgress("moments"),
    season_progress_end_slug: replaySeasonProgressEndSlug,
    valuation_model: invalidPredictor,
  }]);
  assert.equal(result.predictorCoverage.completeRows, 0);
  assert.equal(result.predictorCoverage.missingByField.valuation_model_semantics, 1);
});

test("keeps old listing text and account features compatible without leaking them", async () => {
  const result = await audit([{ price_twd: 18500, evidence_kind: "ask", evidence_quality: "high", published_at: recent, listing_text: "追光畢出售", account_features: "大傘" }]);
  assert.equal(result.seasons.lightseekers.median, 18500);
  assert.equal(/追光畢|大傘/.test(JSON.stringify(result)), false);
});

test("does not mistake collection time for publication recency", async () => {
  const result = await audit([{
    post_hash: "unknown-date",
    observed_at: recent,
    price_twd: 4500,
    evidence_kind: "ask",
    evidence_quality: "high",
    season_progress: { moomin: "start" },
  }]);
  assert.equal(result.seasons.moomin.effectiveWeight, 0.45);
  assert.equal(result.segments.startSeason.moomin.sampleCount, 1);
  assert.equal(result.segments.startSeason.moomin.effectiveWeight, 0.203);
});

test("unknown structured season progress never enters start-season calibration", async () => {
  const result = await audit([{
    post_hash: "unknown-start",
    published_at: recent,
    price_twd: 4500,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_confidence: "unknown",
    season_progress: { moomin: "start" },
  }]);
  assert.equal(result.segments.startSeason.moomin.sampleCount, 0);
});

test("infers the earliest progressed season from multi-season structured progress", async () => {
  const result = await audit([{
    post_hash: "multi-season-start",
    published_at: recent,
    price_twd: 12000,
    evidence_kind: "ask",
    evidence_quality: "high",
    season_progress: {
      blue_bird: "0/3",
      moomin: "畢",
      duets: "1/3",
      nesting: 0,
    },
  }]);
  assert.equal(result.segments.startSeason.duets.sampleCount, 1);
  assert.equal(result.segments.startSeason.moomin.sampleCount, 0);
});

test("does not report a valid-price row as eligible when it affects no calibration", async () => {
  const result = await audit([{
    post_hash: "no-calibration-fields",
    published_at: recent,
    price_twd: 12000,
    evidence_kind: "ask",
    evidence_quality: "high",
  }]);
  assert.equal(result.eligibleRows, 0);
  assert.equal(result.groupConcentration.largestEffectiveShare, 0);
  assert.equal(result.excludedRows, 1);
});

test("aggregates price ranges and objective market classifications", async () => {
  const result = await audit([
    {
      post_hash: "structured",
      published_at: recent,
      price_twd_low: 4800,
      price_twd_high: 5200,
      price_kind: "ask",
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "assembly",
      missing_season_count: 2,
      completion_ratio: 0.9,
      paid_package_count: 42,
      account_style: "regular",
    },
  ]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.segments.startSeason.assembly.median, 5032);
  assert.equal(result.segments.breakClass.slight.sampleCount, 1);
  assert.equal(result.segments.packageTier.many.sampleCount, 1);
  assert.equal(result.segments.accountStyle.regular.sampleCount, 1);
  const packageModifiers = result.modifiers.packageTier;
  assert.ok(packageModifiers.few.multiplier <= packageModifiers.medium.multiplier);
  assert.ok(packageModifiers.medium.multiplier <= packageModifiers.many.multiplier);
  assert.ok(packageModifiers.many.multiplier <= packageModifiers.hundred.multiplier);
  assert.ok(packageModifiers.few.multiplier <= 1);
  assert.ok(packageModifiers.medium.multiplier <= 1.08);
  assert.ok(packageModifiers.many.multiplier <= 1.15);
  assert.ok(packageModifiers.hundred.multiplier <= 1.21);
});

test("keeps seller break labels as an audit-only fallback", async () => {
  const result = await audit([{
    post_hash: "seller-break-label",
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
    seller_break_label: "微斷",
  }]);
  assert.equal(result.segments.breakClass.slight.sampleCount, 1);
});

test("reduces inferred and structured start-season evidence weight", async () => {
  const base = {
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  };
  const result = await audit([
    { ...base, post_hash: "explicit", start_season_confidence: "explicit" },
    { ...base, post_hash: "structured", start_season_confidence: "structured" },
    { ...base, post_hash: "inferred", start_season_confidence: "inferred" },
    { ...base, post_hash: "unknown", start_season_confidence: "unknown" },
  ]);
  assert.equal(result.segments.startSeason.assembly.sampleCount, 3);
  assert.equal(result.segments.startSeason.assembly.effectiveWeight, 2.25);
  assert.deepEqual(result.segments.startSeason.assembly.qualityBreakdown, {
    high: 3,
    medium: 0,
    low: 0,
  });
  assert.deepEqual(result.segments.startSeason.assembly.sourceBreakdown, {
    unknown: 3,
  });
});

test("aggregate is stable when source rows arrive in a different order", async () => {
  const rows = [
    { post_hash: "one", published_at: recent, price_twd: 2000, evidence_kind: "ask", evidence_quality: "high", start_season_slug: "assembly", start_season_confidence: "inferred" },
    { post_hash: "two", published_at: recent, price_twd: 4000, evidence_kind: "sold", evidence_quality: "medium", start_season_slug: "assembly", start_season_confidence: "structured" },
  ];
  const first = await audit(rows);
  const second = await audit([...rows].reverse());
  assert.deepEqual(first, second);
});

test("keeps the strongest evidence when the same account is relisted", async () => {
  const result = await audit([
    {
      post_hash: "first-listing",
      account_hash: "relist-0",
      published_at: "2025-01-01T00:00:00.000Z",
      price_twd: 11000,
      evidence_kind: "sold",
      evidence_quality: "high",
      start_season_slug: "aurora",
    },
    {
      post_hash: "later-asking-price",
      account_fingerprint: "relist-0",
      published_at: "2025-06-01T00:00:00.000Z",
      price_twd: 24000,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "aurora",
    },
    {
      post_hash: "newest-sold-price",
      account_hash: "relist-0",
      published_at: "2025-07-01T00:00:00.000Z",
      price_twd: 13000,
      evidence_kind: "sold",
      evidence_quality: "high",
      start_season_slug: "aurora",
    },
  ]);
  assert.deepEqual(
    [result.eligibleRows, result.uniqueAccountRows, result.relistedAccountRows],
    [1, 1, 2],
  );
  assert.equal(result.seasons.aurora.median, 13000);
});

test("splits identified accounts as deterministic whole groups while anonymous rows stay in calibration", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ([
    {
      post_hash: `account-${index}-old`,
      account_hash: `account-${index}`,
      published_at: "2025-01-01T00:00:00.000Z",
      price_twd: 5000 + index,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "assembly",
    },
    {
      post_hash: `account-${index}-new`,
      account_fingerprint: `account-${index}`,
      published_at: "2025-02-01T00:00:00.000Z",
      price_twd: 6000 + index,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "assembly",
    },
  ])).flat();
  rows.push({
    post_hash: "anonymous",
    published_at: recent,
    price_twd: 7000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  });
  const first = await audit(rows, { splitSeed: "stable-split" });
  const second = await audit([...rows].reverse(), { splitSeed: "stable-split" });
  assert.deepEqual(first, second);
  assert.equal(first.relistedAccountRows, 20);
  assert.equal(first.uniqueAccountRows, 20);
  assert.equal(first.anonymousEligibleRows, 1);
  assert.equal(first.split.calibrationRows + first.split.holdoutRows, 21);
  assert.equal(first.split.anonymousCalibrationRows, 1);
});

test("uses the same account identity aliases as model validation", async () => {
  const result = await audit(
    Array.from({ length: 30 }, (_, index) => ({
      post_hash: `post-${index}`,
      account_group_hash: `account-${index}`,
      published_at: recent,
      price_twd: 5000 + index,
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "assembly",
    })),
    { splitSeed: "fixture" },
  );
  assert.equal(result.uniqueAccountRows, 30);
  assert.equal(result.anonymousEligibleRows, 0);
  assert.ok(result.split.holdoutRows > 0);
  assert.equal(
    result.split.calibrationRows + result.split.holdoutRows,
    result.uniqueAccountRows,
  );
});

test("caps unlinked legacy rows to ten percent once identified accounts exist", async () => {
  const identified = Array.from({ length: 20 }, (_, index) => ({
    post_hash: `identified-${index}`,
    account_fingerprint: `account-${index}`,
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  }));
  const anonymous = Array.from({ length: 100 }, (_, index) => ({
    post_hash: `anonymous-${index}`,
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  }));
  const result = await audit([...identified, ...anonymous], {
    splitSeed: "fixture",
  });
  assert.equal(result.uniqueAccountRows, 20);
  assert.equal(result.anonymousEligibleRows, 100);
  assert.equal(result.anonymousCalibration.capped, true);
  assert.ok(result.anonymousCalibration.effectiveShare <= 0.1);
});

test("keeps anonymous rows at ten percent after a conflicting group cap", async () => {
  const identified = Array.from({ length: 100 }, (_, index) => ({
    post_hash: `identified-conflict-${index}`,
    account_fingerprint: `conflict-account-${index}`,
    group_hash: "identified-group",
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  }));
  const anonymous = Array.from({ length: 10 }, (_, index) => ({
    post_hash: `anonymous-conflict-${index}`,
    group_hash: "anonymous-group",
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  }));
  const result = await audit([...identified, ...anonymous], {
    splitSeed: "fixture",
    includeHoldout: true,
  });
  assert.deepEqual(result.groupConcentration, {
    groupCount: 1,
    largestEffectiveShare: 1,
    cap: 0.6,
    capped: false,
    sampleScope: "identified-accounts",
  });
  assert.equal(result.anonymousCalibration.capped, true);
  assert.ok(result.anonymousCalibration.effectiveShare <= 0.1);
});

test("caps a dominant source group at sixty percent of calibration weight", async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({
    post_hash: `dominant-${index}`,
    group_hash: "dominant-private-group",
    published_at: recent,
    price_twd: 10000 + index,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "duets",
  }));
  rows.push({
    post_hash: "other-group",
    group_hash: "other-private-group",
    published_at: recent,
    price_twd: 20000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "duets",
  });
  const result = await audit(rows);
  assert.deepEqual(result.groupConcentration, {
    groupCount: 2,
    largestEffectiveShare: 0.6,
    cap: 0.6,
    capped: true,
    sampleScope: "legacy-anonymous",
  });
  assert.equal(result.segments.startSeason.duets.effectiveWeight, 2.5);
});

test("keeps identical market rows distinct while applying group weights", async () => {
  const rows = [
    ["account-a", "group-a"],
    ["account-b", "group-a"],
    ["account-c", "group-b"],
  ].map(([account, group]) => ({
    account_fingerprint: account,
    group_hash: group,
    published_at: recent,
    price_twd: 10000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "duets",
  }));
  const result = await audit(rows, { includeHoldout: true });
  assert.equal(result.seasons.duets.effectiveWeight, 2.5);
  assert.equal(result.segments.startSeason.duets.effectiveWeight, 2.5);
  assert.equal(result.split.trainingEffectiveWeight, 2.5);
  assert.equal(
    result.split.calibrationEffectiveWeight + result.split.holdoutEffectiveWeight,
    result.split.trainingEffectiveWeight,
  );
});

test("does not emit raw post, account, group, text, URL, or author fields", async () => {
  const result = await audit([{
    post_hash: "private-post-hash",
    account_hash: "private-account-hash",
    group_hash: "private-group-hash",
    author: "private-author",
    url: "https://example.test/private",
    listing_text: "private listing text",
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "moomin",
  }]);
  const output = JSON.stringify(result);
  for (const value of [
    "private-post-hash",
    "private-account-hash",
    "private-group-hash",
    "private-author",
    "example.test",
    "private listing text",
  ]) assert.equal(output.includes(value), false);
  assert.equal(result.schemaVersion, 4);
});
