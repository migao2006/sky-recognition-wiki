import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fitWholeAccountModel, predictFreshModel, packageTiers, breakClasses, freshModelRevision } from "../app/valuation-fresh-core.js";
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


test("whole-account price is not divided by owned seasons; unknown inputs stay usable", () => {
  const data = [row(1, { price: 12000, packageCount: null, breakClass: null, seasonEvidence: seasons })];
  const model = fitWholeAccountModel(data, { seasons });
  assert.equal(model.sourceEvidenceCount, 1);
  assert.equal(model.seasons.gratitude.sampleCount, 1);
  for (const season of [...seasons, null]) {
    const result = predictFreshModel(model, { season, bindingRiskCount: null });
    assert.equal(result.status, "unvalidated");
    assert.equal(result.midpoint, 12000);
  }
});

test("whole-account fit rejects duplicates, foreign quotes and empty training; no legacy branch", () => {
  assert.throws(() => fitWholeAccountModel([], { seasons }), /No eligible/);
  assert.throws(() => fitWholeAccountModel([row(1), row(2, { accountKey: "a1" })], { seasons }), /Unique/);
  for (const extra of [{ currency: "CNY" }, { priceKind: "sold" }, { converted: true }, { price: 0 }])
    assert.throws(() => fitWholeAccountModel([row(1, extra)], { seasons }), /unconverted/);
  assert.equal(predictFreshModel({ revision: "fresh-candidate-v1" }, row(0)).midpoint, null);
});

test("all 30 seasons interpolate/extrapolate; packages nondecreasing and breaks nonincreasing", () => {
  const canonical = Array.from({ length: 30 }, (_, i) => "season-" + i);
  const data = [2, 9, 17, 27].flatMap(s => packageTiers.flatMap((packageTier, p) =>
    breakClasses.map((breakClass, b) => row(s + "-" + p + "-" + b, {
      season: canonical[s], packageTier, packageCount: null, breakClass,
      price: Math.exp(10 - s * .1 + p * .2 - b * .3),
    }))));
  const model = fitWholeAccountModel(data, { seasons: canonical });
  assert.equal(model.seasons[canonical[0]].method, "extrapolated");
  assert.equal(model.seasons[canonical[29]].method, "extrapolated");
  assert.equal(model.seasons[canonical[5]].method, "interpolated");
  for (const season of [...canonical, null]) {
    for (const breakClass of [...breakClasses, null]) {
      let previous = 0;
      for (const packageTier of packageTiers) {
        const result = predictFreshModel(model, { season, packageTier, breakClass, bindingRiskCount: null });
        assert.equal(result.status, "unvalidated");
        assert.ok(result.midpoint >= previous);
        assert.ok(result.range.low > 0 && result.range.low <= result.midpoint && result.midpoint <= result.range.high);
        previous = result.midpoint;
      }
    }
    for (const packageTier of [...packageTiers, null]) {
      let previous = Infinity;
      for (const breakClass of breakClasses) {
        const result = predictFreshModel(model, { season, packageTier, breakClass });
        assert.ok(result.midpoint <= previous);
        previous = result.midpoint;
      }
    }
    let previous = 0;
    for (let packageCount = 0; packageCount <= 300; packageCount++) {
      const result = predictFreshModel(model, { season, packageCount, breakClass: null });
      assert.ok(result.midpoint >= previous);
      previous = result.midpoint;
    }
  }
  assert.equal(model.validation, "unvalidated");
  assert.equal(model.revision, freshModelRevision);
  for (const modelUpdate of [{ coefficients: [NaN] }, { centers: [] }, { converged: false }])
    assert.equal(predictFreshModel({ ...model, ...modelUpdate }, { season: canonical[0] }).midpoint, null);
  assert.equal(predictFreshModel({ ...model, pooled: { logBase: Infinity } }, { season: null }).midpoint, null);
});

test("unknown binding does not mean unbound or block estimation; no binding/resource constant", () => {
  const model = fitWholeAccountModel(Array.from({ length: 6 }, (_, i) => row(i)), { seasons });
  const unknown = predictFreshModel(model, { season: null, packageTier: "few" });
  assert.deepEqual(unknown, predictFreshModel(model, { season: null, packageTier: "few", bindingRiskCount: 0 }));
  assert.deepEqual(unknown, predictFreshModel(model, { season: null, packageTier: "few", bindingRiskCount: 7 }));
});

test("candidate has no runtime dependency on old prices or manual fixed answers", async () => {
  const source = await readFile(new URL("../app/valuation-fresh-core.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bimport\s|seasonBandSeeds|priceShare|tierProxy|fitFreshModel|fitEvidenceBlendedModel/);
});
