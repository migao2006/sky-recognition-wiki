/** Build a private serving artifact from the strict title-evidenced cohort.
 *
 * The artifact deliberately contains fitted coefficients and aggregate
 * residuals only: never post text, URLs, account keys, or training rows.
 */
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fitWholeAccountModel } from "../app/valuation-fresh-core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const common = ["season", "breakClass", "packageTier"];
const titleAlpha = 3;
const bindingAlpha = 1;
const blendWeight = .5;
// Selected only from grouped inner validation on the final strict training
// cohort; the outer benchmark answers are not consulted here.
const correctedRidge = .3;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const finite = value => typeof value === "number" && Number.isFinite(value);
const tierForCount = count => Number.isSafeInteger(count) && count >= 0
  ? count >= 100 ? "hundred" : count >= 90 ? "many" : count >= 60 ? "medium" : "few"
  : null;
const featureVector = (row, centers) => {
  const values = [row.packageTier ?? tierForCount(row.features?.packageCount), row.breakClass === "big" ? "large" : row.breakClass];
  const levels = [ ["few", "medium", "many", "hundred"].indexOf(values[0]), ["none", "slight", "medium", "large"].indexOf(values[1]) ];
  return levels.flatMap((level, group) => [1, 2, 3].map((threshold, index) =>
    level < 0 ? 0 : Number(level >= threshold) - centers[group * 3 + index]));
};
const rawPrediction = (model, row) => {
  const season = row.season == null ? model.pooled : model.seasons[row.season];
  if (!season) throw new Error("Model is missing a canonical season");
  return Math.exp(season.logBase + featureVector(row, model.centers)
    .reduce((sum, value, index) => sum + value * model.coefficients[index], 0));
};
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
};
const titleKey = row => common.map(key => row[key] ?? "unknown").join("|");
const lockCount = row => Object.entries(row.features ?? {}).filter(([key, value]) =>
  key.startsWith("binding:") && value !== "transferable" && value !== "unbound" && value != null).length;
const strict = row => row.priceKind === "ask" && row.market === "taiwan" && row.server === "international"
  && row.currency === "TWD" && row.converted !== true && row.accountOnly !== false
  && common.every(key => row[key] != null) && finite(row.price) && row.price > 0;

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error("Usage: node scripts/build-strict-title-model.mjs <private-benchmark.json> <new-work-directory>");
const source = path.resolve(sourceArg);
const output = path.resolve(outputArg);
const work = path.resolve(root, "work") + path.sep;
if (!output.startsWith(work)) throw new Error("Private output must stay inside work/");
const bytes = await readFile(source);
const input = JSON.parse(bytes);
const rows = input.rows.filter(strict);
if (rows.length < 15) throw new Error("Strict title cohort needs at least 15 rows");
const groups = new Set(rows.map(row => row.splitGroup ?? row.accountKey));
if (new Set(rows.map(row => row.accountKey)).size !== rows.length)
  throw new Error("Strict training rows must have unique account identities");

// The plain model is deliberately ridge=1, exactly the non-residual half of
// the benchmarked geometric blend. The corrected model uses the same public
// feature contract and only shrunk residuals from this frozen strict cohort.
const plain = fitWholeAccountModel(rows, { seasons: input.seasons, priceKind: "ask", ridge: 1 });
const corrected = fitWholeAccountModel(rows, { seasons: input.seasons, priceKind: "ask", ridge: correctedRidge });
const titleBuckets = new Map();
for (const row of rows) {
  const value = Math.log(row.price / rawPrediction(corrected, row));
  const key = titleKey(row);
  titleBuckets.set(key, [...(titleBuckets.get(key) ?? []), value]);
}
const titleResiduals = Object.fromEntries([...titleBuckets].map(([key, values]) =>
  [key, median(values) * values.length / (values.length + titleAlpha)]));
