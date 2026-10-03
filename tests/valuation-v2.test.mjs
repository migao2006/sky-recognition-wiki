import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
const { seasonPriceBands, valuationSampleSummary } = await tsImport("../app/valuation-season-bands.ts", import.meta.url);
const { seasons } = await tsImport("../app/catalog-sources.ts", import.meta.url);
test("every catalog season explicitly reports missing fresh evidence without old prices", () => {
  assert.deepEqual(seasonPriceBands.map(row => row.slug), seasons.map(([slug]) => slug));
  for (const band of seasonPriceBands) {
    assert.equal(band.low, null);
    assert.equal(band.median, null);
    assert.equal(band.high, null);
    assert.equal(band.status, "unavailable");
    assert.equal(band.sampleCount, 0);
  }
});
test("foreign collection is not represented as eligible Taiwan observations", () => {
  assert.equal(valuationSampleSummary.sourceRows, 622);
  assert.equal(valuationSampleSummary.foreignRows, 622);
  assert.equal(valuationSampleSummary.eligibleRows, 0);
  assert.equal(valuationSampleSummary.collectionComplete, false);
});
