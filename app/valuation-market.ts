import marketAggregate from "./valuation-market-aggregate.json";

export type MarketBreakClass = "none" | "slight" | "medium" | "big";
export type MarketAccountStyle = "simple" | "regular";

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

export const valuationMarketAggregate = marketAggregate;

export const classifyBreakClass = (
  completion: ReadonlyMap<string, { selected: number; expected: number }>,
) => {
  const rows = [...completion.values()].filter((row) => row.expected > 0);
  if (!rows.length)
    return {
      key: "big" as MarketBreakClass,
      missingSeasons: 0,
      completionRatio: 0,
    };
  const missingSeasons = rows.filter(
    (row) => row.selected < row.expected,
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
  return { key, missingSeasons, completionRatio };
};

export const classifyAccountStyle = ({
  packageCount,
  graduationCount,
  seasonCount,
}: {
  packageCount: number;
  graduationCount: number;
  seasonCount: number;
}): MarketAccountStyle =>
  packageCount < 15 && graduationCount <= 4 && seasonCount <= 8
    ? "simple"
    : "regular";

export const marketBreakMultiplier = (key: MarketBreakClass) =>
  marketAggregate.modifiers.breakClass[key].multiplier;

export const marketPackageMultiplier = (
  key: "few" | "medium" | "many" | "hundred",
) => marketAggregate.modifiers.packageTier[key].multiplier;

export const marketAccountStyleMultiplier = (key: MarketAccountStyle) =>
  marketAggregate.modifiers.accountStyle[key].multiplier;
