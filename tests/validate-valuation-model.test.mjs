import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateMatchesRebuild,
  officialValuationSplitSeed,
  parseValidationArgs,
  predictValuationAggregate,
  validateValuationModel as validateModelWithoutRebuild,
  valuationModelArtifactDigest,
  withDerivedSeasonBands,
} from "../scripts/validate-valuation-model.mjs";
import {
  accountStyles,
  breakClasses,
  hasCompleteModelEvidence,
  holdoutSplitCommitmentFor,
  inHoldout as sharedInHoldout,
  modelEvidenceSignatureFor,
  packageTiers,
  valuationDatasetDigestFor,
} from "../scripts/lib/valuation-source-core.mjs";

const testHashSalt = "validator-test-hash-salt-32-characters-minimum";
const testHoldoutSecret = "validator-test-holdout-secret-32-characters-minimum";
const inHoldout = (accountKey, seed = officialValuationSplitSeed) =>
  sharedInHoldout(accountKey, seed, { splitSecret: testHoldoutSecret });
const validateValuationModel = (options) => {
  const candidate = structuredClone(options.candidate);
  candidate.split = {
    ...candidate.split,
    strategy: "secret-hmac-v1",
    datasetDigest: valuationDatasetDigestFor(options.rows),
    splitCommitment: holdoutSplitCommitmentFor(
      options.splitSeed ?? officialValuationSplitSeed,
      testHoldoutSecret,
    ),
  };
  return validateModelWithoutRebuild({
    ...options,
    candidate,
    rebuiltCandidate: options.rebuiltCandidate ?? candidate,
    hashSalt: testHashSalt,
    splitSecret: testHoldoutSecret,
    expectedBaselineDigest:
      options.expectedBaselineDigest ?? valuationModelArtifactDigest(options.baseline),
  });
};

test("parses repeated validation source files", () => {
  assert.deepEqual(parseValidationArgs([
    "--candidate", "candidate.json",
    "--source", "one.jsonl",
    "--baseline", "baseline.json",
    "--source", "two.jsonl",
    "--split-seed=custom",
  ]), {
    candidatePath: "candidate.json",
    baselinePath: "baseline.json",
    sourcePaths: ["one.jsonl", "two.jsonl"],
    splitSeed: "custom",
  });
});

test("does not treat another flag as a missing source value", () => {
  assert.deepEqual(parseValidationArgs([
    "--candidate", "candidate.json",
    "--source",
    "--baseline", "baseline.json",
  ]).sourcePaths, []);
});
import {
  deriveSeasonBands,
  replaySeasonProgressEndSlug,
  seasonBandSeeds,
} from "../app/valuation-season-band-core.js";
import { calculateValuationModel } from "../app/valuation-model-core.js";

const completeSeasonProgress = (startSlug, overrides = {}) => {
  const startIndex = seasonBandSeeds.findIndex((seed) => seed.slug === startSlug);
  const endIndex = seasonBandSeeds.findIndex(
    (seed) => seed.slug === replaySeasonProgressEndSlug,
  );
  return Object.fromEntries(
    seasonBandSeeds
      .slice(startIndex, endIndex + 1)
      .map(({ slug }) => [slug, overrides[slug] ?? "畢"]),
  );
};

