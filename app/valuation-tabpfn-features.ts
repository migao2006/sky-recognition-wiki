import manifest from "./valuation-tabpfn-manifest.json";
import type { AccountInfo } from "./account-config";
import type { ValuationAnalysis, ValuationEstimate } from "./valuation-analysis";
import type { ModelRequest } from "./valuation-api-contract";

const platforms: Record<string, string> = { GG: "google", GC: "gameCenter", NS: "nintendo", PSN: "playstation", STEAM: "steam", FB: "facebook" };
export function buildModelRequest(analysis: ValuationAnalysis, estimate: ValuationEstimate,
  account: AccountInfo, owned: ReadonlySet<string>): ModelRequest {
  const count = estimate.marketProfile.canonicalPackageCount;
  const values: ModelRequest["features"] = {
    season: account.wardrobeConfirmed ? analysis.startSeasonSlug : null,
    breakClass: account.wardrobeConfirmed && analysis.seasonCompletion.size
      ? estimate.marketProfile.breakClass === "big" ? "large" : estimate.marketProfile.breakClass : null,
    packageTier: account.wardrobeConfirmed ? count >= 100 ? "hundred" : estimate.marketProfile.salePackageTier : null,
    packageCount: account.wardrobeConfirmed ? count : null,
    // Textual simple/resource claims cannot be inferred from a wardrobe size.
    accountStyle: null,
  };
  for (const key of manifest.columns) {
    if (["candles", "hearts", "ascended", "passes"].includes(key)) {
      const raw = account[key as "candles" | "hearts" | "ascended" | "passes"];
      values[key] = /^\d+$/.test(raw) ? Number(raw) : null;
    } else if (key.startsWith("progress:")) {
      const state = analysis.seasonCompletion.get(key.slice(9));
      values[key] = account.wardrobeConfirmed && state?.expected ? Math.min(1, state.selected / state.expected) : null;
    } else if (key.startsWith("item:")) {
      values[key] = owned.has(key.slice(5)) ? "present" : account.wardrobeConfirmed ? "absent" : null;
    } else if (key.startsWith("binding:")) {
      const status = analysis.bindings[platforms[key.slice(8)]];
      // Combined UI "lost/abnormal" cannot assert either distinct training category.
      values[key] = account.bindingsConfirmed ? ({ none: "unbound", transfer: "transferable", keep: "不出" } as Record<string, string>)[status] ?? null : null;
    }
  }
  return { schemaVersion: 1, features: Object.fromEntries(manifest.columns.map(k => [k, values[k] ?? null])) };
}
