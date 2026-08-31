import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import { loadValuationRuntime } from "./load-valuation-runtime.mjs";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const documentsPath = resolve(
  argument("--documents", "work/drive-documents.private.jsonl"),
);
const marketPath = resolve(
  argument("--market", "work/valuation-drive-2026-08-30.jsonl"),
);
const outputPath = resolve(
  argument("--out", "work/drive-guid-reconstruction.private.jsonl"),
);
const summaryPath = resolve(
  argument("--summary", "work/drive-guid-reconstruction-summary.private.json"),
);
const workRoot = resolve(import.meta.dirname, "..", "work");
const assertPrivatePath = (path, label) => {
  const pathFromWork = relative(workRoot, path);
  if (
    !pathFromWork ||
    pathFromWork.startsWith("..") ||
    isAbsolute(pathFromWork)
  )
    throw new Error(`${label} must stay inside the private work directory.`);
};
[
  [documentsPath, "Document input"],
  [marketPath, "Market input"],
  [outputPath, "Reconstruction output"],
  [summaryPath, "Summary output"],
].forEach(([path, label]) => assertPrivatePath(path, label));
const lines = (text) => text.split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const hashTerm = (term) =>
  createHash("sha256").update(term).digest("hex").slice(0, 16);
const bindingKeys = [
  "google",
  "nintendo",
  "gameCenter",
  "facebook",
  "steam",
  "twitch",
  "playstation",
];
const bindings = (status) =>
  Object.fromEntries(bindingKeys.map((key) => [key, status]));
const quantile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
};
const isCompleteProgress = (value) => {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("zh-Hant");
  if (["complete", "completed", "畢", "全畢"].includes(normalized))
    return true;
  const ratio = normalized.match(/^(\d+)\s*\/\s*(\d+)$/u);
  return ratio
    ? Number(ratio[2]) > 0 && Number(ratio[1]) === Number(ratio[2])
    : false;
};
const intervalGap = (leftLow, leftHigh, rightLow, rightHigh) => {
  if (leftHigh < rightLow) return rightLow - leftHigh;
  if (rightHigh < leftLow) return leftLow - rightHigh;
  return 0;
};

const [documents, marketRows, catalog, valuation] = await Promise.all([
  readFile(documentsPath, "utf8").then(lines),
  readFile(marketPath, "utf8").then(lines),
  loadRuntimeCatalog(),
  loadValuationRuntime(),
]);
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);
const marketByHash = new Map(marketRows.map((row) => [row.post_hash, row]));
const itemByGuid = new Map(catalog.wikiItems.map((item) => [item.guid, item]));
const valuationDomain = {
  ...catalog,
  getZhName: catalog.zhItemName,
};

const reconstructed = documents.map((document) => {
  const market = marketByHash.get(document.post_hash);
  const content =
    document.content ??
    (document.content_base64
      ? Buffer.from(document.content_base64, "base64").toString("utf8")
      : "");
  const resolution = resolver.scan(content);
  const textGuids = new Set(
    resolution.matched.map((match) => match.candidates[0].guid),
  );
  for (const group of resolution.groups)
    for (const item of group.candidates) textGuids.add(item.guid);
  const owned = new Set(textGuids);
  for (const [slug, progress] of Object.entries(
    market?.season_progress ?? {},
  )) {
    if (!isCompleteProgress(progress)) continue;
    for (const item of catalog.seasonGraduationItems.get(slug) ?? [])
      owned.add(item.guid);
  }
  const chosen = [...owned].map((guid) => itemByGuid.get(guid)).filter(Boolean);
  const analyze = (selectedBindings) =>
    valuation.analyzeValuation({
      chosen,
      bindings: selectedBindings,
      bindingNote: "",
      domain: valuationDomain,
    });
  const optimistic = chosen.length
    ? valuation.estimateValuation({ analysis: analyze(bindings("none")) })
    : null;
  const restricted = chosen.length
    ? valuation.estimateValuation({ analysis: analyze(bindings("keep")) })
    : null;
  const exactPaidCount = chosen.filter(catalog.isPaidItem).length;
  const declaredPaidCount = market?.paid_package_count ?? null;
  const paidCoverage = declaredPaidCount
    ? Math.min(1, exactPaidCount / declaredPaidCount)
    : null;
  const ambiguity = resolution.ambiguous.map((match) => ({
    term_hash: hashTerm(match.normalized),
    candidate_guids: match.candidates.map((item) => item.guid),
  }));
  const envelope =
    optimistic && restricted
      ? {
          low: Math.min(optimistic.range.low, restricted.range.low),
          high: Math.max(optimistic.range.high, restricted.range.high),
          midpoint_low: Math.min(optimistic.midpoint, restricted.midpoint),
          midpoint_high: Math.max(optimistic.midpoint, restricted.midpoint),
        }
      : null;
  const comparisonClass = !market
    ? "no-price"
    : ambiguity.length === 0 &&
        textGuids.size > 0 &&
        declaredPaidCount !== null &&
        paidCoverage >= 0.75
      ? "paid-count-covered"
      : "partial-guid";
  const listingOverlapsEstimate =
    market && envelope
      ? market.price_twd_low <= envelope.high &&
        market.price_twd_high >= envelope.low
      : null;
  return {
    document_hash: hashTerm(document.post_hash),
    price_kind: market?.price_kind ?? null,
    price_twd_low: market?.price_twd_low ?? null,
    price_twd_high: market?.price_twd_high ?? null,
    start_season_slug: market?.start_season_slug ?? null,
    owned_guids: [...owned].sort(),
    exact_text_guid_count: textGuids.size,
    season_guid_count: owned.size - textGuids.size,
    ambiguous: ambiguity,
    excluded_name_count: resolution.excluded.length,
    unmatched_segment_count: resolution.unmatched.length,
    confirmed_group_count: resolution.groups.length,
    exact_paid_count: exactPaidCount,
    declared_paid_count: declaredPaidCount,
    paid_coverage: paidCoverage,
    unresolved_declared_paid_count:
      declaredPaidCount === null
        ? null
        : Math.max(0, declaredPaidCount - exactPaidCount),
    missing_fields: ["bindings", "resources"],
    comparison_class: comparisonClass,
    estimate_envelope: envelope,
    listing_overlaps_estimate: listingOverlapsEstimate,
    listing_interval_gap:
      market && envelope
        ? intervalGap(
            market.price_twd_low,
            market.price_twd_high,
            envelope.low,
            envelope.high,
          )
        : null,
  };
});

