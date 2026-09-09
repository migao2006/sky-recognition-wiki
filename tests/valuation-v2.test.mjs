import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  seasonPriceBands,
  valuationSampleSummary,
} from "../app/valuation-season-bands.ts";
import {
  deriveSeasonBands,
  seasonBandSeeds,
} from "../app/valuation-season-band-core.js";

const marketAggregate = JSON.parse(
  await readFile(
    new URL("../app/valuation-market-aggregate.json", import.meta.url),
    "utf8",
  ),
);

test("season bands contain all thirty ordered seasons with valid price ranges", () => {
  assert.equal(seasonPriceBands.length, 30);
  assert.deepEqual(valuationSampleSummary, {
    sourceRows: 446,
    eligibleRows: 399,
    facebookRows: 279,
    facebookEligibleRows: 269,
    driveRows: 115,
    driveEligibleRows: 114,
    marketplaceRows: 36,
    marketplaceEligibleRows: 2,
    secondaryMarketRows: 74,
    asOf: "2026-09-10",
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

test("browser season bands are derived from the shared blend and monotonic clamp", () => {
  const comparableFields = (band) => ({
    slug: band.slug,
    low: band.low,
    median: band.median,
    high: band.high,
    contributionLow: band.contributionLow,
    contributionHigh: band.contributionHigh,
    sampleCount: band.sampleCount,
    effectiveWeight: band.effectiveWeight,
  });
  assert.deepEqual(
    seasonPriceBands.map(comparableFields),
    deriveSeasonBands(marketAggregate, seasonBandSeeds),
  );
});

test("keeps the published thirty-season price bands numerically stable", () => {
  const publishedFields = seasonPriceBands.map(
    ({
      slug,
      low,
      median,
      high,
      contributionLow,
      contributionHigh,
      sampleCount,
      effectiveWeight,
    }) => ({
      slug,
      low,
      median,
      high,
      contributionLow,
      contributionHigh,
      sampleCount,
      effectiveWeight,
    }),
  );
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(publishedFields))
      .digest("hex"),
    "532290fb13656d4f6f11f7e13f044d896d57b88d4baf1aac7a6f8e954b45ed42",
  );
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
      ["rhythm", 35, "medium"],
      ["enchantment", 35, "medium"],
      ["carnival", 8, "low"],
    ],
  );
  assert.equal(bySlug.get("sanctuary")?.sampleCount, 22);
  assert.equal(bySlug.get("sanctuary")?.confidence, "medium");
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

test("anonymous market aggregate keeps the current audited source summary", () => {
  assert.equal(marketAggregate.schemaVersion, 4);
  assert.equal(marketAggregate.validationStatus, "unvalidated");
  assert.equal(marketAggregate.sourceRows, 446);
  assert.equal(marketAggregate.eligibleRows, 399);
  assert.equal(marketAggregate.uniqueAccountRows, 269);
  assert.equal(marketAggregate.split.trainingRows, 356);
  assert.equal(marketAggregate.split.holdoutRows, 43);
  assert.equal(marketAggregate.split.trainingMode, "calibration-only");
  assert.equal(marketAggregate.predictorCoverage.completeRows, 0);
  // A separately reviewed partial-Moments listing is now present; the known
  // answer account remains isolated by the source partition, not by season.
  assert.equal(marketAggregate.segments.startSeason.moments.sampleCount, 1);
  assert.equal(marketAggregate.segments.startSeason["dear-van-gogh"].sampleCount, 0);
  assert.deepEqual(marketAggregate.sourceBreakdown, {
    "8591_tw": 1,
    carousell_tw: 1,
    facebook: 269,
    google_drive: 114,
    unknown: 14,
  });
  assert.deepEqual(marketAggregate.sourceRowsBySource, {
    "8591_hk": 33,
    "8591_tw": 1,
    carousell_tw: 2,
    facebook: 279,
    google_drive: 115,
    unknown: 16,
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.breakClass).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    // Excludes a badge/account mixed sale and an unsupported big-break claim.
    { none: 43, slight: 62, medium: 76, big: 112 },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(marketAggregate.segments.packageTier).map(
        ([key, value]) => [key, value.sampleCount],
      ),
    ),
    { few: 114, medium: 62, many: 78, hundred: 19 },
  );
  assert.equal(marketAggregate.segments.accountStyle.simple.sampleCount, 80);
  assert.equal(marketAggregate.segments.accountStyle.regular.sampleCount, 256);
});

test("priors add no observations, and only audited start-season samples affect bands", () => {
  assert.ok(deriveSeasonBands({}).every((band) => band.sampleCount === 0 && band.effectiveWeight === 0));
  for (const band of seasonPriceBands) {
    const source = marketAggregate.segments.startSeason[band.slug];
    assert.equal(band.sampleCount, source.sampleCount);
    assert.equal(band.effectiveWeight, Number(source.effectiveWeight.toFixed(2)));
  }
  const seeds = [{ slug: "test-season", prior: 1000, sampleCount: 99, p25: 90000, p75: 99000 }];
  assert.deepEqual(deriveSeasonBands({}, seeds)[0], {
    slug: "test-season", low: 800, median: 1000, high: 1300,
    contributionLow: 100, contributionHigh: 200, sampleCount: 0, effectiveWeight: 0,
  });
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
