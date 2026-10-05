import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { facebookPostHash } from "./lib/facebook-market-csv.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), write = args.includes("--write"), positional = args.filter(arg => arg !== "--write");
if (positional.length !== 3) throw new Error("Usage: node scripts/merge-facebook-market-benchmark.mjs <benchmark.json> <facebook-rows.json> <work/output-dir> [--write]");
const [basePath, facebookPath, outputPath] = positional.map(value => path.resolve(value));
const workRoot = path.join(root, "work") + path.sep;
if (![basePath, facebookPath, outputPath].every(value => value.startsWith(workRoot))) throw new Error("All inputs and outputs must stay inside work/");
const baseBytes = await readFile(basePath), facebookBytes = await readFile(facebookPath);
const base = JSON.parse(baseBytes), facebook = JSON.parse(facebookBytes);
const existingPostHashes = new Set(base.rows.flatMap(row => [...String(row.postKey ?? "").matchAll(/(?<!\d)(\d{12,20})(?!\d)/gu)]
  .map(match => facebookPostHash(match[1]))));
const eligibleNew = facebook.rows.filter(row => row.priceKind === "ask" && row.season && row.breakClass && row.packageTier);
const duplicatePosts = eligibleNew.filter(row => existingPostHashes.has(row.stablePost));
const additions = eligibleNew.filter(row => !existingPostHashes.has(row.stablePost));
const rows = [...base.rows, ...additions];
// A release comparison must keep every frozen source account in its previous
// holdout. Assign only new seller groups, otherwise adding rows changes the
// old answer sheet and makes before/after metrics incomparable.
const foldForNewGroup = group => Number.parseInt(createHash("sha256")
  .update(`facebook-market-new-fold-v1:${group}`).digest("hex").slice(0, 8), 16) % 5;
const newGroupFolds = new Map();
for (const row of additions) {
  const group = row.splitGroup ?? row.accountKey;
  if (!newGroupFolds.has(group)) newGroupFolds.set(group, foldForNewGroup(group));
  row.fold = newGroupFolds.get(group);
}
const result = {
  ...base,
  schemaVersion: 1,
  validation: "development_only",
  productionChanged: false,
  sourceDigest: createHash("sha256").update(baseBytes).update(facebookBytes).digest("hex"),
  foldCommitment: createHash("sha256").update(JSON.stringify(rows.map(row => [row.accountKey, row.fold]))).digest("hex"),
  rows,
};
const report = {
  baseRows: base.rows.length,
  eligibleNewRows: eligibleNew.length,
  duplicateSourcePosts: duplicatePosts.length,
  addedRows: additions.length,
  combinedRows: rows.length,
  strictAskRows: rows.filter(row => row.priceKind === "ask" && row.market === "taiwan" && row.server === "international" && row.currency === "TWD" && row.season && row.breakClass && row.packageTier).length,
  sourceDigest: result.sourceDigest,
  foldCommitment: result.foldCommitment,
};
console.log(JSON.stringify(report, null, 2));
if (write) {
  await mkdir(outputPath, { recursive: false });
  await writeFile(path.join(outputPath, "benchmark.private.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  await writeFile(path.join(outputPath, "merge-summary.private.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