const aggregate = (median, { fullModel = false, status = "unvalidated" } = {}) => ({
  schemaVersion: 4,
  validationStatus: status,
  ...(fullModel
    ? {
        provenance: {
          modelSchemaVersion: 3,
          predictorSchema: "valuation_model",
          seasonProgressEndSlug: replaySeasonProgressEndSlug,
        },
      }
    : {}),
  asOf: "2026-08-31",
  split: {
    splitSeed: officialValuationSplitSeed,
    trainingMode: "calibration-only",
  },
  segments: {
    startSeason: Object.fromEntries(
      seasonBandSeeds.map(({ slug }) => [slug, {
        p25: median * 0.9,
        median,
        p75: median * 1.1,
        sampleCount: 8,
        effectiveWeight: 8,
      }]),
    ),
  },
  modifiers: {
    breakClass: Object.fromEntries(breakClasses.map((value) => [value, { multiplier: 1 }])),
    packageTier: Object.fromEntries(packageTiers.map((value) => [value, { multiplier: 1 }])),
    accountStyle: Object.fromEntries(accountStyles.map((value) => [value, { multiplier: 1 }])),
  },
});
const modelFeatures = {
  baseLow: 8000,
  baseHigh: 12000,
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
const completedSeasonSeeds = seasonBandSeeds.slice(
  0,
  seasonBandSeeds.findIndex(({ slug }) => slug === replaySeasonProgressEndSlug) + 1,
);
let fingerprintCursor = 1;
const nextFingerprint = (holdout) => {
  while (true) {
    const fingerprint = fingerprintCursor.toString(16).padStart(64, "0");
    fingerprintCursor += 1;
    if (inHoldout(fingerprint, officialValuationSplitSeed) === holdout) {
      return fingerprint;
    }
  }
};
const fixtureFingerprints = Array.from(
  { length: 500 },
  (_, index) => nextFingerprint(index < 100),
);
const unsignedRows = Array.from({ length: 500 }, (_, index) => {
  const startSeason = completedSeasonSeeds[index % completedSeasonSeeds.length].slug;
  return ({
  account_group_hash: `account-${index}`,
  account_fingerprint: fixtureFingerprints[index],
  snapshot_hash: (index + 1_000).toString(16).padStart(64, "0"),
  identity_namespace: "c".repeat(64),
  account_identity_scheme: "stable-hmac-v1",
  inventory_complete: true,
  bindings_complete: true,
  valuation_model_schema_version: 3,
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
  group_hash: `market-${index % 3}`,
  published_at: "2026-08-01",
  price_twd: [10000, 10000, 10000, 8500, 11500][index % 5],
  evidence_kind: "ask",
  evidence_quality: "high",
  start_season_slug: startSeason,
  computed_break_class: breakClasses[index % breakClasses.length],
  computed_package_tier: packageTiers[index % packageTiers.length],
  account_style: accountStyles[index % accountStyles.length],
  season_progress: completeSeasonProgress(startSeason),
  season_progress_end_slug: replaySeasonProgressEndSlug,
  valuation_model: modelFeatures,
  });
});
const signEvidenceRow = (row) => ({
  ...row,
  evidence_signature: modelEvidenceSignatureFor(row, testHashSalt),
});
const rows = unsignedRows.map(signEvidenceRow);
const predictionForRow = (aggregateValue, row) =>
  predictValuationAggregate(
    withDerivedSeasonBands(aggregateValue),
    {
      startSeason: row.start_season_slug,
      breakClass: row.computed_break_class,
      packageTier: row.computed_package_tier,
      accountStyle: row.account_style,
      row,
      modelFeatures: row.valuation_model,
    },
    { assumeValidated: true },
  );
const priceHoldoutRows = (sourceRows, candidate, baseline, priceForPrediction) =>
  sourceRows.map((row, index) => {
    if (!inHoldout(row.account_fingerprint, officialValuationSplitSeed)) return row;
    const candidatePrediction = predictionForRow(candidate, row);
    const baselinePrediction = predictionForRow(baseline, row);
    assert.ok(candidatePrediction);
    assert.ok(baselinePrediction);
    return signEvidenceRow({
      ...row,
      price_twd: priceForPrediction(
        candidatePrediction,
        baselinePrediction,
        index,
        row,
      ),
    });
  });

test("validator predictor uses the browser's blended season low, midpoint, and high", () => {
  const candidate = aggregate(10000, { fullModel: true });
  candidate.segments.startSeason = Object.fromEntries(
    seasonBandSeeds.map((seed, index) => [
      seed.slug,
      {
        p25: 10000 - index * 100,
        median: 11000 - index * 100,
        p75: 12000 - index * 100,
        sampleCount: 8,
        effectiveWeight: 4,
      },
    ]),
  );
  const browserBand = deriveSeasonBands(candidate, seasonBandSeeds).find(
    (band) => band.slug === "assembly",
  );
  assert.ok(browserBand);
  const sample = {
    startSeason: "assembly",
    breakClass: "none",
    packageTier: "few",
    accountStyle: "regular",
    row: {
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly"),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    modelFeatures,
  };
  const expected = calculateValuationModel({
    ...modelFeatures,
    baseLow: browserBand.low,
    baseHigh: browserBand.high,
  });
  const actual = predictValuationAggregate(withDerivedSeasonBands(candidate), sample);
  assert.deepEqual(actual, {
    low: expected.low,
    high: expected.high,
    price: expected.midpoint,
  });
});

test("schema v3 replays partial-season discounts and confidence from the candidate", () => {
  const candidate = aggregate(10000, { fullModel: true });
  Object.assign(candidate.segments.startSeason.assembly, {
    evidenceBreakdown: { sold: 8 },
    qualityBreakdown: { high: 8 },
    sourceBreakdown: { first: 4, second: 4 },
  });
  const replay = withDerivedSeasonBands(candidate);
  const segment = replay.segments.startSeason.assembly;
  const staleFeatures = {
    ...modelFeatures,
    partialDiscountLow: 9999,
    partialDiscountHigh: 9999,
    confidence: "low",
  };
  const sample = {
    startSeason: "assembly",
    breakClass: "none",
    packageTier: "few",
    accountStyle: "regular",
    row: {
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly", { assembly: "1/4" }),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    modelFeatures: staleFeatures,
  };
  const expected = calculateValuationModel({
    ...staleFeatures,
    baseLow: segment.p25,
    baseHigh: segment.p75,
    partialDiscountLow: segment.contributionLow * 0.75,
    partialDiscountHigh: segment.contributionHigh * 0.75,
    confidence: "high",
  });
  assert.deepEqual(
    predictValuationAggregate(replay, sample, { assumeValidated: true }),
    { low: expected.low, high: expected.high, price: expected.midpoint },
  );
  assert.equal(
    predictValuationAggregate(replay, { ...sample, row: {} }, {
      assumeValidated: true,
    }),
    null,
  );
});

test("schema v3 rejects unknown, incomplete, or mismatched season progress", () => {
  const replay = withDerivedSeasonBands(aggregate(10000, { fullModel: true }));
  const sample = {
    startSeason: "assembly",
    breakClass: "none",
    packageTier: "few",
    accountStyle: "regular",
    modelFeatures,
  };
  const missingMiddle = completeSeasonProgress("assembly");
  delete missingMiddle.duets;
  const invalidRows = [
    {
      start_season_slug: "assembly",
      season_progress: {
        ...completeSeasonProgress("assembly"),
        "not-a-season": "畢",
      },
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    {
      start_season_slug: "assembly",
      season_progress: missingMiddle,
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    {
      start_season_slug: "rhythm",
      season_progress: completeSeasonProgress("rhythm"),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    {
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly"),
      season_progress_end_slug: "assembly",
    },
    {
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly", { assembly: "0" }),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    ...["1/2", "1/999"].map((assembly) => ({
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly", { assembly }),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    })),
  ];
  for (const row of invalidRows)
    assert.equal(
      predictValuationAggregate(replay, { ...sample, row }, {
        assumeValidated: true,
      }),
      null,
    );
});

test("keeps an explicit canonical start season when the raw baseline segment is sparse", () => {
  const baseline = aggregate(8000);
  const candidate = aggregate(10000, { fullModel: true });
  for (const value of [baseline, candidate]) {
    value.segments.startSeason.gratitude = {
      p25: null,
      median: null,
      p75: null,
      sampleCount: 0,
      effectiveWeight: 0,
    };
    value.segments.startSeason.lightseekers = {
      p25: 9000,
      median: 10000,
      p75: 11000,
      sampleCount: 5,
      effectiveWeight: 5,
    };
  }
  const explicitGratitude = {
    ...rows[0],
    start_season_slug: "gratitude",
    season_progress: completeSeasonProgress("gratitude"),
    season_progress_end_slug: replaySeasonProgressEndSlug,
  };
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: [explicitGratitude],
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, 1);
  assert.equal(report.eligibleRows, 1);
  assert.equal(report.criteria.completeModelPredictors.actual, 1);
});

test("schema v3 requires valid replay classifications and candidate modifiers", () => {
  const candidate = withDerivedSeasonBands(aggregate(10000, { fullModel: true }));
  const sample = {
    startSeason: "assembly",
    breakClass: "none",
    packageTier: "few",
    accountStyle: "regular",
    row: {
      start_season_slug: "assembly",
      season_progress: completeSeasonProgress("assembly"),
      season_progress_end_slug: replaySeasonProgressEndSlug,
    },
    modelFeatures,
  };
  for (const changes of [
    { breakClass: null },
    { packageTier: "unknown" },
    { accountStyle: undefined },
  ])
    assert.equal(
      predictValuationAggregate(candidate, { ...sample, ...changes }, {
        assumeValidated: true,
      }),
      null,
    );
  const missingModifier = structuredClone(candidate);
  delete missingModifier.modifiers.breakClass.none;
  assert.equal(
    predictValuationAggregate(missingModifier, sample, { assumeValidated: true }),
    null,
  );
});

test("passes a deterministic anonymous holdout when candidate materially improves error", () => {
  const candidate = aggregate(14000, { fullModel: true });
  const baseline = aggregate(8000);
  const fittedRows = priceHoldoutRows(
    rows,
    candidate,
    baseline,
    (prediction, _baseline, index) =>
      index % 5 === 0 ? prediction.high * 1.5 : prediction.price,
  );
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: fittedRows,
  });
  assert.equal(report.outcome, "pass");
  assert.equal(report.sourceEligibleRows, 500);
  assert.equal(report.eligibleRows, 500);
  assert.equal(report.criteria.marketGroups.actual, 3);
  assert.equal(report.criteria.candidateModifierCoverage.pass, true);
  assert.equal(report.criteria.seasonHoldoutCoverage.pass, true);
  assert.equal(report.criteria.modifierHoldoutCoverage.pass, true);
  assert.ok(report.candidate.p25P75Coverage >= 0.5);
  assert.ok(report.candidate.p25P75Coverage <= 0.9);
  assert.ok(report.candidate.medianAbsoluteLogError < report.baseline.medianAbsoluteLogError);
  assert.equal(/"account-|"market-|price_twd/.test(JSON.stringify(report)), false);
});

test("requires a separate private holdout secret and frozen dataset digest", () => {
  const candidate = aggregate(14000, { fullModel: true });
  const baseline = aggregate(8000);
  candidate.split = {
    ...candidate.split,
    strategy: "secret-hmac-v1",
    datasetDigest: valuationDatasetDigestFor(rows),
    splitCommitment: holdoutSplitCommitmentFor(
      officialValuationSplitSeed,
      testHoldoutSecret,
    ),
  };
  const common = {
    candidate,
    rebuiltCandidate: candidate,
    baseline,
    rows,
    hashSalt: testHashSalt,
    expectedBaselineDigest: valuationModelArtifactDigest(baseline),
  };
  const missingSecret = validateModelWithoutRebuild({
    ...common,
    splitSecret: "",
  });
  const reusedEvidenceSecret = validateModelWithoutRebuild({
    ...common,
    splitSecret: testHashSalt,
  });
  assert.equal(missingSecret.criteria.candidateProvenance.pass, false);
  assert.equal(reusedEvidenceSecret.criteria.candidateProvenance.pass, false);
});

test("rejects a cherry-picked holdout containing only one of two hundred accounts", () => {
  const selectedFingerprints = [];
  let candidateIndex = 10_000;
  while (selectedFingerprints.length < 200) {
    const fingerprint = candidateIndex.toString(16).padStart(64, "0");
    const shouldSelect = selectedFingerprints.length === 199
      ? inHoldout(fingerprint, officialValuationSplitSeed)
      : !inHoldout(fingerprint, officialValuationSplitSeed);
    if (shouldSelect) selectedFingerprints.push(fingerprint);
    candidateIndex += 1;
  }
  const cherryPickedRows = rows.slice(0, 200).map((row, index) => ({
    ...row,
    account_group_hash: `cherry-picked-${index}`,
    account_fingerprint: selectedFingerprints[index],
    snapshot_hash: (candidateIndex + index).toString(16).padStart(64, "0"),
  }));
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: cherryPickedRows,
  });
  assert.equal(report.holdoutRows, 1);
  assert.equal(report.criteria.holdout.minimum, 30);
  assert.equal(report.criteria.holdout.pass, false);
  assert.equal(report.outcome, "fail");
});

test("ignores source-supplied weights that hide most holdout errors", () => {
  let favorableRows = 0;
  const candidateFavoredFingerprints = new Set();
  const candidate = aggregate(14000, { fullModel: true });
  const baseline = aggregate(8000);
  const manipulatedWeights = priceHoldoutRows(
    rows,
    candidate,
    baseline,
    (candidatePrediction, baselinePrediction, _index, row) => {
      const favorsCandidate = favorableRows < 3;
      favorableRows += 1;
      if (favorsCandidate) candidateFavoredFingerprints.add(row.account_fingerprint);
      return favorsCandidate ? candidatePrediction.price : baselinePrediction.price;
    },
  ).map((row) => ({
    ...row,
    effective_weight: candidateFavoredFingerprints.has(row.account_fingerprint)
      ? 1
      : 1e-12,
    sample_weight: candidateFavoredFingerprints.has(row.account_fingerprint)
      ? 1
      : 1e-12,
  }));
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: manipulatedWeights,
  });
  assert.ok(favorableRows >= 30);
  assert.equal(report.criteria.holdout.pass, true);
  assert.equal(report.criteria.accuracy.status, "fail");
  assert.equal(report.outcome, "fail");
});

