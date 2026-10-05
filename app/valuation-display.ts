export const formatTwd = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;

export const referencePriceText = (midpoint: number | null | undefined, itemCount: number) =>
  midpoint != null ? formatTwd(midpoint) : itemCount ? "估價載入失敗" : "請先選擇物品";

export const referenceRangeText = (range: { low: number; high: number } | null | undefined) =>
  range ? `參考區間 ${formatTwd(range.low)}～${formatTwd(range.high)}` : "";

export const estimationMethodName = (method: string | null) =>
  ({ "bounded-percentage": "基準受限百分比模型 · 未驗證推估",
    "strict-title-binding-hybrid": "嚴格標題與綁定混合模型 · 未驗證推估",
    monotone: "單調行情模型 · 未驗證推估", percentage: "百分比行情模型 · 未驗證推估",
    tabpfn: "TabPFN v2 延伸版 · 未驗證推估", direct: "同起季整號行情", interpolated: "相鄰季節趨勢推算",
    extrapolated: "季節趨勢延伸推算", pooled: "未指定起季的整號推算" }[method ?? ""] ?? "重新載入後再試");
