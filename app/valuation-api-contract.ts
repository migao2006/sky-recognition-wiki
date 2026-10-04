import manifest from "./valuation-tabpfn-manifest.json";
import type { SeasonPriceBand } from "./valuation-season-bands";

export type ModelFeatures = Record<string, string | number | null>;
export type ModelRequest = { schemaVersion: 1; features: ModelFeatures };
export type PackageAdjustment = { count: number | null; multiplier: number; basis: "count" | "tier" | "unknown" };
export type ModelResponse = {
  schemaVersion: 1; modelRevision: string; status: "unvalidated";
  midpoint: number; currency: "TWD"; range: null; seasonBands: SeasonPriceBand[];
  packageAdjustment?: PackageAdjustment;
};
const enums: Record<string, readonly string[]> = {
  season: manifest.seasons, breakClass: ["none", "slight", "medium", "large"],
  packageTier: ["few", "medium", "many", "hundred"], accountStyle: ["simple", "regular", "resource"],
};
export function isModelRequest(value: unknown): value is ModelRequest {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== 2 || obj.schemaVersion !== 1 || !obj.features || typeof obj.features !== "object" || Array.isArray(obj.features)) return false;
  return Object.entries(obj.features).every(([key, v]) => {
    if (!manifest.columns.includes(key)) return false;
    if (v === null) return true;
    if (key === "packageCount") return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 99999;
    const options = key.startsWith("item:") ? ["present", "absent"] : key.startsWith("binding:")
      ? ["unbound", "transferable", "不出", "遺失", "異常"] : enums[key];
    return options ? typeof v === "string" && options.includes(v)
      : typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= (key.startsWith("progress:") ? 1 : 99999);
  });
}
export function isModelResponse(value: unknown): value is ModelResponse {
  if (!value || typeof value !== "object") return false;
  const r = value as ModelResponse;
  const a = r.packageAdjustment;
  if (a !== undefined && (!a || !Number.isFinite(a.multiplier) || a.multiplier <= 0
    || !["count", "tier", "unknown"].includes(a.basis)
    || (a.basis === "count" ? !Number.isSafeInteger(a.count) || a.count! < 0 || a.count! > 99999 : a.count !== null))) return false;
  return r.schemaVersion === 1 && r.modelRevision === manifest.modelRevision && r.status === "unvalidated"
    && r.currency === "TWD" && r.range === null && Number.isFinite(r.midpoint) && r.midpoint > 0
    && Array.isArray(r.seasonBands) && r.seasonBands.length === manifest.seasons.length
    && r.seasonBands.every((b, i) => b.slug === manifest.seasons[i] && b.status === "unvalidated"
      && b.method === manifest.method && b.confidence === "inferred" && b.low === null && b.high === null
      && typeof b.median === "number" && Number.isFinite(b.median) && b.median > 0
      && b.sampleCount === manifest.seasonCounts[b.slug as keyof typeof manifest.seasonCounts] && b.asOf === manifest.asOf);
}