test("requires a bias justification rather than automatically passing a near-neutral candidate", () => {
  const candidate = aggregate(16500, { fullModel: true });
  const baseline = aggregate(18000);
  const neutralRows = priceHoldoutRows(
    rows,
    candidate,
    baseline,
    (candidatePrediction, baselinePrediction, index) => {
      const midpoint = Math.sqrt(candidatePrediction.price * baselinePrediction.price);
      return index % 5 === 0 ? midpoint * 2 : midpoint;
    },
  );
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: neutralRows,
  });
  assert.equal(report.criteria.accuracy.status, "needsBiasJustification");
  assert.equal(report.outcome, "needsBiasJustification");
});

test("requires holdout evidence for every completed season and modifier class", () => {
  const singleDimensionRows = rows.map((row) => ({
    ...row,
    start_season_slug: "assembly",
    season_progress: completeSeasonProgress("assembly"),
    computed_break_class: "none",
    computed_package_tier: "few",
    account_style: "regular",
  }));
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: singleDimensionRows,
  });
  assert.ok(report.criteria.seasonHoldoutCoverage.missingEligible.includes("gratitude"));
  assert.ok(
    report.criteria.modifierHoldoutCoverage.dimensions.breakClass.missingEligible
      .includes("big"),
  );
  assert.ok(
    report.criteria.modifierHoldoutCoverage.dimensions.packageTier.missingHoldout
      .includes("hundred"),
  );
  assert.ok(
    report.criteria.modifierHoldoutCoverage.dimensions.accountStyle.missingEligible
      .includes("simple"),
  );
  assert.equal(report.criteria.seasonHoldoutCoverage.pass, false);
  assert.equal(report.criteria.modifierHoldoutCoverage.pass, false);
  assert.equal(report.outcome, "fail");
});

