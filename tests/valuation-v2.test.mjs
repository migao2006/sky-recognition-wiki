import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
const { seasonPriceBands, valuationSampleSummary } = await tsImport("../app/valuation-season-bands.ts", import.meta.url);
const { seasons } = await tsImport("../app/catalog-sources.ts", import.meta.url);
test("every catalog season reports either blended evidence or missing fresh evidence", () => {
  assert.deepEqual(seasonPriceBands.map(row => row.slug), seasons.map(([slug]) => slug));
  for (const band of seasonPriceBands) {
    assert.ok(["blended", "unavailable"].includes(band.status));
    if (band.status === "unavailable") {
      assert.equal(band.low, null);
      assert.equal(band.median, null);
      assert.equal(band.high, null);
      assert.equal(band.sampleCount, 0);
    } else {
      assert.ok(band.sampleCount > 0);
      assert.ok(band.low !== null && band.median !== null && band.high !== null);
    }
  }
});
test("foreign collection is not represented as eligible Taiwan observations", () => {
  assert.equal(valuationSampleSummary.sourceRows, 446);
  assert.equal(valuationSampleSummary.foreignRows, 0);
  assert.equal(valuationSampleSummary.eligibleRows, 113);
  assert.equal(valuationSampleSummary.collectionComplete, false);
});
