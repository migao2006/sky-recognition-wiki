import { seasons } from "./catalog-sources";
import freshData from "./valuation-fresh-data.json";

export type SeasonConfidence = "high" | "medium" | "low" | "inferred";
export type SeasonPriceBand = {
  slug: string;
  low: number | null;
  median: number | null;
  high: number | null;
  status: "unavailable";
  sampleCount: number;
  confidence: SeasonConfidence;
  asOf: string;
};
export const valuationSampleSummary = {
  sourceRows: freshData.sourceRows,
  eligibleRows: freshData.eligibleRows,
  foreignRows: freshData.foreignRows,
  asOf: freshData.asOf,
  collectionComplete: freshData.collectionComplete,
};
// A season-only price is not a bare-account price. Without a reviewed common
// package/risk scenario, never present historical bands as the new model.
export const seasonPriceBands: readonly SeasonPriceBand[] = seasons.map(([slug]) => ({
  slug, low: null, median: null, high: null, status: "unavailable",
  sampleCount: 0, confidence: "inferred", asOf: freshData.asOf,
}));
export const seasonBandBySlug = new Map(seasonPriceBands.map(band => [band.slug, band]));
