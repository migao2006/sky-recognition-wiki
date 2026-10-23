import type { AccountSummary } from "./account-summary";
import valuationArtifact from "./valuation-fresh-data.json";
import {
  packageTierForCount,
  predictFreshModel,
} from "./valuation-fresh-core.js";

export type ValuationMethod = "direct" | "interpolated" | "extrapolated" | "pooled";
export type ValuationPackageTier = "few" | "medium" | "many" | "hundred";

export type AccountValuation = {
  status: "unvalidated" | "unavailable";
  midpoint: number | null;
  range: { low: number; high: number } | null;
  season: string | null;
  breakClass: AccountSummary["breakClass"];
  packageTier: ValuationPackageTier;
  packageCount: number;
  method: ValuationMethod | null;
  sampleCount: number;
  preliminary: boolean;
  revision: string;
  asOf: string;
};

export const valuationPackageTierNames: Record<ValuationPackageTier, string> = {
  few: "少禮",
  medium: "中禮",
  many: "多禮",
  hundred: "百禮",
};

export const valuationMethodNames: Record<ValuationMethod, string> = {
  direct: "直接行情",
  interpolated: "相鄰季推算",
  extrapolated: "季序外推",
  pooled: "全市場推算",
};

export const estimateAccountValue = (
  summary: AccountSummary,
  wardrobeConfirmed: boolean,
): AccountValuation => {
  const packageTier = packageTierForCount(
    summary.canonicalPackageCount,
  ) as ValuationPackageTier;
  const prediction = predictFreshModel(valuationArtifact.model, {
    season: summary.startSeasonSlug,
    breakClass: summary.breakClass,
    packageCount: summary.canonicalPackageCount,
  });
  const method = ["direct", "interpolated", "extrapolated", "pooled"].includes(
    prediction.method,
  )
    ? (prediction.method as ValuationMethod)
    : null;

  return {
    status: prediction.status === "unvalidated" ? "unvalidated" : "unavailable",
    midpoint: prediction.midpoint,
    range: prediction.range,
    season: summary.startSeasonSlug,
    breakClass: summary.breakClass,
    packageTier,
    packageCount: summary.canonicalPackageCount,
    method,
    sampleCount: prediction.sampleCount,
    preliminary: !wardrobeConfirmed,
    revision: prediction.revision,
    asOf: valuationArtifact.asOf,
  };
};