const comparable = reconstructed.filter((row) => row.price_twd_low !== null);
const exact = comparable.filter(
  (row) => row.comparison_class === "paid-count-covered",
);
const summarize = (rows) => {
  const estimated = rows.filter((row) => row.estimate_envelope);
  const overlaps = rows.filter((row) => row.listing_overlaps_estimate).length;
  return {
    count: rows.length,
    listing_interval_overlaps_estimate: overlaps,
    listing_above_estimate: estimated.filter(
      (row) => row.price_twd_low > row.estimate_envelope.high,
    ).length,
    listing_below_estimate: estimated.filter(
      (row) => row.price_twd_high < row.estimate_envelope.low,
    ).length,
    overlap_rate: rows.length ? overlaps / rows.length : null,
    listing_interval_gap_median: quantile(
      estimated.map((row) => row.listing_interval_gap),
      0.5,
    ),
  };
};
const summarizeKinds = (rows) =>
  Object.fromEntries(
    [...new Set(rows.map((row) => row.price_kind ?? "unknown"))].map(
      (kind) => [
        kind,
        summarize(
          rows.filter((row) => (row.price_kind ?? "unknown") === kind),
        ),
      ],
    ),
  );
const summary = {
  document_count: documents.length,
  priced_document_count: comparable.length,
  paid_count_covered_exploration: summarize(exact),
  all_partial_reconstructions: summarize(comparable),
  by_price_kind_all_partial: summarizeKinds(comparable),
  partial_guid_count: comparable.length - exact.length,
  guid_count: {
    median: quantile(reconstructed.map((row) => row.owned_guids.length), 0.5),
    maximum: Math.max(...reconstructed.map((row) => row.owned_guids.length)),
  },
  name_resolution: {
    text_guid_median: quantile(
      reconstructed.map((row) => row.exact_text_guid_count),
      0.5,
    ),
    zero_text_guid_documents: reconstructed.filter(
      (row) => row.exact_text_guid_count === 0,
    ).length,
    ambiguous_documents: reconstructed.filter((row) => row.ambiguous.length)
      .length,
    unmatched_segment_median: quantile(
      reconstructed.map((row) => row.unmatched_segment_count),
      0.5,
    ),
  },
  limitations: [
    "Prices are listings or quick-sale asks, not verified completed sales.",
    "Unknown bindings are evaluated as an optimistic/restricted envelope.",
    "Unknown resources contribute no value.",
    "Ambiguous names never enter owned GUIDs.",
    "Overlap and interval gaps are exploratory listing-fit measures, not model accuracy metrics.",
  ],
};
await Promise.all([
  writeFile(
    outputPath,
    `${reconstructed.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  ),
  writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify(summary, null, 2));
