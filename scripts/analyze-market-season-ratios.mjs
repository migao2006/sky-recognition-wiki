import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { seasonSlugs } from "./collect-public-market-listings.mjs";

const quantile = (values, percentile) => {
  const ordered = [...values].sort((left, right) => left - right);
  if (!ordered.length) return null;
  return ordered[Math.floor((ordered.length - 1) * percentile)];
};

const roundRatio = (value) => Math.round(value * 1_000) / 1_000;

const marketKeyFor = (row) => {
  const source = String(row.source ?? "").trim().toLowerCase();
  const currency = String(row.currency_original ?? "").trim().toUpperCase();
  return source && currency ? `${source}:${currency}` : null;
};

const isEligible = (row) =>
  row?.account_candidate === true &&
  row?.relative_price_candidate === true &&
  row?.price_outlier !== true &&
  row?.season_graduation_count_consistent === true &&
  seasonSlugs.includes(row?.start_season_candidate) &&
  Number.isFinite(row?.price_original) &&
  row.price_original > 0 &&
  Boolean(marketKeyFor(row));

export const buildSeasonRatioReport = (rows, { minimumSamples = 3 } = {}) => {
  if (!Number.isInteger(minimumSamples) || minimumSamples < 2)
    throw new Error("minimumSamples must be an integer of at least 2");

  const eligibleRows = rows.filter(isEligible);
  const marketRows = new Map();
  for (const row of eligibleRows) {
    const key = marketKeyFor(row);
    const values = marketRows.get(key) ?? [];
    values.push(row);
    marketRows.set(key, values);
  }

  const markets = [...marketRows.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([market, entries]) => {
      const marketMedian = quantile(entries.map((row) => row.price_original), 0.5);
      const seasons = seasonSlugs.flatMap((slug) => {
        const prices = entries
          .filter((row) => row.start_season_candidate === slug)
          .map((row) => row.price_original);
        if (!prices.length) return [];
        const median = quantile(prices, 0.5);
        return [{
          slug,
          sample_count: prices.length,
          sufficient_samples: prices.length >= minimumSamples,
          p25_original: quantile(prices, 0.25),
          median_original: median,
          p75_original: quantile(prices, 0.75),
          ratio_to_market_median: roundRatio(median / marketMedian),
        }];
      });
      const comparable = seasons.filter((season) => season.sufficient_samples);
      const inversions = comparable.slice(1).flatMap((season, index) => {
        const older = comparable[index];
        if (older.median_original >= season.median_original * 0.8) return [];
        return [{
          older_slug: older.slug,
          newer_slug: season.slug,
          older_to_newer_ratio: roundRatio(older.median_original / season.median_original),
        }];
      });
      return {
        market,
        sample_count: entries.length,
        market_median_original: marketMedian,
        seasons,
        possible_inversions: inversions,
      };
    });

  return {
    schema_version: 1,
    evidence_kind: "same-market-season-relative-asking-price",
    minimum_samples_per_season: minimumSamples,
    source_rows: rows.length,
    eligible_rows: eligibleRows.length,
    markets,
    warning: "Diagnostic relative asking-price evidence only; never mix original currencies or publish as a TWD valuation.",
  };
};

const parseArgs = (argv) => {
  const input = argv.find((argument) => !argument.startsWith("--")) ??
    "work/market-listings/combined/public-listings.jsonl";
  const minimumArgument = argv.find((argument) => argument.startsWith("--min-samples="));
  return {
    input,
    minimumSamples: minimumArgument
      ? Number(minimumArgument.slice("--min-samples=".length))
      : 3,
  };
};

const main = async () => {
  const { input, minimumSamples } = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(input);
  const content = await readFile(inputPath, "utf8");
  const rows = content.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`${inputPath}:${index + 1}: invalid JSON`);
    }
  });
  process.stdout.write(`${JSON.stringify(buildSeasonRatioReport(rows, { minimumSamples }), null, 2)}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
