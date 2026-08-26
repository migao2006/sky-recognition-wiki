import assert from "node:assert/strict";
import test from "node:test";
import {
  seasonPriceBands,
  valuationSampleSummary,
} from "../app/valuation-season-bands.ts";

test("season bands contain all thirty ordered seasons with valid price ranges", () => {
  assert.equal(seasonPriceBands.length, 30);
  assert.deepEqual(valuationSampleSummary, {
    sourceRows: 1022,
    eligibleRows: 133,
    secondaryMarketRows: 74,
    asOf: "2026-08-16",
  });
  for (const [index, band] of seasonPriceBands.entries()) {
    assert.ok(band.low > 0 && band.high >= band.low);
    assert.ok(
      band.contributionLow > 0 && band.contributionHigh >= band.contributionLow,
    );
    if (index) assert.ok(seasonPriceBands[index - 1].low >= band.low);
  }
});

test("sample confidence reflects direct eligible mentions", () => {
  const bySlug = new Map(seasonPriceBands.map((band) => [band.slug, band]));
  assert.deepEqual(
    ["gratitude", "rhythm", "enchantment", "carnival"].map((slug) => {
      const band = bySlug.get(slug);
      return [slug, band?.sampleCount, band?.confidence];
    }),
    [
      ["gratitude", 0, "inferred"],
      ["rhythm", 5, "medium"],
      ["enchantment", 16, "high"],
      ["carnival", 15, "high"],
    ],
  );
});

test("sparse Lightseekers mentions do not erase early-season scarcity", () => {
  const lightseekers = seasonPriceBands.find(
    (band) => band.slug === "lightseekers",
  );
  assert.ok(lightseekers);
  assert.equal(lightseekers.sampleCount, 2);
  assert.ok(lightseekers.low >= 75000);
  assert.ok(lightseekers.high >= 130000);
  assert.ok(lightseekers.high < seasonPriceBands[0].high);
});

test("client summary contains no raw listing text", () => {
  const serialized = JSON.stringify(seasonPriceBands);
  assert.equal(/listing|description|seller|title/i.test(serialized), false);
});
