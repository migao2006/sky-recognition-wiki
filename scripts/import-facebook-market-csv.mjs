import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adaptFacebookCsvRow, dedupeFacebookMarketRows } from "./lib/facebook-market-csv.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), write = args.includes("--write");
const positional = args.filter(arg => arg !== "--write");
if (positional.length !== 2) throw new Error("Usage: node scripts/import-facebook-market-csv.mjs <private.csv> <work/output-dir> [--write]");
const source = path.resolve(positional[0]), output = path.resolve(positional[1]);
const workRoot = path.join(root, "work") + path.sep;
if (!source.startsWith(workRoot) || !output.startsWith(workRoot)) throw new Error("Raw input and output must stay inside work/");
const raw = await readFile(source);
const csvRows = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, bom: true });
const accepted = [], rejected = [];
for (const row of csvRows) {
  const result = adaptFacebookCsvRow(row);
  accepted.push(...result.accepted); rejected.push(...result.rejected);
}
const deduped = dedupeFacebookMarketRows(accepted);
rejected.push(...deduped.rejected);
const strictRows = deduped.kept.filter(row => row.priceKind === "ask" && row.season && row.breakClass && row.packageTier);
const counts = values => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map())]
  .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const report = {
  schemaVersion: 1,
  sourceSha256: createHash("sha256").update(raw).digest("hex"),
  inputRows: csvRows.length,
  acceptedBeforeDedupe: accepted.length,
  accepted: deduped.kept.length,
  strictAskRows: strictRows.length,
  uniquePosts: new Set(deduped.kept.map(row => row.stablePost)).size,
  splitAccounts: deduped.kept.filter(row => row.separateAccountInPost).length,
  inferredCurrency: deduped.kept.filter(row => row.currencyInferred).length,
  bySeason: counts(strictRows.map(row => row.season)),
  byBreak: counts(strictRows.map(row => row.breakClass)),
  byPackage: counts(strictRows.map(row => row.packageTier)),
  rejectionReasons: counts(rejected.map(row => row.reason)),
};
console.log(JSON.stringify(report, null, 2));
if (write) {
  await mkdir(output, { recursive: false });
  await writeFile(path.join(output, "market-rows.private.json"), JSON.stringify({ schemaVersion: 1, rows: deduped.kept }) + "\n", { flag: "wx" });
  await writeFile(path.join(output, "audit-summary.private.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  await writeFile(path.join(output, "rejections.private.json"), JSON.stringify({ schemaVersion: 1, rows: rejected }, null, 2) + "\n", { flag: "wx" });
}

