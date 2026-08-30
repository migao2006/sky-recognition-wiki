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
    sourceRows: 1150,
    eligibleRows: 259,
    facebookRows: 16,
    facebookEligibleRows: 14,
    driveRows: 112,
    driveEligibleRows: 112,
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
      ["rhythm", 17, "high"],
      ["enchantment", 36, "high"],
      ["carnival", 17, "high"],
    ],
  );
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

test("anonymous market aggregate covers more than one hundred accounts", () => {
  assert.equal(marketAggregate.sourceRows, 128);
  assert.equal(marketAggregate.eligibleRows, 126);
  assert.deepEqual(marketAggregate.sourceBreakdown, {
    facebook: 14,
    google_drive: 112,
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.breakClass).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    { none: 12, slight: 23, medium: 44, big: 33 },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.packageTier).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    { few: 37, medium: 38, many: 26, hundred: 11 },
  );
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
