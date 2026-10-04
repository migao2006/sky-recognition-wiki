import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fitFreshModel, fitEvidenceBlendedModel, predictFreshModel } from "../app/valuation-fresh-core.js";
import { reviewFreshEvidence } from "../scripts/lib/fresh-valuation-evidence.mjs";

// Synthetic fixtures test mechanics, not market accuracy or known user answers.
const seasons = ["gratitude", "lightseekers", "rhythm", "moments"];
const options = { seasons, asOf: "2026-10-04", recheckedSince: "2026-10-03" };
const row = (i, extra = {}) => ({ id: `r${i}`, accountKey: `a${i}`, postKey: `p${i}`,
  sourceGroup: "synthetic", sourceUrl: `https://example.com/post/${i}`, reviewed: true,
  reviewedAt: "2026-10-04", publishedAt: "2026-10-01", accountOnly: true,
  intent: "sell", market: "taiwan", server: "international", currency: "TWD",
  priceKind: "ask", season: "gratitude", price: 1000 + i * 100,
  packageCount: i * 25, breakFraction: 0, bindingRiskCount: 0, ...extra });

test("fresh evidence rejects legacy, unknown dates, FX and mixed goods without inventing values", () => {
  const mutations = [{ reviewed: false }, { publishedAt: null }, { publishedAt: "2026-99-01" },
    { publishedAt: "2026-02-30" }, { publishedAt: "2024-10-01" }, { converted: true },
    { currency: "CNY" }, { server: "unknown" }, { market: "china" }, { accountOnly: false },
    { intent: "buy" }, { excludeFromModel: true }, { priceKind: "sold" }, { sourceUrl: "" }];
  const report = reviewFreshEvidence(mutations.map((extra, i) => row(i, extra)), options);
  assert.equal(report.accepted.length, 0);
  assert.equal(report.rejected.length, mutations.length);
  assert.equal(report.coverage.gratitude.status, "unavailable");
});

test("dedup crossposts deterministically and preserve unknown predictors", () => {
  const data = [row(1, { packageCount: null }), row(2, { accountKey: "a1" }), row(3, { postKey: "p1" })];
  const a = reviewFreshEvidence(data, options), b = reviewFreshEvidence([...data].reverse(), options);
  assert.equal(a.accepted.length, 1);
  assert.equal(a.accepted[0].packageCount, null);
  assert.equal(a.datasetDigest, b.datasetDigest);
  assert.equal(a.coverage.gratitude.ask, 1);
});

test("365-day extension is cohort-specific; manual quotes never masquerade as sold", () => {
  const data = Array.from({ length: 5 }, (_, i) => row(i));
  data.push(row(8, { publishedAt: "2026-01-01" }));
  data.push(row(9, { publishedAt: "2026-01-01", season: "rhythm", priceKind: "manual" }));
  const report = reviewFreshEvidence(data, options);
  assert.equal(report.accepted.length, 6);
  assert.equal(report.deferredOutsideRecentWindow, 1);
  assert.equal(report.coverage.rhythm.status, "manual");
  assert.equal(report.coverage.rhythm.sold, 0);
});

test("linked crossposts deduplicate transitively before coverage", () => {
  const report = reviewFreshEvidence([row(1), row(2), row(3, { accountKey: "a1", postKey: "p2" })], options);
  assert.equal(report.accepted.length, 1);
  assert.equal(report.rejected.length, 2);
});

test("fresh fit contains no old seed fallback and does not coerce null to zero", () => {
  const model = fitFreshModel(Array.from({ length: 8 }, (_, i) => row(i, { packageCount: null })), { seasons });
  assert.deepEqual(model.intercepts, {});
  assert.equal(predictFreshModel(model, row(0)).midpoint, null);
  const empty = fitFreshModel([], { seasons });
  assert.equal(Object.keys(empty.seasons).length, seasons.length);
  assert.equal(empty.validation, "unvalidated");
  assert.throws(() => fitFreshModel([row(1), row(2, { accountKey: "a1" })], { seasons }), /Unique/);
  assert.throws(() => fitFreshModel([row(1), row(2, { priceKind: "sold" })], { seasons }), /mix/);
  assert.throws(() => fitFreshModel([row(1, { currency: "CNY" })], { seasons }), /unconverted/);
});

test("learned package curve is continuous and monotonic for every supplied season at 0–250", () => {
  const data = seasons.flatMap((season, s) => Array.from({ length: 11 }, (_, i) =>
    [0, .5, 1].flatMap(breakFraction => [0, 2, 7].map(bindingRiskCount =>
      row(`${s}-${i}-${breakFraction}-${bindingRiskCount}`, { season, packageCount: i * 25,
        breakFraction, bindingRiskCount, price: 2200 + 300 * s + i * 130 - breakFraction * 400 - bindingRiskCount * 100 })))).flat());
  const model = fitFreshModel(data, { seasons });
  assert.equal(model.converged, true);
  assert.deepEqual(model.knots, [0, 50, 125, 200, 250]);
  for (const season of seasons) {
    let previous = -Infinity;
    for (let packageCount = 0; packageCount <= 250; packageCount++) {
      const input = { season, packageCount, breakFraction: 0, bindingRiskCount: 0 };
      const current = predictFreshModel(model, input);
      assert.equal(current.status, "unvalidated");
      assert.ok(current.midpoint >= previous);
      previous = current.midpoint;
      const broken = predictFreshModel(model, { ...input, breakFraction: .5 });
      const risky = predictFreshModel(model, { ...input, bindingRiskCount: 2 });
      assert.equal(broken.status, "unvalidated");
      assert.equal(risky.status, "unvalidated");
      assert.ok(broken.midpoint < current.midpoint);
      assert.ok(risky.midpoint < current.midpoint);
    }
  }
  assert.equal(predictFreshModel(model, { ...row(1), packageCount: 251 }).reason, "package_count_outside_evidence");
  assert.equal(predictFreshModel(model, { ...row(1), season: "unknown" }).midpoint, null);
  assert.equal(predictFreshModel(model, { ...row(1), breakFraction: null }).reason, "unknown_predictors");
  assert.equal(model.intervalKind, "in_sample_residual_not_prediction_interval");
});

test("candidate has no runtime dependency on old prices or manual fixed answers", async () => {
  const source = await readFile(new URL("../app/valuation-fresh-core.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bimport\s|seasonBandSeeds/);
});

test("evidence-blended candidate splits cross-season evidence and keeps tier proxy metadata", () => {
  const model = fitEvidenceBlendedModel([
    { price: 12000, packageCount: 75, seasonEvidence: [
      { season: "gratitude", priceShare: 12000, weight: 1, breakClass: "none" },
    ] },
    { price: 20000, packageCount: 120, seasonEvidence: [
      { season: "gratitude", priceShare: 10000, weight: .25, breakClass: "large" },
      { season: "rhythm", priceShare: 10000, weight: .25, breakClass: "large" },
    ] },
  ], { seasons });
  assert.equal(model.mode, "evidence-blended-v2");
  assert.equal(model.seasons.gratitude.status, "blended");
  assert.equal(model.seasons.rhythm.status, "blended");
  const estimate = predictFreshModel(model, { season: "gratitude", packageCount: 75, breakFraction: 0, bindingRiskCount: 0 });
  assert.equal(estimate.status, "unvalidated");
  assert.ok(estimate.midpoint > 0);
});
