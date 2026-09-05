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
  assert.deepEqual(report.markets.map((market) => market.market), ["market-a:CNY", "market-b:USD"]);
  const first = report.markets[0];
  assert.equal(first.market_median_original, 300);
  assert.deepEqual(first.seasons.map((season) => [season.slug, season.sample_count]), [
    ["remembrance", 3],
    ["nesting", 3],
  ]);
  assert.equal(first.seasons[0].ratio_to_market_median, 1.667);
  assert.equal(first.seasons[1].ratio_to_market_median, 0.833);
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