test("rejects catastrophic season errors hidden by a good overall median", () => {
  const candidate = aggregate(14000, { fullModel: true });
  const baseline = aggregate(8000);
  const mostlyAccurateRows = priceHoldoutRows(
    rows,
    candidate,
    baseline,
    (prediction) => prediction.price,
  );
  const seasonBiasedRows = mostlyAccurateRows.map((row) => {
    if (
      row.start_season_slug !== "gratitude" ||
      !inHoldout(row.account_fingerprint, officialValuationSplitSeed)
    ) return row;
    const prediction = predictionForRow(candidate, row);
    assert.ok(prediction);
    return signEvidenceRow({ ...row, price_twd: prediction.price * 10 });
  });
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: seasonBiasedRows,
  });
  assert.equal(report.criteria.accuracy.status, "pass");
  assert.ok(report.criteria.seasonAccuracy.failing.includes("gratitude"));
  assert.equal(report.criteria.seasonAccuracy.pass, false);
  assert.equal(report.outcome, "fail");
});

test("rejects one catastrophic error among two season holdout rows", () => {
  const candidate = aggregate(14000, { fullModel: true });
  const baseline = aggregate(8000);
  const accurateRows = priceHoldoutRows(
    rows,
    candidate,
    baseline,
    (prediction) => prediction.price,
  );
  let gratitudeHoldoutCount = 0;
  const twoGratitudeHoldouts = accurateRows.map((row) => {
    if (
      row.start_season_slug !== "gratitude" ||
      !inHoldout(row.account_fingerprint, officialValuationSplitSeed)
    ) return row;
    gratitudeHoldoutCount += 1;
    if (gratitudeHoldoutCount > 2) {
      return signEvidenceRow({
        ...row,
        start_season_slug: "lightseekers",
        season_progress: completeSeasonProgress("lightseekers"),
      });
    }
    if (gratitudeHoldoutCount === 2) {
      const prediction = predictionForRow(candidate, row);
      assert.ok(prediction);
      return signEvidenceRow({ ...row, price_twd: prediction.price * 10 });
    }
    return row;
  });
  assert.equal(gratitudeHoldoutCount >= 2, true);
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: twoGratitudeHoldouts,
  });
  assert.equal(
    report.criteria.seasonAccuracy.metrics.gratitude.candidate.count,
    2,
  );
  assert.ok(report.criteria.seasonAccuracy.failing.includes("gratitude"));
  assert.equal(report.outcome, "fail");
});

