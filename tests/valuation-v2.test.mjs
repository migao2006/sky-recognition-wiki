import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { readFile } from "node:fs/promises";
import { predictFreshModel } from "../app/valuation-fresh-core.js";
const { seasonPriceBands, valuationSampleSummary } = await tsImport("../app/valuation-season-bands.ts", import.meta.url);
const { seasons } = await tsImport("../app/catalog-sources.ts", import.meta.url);
const data = JSON.parse(await readFile(new URL("../app/valuation-fresh-data.json", import.meta.url), "utf8"));
test("all canonical seasons have positive unvalidated whole-account reference bands", () => {
  assert.deepEqual(seasonPriceBands.map(row => row.slug), seasons.map(([slug]) => slug));
  for (const band of seasonPriceBands) {
    assert.equal(band.status, "unvalidated");
    assert.equal(band.confidence, "inferred");
    assert.ok(band.low > 0 && band.low <= band.median && band.median <= band.high);
    const prediction = predictFreshModel(data.model, { season: band.slug, packageTier: "few", breakClass: "none" });
    assert.equal(band.median, prediction.midpoint);
    assert.equal(band.low, prediction.range.low);
    assert.equal(band.high, prediction.range.high);
    if (band.method !== "direct") assert.equal(band.sampleCount, 0);
  }
});
test("latest collected records reconcile with exclusions, never inflated by owned seasons", () => {
  assert.equal(data.schemaVersion, 3);
  assert.equal(valuationSampleSummary.sourceRows, 220);
  assert.equal(valuationSampleSummary.eligibleRows, data.model.sourceEvidenceCount);
  assert.equal(data.sourceRows, data.eligibleRows + Object.values(data.provenance.rejectionCounts).reduce((a, b) => a + b, 0));
  assert.equal(data.collectionComplete, false);
  assert.equal(data.validation, "unvalidated");
  assert.ok(data.provenance.unknownDateRows > 0);
});