// Residual cells are sparse. Project the final corrected surface onto the
// three market directions so a local residual cannot make a later season,
// larger break, or smaller package tier more expensive than its neighbour.
// This is a deterministic safety constraint, not an additional price sample.
const breakClasses = ["none", "slight", "medium", "large"];
const packageTiers = ["few", "medium", "many", "hundred"];
const grid = input.seasons.map(season => breakClasses.map(breakClass => packageTiers.map(packageTier => {
  const row = { season, breakClass, packageTier };
  const plainLog = Math.log(rawPrediction(plain, row));
  const correctedLog = Math.log(rawPrediction(corrected, row)) + (titleResiduals[titleKey(row)] ?? 0);
  return (1 - blendWeight) * plainLog + blendWeight * correctedLog;
})));
for (let pass = 0; pass < 30; pass++) {
  let changed = false;
  for (let season = 0; season < grid.length; season++) for (let breaks = 0; breaks < 4; breaks++) for (let packages = 0; packages < 4; packages++) {
    let next = grid[season][breaks][packages];
    if (season > 0) next = Math.min(next, grid[season - 1][breaks][packages]);
    if (breaks > 0) next = Math.min(next, grid[season][breaks - 1][packages]);
    if (packages > 0) next = Math.max(next, grid[season][breaks][packages - 1]);
    if (Math.abs(next - grid[season][breaks][packages]) > 1e-12) changed = true;
    grid[season][breaks][packages] = next;
  }
  if (!changed) break;
}
for (let season = 0; season < grid.length; season++) for (let breaks = 0; breaks < 4; breaks++) for (let packages = 0; packages < 4; packages++) {
  const row = { season: input.seasons[season], breakClass: breakClasses[breaks], packageTier: packageTiers[packages] };
  const plainLog = Math.log(rawPrediction(plain, row));
  const correctedLog = Math.log(rawPrediction(corrected, row));
  titleResiduals[titleKey(row)] = (grid[season][breaks][packages] - (1 - blendWeight) * plainLog) / blendWeight - correctedLog;
}
for (let season = 0; season < grid.length; season++) for (let breaks = 0; breaks < 4; breaks++) for (let packages = 0; packages < 4; packages++) {
  const value = grid[season][breaks][packages];
  if ((season > 0 && value > grid[season - 1][breaks][packages] + 1e-10)
      || (breaks > 0 && value > grid[season][breaks - 1][packages] + 1e-10)
      || (packages > 0 && value < grid[season][breaks][packages - 1] - 1e-10))
    throw new Error("Strict hybrid direction projection failed");
}
const bindingBuckets = new Map();
for (const row of rows) {
  const titleCorrection = titleResiduals[titleKey(row)] ?? 0;
  const value = Math.log(row.price / (rawPrediction(corrected, row) * Math.exp(titleCorrection)));
  const locks = String(lockCount(row));
  bindingBuckets.set(locks, [...(bindingBuckets.get(locks) ?? []), value]);
}
const pooled = [...bindingBuckets.values()].flat();
const bindingFallback = pooled.length ? median(pooled) : 0;
const bindingResiduals = Object.fromEntries([...bindingBuckets].map(([key, values]) =>
  [key, (median(values) * values.length + bindingFallback * bindingAlpha) / (values.length + bindingAlpha)]));
const artifact = {
  schemaVersion: 1,
  revision: "strict-title-binding-hybrid-2026-10-05",
  method: "strict-title-binding-hybrid",
  target: "asking_price_not_transaction",
  sourceDigest: digest(bytes),
  strictRows: rows.length,
  strictGroups: groups.size,
  seasons: input.seasons,
  seasonCounts: Object.fromEntries(input.seasons.map(season => [season, rows.filter(row => row.season === season).length])),
  titleAlpha,
  bindingAlpha,
  blendWeight,
  correctedRidge,
  plain,
  corrected,
  titleResiduals,
  bindingResiduals,
  bindingFallback,
};
await mkdir(output, { recursive: false });
const artifactPath = path.join(output, "model.private.json");
await writeFile(artifactPath, JSON.stringify(artifact), "utf8");
console.log(JSON.stringify({
  revision: artifact.revision, method: artifact.method, rowCount: rows.length, groupCount: groups.size,
  sourceDigest: artifact.sourceDigest, stateSha256: digest(await readFile(artifactPath)),
  seasonCounts: artifact.seasonCounts,
}));
