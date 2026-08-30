import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  seasonPriceBands,
  valuationSampleSummary,
} from "../app/valuation-season-bands.ts";

const marketAggregate = JSON.parse(
  await readFile(
    new URL("../app/valuation-market-aggregate.json", import.meta.url),
    "utf8",
  ),
);

test("season bands contain all thirty ordered seasons with valid price ranges", () => {
  assert.equal(seasonPriceBands.length, 30);
  assert.deepEqual(valuationSampleSummary, {
    sourceRows: 1186,
    eligibleRows: 295,
    facebookRows: 16,
    facebookEligibleRows: 14,
    driveRows: 112,
    driveEligibleRows: 112,
    marketplaceRows: 36,
    marketplaceEligibleRows: 36,
    secondaryMarketRows: 74,
    asOf: "2026-08-30",
  });
  for (const [index, band] of seasonPriceBands.entries()) {
    assert.ok(
      band.low > 0 && band.median >= band.low && band.high >= band.median,
    );
    assert.ok(band.effectiveWeight >= 0);
    assert.equal(
      band.evidenceBreakdown.directSale,
      band.sampleCount,
    );
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
      ["rhythm", 18, "high"],
      ["enchantment", 35, "high"],
      ["carnival", 16, "high"],
    ],
  );
  assert.equal(bySlug.get("sanctuary")?.sampleCount, 10);
  assert.equal(bySlug.get("sanctuary")?.confidence, "low");
});

test("sparse Lightseekers mentions do not erase early-season scarcity", () => {
  const lightseekers = seasonPriceBands.find(
    (band) => band.slug === "lightseekers",
  );
  assert.ok(lightseekers);
  assert.equal(lightseekers.sampleCount, 4);
  assert.ok(lightseekers.low >= 75000);
  assert.ok(lightseekers.high >= 130000);
  assert.ok(lightseekers.high < seasonPriceBands[0].high);
});

test("client summary contains no raw listing text", () => {
  const serialized = JSON.stringify(seasonPriceBands);
  assert.equal(/listing|description|seller|title/i.test(serialized), false);
});

test("anonymous market aggregate covers more than one hundred and fifty accounts", () => {
  assert.equal(marketAggregate.sourceRows, 164);
  assert.equal(marketAggregate.eligibleRows, 162);
  assert.deepEqual(marketAggregate.sourceBreakdown, {
    "8591_hk": 33,
    "8591_tw": 1,
    carousell_tw: 2,
    facebook: 14,
    google_drive: 112,
  });
  assert.deepEqual(marketAggregate.sourceRowsBySource, {
    "8591_hk": 33,
    "8591_tw": 1,
    carousell_tw: 2,
    facebook: 16,
    google_drive: 112,
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.breakClass).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    { none: 13, slight: 28, medium: 54, big: 52 },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.packageTier).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    { few: 47, medium: 53, many: 28, hundred: 12 },
  );
  assert.equal(marketAggregate.segments.accountStyle.simple.sampleCount, 15);
});

test("learned market modifiers remain monotonic and anonymous", () => {
  const breaks = marketAggregate.modifiers.breakClass;
  assert.ok(
    breaks.none.multiplier >= breaks.slight.multiplier &&
      breaks.slight.multiplier >= breaks.medium.multiplier &&
      breaks.medium.multiplier >= breaks.big.multiplier,
  );
  const packages = marketAggregate.modifiers.packageTier;
  assert.ok(
    packages.few.multiplier <= packages.medium.multiplier &&
      packages.medium.multiplier <= packages.many.multiplier &&
      packages.many.multiplier <= packages.hundred.multiplier,
  );
  assert.equal(
    /post_hash|listing_text|seller|author|facebook\.com|drive\.google/i.test(
      JSON.stringify(marketAggregate),
    ),
    false,
  );
});
