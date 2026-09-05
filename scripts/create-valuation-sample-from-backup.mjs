import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { tsImport } from "tsx/esm/api";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import { loadValuationRuntime } from "./load-valuation-runtime.mjs";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const backupPath = argument("--backup");
const outputPath = resolve(argument("--out", "work/valuation-backup-sample.private.jsonl"));
const priceTwd = Number(argument("--price-twd"));
const evidenceKind = argument("--evidence-kind", "professional_estimate");
const evidenceQuality = argument("--evidence-quality", "medium");
const groupId = argument("--group-id", "manual-account-backup");
const observedAt = new Date(argument("--observed-at", new Date().toISOString()));
const workRoot = resolve(import.meta.dirname, "..", "work");
const hashSalt = process.env.VALUATION_HASH_SALT?.trim() ?? "";

if (!backupPath || !Number.isFinite(priceTwd) || priceTwd <= 0) {
  throw new Error(
    "Usage: node scripts/create-valuation-sample-from-backup.mjs --backup <backup.json> --price-twd <amount> [--evidence-kind professional_estimate] [--evidence-quality medium] [--group-id manual-account-backup] [--observed-at ISO] [--out work/sample.jsonl]",
  );
}
if (!["sold", "professional_estimate"].includes(evidenceKind)) {
  throw new Error("--evidence-kind must be sold or professional_estimate");
}
if (!["high", "medium", "low"].includes(evidenceQuality)) {
  throw new Error("--evidence-quality must be high, medium, or low");
}
if (hashSalt.length < 32) {
  throw new Error("VALUATION_HASH_SALT must contain at least 32 characters");
}
if (!Number.isFinite(observedAt.getTime())) throw new Error("--observed-at must be a valid date");
const outputFromWork = relative(workRoot, outputPath);
if (!outputFromWork || outputFromWork.startsWith("..") || isAbsolute(outputFromWork)) {
  throw new Error("--out must point to a file inside work/");
}

const [catalog, valuation, backupRuntime, backupText] = await Promise.all([
  loadRuntimeCatalog(),
  loadValuationRuntime(),
  tsImport("../app/account-backup.ts", import.meta.url),
  readFile(resolve(backupPath), "utf8"),
]);
const validGuids = new Set(catalog.wikiItems.map((item) => item.guid));
const itemByGuid = new Map(catalog.wikiItems.map((item) => [item.guid, item]));
const imported = backupRuntime.parseAccountBackup(JSON.parse(backupText), validGuids);
if (imported.ignored || imported.unknownGuids.length || imported.invalidEntries) {
  throw new Error(`Backup contains ${imported.ignored} ignored or unknown owned-item entries`);
}
if (!imported.account.bindingsConfirmed) {
  throw new Error("Backup binding states must be explicitly confirmed");
}
const chosen = imported.owned.map((guid) => itemByGuid.get(guid)).filter(Boolean);
if (!chosen.length) throw new Error("Backup has no recognized owned items");
const domain = { ...catalog, getZhName: catalog.zhItemName };
const analysis = valuation.analyzeValuation({
  chosen,
  bindings: imported.bindings,
  bindingNote: imported.account.bindingNote,
  domain,
});
const resources = {
  candles: imported.account.candles,
  hearts: imported.account.hearts,
  ascended: imported.account.ascended,
  passes: imported.account.passes,
};
const estimate = valuation.estimateValuation({ analysis, resources });
if (!estimate?.modelFeatures) throw new Error("Backup could not produce a complete valuation predictor");

const stableHash = (label, value) =>
  createHmac("sha256", hashSalt).update(`${label}:${value}`, "utf8").digest("hex");
const accountSnapshot = JSON.stringify({
  owned: [...imported.owned].sort(),
  bindings: imported.bindings,
  resources,
  accountType: imported.account.accountType,
});
const accountFingerprint = stableHash("account", accountSnapshot);
const seasonProgress = Object.fromEntries(
  [...analysis.seasonCompletion.entries()].map(([slug, progress]) => [
    slug,
    progress.expected > 0 && progress.selected === progress.expected
      ? "畢"
      : `${progress.selected}/${progress.expected}`,
  ]),
);
const row = {
  schema_version: 1,
  source: "manual_backup",
  post_hash: stableHash(
    "sample",
    `${accountFingerprint}:${priceTwd}:${evidenceKind}:${observedAt.toISOString()}`,
  ),
  group_hash: stableHash("group", groupId),
  account_fingerprint: accountFingerprint,
  observed_at: observedAt.toISOString(),
  price_twd: priceTwd,
  price_kind: evidenceKind,
  evidence_kind: evidenceKind,
  evidence_quality: evidenceQuality,
  region: "international",
  currency: "twd",
  start_season_slug: analysis.startSeasonSlug,
  start_season_confidence: "structured",
  season_progress: seasonProgress,
  computed_break_class: estimate.marketProfile.breakClass,
  missing_season_count: estimate.marketProfile.missingSeasons,
  completion_ratio: estimate.marketProfile.completionRatio,
  paid_package_count: estimate.marketProfile.canonicalPackageCount,
  computed_package_tier: estimate.marketProfile.packageTier,
  account_style: estimate.marketProfile.accountStyle,
  limited_item_count: analysis.limited.length,
  graduation_gift_count: analysis.ultimates.length,
  valuation_model: estimate.modelFeatures,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(row)}\n`, "utf8");
console.log(JSON.stringify({
  output: relative(resolve(import.meta.dirname, ".."), outputPath),
  recognized_items: chosen.length,
  start_season_slug: row.start_season_slug,
  price_twd: row.price_twd,
  predictor_complete: true,
}, null, 2));
