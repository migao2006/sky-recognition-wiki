import { readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { seasons, seasonZh, seasonSearchAliases } from "../app/catalog-sources.ts";
import { wikiItems } from "../app/catalog-seeds.ts";
import { zhItemSearchNames } from "../app/catalog-zh.ts";
import { buildCatalogNameResolver } from "../app/catalog-name-resolver.ts";
import { extractBenchmarkFeatures, fixedFolds } from "./lib/benchmark-features.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node --import tsx scripts/export-market-benchmark.mjs work/graded.json work/benchmark.json");
const raw = await readFile(input, "utf8"), report = JSON.parse(raw);
const slugs = seasons.map(([s]) => s);
const seasonNames = Object.fromEntries(slugs.map(s => [s, [...new Set([seasonZh[s].replace(/季$/, ""), ...(seasonSearchAliases[s] ?? [])])]]));
for (const [slug, names] of Object.entries({ rhythm: ["音"], "the-little-prince": ["王子"], abyss: ["深淵"], "dear-van-gogh": ["梵谷"] }))
  seasonNames[slug] = [...new Set([...seasonNames[slug], ...names])];
const resolver = buildCatalogNameResolver(wikiItems, zhItemSearchNames);
const rows = report.accepted.map(row => ({ ...row,
  originalFeatures: { season: row.season, packageTier: row.packageTier, breakClass: row.breakClass },
  ...extractBenchmarkFeatures(row, { seasons: slugs, seasonNames, resolveItem: resolver.resolve }),
  sourceFamily: row.sourceFormat === "drive" ? "drive" : "facebook" }));
// Multiple accounts advertised in one post remain different observations,
// but cannot leak their shared post across training/test partitions.
for (const row of rows) row.splitGroup = row.stablePost || row.postKey.match(/-post-(\d+)/)?.[1]
  ? `facebook-post:${row.stablePost ?? row.postKey.match(/-post-(\d+)/)[1]}` : row.accountKey;
for (const kind of ["ask", "sold_proxy", "sold"]) {
  const cohort = rows.filter(r => r.priceKind === kind), folds = fixedFolds(cohort);
  cohort.forEach((r, i) => { r.fold = folds[i]; });
}
const result = { schemaVersion: 1, validation: "development_only", productionChanged: false,
  seed: 42, seasons: slugs, sourceDigest: createHash("sha256").update(raw).digest("hex"),
  foldCommitment: createHash("sha256").update(JSON.stringify(rows.map(r => [r.accountKey, r.fold]))).digest("hex"), rows };
const root = await realpath("work"), target = path.resolve(output), parent = await realpath(path.dirname(target));
const relative = path.relative(root, parent);
if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Private output must stay in work");
await writeFile(path.join(parent, path.basename(target)), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ rows: rows.length, corrections: rows.reduce((n, r) => n + r.corrections.length, 0),
  extendedRows: rows.filter(r => Object.keys(r.features).length).length, foldCommitment: result.foldCommitment }));
