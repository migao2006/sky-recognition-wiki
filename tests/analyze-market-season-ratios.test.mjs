import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonRatioReport } from "../scripts/analyze-market-season-ratios.mjs";

const row = (overrides = {}) => ({
  source: "market-a",
  currency_original: "CNY",
  account_candidate: true,
  relative_price_candidate: true,
  price_outlier: false,
  season_graduation_count_consistent: true,
  start_season_candidate: "remembrance",
  price_original: 500,
  ...overrides,
});

test("computes season ratios separately for every source and currency", () => {
  const report = buildSeasonRatioReport([
    row({ price_original: 400 }),
    row({ price_original: 500 }),
    row({ price_original: 600 }),
    row({ start_season_candidate: "nesting", price_original: 200 }),
    row({ start_season_candidate: "nesting", price_original: 250 }),
    row({ start_season_candidate: "nesting", price_original: 300 }),
    row({ source: "market-b", currency_original: "USD", price_original: 100 }),
    row({ source: "market-b", currency_original: "USD", price_original: 120 }),
    row({ source: "market-b", currency_original: "USD", price_original: 140 }),
  ]);
  assert.deepEqual(report.markets.map((market) => market.market), ["market-a:CNY:unknown", "market-b:USD:unknown"]);
  const first = report.markets[0];
  assert.equal(first.market_median_original, 300);
  assert.deepEqual(first.seasons.map((season) => [season.slug, season.sample_count]), [
    ["remembrance", 3],
    ["nesting", 3],
  ]);
  assert.equal(first.seasons[0].ratio_to_market_median, 1.667);
  assert.equal(first.seasons[1].ratio_to_market_median, 0.833);
});

test("channel-specific medians preserve unknown rows and do not create cross-channel inversions", () => {
  const report = buildSeasonRatioReport([
    ...[100, 110, 120].map(price => row({ channel: "安卓官服", price_original: price })),
    ...[1000, 1100, 1200].map(price => row({ channel: "iOS官服", start_season_candidate: "nesting", price_original: price })),
    ...[200, 210, 220].map(price => row({ price_original: price })),
  ]);
  assert.equal(report.schema_version, 2);
  assert.equal(report.eligible_rows, 9);
  assert.equal(report.markets.length, 3);
  for (const [channel, median] of [["android-official", 110], ["ios-official", 1100], ["unknown", 210]]) {
    const market = report.markets.find(m => m.channel === channel);
    assert.equal(market.market_median_original, median);
    assert.equal(market.sample_count, 3);
    assert.equal(market.seasons[0].ratio_to_market_median, 1);
    assert.deepEqual(market.possible_inversions, []);
  }
  const unknown = buildSeasonRatioReport([row({ channel: "private-note" }), row({ channel: "iOS" })]);
  assert.equal(unknown.eligible_rows, 2);
  assert.equal(unknown.markets[0].channel, "unknown");
  assert.doesNotMatch(JSON.stringify(unknown), /private-note/);
});

test("excludes weak or confounded rows and marks sparse seasons insufficient", () => {
  const report = buildSeasonRatioReport([
    row(),
    row({ price_original: 550 }),
    row({ price_original: 9999, price_outlier: true }),
    row({ price_original: 9999, relative_price_candidate: false }),
    row({ price_original: 9999, season_graduation_count_consistent: false }),
    row({ price_original: 9999, start_season_candidate: "unknown" }),
  ], { minimumSamples: 3 });
  assert.equal(report.source_rows, 6);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.markets[0].seasons[0].sufficient_samples, false);
});

test("reports only material chronological inversions between comparable seasons", () => {
  const rows = [100, 110, 120].map((price) => row({
    start_season_candidate: "remembrance",
    price_original: price,
  })).concat([300, 310, 320].map((price) => row({
    start_season_candidate: "nesting",
    price_original: price,
  })));
  const report = buildSeasonRatioReport(rows);
  assert.deepEqual(report.markets[0].possible_inversions, [{
    older_slug: "remembrance",
    newer_slug: "nesting",
    older_to_newer_ratio: 0.355,
  }]);
});
