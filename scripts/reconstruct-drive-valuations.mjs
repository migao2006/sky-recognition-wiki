import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import { loadValuationRuntime } from "./load-valuation-runtime.mjs";
import { positivePriceNumber, seasonProgressParts } from "./lib/valuation-source-core.mjs";
import {
  bindingsForStatus,
  extractCompleteBindings,
  extractResourceEvidence,
  splitListingInventoryContext,
} from "./lib/listing-account-evidence.mjs";

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value?.trim() || value.startsWith("--"))
    throw new Error(`${name} requires an explicit file path.`);
  return value;
};
const documentsPath = resolve(
  argument("--documents", "work/drive-documents.private.jsonl"),
);
const marketPath = resolve(
  argument("--market"),
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
const quantile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)];
};
const isCompleteProgress = (value) => {
  const parts = seasonProgressParts(value);
  return Boolean(parts && Number.isSafeInteger(parts.expected) &&
    parts.expected > 0 && parts.selected === parts.expected);
};
const intervalGap = (leftLow, leftHigh, rightLow, rightHigh) => {
  if (leftHigh < rightLow) return rightLow - leftHigh;
  if (rightHigh < leftLow) return leftLow - rightHigh;
  return 0;
};
const sameStringSet = (left, right) => {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every((value, index) => value === sortedRight[index]);
};

