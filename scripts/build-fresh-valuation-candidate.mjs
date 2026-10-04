import { readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seasons } from "../app/catalog-sources.ts";
import { reviewFreshEvidence } from "./lib/fresh-valuation-evidence.mjs";
import { fitWholeAccountModel } from "../app/valuation-fresh-core.js";

// Manual invocation only. Never replaces production data or bypasses holdout.
const [input, output, asOf, recheckedSince] = process.argv.slice(2);
if (!input || !output || !asOf || !recheckedSince) throw new Error(
  "Usage: node --import tsx scripts/build-fresh-valuation-candidate.mjs input.jsonl work/output.json YYYY-MM-DD YYYY-MM-DD");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../work");
const parent = await realpath(path.dirname(path.resolve(output)));
const relative = path.relative(await realpath(root), parent);
if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must remain in private work directory");
const rows = (await readFile(input, "utf8")).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
const slugs = seasons.map(([slug]) => slug);
const report = reviewFreshEvidence(rows, { asOf, recheckedSince, seasons: slugs });
const asks = report.accepted.filter(row => row.priceKind === "ask");
const model = fitWholeAccountModel(asks, { seasons: slugs });
await writeFile(path.join(parent, path.basename(output)), JSON.stringify({ ...report, model }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ accepted: report.accepted.length, rejected: report.rejected.length,
  coverage: report.coverage, validation: "unvalidated", productionChanged: false }, null, 2));
