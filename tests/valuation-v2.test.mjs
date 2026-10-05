import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { readFile } from "node:fs/promises";
const { seasonPriceBands, valuationSampleSummary } = await tsImport("../app/valuation-season-bands.ts", import.meta.url);
const { seasons } = await tsImport("../app/catalog-sources.ts", import.meta.url);
const data = JSON.parse(await readFile(new URL("../app/valuation-tabpfn-manifest.json", import.meta.url), "utf8"));
test("all canonical seasons wait for the local model without a fabricated local price", () => {
  assert.deepEqual(seasonPriceBands.map(row => row.slug), seasons.map(([slug]) => slug));
  for (const band of seasonPriceBands) {
    assert.equal(band.status, "unavailable");
    assert.equal(band.confidence, "inferred");
    assert.equal(band.median, null);
    assert.equal(band.low, null);
    assert.equal(band.high, null);
    assert.equal(band.method, "strict-title-binding-hybrid");
    assert.equal(band.sampleCount, data.seasonCounts[band.slug]);
  }
});
test("latest collected records reconcile with exclusions, never inflated by owned seasons", () => {
  assert.equal(data.schemaVersion, 1);
  assert.equal(valuationSampleSummary.sourceRows, 44);
  assert.equal(valuationSampleSummary.eligibleRows, data.sampleCount);
  assert.equal(valuationSampleSummary.collectionComplete, false);
  assert.equal(data.status, "unvalidated");
  assert.match(data.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(data.rows, undefined);
});
