import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { channelFor } from "./lib/market-channel.mjs";
import { extractMarketTitleEvidence, extractMarketPackageRange, marketHeadlineFor as titleFor } from "./lib/market-title-evidence.mjs";
import {
  accountKeyFor,
  breakClasses,
  isExcludedFromModel,
  postKeyFor,
  preferredRow,
  priceFor,
  marketExclusionReason,
  seasonProgressParts,
} from "./lib/valuation-source-core.mjs";
import { seasonBandSeeds } from "../app/valuation-season-band-core.js";

const canonicalSeasons = new Set(seasonBandSeeds.map((seed) => seed.slug));
const supportedEarlierStart = (row, start, headlineStart) => {
  const progress = row.season_progress;
  if (row.start_season_confidence !== "structured" || !progress || typeof progress !== "object" || Array.isArray(progress)) return false;
  const nonzero = new Set();
  for (const [slug, value] of Object.entries(progress)) {
    const parts = seasonProgressParts(value);
    if (!canonicalSeasons.has(slug) || !parts || parts.expected <= 0 || parts.selected < 0 || parts.selected > parts.expected) return false;
    if (parts.selected > 0) nonzero.add(slug);
  }
  const ordered = [...canonicalSeasons].filter(slug => nonzero.has(slug));
  return ordered[0] === start && ordered.indexOf(headlineStart) > 0;
};
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const known = (value) => {
  const text = String(value ?? "").trim();
  return text && !["unknown", "unk", "n/a", "null", "undefined", "-"].includes(text.toLowerCase()) ? text : null;
};
const knownIdentity = value => known(value)?.toLowerCase() === "none" ? null : known(value);
const quantile = (values, percentile) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered.length ? ordered[Math.floor((ordered.length - 1) * percentile)] : null;
};
const packageTierFor = (count, sellerTier) => {
  if (Number.isSafeInteger(count) && count >= 0) {
    if (count === 0) return "0";
    if (count < 10) return "1-9";
    const lower = Math.floor(count / 10) * 10;
    return `${lower}-${lower + 9}`;
  }
  return ["few", "medium", "many"].includes(sellerTier) ? `seller:${sellerTier}` : "unknown";
};
const packageEvidenceFor = (row, titleEvidence) => {
  const suppliedRange = row.paid_package_min != null || row.paid_package_max != null;
  const range = suppliedRange
    ? { min: row.paid_package_min, max: row.paid_package_max ?? null }
    : extractMarketPackageRange(titleFor(row));
  const validRange = range && Number.isSafeInteger(range.min) && range.min >= 0 &&
    (range.max === null || (Number.isSafeInteger(range.max) && range.max >= range.min));
  const rawCount = row.paid_package_count;
  const suppliedCount = rawCount != null && rawCount !== "";
  const countValue = suppliedCount ? rawCount : range || suppliedRange ? null : titleEvidence.paidPackageCount;
  const count = /^\d+$/.test(String(countValue ?? "")) && Number.isSafeInteger(Number(countValue)) ? Number(countValue) : null;
  // Bounds retain their own cohorts: a 60+ listing is neither exactly 60 nor
  // comparable to a disjoint exact-count tier for package-price differences.
  if (suppliedCount) {
    if (count === null || (range && (!validRange || count < range.min || (range.max !== null && count > range.max)))) return "unknown";
    return packageTierFor(count, null);
  }
  if (range || suppliedRange) return validRange ? `range:${range.min}${range.max === null ? "+" : `-${range.max}`}` : "unknown";
  const sellerTier = ["few", "medium", "many"].includes(row.seller_package_label) ? row.seller_package_label : null;
  const titleTier = titleEvidence.salePackageTier;
  // Seller labels are usable even without a title/count, but remain distinct
  // from measured package counts. Conflicting labels affect only this dimension.
  return packageTierFor(count, sellerTier && titleTier && sellerTier !== titleTier ? null : sellerTier ?? titleTier);
};
const priceAndMarketFor = (row) => {
  const isPublic = Object.hasOwn(row, "price_original") || Object.hasOwn(row, "currency_original");
  const currency = known(isPublic ? row.currency_original : row.currency);
  const region = known(isPublic ? row.market_scope : row.region);
  const originalCurrency = known(row.original_currency ?? row.currency_original)?.toUpperCase();
  if (!isPublic && Object.hasOwn(row, "price_twd") && originalCurrency && !["TWD", "NTD", "NT$", "NT＄", "台幣", "新台幣"].includes(originalCurrency))
    return { reason: "converted_currency_only" };
  if (!isPublic && marketExclusionReason({ ...row, listing_text: `${titleFor(row)} ${row.listing_text ?? ""}` }) === "foreign_currency")
    return { reason: "converted_currency_only" };
  const price = isPublic
    ? (typeof row.price_original === "number" && Number.isFinite(row.price_original) && row.price_original > 0 ? row.price_original : null)
    : priceFor(row);
  if (!currency || !region || !price || price <= 0) return { reason: "price_or_market_unknown" };
  return { price, currency: currency.toUpperCase(), region: region.toLowerCase() };
};
const rowKeys = (row) => {
  const keys = [];
  const account = knownIdentity(accountKeyFor(row));
  const post = knownIdentity(postKeyFor(row));
  if (account) keys.push(`account:${account}`);
  if (post) keys.push(`post:${post}`);
  const source = known(row.source)?.toLowerCase() ?? "unknown";
  for (const value of [row.listing_id, row.listing_url]) {
    const text = knownIdentity(value);
    if (text) keys.push(`listing:${source}:${text}`);
  }
  return keys;
};
const priceKindFor = (row) => {
  const explicit = known(row.price_kind)?.toLowerCase();
  const evidence = known(row.evidence_kind)?.toLowerCase();
  // Evidence describes where the price came from: a comment can quote an ask,
  // and a quick-sale ask remains asking evidence, not a completed transaction.
  const compatible = evidence === "comment" || (evidence === "ask" && explicit === "quick_sale");
  if (explicit && evidence && explicit !== evidence && !compatible) return { conflict: true };
  return { value: explicit ?? evidence ?? "unknown" };
};
const isContradictoryChinaMarket = (row, market) =>
  /^(?:tw|taiwan|global|international|國際服|台服)$/i.test(market.region) &&
  marketExclusionReason({ ...row, listing_text: `${titleFor(row)} ${row.listing_text ?? ""}` }) === "china";