test("requires every candidate modifier value even when source coverage is complete", () => {
  const candidate = aggregate(14000, { fullModel: true });
  delete candidate.modifiers.packageTier.hundred;
  const report = validateValuationModel({
    candidate,
    baseline: aggregate(8000),
    rows,
  });
  assert.deepEqual(report.criteria.candidateModifierCoverage.missing.packageTier, [
    "hundred",
  ]);
  assert.equal(report.criteria.candidateModifierCoverage.pass, false);
  assert.equal(report.outcome, "fail");
});

test("requires the candidate model artifact to match a calibration-only rebuild", () => {
  const rebuiltCandidate = aggregate(14000, { fullModel: true });
  const forgedCandidate = structuredClone(rebuiltCandidate);
  forgedCandidate.segments.startSeason.assembly.median += 1000;
  assert.equal(candidateMatchesRebuild(rebuiltCandidate, rebuiltCandidate), true);
  assert.equal(candidateMatchesRebuild(forgedCandidate, rebuiltCandidate), false);

  const forgedReport = validateValuationModel({
    candidate: forgedCandidate,
    rebuiltCandidate,
    baseline: aggregate(8000),
    rows,
  });
  assert.equal(forgedReport.criteria.candidateRebuild.pass, false);
  assert.equal(forgedReport.outcome, "fail");

  const unverifiedReport = validateModelWithoutRebuild({
    candidate: rebuiltCandidate,
    baseline: aggregate(8000),
    rows,
  });
  assert.equal(unverifiedReport.criteria.candidateRebuild.pass, false);
  assert.equal(unverifiedReport.outcome, "fail");
});

test("never promotes legacy data even if it otherwise resembles a passing aggregate", () => {
  const legacy = {
    ...aggregate(10000, { fullModel: true, status: "legacy-unvalidated" }),
    schemaVersion: 3,
  };
  const report = validateValuationModel({
    candidate: legacy,
    baseline: aggregate(8000),
    rows,
    splitSeed: "fixture",
  });
  assert.equal(report.outcome, "legacy-unvalidated");
  assert.equal(report.criteria.candidateProvenance.pass, false);
});

test("rejects a candidate that declares a shortened season replay scope", () => {
  const shortened = aggregate(14000, { fullModel: true });
  shortened.provenance.seasonProgressEndSlug = "assembly";
  const report = validateValuationModel({
    candidate: shortened,
    baseline: aggregate(8000),
    rows,
    splitSeed: "fixture",
  });
  assert.equal(report.criteria.candidateProvenance.pass, false);
  assert.equal(report.criteria.completeModelPredictors.actual, 0);
  assert.equal(report.outcome, "fail");
});