const [documentText, marketText, catalog, valuation] = await Promise.all([
  readFile(documentsPath, "utf8"),
  readFile(marketPath, "utf8"),
  loadRuntimeCatalog(),
  loadValuationRuntime(),
]);
const documents = lines(documentText);
const marketRows = lines(marketText);
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
  const excludedFromModel = market?.exclude_from_model === true;
  const content =
    document.content ??
    (document.content_base64
      ? Buffer.from(document.content_base64, "base64").toString("utf8")
      : "");
  const context = splitListingInventoryContext(content);
  const bindingEvidence = extractCompleteBindings(context.inventory);
  const resourceEvidence = extractResourceEvidence(context.inventory);
  const resolution = resolver.scan(context.inventory);
  const separateResolution = resolver.scan(context.separateAccount);
  const separateAccountGuids = [...new Set([
    ...separateResolution.matched.flatMap((match) => match.candidates.map((item) => item.guid)),
    ...separateResolution.groups.flatMap((group) => group.candidates.map((item) => item.guid)),
  ])].sort();
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
  const resourceScenario = (bound) => ({
    ...Object.fromEntries(Object.entries(resourceEvidence.ranges)
      .filter(([, range]) => range.max !== null)
      .map(([key, range]) => [key, range[bound]])),
    ...resourceEvidence.resources,
  });
  const resourceEstimateInputs = { low: resourceScenario("min"), high: resourceScenario("max") };
  const estimateFor = (selectedBindings, resources = resourceEvidence.resources) =>
    chosen.length
      ? valuation.estimateValuation({
          analysis: analyze(selectedBindings),
          resources,
        })
      : null;
  const knownEstimate = bindingEvidence
    ? estimateFor(bindingEvidence.bindings)
    : null;
  const exactEstimate = Object.values(resourceEvidence.ranges).some((range) => range.max !== null)
    ? null : knownEstimate;
  const optimistic = exactEstimate ?? estimateFor(bindingEvidence?.bindings ?? bindingsForStatus("none"), resourceEstimateInputs.high);
  const restricted = exactEstimate ?? estimateFor(bindingEvidence?.bindings ?? bindingsForStatus("keep"), resourceEstimateInputs.low);
  const reconstructedStartSeason = chosen.length
    ? analyze(bindingEvidence?.bindings ?? bindingsForStatus("none")).startSeasonSlug
    : null;
  const sourceStartSeason = catalog.graduationSeasonSlugs.includes(market?.start_season_slug)
    ? market.start_season_slug : null;
  const startSeasonConflict = sourceStartSeason && reconstructedStartSeason
    ? sourceStartSeason !== reconstructedStartSeason : null;
  const exactPaidItemCount = chosen.filter(catalog.isPaidItem).length;
  const exactPaidCount = optimistic?.marketProfile?.canonicalPackageCount ?? 0;
  const declaredPaidCount = market?.paid_package_count ?? null;
  const packageMin = market?.paid_package_min;
  const packageMax = market?.paid_package_max;
  const declaredPaidRange = Number.isSafeInteger(packageMin) && packageMin >= 0 &&
    (packageMax == null || (Number.isSafeInteger(packageMax) && packageMax >= packageMin))
    ? { min: packageMin, max: packageMax ?? null }
    : null;
  const paidCoverage = declaredPaidCount
    ? Math.min(1, exactPaidCount / declaredPaidCount)
    : null;
  const ambiguity = resolution.ambiguous.map((match) => ({
    term_hash: hashTerm(match.normalized),
    candidate_guids: match.candidates.map((item) => item.guid),
  }));
  const confirmedOwnedGuids = Array.isArray(market?.confirmed_owned_guids)
    ? [...new Set(market.confirmed_owned_guids.filter((guid) => itemByGuid.has(guid)))]
    : null;
  const inventoryComplete =
    Boolean(confirmedOwnedGuids) &&
    confirmedOwnedGuids.length === market.confirmed_owned_guids.length &&
    sameStringSet(confirmedOwnedGuids, [...owned]) &&
    ambiguity.length === 0 &&
    declaredPaidCount !== null &&
    exactPaidCount === declaredPaidCount;
  const missingFields = [
    ...(!inventoryComplete ? ["inventory"] : []),
    ...(!bindingEvidence ? ["bindings"] : []),
    ...(!resourceEvidence.complete ? ["resources"] : []),
    ...(context.separateAccount.trim() ? ["separate_account_scope"] : []),
  ];
  const modelFeaturesReady =
    !excludedFromModel && startSeasonConflict !== true && missingFields.length === 0 && Boolean(knownEstimate?.modelFeatures);
  const envelope =
    optimistic && restricted
      ? {
          low: Math.min(optimistic.range.low, restricted.range.low),
          high: Math.max(optimistic.range.high, restricted.range.high),
          midpoint_low: Math.min(optimistic.midpoint, restricted.midpoint),
          midpoint_high: Math.max(optimistic.midpoint, restricted.midpoint),
        }
      : null;
  const pointPrice = positivePriceNumber(market?.price_twd);
  const hasPointPrice = pointPrice !== null;
  const listingLow = hasPointPrice ? pointPrice : positivePriceNumber(market?.price_twd_low);
  const listingHigh = hasPointPrice ? pointPrice : positivePriceNumber(market?.price_twd_high);
  const hasPrice = Number.isFinite(listingLow) && listingLow > 0 &&
    Number.isFinite(listingHigh) && listingHigh >= listingLow;
  const comparisonClass = excludedFromModel
    ? "excluded"
    : !hasPrice
    ? "no-price"
    : ambiguity.length === 0 &&
        textGuids.size > 0 &&
        declaredPaidCount !== null &&
        paidCoverage >= 0.75
      ? "paid-count-covered"
      : "partial-guid";
  const listingOverlapsEstimate =
    hasPrice && envelope && !excludedFromModel
      ? listingLow <= envelope.high &&
        listingHigh >= envelope.low
      : null;
  return {
    document_hash: hashTerm(document.post_hash),
    exclude_from_model: excludedFromModel,
    price_kind: market?.price_kind ?? null,
    price_twd_low: hasPrice ? listingLow : null,
    price_twd_high: hasPrice ? listingHigh : null,
    start_season_slug: market?.start_season_slug ?? null,
    reconstructed_start_season_slug: reconstructedStartSeason,
    start_season_conflict: startSeasonConflict,
    owned_guids: [...owned].sort(),
    separate_account_guids: separateAccountGuids,
    exact_text_guid_count: textGuids.size,
    season_guid_count: owned.size - textGuids.size,
    ambiguous: ambiguity,
    excluded_name_count: resolution.excluded.length,
    unmatched_segment_count: resolution.unmatched.length,
    confirmed_group_count: resolution.groups.length,
    exact_paid_count: exactPaidCount,
    exact_paid_item_count: exactPaidItemCount,
    declared_paid_count: declaredPaidCount,
    declared_paid_range: declaredPaidRange,
    unresolved_declared_paid_range: declaredPaidRange ? {
      min: Math.max(0, declaredPaidRange.min - exactPaidCount),
      max: declaredPaidRange.max === null ? null : Math.max(0, declaredPaidRange.max - exactPaidCount),
    } : null,
    paid_coverage: paidCoverage,
    unresolved_declared_paid_count:
      declaredPaidCount === null
        ? null
        : Math.max(0, declaredPaidCount - exactPaidCount),
    binding_evidence: bindingEvidence?.kind ?? null,
    resource_fields: resourceEvidence.observed,
    resource_values: resourceEvidence.resources,
    resource_ranges: resourceEvidence.ranges,
    resource_estimate_inputs: resourceEstimateInputs,
    resource_approximations: resourceEvidence.approximations,
    inventory_complete: inventoryComplete,
    missing_fields: missingFields,
    model_features_ready: modelFeaturesReady,
    valuation_model: modelFeaturesReady ? knownEstimate.modelFeatures : undefined,
    comparison_class: comparisonClass,
    estimate_envelope: envelope,
    listing_overlaps_estimate: listingOverlapsEstimate,
    listing_interval_gap:
      hasPrice && envelope && !excludedFromModel
        ? intervalGap(
            listingLow,
            listingHigh,
            envelope.low,
            envelope.high,
          )
        : null,
  };
});

