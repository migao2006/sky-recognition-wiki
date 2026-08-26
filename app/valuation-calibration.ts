export type PackageTierKey = "few" | "medium" | "many" | "hundred";
export type PackageTier = {
  key: PackageTierKey;
  label: string;
  premium: number;
};

export const classifyPackageTier = (count: number): PackageTier => {
  if (count >= 100)
    return {
      key: "hundred",
      label: "百禮",
      premium: 23000 + Math.min(count - 100, 50) * 180,
    };
  if (count >= 40)
    return { key: "many", label: "多禮", premium: 8000 + (count - 40) * 250 };
  if (count >= 15)
    return { key: "medium", label: "中禮", premium: 2500 + (count - 15) * 150 };
  return { key: "few", label: "少禮", premium: count * 80 };
};
