import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { seasons } from "../app/catalog-sources.ts";
import { fitWholeAccountModel, predictFreshModel, packageTiers, breakClasses } from "../app/valuation-fresh-core.js";
import { prepareWholeAccountEvidence } from "./lib/whole-account-evidence.mjs";

const [input, output, asOf, reviewPath, ...flags] = process.argv.slice(2);
if (!input || !output || !/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? "") || !reviewPath ||
    flags.some(flag => flag !== "--write")) throw new Error(
  "Usage: node --import tsx scripts/build-evidence-blended-model.mjs input.jsonl output.json YYYY-MM-DD review.json [--write]");
const raw = await readFile(input, "utf8");
const sourceDigest = createHash("sha256").update(raw).digest("hex");
const reviewText = await readFile(reviewPath, "utf8");
const review = JSON.parse(reviewText);
if (!review.sourceDigest) throw new Error("Review must identify the original source digest");
const rows = raw.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
const slugs = seasons.map(([slug]) => slug);
const report = prepareWholeAccountEvidence(rows, { seasons: slugs, sourceDigest, review });
const model = fitWholeAccountModel(report.accepted, { seasons: slugs });
// This is a technical publication check, never a validation/accuracy claim.
for (const season of [...slugs, null]) for (const packageTier of [...packageTiers, null]) for (const breakClass of [...breakClasses, null]) {
  const result = predictFreshModel(model, { season, packageTier, breakClass });
  if (!result.range || !(result.range.low > 0 && result.range.low <= result.midpoint && result.midpoint <= result.range.high))
    throw new Error("Invalid production prediction");
}
const data = {
  schemaVersion: 3, revision: model.revision, asOf, validation: "unvalidated", model,
  sourceRows: rows.length, eligibleRows: report.accepted.length,
  foreignRows: report.rejectionCounts.foreign_or_converted ?? 0, collectionComplete: false,
  provenance: {
    sourceDigest, reviewDigest: createHash("sha256").update(reviewText).digest("hex"),
    datasetDigest: report.datasetDigest, rejectionCounts: report.rejectionCounts,
    unknownSeasonRows: report.accepted.filter(row => row.season === null).length,
    unknownPackageRows: report.accepted.filter(row => row.packageTier === null).length,
    unknownBreakRows: report.accepted.filter(row => row.breakClass === null).length,
    unknownDateRows: report.accepted.filter(row => row.publishedAt === null).length,
    identityQuality: "post_ids_and_reviewed_surrogates_not_verified_account_ids",
    method: "whole-account log-price joint season/tier/break fit; no price splitting or exact-count proxies",
    interval: model.intervalKind,
  },
};
const serialized = JSON.stringify(data, null, 2) + "\n";
const previous = await readFile(output, "utf8").catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});
console.log(JSON.stringify({ sourceRows: rows.length, eligibleRows: data.eligibleRows,
  rejected: report.rejectionCounts, changed: previous !== serialized, write: flags.includes("--write"),
  seasons: Object.fromEntries(slugs.map(season => [season,
    predictFreshModel(model, { season, packageTier: "few", breakClass: "none" })])) }, null, 2));
if (flags.includes("--write")) await writeFile(output, serialized);