const priced = reconstructed.filter((row) => row.price_twd_low !== null);
const comparable = priced.filter((row) => !row.exclude_from_model);
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
const summarizeCompleteness = (rows) => ({
  count: rows.length,
  explicit_bindings: rows.filter((row) => row.binding_evidence).length,
  explicit_resources: rows.filter(
    (row) => !row.missing_fields.includes("resources"),
  ).length,
  confirmed_inventory: rows.filter((row) => row.inventory_complete).length,
  model_features_ready: rows.filter((row) => row.model_features_ready).length,
  missing_by_field: Object.fromEntries(
    ["inventory", "bindings", "resources"].map((field) => [
      field,
      rows.filter((row) => row.missing_fields.includes(field)).length,
    ]),
  ),
});
const summary = {
  input_sources: {
    documents_sha256: createHash("sha256").update(documentText).digest("hex"),
    market_sha256: createHash("sha256").update(marketText).digest("hex"),
    market_row_count: marketRows.length,
  },
  document_count: documents.length,
  priced_document_count: priced.length,
  comparable_document_count: comparable.length,
  excluded_document_count: reconstructed.filter((row) => row.exclude_from_model).length,
  paid_count_covered_exploration: summarize(exact),
  all_partial_reconstructions: summarize(comparable),
  start_season_consistency: {
    matching: comparable.filter(row => row.start_season_conflict === false).length,
    conflicting: comparable.filter(row => row.start_season_conflict === true).length,
    unknown: comparable.filter(row => row.start_season_conflict === null).length,
  },
  matching_start_reconstructions: summarize(comparable.filter(row => row.start_season_conflict === false)),
  by_price_kind_all_partial: summarizeKinds(comparable),
  partial_guid_count: comparable.length - exact.length,
  guid_count: {
    median: quantile(reconstructed.map((row) => row.owned_guids.length), 0.5),
    maximum: Math.max(...reconstructed.map((row) => row.owned_guids.length)),
  },
  evidence_completeness: {
    all_documents: summarizeCompleteness(reconstructed),
    priced_documents: summarizeCompleteness(priced),
    comparable_documents: summarizeCompleteness(comparable),
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
    "Source and reconstructed start-season conflicts remain exploratory comparisons, are counted separately, and cannot emit complete model features. Missing either start is unknown, not a verified match.",
    "Explicitly excluded market rows retain GUID diagnostics but emit no model features or price comparison and do not enter fit summaries.",
    "Prices are listings or quick-sale asks, not verified completed sales.",
    "Unknown bindings are evaluated as an optimistic/restricted envelope.",
    "Each explicitly observed resource contributes independently; unknown resources contribute no value and remain incomplete.",
    "Closed resource ranges are replayed at both endpoints as exploratory resource_estimate_inputs, never as exact resource_values or complete resource fields; open bounds and approximations remain diagnostic only.",
    "Declared package ranges and unresolved-count bounds are diagnostic evidence only; they never create GUIDs, exact coverage or complete model features.",
    "Model features are emitted only after an exact confirmed GUID list, matching canonical package count, complete binding evidence, and all four resource fields.",
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