test("requires complete full-model predictors before a current aggregate can pass", () => {
  const incomplete = rows.map((row, index) =>
    index === 0 ? { ...row, valuation_model: undefined } : row,
  );
  const report = validateValuationModel({
    candidate: aggregate(20000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: incomplete,
    splitSeed: "fixture",
  });
  assert.equal(report.criteria.completeModelPredictors.pass, false);
  assert.equal(report.outcome, "fail");
});

test("requires explicit identity, wardrobe, and binding evidence for every predictor", () => {
  for (const key of [
    "account_fingerprint",
    "snapshot_hash",
    "identity_namespace",
    "account_identity_scheme",
    "inventory_complete",
    "bindings_complete",
    "valuation_model_schema_version",
  ]) {
    const incomplete = rows.map((row, index) =>
      index === 0 ? { ...row, [key]: undefined } : row,
    );
    const report = validateValuationModel({
      candidate: aggregate(20000, { fullModel: true }),
      baseline: aggregate(8000),
      rows: incomplete,
      splitSeed: "fixture",
    });
    assert.equal(report.criteria.completeModelPredictors.pass, false, key);
    if (key === "identity_namespace") {
      assert.equal(report.criteria.identityNamespaceConsistency.pass, false);
    }
    assert.equal(report.outcome, "fail", key);
  }
});

test("rejects any tampering with signed model evidence inputs", () => {
  const original = rows[0];
  assert.equal(
    hasCompleteModelEvidence(original, { hashSalt: testHashSalt }),
    true,
  );
  for (const mutated of [
    { ...original, price_twd: original.price_twd + 1 },
    { ...original, group_hash: "forged-group" },
    { ...original, evidence_quality: "low" },
    { ...original, observed_at: "2026-09-06T00:00:00.000Z" },
    { ...original, listing_text: "國服" },
    { ...original, account_features: "USD 100" },
    { ...original, exclude_from_model: true },
  ]) {
    assert.equal(
      hasCompleteModelEvidence(mutated, { hashSalt: testHashSalt }),
      false,
    );
    const report = validateValuationModel({
      candidate: aggregate(14000, { fullModel: true }),
      baseline: aggregate(8000),
      rows: [mutated, ...rows.slice(1)],
    });
    assert.equal(report.criteria.authenticatedModelEvidence.invalid, 1);
    assert.equal(report.criteria.authenticatedModelEvidence.pass, false);
    assert.equal(report.outcome, "fail");
  }
});

test("deduplicates identical signed snapshots across different account ids", () => {
  const duplicate = signEvidenceRow({
    ...unsignedRows[1],
    snapshot_hash: unsignedRows[0].snapshot_hash,
  });
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: [rows[0], duplicate, ...rows.slice(2)],
  });
  assert.equal(report.sourceEligibleRows, rows.length - 1);
  assert.equal(report.eligibleRows, rows.length - 1);
});

test("does not validate against rows explicitly excluded from the model", () => {
  const excluded = rows.map((row, index) =>
    index === 0 ? { ...row, exclude_from_model: true } : row,
  );
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: excluded,
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, rows.length - 1);
  assert.equal(report.eligibleRows, rows.length - 1);
});

test("rejects an unsigned row that collides with authenticated identity", () => {
  const signed = rows[0];
  const collision = {
    account_group_hash: signed.account_fingerprint,
    post_hash: "unsigned-collision",
    published_at: "2026-08-30",
    price_twd: 1,
    evidence_kind: "sold",
    evidence_quality: "high",
    start_season_slug: "not-a-season",
  };
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: [signed, collision, ...rows.slice(1)],
  });
  assert.equal(report.criteria.unsignedIdentityCollisions.actual, 1);
  assert.equal(report.criteria.unsignedIdentityCollisions.pass, false);
  assert.equal(report.outcome, "fail");
});

test("candidate market parameters materially change full-model predictions", () => {
  const accurate = validateValuationModel({
    candidate: aggregate(20000, { fullModel: true }),
    baseline: aggregate(8000),
    rows,
  });
  const distorted = validateValuationModel({
    candidate: aggregate(999999, { fullModel: true }),
    baseline: aggregate(8000),
    rows,
  });
  assert.notDeepEqual(distorted.candidate, accurate.candidate);
  assert.ok(
    distorted.candidate.medianAbsoluteLogError >
      accurate.candidate.medianAbsoluteLogError,
  );
});

test("candidate package calibration changes full-model predictions", () => {
  const packageRows = rows.map((row) => signEvidenceRow({
    ...row,
    valuation_model: {
      ...row.valuation_model,
      packageLow: 1000,
      packageHigh: 1500,
    },
  }));
  const regular = aggregate(10000, { fullModel: true });
  const premium = aggregate(10000, { fullModel: true });
  premium.modifiers.packageTier.few.multiplier = 2;
  const regularReport = validateValuationModel({
    candidate: regular,
    baseline: aggregate(8000),
    rows: packageRows,
    splitSeed: "fixture",
  });
  const premiumReport = validateValuationModel({
    candidate: premium,
    baseline: aggregate(8000),
    rows: packageRows,
    splitSeed: "fixture",
  });
  assert.notDeepEqual(premiumReport.candidate, regularReport.candidate);
});

test("rejects predictors missing style multiplier or confidence", () => {
  for (const key of ["accountStyleMultiplier", "confidence"]) {
    const incomplete = rows.map((row, index) =>
      index === 0
        ? {
            ...row,
            valuation_model: Object.fromEntries(
              Object.entries(row.valuation_model).filter(([name]) => name !== key),
            ),
          }
        : row,
    );
    const report = validateValuationModel({
      candidate: aggregate(10000, { fullModel: true }),
      baseline: aggregate(8000),
      rows: incomplete,
      splitSeed: "fixture",
    });
    assert.equal(report.criteria.completeModelPredictors.pass, false, key);
    assert.equal(report.outcome, "fail", key);
  }
});

