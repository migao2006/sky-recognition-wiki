import { readFile, writeFile } from "node:fs/promises";
import { seasons } from "../app/catalog-sources.ts";
import { fitEvidenceBlendedModel } from "../app/valuation-fresh-core.js";

const [input, output, asOf = "2026-10-04"] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node --import tsx scripts/build-evidence-blended-model.mjs input.jsonl app/valuation-fresh-data.json [asOf]");
const rows = (await readFile(input, "utf8")).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const slugs = seasons.map(([slug]) => slug);
const known = new Set(slugs);
const eligible = [];
const tierProxy = { few: 30, medium: 75, many: 120, hundred: 170 };
for (const row of rows) {
  if (row.currency !== "TWD" || row.region !== "international" || row.price_kind !== "ask") continue;
  const low = Number(row.price_twd_low), high = Number(row.price_twd_high);
  if (!Number.isFinite(low) || low <= 0 || !Number.isFinite(high) || high < low) continue;
  const progress = Object.entries(row.season_progress ?? {})
    .filter(([season, value]) => known.has(season) && (value === "complete" || value === "畢" ||
      (typeof value === "string" && /^\d+\/\d+$/.test(value) && Number(value.split("/")[0]) > 0)))
    .map(([season]) => season);
  if (!progress.length) continue;
  const price = (low + high) / 2;
  const weight = progress.length === 1 ? 1 : 0.25;
  const priceShare = price / progress.length;
  const exactPackageCount = Number.isSafeInteger(row.paid_package_count) ? row.paid_package_count : null;
  const packageTier = row.computed_package_tier ?? row.seller_package_label;
  const packageCount = exactPackageCount ?? tierProxy[packageTier] ?? null;
  eligible.push({
    id: row.post_hash,
    price,
    packageCount,
    packageInputKind: exactPackageCount === null && packageCount !== null ? "tier_proxy" : "exact",
    seasonEvidence: progress.map(season => ({ season, weight, priceShare,
      breakClass: row.computed_break_class ?? "unknown" })),
  });
}
const model = fitEvidenceBlendedModel(eligible, { seasons: slugs });
const outputData = {
  schemaVersion: 2,
  revision: model.revision,
  asOf,
  validation: "unvalidated",
  model,
  sourceRows: rows.length,
  foreignRows: 0,
  eligibleRows: eligible.length,
  collectionComplete: false,
  provenance: {
    source: input,
    method: "reviewed Taiwan TWD listings; cross-season rows split by explicit season_progress and weighted 0.25",
    directRows: eligible.filter(row => row.seasonEvidence.length === 1).length,
    crossSeasonRows: eligible.filter(row => row.seasonEvidence.length > 1).length,
    packageCountRows: eligible.filter(row => Number.isSafeInteger(row.packageCount)).length,
    packageTierProxyRows: eligible.filter(row => row.packageInputKind === "tier_proxy").length,
    interval: "weighted empirical quartiles; not a prediction interval",
  },
  reason: "Candidate only. It is not independently holdout-validated and must remain labelled unvalidated.",
};
await writeFile(output, JSON.stringify(outputData, null, 2) + "\n", { flag: "w" });
console.log(JSON.stringify({ eligible: eligible.length, directRows: outputData.provenance.directRows,
  crossSeasonRows: outputData.provenance.crossSeasonRows, packageCountRows: outputData.provenance.packageCountRows,
  output }, null, 2));
