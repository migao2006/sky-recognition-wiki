import { readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { seasons } from "../app/catalog-sources.ts";
import { reviewTransactions, evaluateTransactionDevelopment } from "./lib/transaction-valuation.mjs";

const [input, asOf, ...flags] = process.argv.slice(2);
if (!input || !asOf || (flags.length && (flags.length !== 2 || flags[0] !== "--out")))
  throw new Error("Usage: node --import tsx scripts/audit-transaction-valuation.mjs input.jsonl YYYY-MM-DD [--out work/report.json]");
const source = await readFile(input, "utf8");
const rows = source.split(/\r?\n/).filter(line => line.trim()).map(JSON.parse);
const slugs = seasons.map(([slug]) => slug);
const evidence = reviewTransactions(rows, { seasons: slugs, asOf });
const report = { schemaVersion: 1, asOf, target: "sold_TWD_hit10_at_least_90_percent", validation: "unvalidated",
  sourceRows: rows.length, eligibleTransactions: evidence.accepted.length,
  sourceDigest: createHash("sha256").update(source).digest("hex"),
  legacySoldLabels: rows.filter(r => r.price_kind === "sold").length,
  datasetDigest: evidence.datasetDigest, rejectionCounts: evidence.rejectionCounts,
  collectionTarget: 500, independentHoldoutTarget: 100,
  missingSeasons: slugs.filter(slug => !evidence.accepted.some(r => r.season === slug)),
  evaluation: evaluateTransactionDevelopment(evidence.accepted, { seasons: slugs }), productionChanged: false };
if (flags.length) {
  const root = await realpath(fileURLToPath(new URL("../work", import.meta.url)));
  const target = path.resolve(flags[1]), parent = await realpath(path.dirname(target));
  const relative = path.relative(root, parent);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
    throw new Error("Output must remain in private work directory");
  await writeFile(path.join(parent, path.basename(target)), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify(report, null, 2));
