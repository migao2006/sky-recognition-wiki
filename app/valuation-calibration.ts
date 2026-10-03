import type { PackageTierKey } from "./valuation-market";
import { interpolateIncreasing, progressivePackageValue } from "./valuation-reference";

type PackageTier = {
  key: PackageTierKey;
  label: string;
  premium: number;
};

export type SalePackageTierKey = "few" | "medium" | "many";

type SalePackageTier = {
  key: SalePackageTierKey;
  label: "少禮" | "中禮" | "多禮";
};

type ExtraValueCap = { low: number; high: number };

type ExtraValueContext = {
  conservative?: boolean;
};

export const classifyPackageTier = (count: number): PackageTier => {
  if (count >= 100)
    return {
      key: "hundred",
      label: "百禮",
      premium: progressivePackageValue(count),
    };
  if (count >= 40)
    return { key: "many", label: "多禮", premium: progressivePackageValue(count) };
  if (count >= 15)
    return { key: "medium", label: "中禮", premium: progressivePackageValue(count) };
  return { key: "few", label: "少禮", premium: progressivePackageValue(count) };
};

// 玩家文案中的少／中／多禮，是以不重複的實際禮包數判斷。
// 全禮數隨 catalog 變動，不以固定數量當完成上限。交易文案庫把 60／70 禮視為
// 一般禮包量、90 禮視為近百禮，因此三段標題以 60、90 為界。
// 免費活動物品、季節畢業禮與同一禮包內的多件物品都不重複計入。
export const classifySalePackageTier = (
  canonicalPackageCount: number,
): SalePackageTier => {
  if (canonicalPackageCount >= 90) return { key: "many", label: "多禮" };
  if (canonicalPackageCount >= 60) return { key: "medium", label: "中禮" };
  return { key: "few", label: "少禮" };
};

// Paid cosmetics retain only a diminishing share of their original purchase
// cost on a bundled account. The cap prevents a modern multi-pack account from
// being valued like an early-season scarce account solely by adding IAPs.
export const packageValueCap = (
  count: number,
  { conservative = false }: ExtraValueContext = {},
): ExtraValueCap => {
  const cap: ExtraValueCap = {
    low: interpolateIncreasing(count, [[0, 0], [15, 1000], [40, 1500], [100, 3300], [150, 5800]]),
    high: interpolateIncreasing(count, [[0, 0], [15, 1600], [40, 2200], [100, 4000], [150, 7500]]),
  };

  return conservative
    ? { low: Math.min(cap.low, 700), high: Math.min(cap.high, 1000) }
    : cap;
};

export const limitedValueCap = (
  count: number,
  { conservative = false }: ExtraValueContext = {},
): ExtraValueCap => ({
  low: Math.min(conservative ? 300 : 700, count * 200),
  high: Math.min(conservative ? 500 : 1200, count * 350),
});
