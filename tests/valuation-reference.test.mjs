import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { loadValuationRuntime } from "../scripts/load-valuation-runtime.mjs";
import { freshModelRevision } from "../app/valuation-fresh-core.js";
import { predictValuationAggregate } from "../scripts/validate-valuation-model.mjs";


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


test("all completed seasons and 0–250 packages have no inherited manual anchors", () => {
  for (const slug of catalog.graduationSeasonSlugs) {
    for (let count = 0; count <= 250; count++) {
      const result = estimate(slug, count);
      assert.equal(result.marketProfile.canonicalPackageCount, count);
      assert.equal(result.midpoint, null);
      assert.equal(result.range, null);
      assert.equal(result.modelFeatures.modelRevision, freshModelRevision);
    }
  }
});
test("legacy validator cannot certify fresh predictors", () => {
  const features = estimate("enchantment", 100).modelFeatures;
  assert.equal(predictValuationAggregate({}, { modelFeatures: features }), null);
});