test("fails safety gates for concentrated or undersized samples", () => {
  const report = validateValuationModel({ candidate: aggregate(100), baseline: aggregate(80), rows: rows.slice(0, 40).map((row) => ({ ...row, group_hash: "only" })), splitSeed: "fixture" });
  assert.equal(report.outcome, "fail");
  assert.equal(report.criteria.minimumEligibleRows.pass, false);
  assert.equal(report.criteria.marketGroups.pass, false);
  assert.equal(report.criteria.maximumGroupEffectiveShare.pass, false);
});

test("requires holdout evidence from multiple unconcentrated market groups", () => {
  const concentratedHoldout = rows.map((row) =>
    signEvidenceRow({
      ...row,
      group_hash: inHoldout(row.account_fingerprint, officialValuationSplitSeed)
        ? "holdout-only"
        : row.group_hash,
    }),
  );
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: concentratedHoldout,
  });
  assert.equal(report.criteria.marketGroups.pass, true);
  assert.equal(report.criteria.holdoutMarketGroups.pass, false);
  assert.equal(report.criteria.holdoutMaximumGroupEffectiveShare.pass, false);
  assert.equal(report.outcome, "fail");
});

test("uses the same strict point-price and canonical market-group ingestion as audit", () => {
  const stringPriceRows = rows.map((row, index) =>
    index === 0 ? { ...row, price_twd: "10000" } : row,
  );
  const strictPriceReport = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: stringPriceRows,
  });
  assert.equal(strictPriceReport.sourceEligibleRows, 499);

  const aliasedGroups = rows.map((row, index) => {
    const rest = { ...row };
    delete rest.group_hash;
    return signEvidenceRow({
      ...rest,
      market_group_hash: `market-${index % 3}   `,
    });
  });
  const groupReport = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: aliasedGroups,
  });
  assert.equal(groupReport.criteria.marketGroups.actual, 3);
  assert.ok(groupReport.criteria.maximumGroupEffectiveShare.raw < 0.34);
});

test("requires two hundred comparable accounts instead of counting unusable identities", () => {
  const sparseRows = rows.slice(0, 200).map((row, index) => ({
    ...row,
    start_season_slug: index < 120 ? "assembly" : null,
    season_progress: index < 120 ? row.season_progress : {},
  }));
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: sparseRows,
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, 200);
  assert.equal(report.eligibleRows, 120);
  assert.equal(report.criteria.minimumEligibleRows.actual, 120);
  assert.equal(report.criteria.minimumEligibleRows.pass, false);
});

test("checks source diversity and concentration only across comparable accounts", () => {
  const concentratedSource = rows.slice(0, 200).map((row, index) => ({
    ...row,
    group_hash: index < 140 ? "dominant" : index < 170 ? "second" : "third",
    start_season_slug: index < 140 ? null : "assembly",
    season_progress: index < 140 ? {} : row.season_progress,
  }));
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: concentratedSource,
    splitSeed: "fixture",
  });
  assert.equal(report.eligibleRows, 60);
  assert.equal(report.criteria.marketGroups.actual, 2);
  assert.equal(report.criteria.marketGroups.pass, false);
  assert.equal(report.criteria.maximumGroupEffectiveShare.raw, 0.5);
  assert.equal(report.criteria.maximumGroupEffectiveShare.pass, true);
});

test("does not let a duplicated post with conflicting account hashes inflate the sample gate", () => {
  const duplicated = rows.slice(0, 200).map((row, index) => ({
    ...row,
    post_hash: `post-${index}`,
  }));
  duplicated.push({
    ...duplicated[0],
    account_group_hash: "conflicting-account-hash",
  });
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: duplicated,
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, 200);
  assert.equal(report.criteria.minimumEligibleRows.actual, 200);
  const reversed = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: [...duplicated].reverse(),
    splitSeed: "fixture",
  });
  assert.deepEqual(reversed, report);
});

test("stable account fingerprints override conflicting aliases during deduplication", () => {
  const duplicatedIdentity = rows.slice(0, 200).map((row, index) => ({
    ...row,
    account_group_hash: `conflicting-alias-${index}`,
    account_fingerprint: "a".repeat(64),
    post_hash: `distinct-post-${index}`,
  }));
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: duplicatedIdentity,
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, 1);
  assert.equal(report.eligibleRows, 1);
  assert.equal(report.criteria.minimumEligibleRows.pass, false);
  assert.equal(report.outcome, "fail");
});

test("rejects otherwise complete evidence produced with mixed identity salts", () => {
  const mixedNamespaces = rows.map((row, index) => signEvidenceRow({
    ...row,
    identity_namespace: index < 250 ? "c".repeat(64) : "d".repeat(64),
  }));
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline: aggregate(8000),
    rows: mixedNamespaces,
    splitSeed: "fixture",
  });
  assert.equal(report.criteria.identityNamespaceConsistency.actual, 2);
  assert.equal(report.criteria.identityNamespaceConsistency.pass, false);
  assert.equal(report.outcome, "fail");
});

