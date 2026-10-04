import { seasons } from "./catalog-sources";
import freshData from "./valuation-fresh-data.json";
import { predictFreshModel } from "./valuation-fresh-core.js";

export type SeasonConfidence = "high" | "medium" | "low" | "inferred";
export type SeasonPriceBand = {
  slug: string;
  low: number | null;
  median: number | null;
  high: number | null;
  status: "unavailable" | "unvalidated";
  method: string | null;
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
// Comparable whole-account reference: no breaks, few packages, binding unknown.
// Same predictor as the actual account; this is NOT a season/item unit price.
export const seasonPriceBands: readonly SeasonPriceBand[] = seasons.map(([slug]) => {
  const result = predictFreshModel(freshData.model, { season: slug, packageTier: "few", breakClass: "none" });
  return {
    slug,
    low: result.range?.low ?? null,
    median: result.midpoint,
    high: result.range?.high ?? null,
    status: result.status === "unavailable" ? "unavailable" : "unvalidated",
    method: result.method,
    sampleCount: result.sampleCount,
    confidence: "inferred",
    asOf: freshData.asOf,
  };
});
export const seasonBandBySlug = new Map(seasonPriceBands.map(band => [band.slug, band]));
