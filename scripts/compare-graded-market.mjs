import { readFile, writeFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seasons, seasonZh, seasonSearchAliases } from "../app/catalog-sources.ts";
import { prepareGradedEvidence, compareGradedModels } from "./lib/graded-market-evidence.mjs";

const [configPath, ...flags] = process.argv.slice(2);
if (!configPath || (flags.length && (flags.length !== 2 || flags[0] !== "--out")))
  throw new Error("Usage: node --import tsx scripts/compare-graded-market.mjs work/sources.json [--out work/report.json]");
const config = JSON.parse(await readFile(configPath, "utf8"));
if (!Array.isArray(config.sources) || !config.sources.length || !/^\d{4}-\d{2}-\d{2}$/.test(config.asOf ?? ""))
  throw new Error("Invalid source configuration");
const batches = [];
for (const source of config.sources) {
  if (!["legacy", "facebook", "transaction", "drive"].includes(source.format)) throw new Error("Unknown source format");
  const raw = await readFile(source.path, "utf8");
  batches.push({ format: source.format, rows: raw.split(/\r?\n/).filter(s => s.trim()).map(JSON.parse),
    sourceDigest: createHash("sha256").update(raw).digest("hex"),
    review: source.review ? JSON.parse(await readFile(source.review, "utf8")) : undefined });
}
const slugs = seasons.map(([s]) => s);
const seasonNames = Object.fromEntries(slugs.map(s => [s, [seasonZh[s].replace(/季$/, ""), ...(seasonSearchAliases[s] ?? [])]]));
for (const [slug, aliases] of Object.entries({ rhythm: ["音"], "the-little-prince": ["王子"], abyss: ["深淵"], "dear-van-gogh": ["梵谷"] }))
  seasonNames[slug].push(...aliases);
const evidence = prepareGradedEvidence(batches, { seasons: slugs, asOf: config.asOf, seasonNames });
const report = { schemaVersion: 1, asOf: config.asOf, validation: "unvalidated", productionChanged: false,
  sources: batches.map(b => ({ format: b.format, count: b.rows.length, digest: b.sourceDigest })),
  ...evidence, comparison: compareGradedModels(evidence.accepted, { seasons: slugs }) };
if (flags.length) {
  const root = await realpath(fileURLToPath(new URL("../work", import.meta.url)));
  const target = path.resolve(flags[1]), parent = await realpath(path.dirname(target)), relative = path.relative(root, parent);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("Private output must stay in work");
  await writeFile(path.join(parent, path.basename(target)), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ sources: report.sources, accepted: evidence.accepted.length, rejected: evidence.rejectionCounts,
  comparison: Object.fromEntries(Object.entries(report.comparison).map(([kind, r]) => [kind,
    { count: r.count, missing: r.missing, knownDates: r.knownDates, unknownDates: { ...r.unknownDates,
      bySeason: undefined, byPackage: undefined, byBreak: undefined, bySource: undefined } }])), productionChanged: false }, null, 2));