test("applies the same sixty-percent group cap used by calibration", () => {
  const concentrated = rows.map((row, index) => ({
    ...row,
    group_hash: index < 350 ? "dominant" : index < 425 ? "second" : "third",
  }));
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: concentrated,
    splitSeed: "fixture",
  });
  assert.equal(report.criteria.maximumGroupEffectiveShare.raw, 0.7);
  assert.equal(report.criteria.maximumGroupEffectiveShare.actual, 0.6);
  assert.equal(report.criteria.maximumGroupEffectiveShare.pass, false);
  assert.equal(report.outcome, "fail");
});

test("normalizes reversed price ranges like calibration", () => {
  const rangedRows = rows.map((row) => ({
    ...row,
    price_twd: undefined,
    price_twd_low: 120,
    price_twd_high: 80,
    price_kind: "sold",
  }));
  const normalRows = rangedRows.map((row) => ({
    ...row,
    price_twd_low: 80,
    price_twd_high: 120,
  }));
  const reversed = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: rangedRows,
    splitSeed: "fixture",
  });
  const normal = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: normalRows,
    splitSeed: "fixture",
  });
  assert.deepEqual(reversed.candidate, normal.candidate);
  assert.deepEqual(reversed.baseline, normal.baseline);
});

test("penalizes a candidate that removes a difficult baseline season", () => {
  const candidate = aggregate(10000);
  candidate.segments.startSeason = {};
  const report = validateValuationModel({
    candidate,
    baseline: aggregate(10000),
    rows,
    splitSeed: "fixture",
  });
  assert.equal(report.eligibleRows, 500);
  assert.ok(
    report.candidate.medianAbsoluteLogError >
      report.baseline.medianAbsoluteLogError,
  );
  assert.equal(report.outcome, "fail");
});

test("rejects a candidate that omits a baseline season even without holdout examples", () => {
  const baseline = aggregate(8000);
  const candidate = aggregate(14000, { fullModel: true });
  delete candidate.segments.startSeason.aurora;
  const report = validateValuationModel({
    candidate,
    baseline,
    rows,
    splitSeed: "fixture",
  });
  assert.deepEqual(report.criteria.candidateSeasonCoverage.missing, ["aurora"]);
  assert.equal(report.criteria.candidateSeasonCoverage.pass, false);
  assert.equal(report.outcome, "fail");
});

test("pins the official baseline and keeps canonical seasons in validation scope", () => {
  const baseline = aggregate(8000);
  const expectedBaselineDigest = valuationModelArtifactDigest(baseline);
  delete baseline.segments.startSeason.gratitude;
  const report = validateValuationModel({
    candidate: aggregate(14000, { fullModel: true }),
    baseline,
    rows,
    expectedBaselineDigest,
  });
  assert.equal(report.criteria.baselineProvenance.pass, false);
  assert.ok(report.criteria.candidateSeasonCoverage.required.includes("gratitude"));
  assert.equal(report.outcome, "fail");
});

test("fails when a candidate drops even a minority baseline-supported season", () => {
  const baseline = aggregate(100);
  const candidate = aggregate(100);
  delete candidate.segments.startSeason.aurora;
  const mixedRows = [
    ...rows,
    ...Array.from({ length: 100 }, (_, index) => ({
      ...rows[index],
      account_group_hash: `aurora-${index}`,
      account_fingerprint: (index + 10_000).toString(16).padStart(64, "0"),
      snapshot_hash: (index + 20_000).toString(16).padStart(64, "0"),
      start_season_slug: "aurora",
    })),
  ];
  const report = validateValuationModel({
    candidate,
    baseline,
    rows: mixedRows,
    splitSeed: "fixture",
  });
  assert.ok(report.candidate.missingPredictionCount > 0);
  assert.ok(report.candidate.predictionCoverage < 1);
  assert.equal(report.criteria.candidatePredictionCoverage.pass, false);
  assert.equal(report.criteria.candidateSeasonCoverage.pass, false);
  assert.equal(report.outcome, "fail");
});

test("rejects a candidate built with holdout rows or a different split seed", () => {
  const allEligible = aggregate(100);
  allEligible.split.trainingMode = "all-eligible";
  const includedHoldout = validateValuationModel({
    candidate: allEligible,
    baseline: aggregate(80),
    rows,
    splitSeed: "fixture",
  });
  assert.equal(includedHoldout.criteria.candidateProvenance.pass, false);
  assert.equal(includedHoldout.outcome, "fail");

  const wrongSeed = aggregate(100);
  wrongSeed.split.splitSeed = "another-seed";
  const mismatched = validateValuationModel({
    candidate: wrongSeed,
    baseline: aggregate(80),
    rows,
    splitSeed: "fixture",
  });
  assert.equal(mismatched.criteria.candidateProvenance.pass, false);
  assert.equal(mismatched.outcome, "fail");

  const customSeed = aggregate(14000, { fullModel: true });
  customSeed.split.splitSeed = "custom-seed";
  const matchingButUncommitted = validateValuationModel({
    candidate: customSeed,
    baseline: aggregate(8000),
    rows,
    splitSeed: "custom-seed",
  });
  assert.equal(
    matchingButUncommitted.criteria.candidateProvenance.requiredSplitSeed,
    officialValuationSplitSeed,
  );
  assert.equal(matchingButUncommitted.criteria.candidateProvenance.pass, false);
  assert.equal(matchingButUncommitted.outcome, "fail");
});
