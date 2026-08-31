import marketAggregate from "./valuation-market-aggregate.json";

export type MarketBreakClass = "none" | "slight" | "medium" | "big";
export type MarketAccountStyle = "simple" | "regular";
export type PackageTierKey = "few" | "medium" | "many" | "hundred";

export const marketBreakClassNames: Record<MarketBreakClass, string> = {
  none: "無斷",
  slight: "微斷",
  medium: "中斷",
  big: "大斷",
};

export const marketAccountStyleNames: Record<MarketAccountStyle, string> = {
  simple: "簡號",
  regular: "一般帳號",
};

export const marketPackageTierNames: Record<PackageTierKey, string> = {
  few: "少禮",
  medium: "中禮",
  many: "多禮",
  hundred: "百禮",
};

export const valuationMarketAggregate = marketAggregate;

export type MarketValidationStatus =
  | "validated"
  | "legacy-unvalidated"
  | "unvalidated";

const validationStatus =
  (marketAggregate as { validationStatus?: string }).validationStatus === "validated" ||
  (marketAggregate as { validationStatus?: string }).validationStatus === "legacy-unvalidated"
    ? (marketAggregate as { validationStatus?: "validated" | "legacy-unvalidated" }).validationStatus
    : "unvalidated";

/** A UI-safe summary of whether the published aggregate passed the full model gates. */
export const marketValidation = {
  status: validationStatus as MarketValidationStatus,
  isValidated: validationStatus === "validated",
  confidenceCap:
    validationStatus === "validated" ? "high" : "low",
  label:
    validationStatus === "validated"
      ? "市場驗證完成"
      : "資料不足・參考估價",
} as const;

export const capConfidenceForMarketValidation = <T extends "high" | "medium" | "low" | "inferred">(
  confidence: T,
): T | "low" | "inferred" => {
  if (marketValidation.isValidated || confidence === "inferred") return confidence;
  return confidence === "high" || confidence === "medium" ? "low" : confidence;
};

export const classifyBreakClass = (
  completion: ReadonlyMap<string, { selected: number; expected: number }>,
) => {
  const rows = [...completion.values()].filter((row) => row.expected > 0);
  if (!rows.length)
    return {
      key: "big" as MarketBreakClass,
      missingSeasons: 0,
      partialSeasons: 0,
      completionRatio: 0,
    };
  const missingSeasons = rows.filter(
    (row) => row.selected === 0,
  ).length;
  const partialSeasons = rows.filter(
    (row) => row.selected > 0 && row.selected < row.expected,
  ).length;
  const completionRatio =
    rows.reduce(
      (sum, row) => sum + Math.min(1, row.selected / row.expected),
      0,
    ) / rows.length;
  const key: MarketBreakClass =
    missingSeasons === 0
      ? "none"
      : missingSeasons <= 2 && completionRatio >= 0.8
        ? "slight"
        : missingSeasons <= 5 || completionRatio >= 0.5
          ? "medium"
          : "big";
  return { key, missingSeasons, partialSeasons, completionRatio };
};

export const classifyAccountStyle = ({
  paidItemCount,
  graduationCount,
  seasonCount,
}: {
  paidItemCount: number;
  graduationCount: number;
  seasonCount: number;
}): MarketAccountStyle =>
  paidItemCount < 15 && graduationCount <= 4 && seasonCount <= 8
    ? "simple"
    : "regular";

export const marketBreakMultiplier = (key: MarketBreakClass) =>
  marketAggregate.modifiers.breakClass[key].multiplier;

export const marketPackageMultiplier = (
  key: PackageTierKey,
) => marketAggregate.modifiers.packageTier[key].multiplier;

export const marketAccountStyleMultiplier = (key: MarketAccountStyle) =>
  marketAggregate.modifiers.accountStyle[key].multiplier;
