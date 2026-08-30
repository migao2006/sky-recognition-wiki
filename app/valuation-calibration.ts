export type PackageTierKey = "few" | "medium" | "many" | "hundred";
export type PackageTier = {
  key: PackageTierKey;
  label: string;
  premium: number;
};

export type ExtraValueCap = { low: number; high: number };

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
export const packageValueCap = (count: number): ExtraValueCap => {
  if (count >= 100)
    return {
      low: 3300 + Math.min(count - 100, 50) * 50,
      high: 4000 + Math.min(count - 100, 50) * 70,
    };
  if (count >= 40)
    return {
      low: 1500 + (count - 40) * 30,
      high: 2200 + (count - 40) * 30,
    };
  if (count >= 15)
    return {
      low: 1000 + (count - 15) * 20,
      high: 1600 + (count - 15) * 25,
    };
  return { low: Math.min(900, count * 65), high: Math.min(1500, count * 110) };
};

export const limitedValueCap = (count: number): ExtraValueCap => ({
  low: Math.min(700, count * 200),
  high: Math.min(1200, count * 350),
});
