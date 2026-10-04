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

export const marketValidation = { status: "unvalidated", isValidated: false, label: "參考估價" } as const;

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


export type SalePackageTierKey = "few" | "medium" | "many";
export const classifySalePackageTier = (count: number): { key: SalePackageTierKey; label: string } =>
  count >= 90 ? { key: "many", label: "多禮" } : count >= 60 ? { key: "medium", label: "中禮" } : { key: "few", label: "少禮" };
