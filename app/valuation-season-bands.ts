import { seasons } from "./catalog-sources";
import freshData from "./valuation-fresh-data.json";

export type SeasonConfidence = "high" | "medium" | "low" | "inferred";
export type SeasonPriceBand = {
  slug: string;
  low: number | null;
  median: number | null;
  high: number | null;
  status: "unavailable" | "blended";
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
// These are exploratory evidence bands, not bare-account prices or a validated
// transaction model. The valuation page keeps the unvalidated warning and
// applies the full candidate model separately.
export const seasonPriceBands: readonly SeasonPriceBand[] = seasons.map(([slug]) => {
  const source = (freshData.model?.seasons as Record<string, {
    status?: string; median?: number | null; low?: number | null; high?: number | null; sampleCount?: number;
  }> | undefined)?.[slug];
  const available = source?.status === "blended" && typeof source.median === "number";
  return {
    slug,
    low: available ? source.low ?? null : null,
    median: available ? source.median ?? null : null,
    high: available ? source.high ?? null : null,
    status: available ? "blended" : "unavailable",
    sampleCount: available ? source.sampleCount ?? 0 : 0,
    confidence: "inferred",
    asOf: freshData.asOf,
  };
});
export const seasonBandBySlug = new Map(seasonPriceBands.map(band => [band.slug, band]));
