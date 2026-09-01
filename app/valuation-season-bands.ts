import valuationMarketAggregate from "./valuation-market-aggregate.json" with {
  type: "json",
};
import {
  deriveSeasonBands,
  seasonBandSeeds,
} from "./valuation-season-band-core.js";

export type SeasonConfidence = "high" | "medium" | "low" | "inferred";

type SeasonEvidenceBreakdown = {
  directSale: number;
  professionalEstimate: number;
  commentSignal: number;
};

export type SeasonPriceBand = {
  slug: string;
  low: number;
  median: number;
  high: number;
  contributionLow: number;
  contributionHigh: number;
  sampleCount: number;
  effectiveWeight: number;
  evidenceBreakdown: SeasonEvidenceBreakdown;
  confidence: SeasonConfidence;
  asOf: string;
};

export const valuationSampleSummary = {
  sourceRows: valuationMarketAggregate.sourceRows,
  eligibleRows: valuationMarketAggregate.eligibleRows,
  facebookRows: valuationMarketAggregate.sourceRowsBySource.facebook ?? 0,
  facebookEligibleRows: valuationMarketAggregate.sourceBreakdown.facebook ?? 0,
  driveRows: valuationMarketAggregate.sourceRowsBySource.google_drive ?? 0,
  driveEligibleRows: valuationMarketAggregate.sourceBreakdown.google_drive ?? 0,
  marketplaceRows:
    (valuationMarketAggregate.sourceRowsBySource["8591_hk"] ?? 0) +
    (valuationMarketAggregate.sourceRowsBySource["8591_tw"] ?? 0) +
    (valuationMarketAggregate.sourceRowsBySource.carousell_tw ?? 0),
  marketplaceEligibleRows:
    (valuationMarketAggregate.sourceBreakdown["8591_hk"] ?? 0) +
    (valuationMarketAggregate.sourceBreakdown["8591_tw"] ?? 0) +
    (valuationMarketAggregate.sourceBreakdown.carousell_tw ?? 0),
  secondaryMarketRows: 74,
  asOf: valuationMarketAggregate.asOf,
} as const;

const confidenceFor = (effectiveWeight: number): SeasonConfidence =>
  effectiveWeight >= 12
    ? "high"
    : effectiveWeight >= 5
      ? "medium"
      : effectiveWeight > 0
        ? "low"
        : "inferred";

export const seasonPriceBands: readonly SeasonPriceBand[] = deriveSeasonBands(
  valuationMarketAggregate,
  seasonBandSeeds,
).map((band) => {
  return {
    ...band,
    evidenceBreakdown: {
      directSale: band.sampleCount,
      professionalEstimate: 0,
      commentSignal: 0,
    },
    confidence: confidenceFor(band.effectiveWeight),
    asOf: valuationSampleSummary.asOf,
  };
});

export const seasonBandBySlug = new Map(
  seasonPriceBands.map((band) => [band.slug, band]),
);
