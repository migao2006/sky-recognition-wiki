import assert from "node:assert/strict";
import test from "node:test";
import { validateValuationModel } from "../scripts/validate-valuation-model.mjs";

const aggregate = (median) => ({
  asOf: "2026-08-31",
  split: { splitSeed: "fixture", trainingMode: "calibration-only" },
  segments: { startSeason: { assembly: { p25: median * 0.9, median, p75: median * 1.1 } } },
  modifiers: { breakClass: { none: { multiplier: 1 } }, packageTier: { few: { multiplier: 1 } }, accountStyle: { regular: { multiplier: 1 } } },
});
const rows = Array.from({ length: 500 }, (_, index) => ({
  account_group_hash: `account-${index}`,
  group_hash: `market-${index % 3}`,
  published_at: "2026-08-01",
  price_twd: [100, 100, 100, 85, 115][index % 5],
  evidence_kind: "ask",
  evidence_quality: "high",
  start_season_slug: "assembly",
  computed_break_class: "none",
  computed_package_tier: "few",
  account_style: "regular",
}));

test("passes a deterministic anonymous holdout when candidate materially improves error", () => {
  const report = validateValuationModel({ candidate: aggregate(100), baseline: aggregate(80), rows, splitSeed: "fixture" });
  assert.equal(report.outcome, "pass");
  assert.equal(report.sourceEligibleRows, 500);
  assert.equal(report.eligibleRows, 500);
  assert.equal(report.criteria.marketGroups.actual, 3);
  assert.ok(report.candidate.p25P75Coverage >= 0.5);
  assert.ok(report.candidate.p25P75Coverage <= 0.9);
  assert.ok(report.candidate.medianAbsoluteLogError < report.baseline.medianAbsoluteLogError);
  assert.equal(/"account-|"market-|price_twd/.test(JSON.stringify(report)), false);
});

test("requires a bias justification rather than automatically passing a near-neutral candidate", () => {
  const report = validateValuationModel({ candidate: aggregate(95.1), baseline: aggregate(95), rows, splitSeed: "fixture" });
  assert.equal(report.criteria.accuracy.status, "needsBiasJustification");
  assert.equal(report.outcome, "needsBiasJustification");
});

test("fails safety gates for concentrated or undersized samples", () => {
  const report = validateValuationModel({ candidate: aggregate(100), baseline: aggregate(80), rows: rows.slice(0, 40).map((row) => ({ ...row, group_hash: "only" })), splitSeed: "fixture" });
  assert.equal(report.outcome, "fail");
  assert.equal(report.criteria.minimumEligibleRows.pass, false);
  assert.equal(report.criteria.marketGroups.pass, false);
  assert.equal(report.criteria.maximumGroupEffectiveShare.pass, false);
});

test("counts valid unique accounts toward the sample gate even without comparable season data", () => {
  const sparseRows = rows.slice(0, 200).map((row, index) => ({
    ...row,
    start_season_slug: index < 120 ? "assembly" : null,
  }));
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: sparseRows,
    splitSeed: "fixture",
  });
  assert.equal(report.sourceEligibleRows, 200);
  assert.equal(report.eligibleRows, 120);
  assert.equal(report.criteria.minimumEligibleRows.pass, true);
});

test("checks source concentration before excluding accounts without comparable seasons", () => {
  const concentratedSource = rows.slice(0, 200).map((row, index) => ({
    ...row,
    group_hash: index < 140 ? "dominant" : index < 170 ? "second" : "third",
    start_season_slug: index < 140 ? null : "assembly",
  }));
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline: aggregate(80),
    rows: concentratedSource,
    splitSeed: "fixture",
  });
  assert.equal(report.eligibleRows, 60);
  assert.equal(report.criteria.maximumGroupEffectiveShare.raw, 0.7);
  assert.equal(report.criteria.maximumGroupEffectiveShare.pass, false);
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
  const candidate = aggregate(100);
  candidate.segments.startSeason = {};
  const report = validateValuationModel({
    candidate,
    baseline: aggregate(100),
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

test("fails when a candidate drops even a minority baseline-supported season", () => {
  const baseline = aggregate(100);
  baseline.segments.startSeason.aurora = {
    p25: 90,
    median: 100,
    p75: 110,
  };
  const mixedRows = [
    ...rows,
    ...Array.from({ length: 100 }, (_, index) => ({
      ...rows[index],
      account_group_hash: `aurora-${index}`,
      start_season_slug: "aurora",
    })),
  ];
  const report = validateValuationModel({
    candidate: aggregate(100),
    baseline,
    rows: mixedRows,
    splitSeed: "fixture",
  });
  assert.ok(report.candidate.missingPredictionCount > 0);
  assert.ok(report.candidate.predictionCoverage < 1);
  assert.equal(report.criteria.candidatePredictionCoverage.pass, false);
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
});