const existingAncestorRealpath = async (target) => {
  let cursor = target;
  while (true) {
    try { return await realpath(cursor); } catch {
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error("cannot resolve output path");
      cursor = parent;
    }
  }
};
const deduplicate = (rows) => {
  const parent = rows.map((_, index) => index);
  const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const join = (left, right) => { left = find(left); right = find(right); if (left !== right) parent[right] = left; };
  const seen = new Map();
  rows.forEach((row, index) => rowKeys(row).forEach((key) => {
    if (seen.has(key)) join(index, seen.get(key)); else seen.set(key, index);
  }));
  const groups = new Map();
  rows.forEach((row, index) => {
    const key = find(index); const entries = groups.get(key) ?? []; entries.push(row); groups.set(key, entries);
  });
  return [...groups.values()].map((entries) => entries.reduce(preferredRow));
};

export const buildMarketHeadlineReport = (rows, { minimumSamples = 3 } = {}) => {
  if (!Number.isInteger(minimumSamples) || minimumSamples < 2)
    throw new Error("minimumSamples must be an integer of at least 2");
  const diagnostics = { excluded_from_model: 0, public_listing_not_candidate: 0, source_unknown: 0, price_or_market_unknown: 0, converted_currency_only: 0, contradictory_market: 0, price_kind_conflict: 0, price_kind_unknown: 0, identity_unknown: 0, title_start_conflict: 0, title_start_resolved: 0, start_unknown: 0 };
  const candidates = [];
  for (const row of rows) {
    if (isExcludedFromModel(row)) { diagnostics.excluded_from_model++; continue; }
    if (!knownIdentity(row.source)) { diagnostics.source_unknown++; continue; }
    const isPublic = Object.hasOwn(row, "price_original") || Object.hasOwn(row, "currency_original");
    if (isPublic && (row.account_candidate !== true || row.price_outlier === true)) { diagnostics.public_listing_not_candidate++; continue; }
    const market = priceAndMarketFor(row);
    if (!market.price) { diagnostics[market.reason]++; continue; }
    if (isContradictoryChinaMarket(row, market)) { diagnostics.contradictory_market++; continue; }
    const priceKind = priceKindFor(row);
    if (priceKind.conflict) { diagnostics.price_kind_conflict++; continue; }
    const titleEvidence = extractMarketTitleEvidence(titleFor(row));
    const suppliedStart = known(row.start_season_slug);
    const verifiedPublicCandidate = isPublic && row.season_graduation_count_consistent === true
      ? known(row.start_season_candidate)?.toLowerCase()
      : null;
    const explicitStart = suppliedStart?.toLowerCase() ?? verifiedPublicCandidate;
    const startConflict = explicitStart && titleEvidence.startSeasonSlug && explicitStart !== titleEvidence.startSeasonSlug;
    if (startConflict && !supportedEarlierStart(row, explicitStart, titleEvidence.startSeasonSlug)) {
      diagnostics.title_start_conflict++; continue;
    }
    const season = explicitStart ?? titleEvidence.startSeasonSlug;
    if (!season || !canonicalSeasons.has(season)) { diagnostics.start_unknown++; continue; }
    if (!["ask", "quick_sale", "sold", "professional_estimate", "comment"].includes(priceKind.value)) {
      diagnostics.price_kind_unknown++; continue;
    }
    if (!rowKeys(row).length) { diagnostics.identity_unknown++; continue; }
    if (startConflict) diagnostics.title_start_resolved++;
    const suppliedBreak = known(row.computed_break_class) ?? known(row.seller_break_label);
    // A title's break claim may cover only its later starting season.
    const breakClass = breakClasses.includes(row.computed_break_class) ? row.computed_break_class
      : startConflict ? "unknown" : breakClasses.includes(suppliedBreak) ? suppliedBreak : titleEvidence.breakClass ?? "unknown";
    const packageTier = packageEvidenceFor(row, titleEvidence);
    const wingless = row.wingless === true ? "yes" : row.wingless === false ? "no" : titleEvidence.wingless ? "yes" : "unknown";
    candidates.push({ ...row, __market: market, __priceKind: priceKind.value, __season: season, __break: breakClass, __package: packageTier, __style: titleEvidence.accountStyle ?? known(row.account_style)?.toLowerCase() ?? "unknown", __wingless: wingless });
  }
  const eligible = deduplicate(candidates);
  const markets = new Map();
  for (const row of eligible) {
    const binding = known(row.binding_class ?? row.bindingClass)?.toLowerCase() ?? "unknown";
    const source = known(row.source)?.toLowerCase() ?? "unknown";
    const channel = channelFor(row);
    const key = [source, row.__market.region, row.__market.currency, channel, row.__priceKind, binding, row.__style, row.__wingless].join("|");
    const entries = markets.get(key) ?? { key, source, region: row.__market.region, currency: row.__market.currency, channel, price_kind: row.__priceKind, binding_class: binding, account_style: row.__style, wingless: row.__wingless, rows: [] };
    entries.rows.push(row); markets.set(key, entries);
  }
  const marketReports = [...markets.values()].sort((a, b) => a.key.localeCompare(b.key)).map((market) => {
    const combinations = new Map();
    market.rows.forEach((row) => {
      const key = `${row.__season}|${row.__break}`; const values = combinations.get(key) ?? { season: row.__season, break_class: row.__break, rows: [] }; values.rows.push(row); combinations.set(key, values);
    });
    const season_breaks = [...combinations.values()].sort((a, b) => `${a.season}|${a.break_class}`.localeCompare(`${b.season}|${b.break_class}`)).map((group) => {
      const tiers = new Map();
      group.rows.forEach((row) => { const values = tiers.get(row.__package) ?? []; values.push(row); tiers.set(row.__package, values); });
      const tierOrder = (tier) => /^\d/.test(tier) ? Number(tier.split("-")[0]) : Number.POSITIVE_INFINITY;
      const packages = [...tiers.entries()].sort(([a], [b]) => tierOrder(a) - tierOrder(b) || a.localeCompare(b)).map(([tier, values]) => ({
        package_tier: tier, sample_count: values.length, sufficient_samples: values.length >= minimumSamples,
        p25: quantile(values.map((row) => row.__market.price), .25), median: quantile(values.map((row) => row.__market.price), .5), p75: quantile(values.map((row) => row.__market.price), .75),
      }));
      const exact = packages.filter((item) => /^\d/.test(item.package_tier) && item.sufficient_samples)
        .sort((a, b) => tierOrder(a.package_tier) - tierOrder(b.package_tier));
      const package_differences = exact.flatMap((left, index) => exact.slice(index + 1).map((right) => ({
        lower_count_tier: left.package_tier, higher_count_tier: right.package_tier,
        median_total_difference: right.median - left.median,
        limitation: "Confounded observational difference only; do not add it to a full package premium.",
      })));
      return { season: group.season, break_class: group.break_class, sample_count: group.rows.length, packages, package_differences, no_package_baseline: packages.some((item) => item.package_tier === "0" && item.sufficient_samples) };
    });
    return { source: market.source, region: market.region, currency: market.currency, channel: market.channel, price_kind: market.price_kind, binding_class: market.binding_class, account_style: market.account_style, wingless: market.wingless, sample_count: market.rows.length, season_breaks };
  });
  return { schema_version: 1, status: "headline-unvalidated", evidence_kind: "season-break-package-market-headline-diagnostic", minimum_samples: minimumSamples, source_rows: rows.length, eligible_rows_before_dedupe: candidates.length, eligible_rows: eligible.length, diagnostics, markets: marketReports, warning: "Diagnostic only: headline evidence is not a valuation baseline or model gate. Markets, currencies, and asking/sold kinds are never combined." };
};

