import type { PackageTierKey } from "./valuation-market";

export type PackageTier = {
  key: PackageTierKey;
  label: string;
  premium: number;
};

export type ExtraValueCap = { low: number; high: number };

export type ExtraValueContext = {
  conservative?: boolean;
};

export const classifyPackageTier = (count: number): PackageTier => {
  if (count >= 100)
    return {
      key: "hundred",
      label: "百禮",
      premium: 2500 + Math.min(count - 100, 50) * 60,
    };
  if (count >= 40)
    return { key: "many", label: "多禮", premium: 1100 + (count - 40) * 25 };
  if (count >= 15)
    return { key: "medium", label: "中禮", premium: 600 + (count - 15) * 20 };
  return { key: "few", label: "少禮", premium: count * 40 };
};

// Paid cosmetics retain only a diminishing share of their original purchase
// cost on a bundled account. The cap prevents a modern multi-pack account from
// being valued like an early-season scarce account solely by adding IAPs.
export const packageValueCap = (
  count: number,
  { conservative = false }: ExtraValueContext = {},
): ExtraValueCap => {
  let cap: ExtraValueCap;
  if (count >= 100)
    cap = {
      low: 3300 + Math.min(count - 100, 50) * 50,
      high: 4000 + Math.min(count - 100, 50) * 70,
    };
  else if (count >= 40)
    cap = {
      low: 1500 + (count - 40) * 30,
      high: 2200 + (count - 40) * 30,
    };
  else if (count >= 15)
    cap = {
      low: 1000 + (count - 15) * 20,
      high: 1600 + (count - 15) * 25,
    };
  else
    cap = {
      low: Math.min(900, count * 65),
      high: Math.min(1500, count * 110),
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
