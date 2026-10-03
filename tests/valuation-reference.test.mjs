import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { loadValuationRuntime } from "../scripts/load-valuation-runtime.mjs";
import { referencePackageValue, valuationRevision } from "../app/valuation-reference.js";
import { predictValuationAggregate } from "../scripts/validate-valuation-model.mjs";
import { stableRowKey, valuationModelFeaturesFor } from "../scripts/lib/valuation-source-core.mjs";

const catalog = await loadRuntimeCatalog();
const { analyzeValuation, estimateValuation } = await loadValuationRuntime();
const bindings = Object.fromEntries(["google", "nintendo", "gameCenter", "facebook", "steam", "twitch", "playstation"].map(key => [key, "none"]));
// Synthetic independent packages exercise counts beyond the current catalog.
// These are not observations or inferred purchases.
const packages = Array.from({ length: 250 }, (_, i) => ({
  id: 9000 + i, order: i, guid: `reference-test-${i}`,
  name: `Reference package ${i}`, type: "Cape", group: "IAP",
  section: "events", collection: "test", icon: "", previewUrl: "", wiki: `https://example.test/Pack_${i}`,
}));
const estimate = (slug, count) => {
  const start = catalog.graduationSeasonSlugs.indexOf(slug);
  assert.ok(start >= 0);
  const chosen = [
    ...catalog.graduationSeasonSlugs.slice(start).flatMap(season => catalog.seasonGraduationItems.get(season) ?? []),
    ...packages.slice(0, count),
  ];
  return estimateValuation({
    analysis: analyzeValuation({ chosen, bindings, bindingNote: "", bindingsConfirmed: true,
      domain: { ...catalog, getZhName: catalog.zhItemName } }),
    resources: {},
  });
};

test("manual whole-account reference points run through the production pipeline", () => {
  for (const [slug, count, expected] of [
    ["gratitude", 100, 250000], ["lightseekers", 100, 150000],
    ["rhythm", 100, 100000], ["enchantment", 60, 37000],
    ["enchantment", 100, 45000],
  ]) {
    const result = estimate(slug, count);
    assert.equal(result.marketProfile.canonicalPackageCount, count);
    assert.equal(result.midpoint, expected, slug);
    assert.equal(result.modelFeatures.modelRevision, valuationRevision);
    assert.equal(result.modelFeatures.limitedLow, 0);
    assert.ok(result.warnings.some(value => value.includes("人工行情")));
  }
});

test("manual revision survives normalization and cannot inherit legacy validation", () => {
  const features = estimate("enchantment", 100).modelFeatures;
  const row = { valuation_model: features };
  assert.equal(valuationModelFeaturesFor(row).modelRevision, valuationRevision);
  assert.notEqual(stableRowKey(row), stableRowKey({ valuation_model: { ...features, modelRevision: undefined } }));
  assert.equal(predictValuationAggregate({}, { modelFeatures: features }), null);
});

test("manual package curves and displayed runtime estimates never decrease from 0 to 250", () => {
  for (const slug of ["gratitude", "lightseekers", "rhythm", "enchantment", "sanctuary", "moments"]) {
    let previous = estimate(slug, 0);
    for (let count = 1; count <= 250; count++) {
      const next = estimate(slug, count);
      assert.ok(next.midpoint >= previous.midpoint, `${slug}/${count}`);
      assert.ok(next.range.low >= previous.range.low);
      assert.ok(next.range.high >= previous.range.high);
      previous = next;
    }
    assert.ok(referencePackageValue(slug, 200) > referencePackageValue(slug, 150));
    for (const count of [15, 40, 60, 90, 100, 150]) {
      assert.ok(Math.abs(referencePackageValue(slug, count + 1e-6) - referencePackageValue(slug, count - 1e-6)) < .001);
    }
  }
});
