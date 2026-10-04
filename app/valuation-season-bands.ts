import { seasons } from "./catalog-sources";
import manifest from "./valuation-tabpfn-manifest.json";

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
  sourceRows: manifest.sampleCount,
  eligibleRows: manifest.sampleCount,
  foreignRows: 0,
  asOf: manifest.asOf,
  collectionComplete: false,
};
// Comparable whole-account reference: no breaks, medium/many midpoint, binding unknown.
// Same predictor as the actual account; this is NOT a season/item unit price.
export const seasonPriceBands: readonly SeasonPriceBand[] = seasons.map(([slug]) => {
  return {
    slug,
    low: null,
    median: null,
    high: null,
    status: "unavailable",
    method: manifest.method,
    sampleCount: manifest.seasonCounts[slug as keyof typeof manifest.seasonCounts] ?? 0,
    confidence: "inferred",
    asOf: manifest.asOf,
  };
});
export const seasonBandBySlug = new Map(seasonPriceBands.map(band => [band.slug, band]));