const parseArgs = (argv) => ({ inputs: argv.filter((arg) => !arg.startsWith("--")), out: argv.find((arg) => arg.startsWith("--out="))?.slice(6) });
const main = async () => {
  const { inputs, out } = parseArgs(process.argv.slice(2));
  if (!inputs.length) throw new Error("usage: node scripts/analyze-market-headlines.mjs file1 [file2 ...] [--out=work/report.json]");
  const rows = (await Promise.all(inputs.map(async (input) => (await readFile(path.resolve(input), "utf8")).split(/\r?\n/).filter(Boolean).map((line, index) => { try { return JSON.parse(line); } catch { throw new Error(`${input}:${index + 1}: invalid JSON`); } })))).flat();
  const output = `${JSON.stringify(buildMarketHeadlineReport(rows), null, 2)}\n`;
  if (out) {
    const outputPath = path.resolve(projectRoot, out);
    const relative = path.relative(projectRoot, outputPath);
    const parts = relative.split(path.sep);
    const safeDestination = !relative.startsWith("..") && !path.isAbsolute(relative) &&
      (parts[0] === "work" || (parts[0] === "dist" && parts[1] === "tmp"));
    if (!safeDestination)
      throw new Error("--out must be under this project's ignored work/ or dist/tmp/ directory");
    const rootRealpath = await realpath(projectRoot);
    const privateRoot = path.join(rootRealpath, parts[0] === "work" ? "work" : "dist/tmp");
    const insidePrivateRoot = (actual) => actual === privateRoot || actual.startsWith(`${privateRoot}${path.sep}`);
    const ancestorRealpath = await existingAncestorRealpath(outputPath);
    // A missing private directory can have a project ancestor. An existing
    // link resolving to app/ or any other tracked directory is never private.
    const ancestorOfPrivateRoot = privateRoot.startsWith(`${ancestorRealpath}${path.sep}`);
    if (!insidePrivateRoot(ancestorRealpath) && !ancestorOfPrivateRoot)
      throw new Error("--out resolves outside the private output directory");
    await mkdir(path.dirname(outputPath), { recursive: true });
    const directoryRealpath = await realpath(path.dirname(outputPath));
    if (!insidePrivateRoot(directoryRealpath))
      throw new Error("--out resolves outside the private output directory");
    await writeFile(outputPath, output, { flag: "wx" });
  } else process.stdout.write(output);
};
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((error) => { console.error(error); process.exitCode = 1; });
