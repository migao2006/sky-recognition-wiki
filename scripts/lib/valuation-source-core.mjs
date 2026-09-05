import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  hasCompleteValuationModelFeatures,
  valuationModelInputKeys,
} from "../../app/valuation-model-core.js";
import {
  replaySeasonProgressEndSlug,
  seasonBandSeeds,
  seasonGraduationGiftCounts,
} from "../../app/valuation-season-band-core.js";

export const evidenceWeights = {
  ask: 1,
  quick_sale: 0.8,
  sold: 1.2,
  professional_estimate: 0.55,
  comment: 0.35,
};
export const priceKindWeights = {
  ask: 0.9,
  quick_sale: 0.82,
  sold: 1,
  professional_estimate: 0.6,
  comment: 0.4,
};
export const qualityWeights = { high: 1, medium: 0.75, low: 0.5 };
export const breakClasses = ["none", "slight", "medium", "big"];
export const packageTiers = ["few", "medium", "many", "hundred"];
export const accountStyles = ["simple", "regular"];
export const modelEvidenceBindingKeys = [
  "google",
  "nintendo",
  "gameCenter",
  "facebook",
  "steam",
  "twitch",
  "playstation",
];
export const modelEvidenceResourceLimits = {
  candles: 99_999,
  hearts: 99_999,
  ascended: 99_999,
  passes: 999,
};
export const modelEvidenceFields = [
  "account_fingerprint",
  "snapshot_hash",
  "identity_namespace",
  "valuation_model_schema_version",
  "account_identity_scheme",
  "inventory_complete",
  "bindings_complete",
  "model_evidence",
  "evidence_signature",
];

export const canonicalJson = (value) => {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
export const valuationDatasetDigestFor = (rows) => {
  const canonicalRows = rows.map((row) => Object.fromEntries(
    Object.entries(row ?? {}).filter(([key]) => !key.startsWith("__")),
  ));
  return createHash("sha256")
    .update(canonicalRows.map(canonicalJson).sort().join("\n"), "utf8")
    .digest("hex");
};
const holdoutKeyFor = (seed, splitSecret) =>
  typeof splitSecret === "string" && splitSecret.length >= 32
    ? createHmac("sha256", splitSecret)
        .update(`holdout-split-v1:${seed}`, "utf8")
        .digest("hex")
    : seed;
export const holdoutSplitCommitmentFor = (seed, splitSecret) =>
  typeof splitSecret === "string" && splitSecret.length >= 32
    ? createHash("sha256")
        .update(holdoutKeyFor(seed, splitSecret), "utf8")
        .digest("hex")
    : null;
export const hasCompleteModelEvidenceSnapshot = (row) => {
  const evidence = row?.model_evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const bindings = evidence.bindings;
  const resources = evidence.resources;
  const bindingStatuses = new Set(["none", "transfer", "keep", "issue"]);
  if (
    !bindings ||
    typeof bindings !== "object" ||
    Array.isArray(bindings) ||
    Object.keys(bindings).length !== modelEvidenceBindingKeys.length ||
    modelEvidenceBindingKeys.some(
      (key) => !Object.hasOwn(bindings, key) || !bindingStatuses.has(bindings[key]),
    )
  ) return false;
  const resourceKeys = Object.keys(modelEvidenceResourceLimits);
  return Boolean(
    resources &&
    typeof resources === "object" &&
    !Array.isArray(resources) &&
    Object.keys(resources).length === resourceKeys.length &&
    resourceKeys.every((key) =>
      Object.hasOwn(resources, key) &&
      Number.isSafeInteger(resources[key]) &&
      resources[key] >= 0 &&
      resources[key] <= modelEvidenceResourceLimits[key]),
  );
};
const modelEvidencePayload = (row) => ({
  schema_version: row?.schema_version ?? null,
  source: row?.source ?? null,
  post_hash: row?.post_hash ?? null,
  post_fingerprint: row?.post_fingerprint ?? null,
  group_hash: row?.group_hash ?? null,
  market_group_hash: row?.market_group_hash ?? null,
  source_group_hash: row?.source_group_hash ?? null,
  account_group_hash: row?.account_group_hash ?? null,
  account_hash: row?.account_hash ?? null,
  account_fingerprint: row?.account_fingerprint ?? null,
  snapshot_hash: row?.snapshot_hash ?? null,
  identity_namespace: row?.identity_namespace ?? null,
  account_identity_scheme: row?.account_identity_scheme ?? null,
  valuation_model_schema_version: row?.valuation_model_schema_version ?? null,
  inventory_complete: row?.inventory_complete ?? null,
  bindings_complete: row?.bindings_complete ?? null,
  model_evidence: row?.model_evidence ?? null,
  published_at: row?.published_at ?? null,
  observed_at: row?.observed_at ?? null,
  price_twd: row?.price_twd ?? null,
  price_twd_low: row?.price_twd_low ?? null,
  price_twd_high: row?.price_twd_high ?? null,
  price_kind: row?.price_kind ?? null,
  evidence_kind: row?.evidence_kind ?? null,
  evidence_quality: row?.evidence_quality ?? null,
  region: row?.region ?? null,
  currency: row?.currency ?? null,
  listing_text: row?.listing_text ?? null,
  account_features: row?.account_features ?? null,
  exclude_from_model: row?.exclude_from_model ?? null,
  exclusion_reason: row?.exclusion_reason ?? null,
  start_season_slug: row?.start_season_slug ?? null,
  start_season_confidence: row?.start_season_confidence ?? null,
  season_progress: row?.season_progress ?? null,
  season_progress_end_slug: row?.season_progress_end_slug ?? null,
  computed_break_class: row?.computed_break_class ?? null,
  missing_season_count: row?.missing_season_count ?? null,
  completion_ratio: row?.completion_ratio ?? null,
  paid_package_count: row?.paid_package_count ?? null,
  computed_package_tier: row?.computed_package_tier ?? null,
  limited_item_count: row?.limited_item_count ?? null,
  graduation_gift_count: row?.graduation_gift_count ?? null,
  account_style: row?.account_style ?? null,
  valuation_model: row?.valuation_model ?? null,
});
export const modelEvidenceSignatureFor = (row, hashSalt) => {
  if (typeof hashSalt !== "string" || hashSalt.length < 32) return null;
  return createHmac("sha256", hashSalt)
    .update(`model-evidence-v1:${canonicalJson(modelEvidencePayload(row))}`, "utf8")
    .digest("hex");
};
export const hasCompleteModelEvidenceShape = (row) =>
  /^[a-f0-9]{64}$/u.test(String(row?.account_fingerprint ?? "")) &&
  /^[a-f0-9]{64}$/u.test(String(row?.snapshot_hash ?? "")) &&
  /^[a-f0-9]{64}$/u.test(String(row?.identity_namespace ?? "")) &&
  row?.valuation_model_schema_version === 3 &&
  row?.account_identity_scheme === "stable-hmac-v1" &&
  row?.inventory_complete === true &&
  row?.bindings_complete === true &&
  hasCompleteModelEvidenceSnapshot(row) &&
  /^[a-f0-9]{64}$/u.test(String(row?.evidence_signature ?? ""));
export const hasCompleteModelEvidence = (row, { hashSalt } = {}) => {
  if (!hasCompleteModelEvidenceShape(row)) return false;
  const expected = modelEvidenceSignatureFor(row, hashSalt);
  if (!expected) return false;
  return timingSafeEqual(
    Buffer.from(row.evidence_signature, "hex"),
    Buffer.from(expected, "hex"),
  );
};

export const seasonProgressParts = (value) => {
  if (value && typeof value === "object") {
    const selected = Number(value.selected);
    const expected = Number(value.expected);
    return Number.isInteger(selected) && Number.isInteger(expected)
      ? { selected, expected }
      : null;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["畢", "全畢", "complete", "completed", "full"].includes(normalized))
    return { selected: 1, expected: 1 };
  if (["", "0", "⁰", "none", "no", "false", "-"].includes(normalized))
    return { selected: 0, expected: 1 };
  const ratio = normalized.match(/^(\d+)\s*\/\s*(\d+)$/u);
  return ratio
    ? { selected: Number(ratio[1]), expected: Number(ratio[2]) }
    : null;
};

export const hasReplayableSeasonProgress = (
  row,
  { orderedSeasonSlugs, requiredEndSlug, graduationGiftCounts } = {},
) => {
  const progress = row?.season_progress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress))
    return false;
  if (!Array.isArray(orderedSeasonSlugs) || !orderedSeasonSlugs.length)
    return false;
  const startSlug = String(row?.start_season_slug ?? "").trim().toLowerCase();
  const endSlug = String(row?.season_progress_end_slug ?? "").trim().toLowerCase();
  const startIndex = orderedSeasonSlugs.indexOf(startSlug);
  const endIndex = orderedSeasonSlugs.indexOf(endSlug);
  if (
    startIndex < 0 ||
    endIndex < startIndex ||
    endSlug !== requiredEndSlug ||
    !graduationGiftCounts ||
    typeof graduationGiftCounts !== "object"
  )
    return false;
  const expectedSlugs = orderedSeasonSlugs.slice(startIndex, endIndex + 1);
  const actualSlugs = Object.keys(progress);
  if (
    actualSlugs.length !== expectedSlugs.length ||
    expectedSlugs.some((slug) => !Object.hasOwn(progress, slug))
  )
    return false;
  const valid = expectedSlugs.every((slug) => {
    const value = progress[slug];
    const parts = seasonProgressParts(value);
    if (
      !parts ||
      parts.expected <= 0 ||
      parts.selected < 0 ||
      parts.selected > parts.expected
    )
      return false;
    const hasExplicitDenominator =
      (value && typeof value === "object") ||
      /^\d+\s*\/\s*\d+$/u.test(String(value ?? "").trim());
    return (
      (!hasExplicitDenominator ||
        parts.expected === graduationGiftCounts[slug]) &&
      Number.isInteger(graduationGiftCounts[slug]) &&
      graduationGiftCounts[slug] > 0
    );
  });
  if (!valid) return false;
  const startProgress = seasonProgressParts(progress[startSlug]);
  return Boolean(
    startProgress &&
      startProgress.expected > 0 &&
      startProgress.selected > 0 &&
      startProgress.selected <= startProgress.expected,
  );
};

export const isExcludedFromModel = (row) => {
  const explicit = row?.exclude_from_model;
  const normalized = String(explicit ?? "").trim().toLowerCase();
  return explicit === true || explicit === 1 || normalized === "true" ||
    Boolean(String(row?.exclusion_reason ?? "").trim());
};

// These classifications are based only on normalized numeric source fields.
// Listing-language fallbacks belong to the ingestion/audit layer so validators
// never recreate market attributes from seller prose.
export const breakClassFor = (row) => {
  if (breakClasses.includes(row.computed_break_class)) return row.computed_break_class;
  const missing = Number(row.missing_season_count);
  const completion = Number(row.completion_ratio);
  if (!Number.isFinite(missing) || !Number.isFinite(completion)) return null;
  if (missing === 0) return "none";
  if (missing <= 2 && completion >= 0.8) return "slight";
  if (missing <= 5 || completion >= 0.5) return "medium";
  return "big";
};
export const packageTierFor = (row) => {
  const rawCount = row.paid_package_count;
  const hasCount = rawCount !== undefined && rawCount !== null && rawCount !== "";
  if (hasCount) {
    const count =
      typeof rawCount === "number" && Number.isInteger(rawCount)
        ? rawCount
        : typeof rawCount === "string" && /^\d+$/.test(rawCount.trim())
          ? Number(rawCount.trim())
          : NaN;
    if (!Number.isSafeInteger(count) || count < 0) return null;
    if (count >= 100) return "hundred";
    if (count >= 40) return "many";
    if (count >= 15) return "medium";
    return "few";
  }
  return packageTiers.includes(row.computed_package_tier)
    ? row.computed_package_tier
    : null;
};

// A source row may carry this normalized snapshot when it was collected from
// the organizer.  It is intentionally numeric: validators must not recreate
// package, limited-item or binding decisions from listing prose.
export const valuationModelFeaturesFor = (row) => {
  const value = row.valuation_model ?? row.valuationModel ?? row.model_features;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    valuationModelInputKeys.some(
      (key) => typeof value[key] !== "number" || !Number.isFinite(value[key]),
    )
  )
    return null;
  const result = Object.fromEntries(
    valuationModelInputKeys.map((key) => [key, value[key]]),
  );
  result.confidence = value.confidence;
  if (!hasCompleteValuationModelFeatures(result)) return null;
  if (result.baseLow <= 0 || result.baseHigh < result.baseLow) return null;
  if (result.breakMultiplier <= 0 || result.accountStyleMultiplier <= 0) return null;
  if (result.packageMarketMultiplier <= 0) return null;
  if (result.bindingRisk < 0.7 || result.bindingRisk > 1) return null;
  if (result.transferHighMultiplier < 1 || result.transferHighMultiplier > 1.03) return null;
  if (["partialDiscountLow", "partialDiscountHigh", "packageLow", "packageHigh", "limitedLow", "limitedHigh", "resourceLow", "resourceHigh"].some((key) => result[key] < 0)) return null;
  return result;
};

const positiveNumber = (value, coerce) => {
  const number = coerce ? Number(value) : value;
  return Number.isFinite(number) && number > 0 ? number : null;
};
export const priceRangeFor = (row, { coerce = true, coercePoint = coerce, coerceRange = coerce } = {}) => {
  const point = positiveNumber(row.price_twd, coercePoint);
  if (point) return { low: point, high: point };
  const low = positiveNumber(row.price_twd_low, coerceRange);
  const high = positiveNumber(row.price_twd_high, coerceRange);
  if (!low && !high) return null;
  return { low: low ?? high, high: high ?? low };
};
export const priceFor = (row, options = {}) => {
  const { round = false } = options;
  const range = priceRangeFor(row, options);
  if (!range) return null;
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  const kind = row.price_kind ?? row.evidence_kind ?? "ask";
  const position = kind === "quick_sale" ? 0.25 : kind === "sold" ? 0.5 : 0.58;
  const price = low + (high - low) * position;
  return round ? Math.round(price) : price;
};
const dateFor = (row) => {
  const date = new Date(row.published_at ?? "");
  return Number.isFinite(date.getTime()) ? date : null;
};
export const timestampFor = (row) => {
  const date = new Date(row.published_at ?? row.observed_at ?? "");
  return Number.isFinite(date.getTime()) ? date.getTime() : Number.NEGATIVE_INFINITY;
};
export const timeWeightFor = (row, referenceDate) => {
  const date = dateFor(row);
  if (!date) return 0.45;
  const age = (referenceDate.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age <= 2) return 1;
  if (age <= 3) return 0.7;
  if (age <= 4) return 0.45;
  return 0.25;
};
export const sampleWeightFor = (row, referenceDate) => {
  const priceKind = row.price_kind ?? row.evidence_kind ?? "ask";
  const priceKindWeight = row.price_kind
    ? (priceKindWeights[priceKind] ?? 0.75)
    : 1;
  return (evidenceWeights[row.evidence_kind] ?? 0) *
    priceKindWeight *
    qualityWeights[row.evidence_quality ?? "medium"] *
    timeWeightFor(row, referenceDate);
};
export const accountKeyFor = (row, { trim = true } = {}) => {
  const stableFingerprint = String(row?.account_fingerprint ?? "").trim();
  const value =
    row?.account_identity_scheme === "stable-hmac-v1" &&
    /^[a-f0-9]{64}$/u.test(stableFingerprint)
      ? stableFingerprint
      : row.account_group_hash ?? row.account_hash ?? row.account_fingerprint;
  return value === undefined || value === null || String(value).trim() === ""
    ? null
    : trim ? String(value).trim() : String(value);
};
export const postKeyFor = (row, { trim = true } = {}) => {
  const value = row.post_hash ?? row.post_fingerprint;
  return value === undefined || value === null || String(value).trim() === ""
    ? null
    : trim ? String(value).trim() : String(value);
};
export const groupKeyFor = (row) => {
  const groupHash = String(
    row.group_hash ?? row.market_group_hash ?? row.source_group_hash ?? "",
  ).trim();
  if (groupHash) return `group:${groupHash}`;
  return `source:${String(row.source ?? row.__sourceHint ?? "unknown").trim() || "unknown"}`;
};
export const marketGroupFor = groupKeyFor;
export const sourceFor = (row) => {
  const value = String(row.source ?? row.__sourceHint ?? "unknown").trim().toLowerCase();
  if (/facebook|\bfb\b/.test(value)) return "facebook";
  if (/drive|google/.test(value)) return "google_drive";
  if (["8591_hk", "8591_tw", "carousell_tw", "manual_backup"].includes(value))
    return value;
  return "unknown";
};
const evidenceRank = (kind) =>
  ({ sold: 5, quick_sale: 4, ask: 3, professional_estimate: 2, comment: 1 })[kind] ?? 0;
const stableValuationModel = (row) => {
  const value = row.valuation_model ?? row.valuationModel ?? row.model_features;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(
    [...valuationModelInputKeys, "confidence"].map((key) => [key, value[key] ?? null]),
  );
};
export const stableRowKey = (row, { accountTrim = true } = {}) =>
  createHash("sha256")
    .update(JSON.stringify({
      evidence_kind: row.evidence_kind ?? "",
      price_twd: row.price_twd ?? "",
      price_twd_low: row.price_twd_low ?? "",
      price_twd_high: row.price_twd_high ?? "",
      published_at: row.published_at ?? "",
      observed_at: row.observed_at ?? "",
      post_hash: row.post_hash ?? "",
      account_key: accountKeyFor(row, { trim: accountTrim }) ?? "",
      group_key: groupKeyFor(row),
      start_season_slug: row.start_season_slug ?? "",
      season_progress: row.season_progress ?? null,
      season_progress_end_slug: row.season_progress_end_slug ?? "",
      paid_package_count: row.paid_package_count ?? "",
      account_identity_scheme: row.account_identity_scheme ?? "",
      identity_namespace: row.identity_namespace ?? "",
      snapshot_hash: row.snapshot_hash ?? "",
      inventory_complete: row.inventory_complete ?? null,
      bindings_complete: row.bindings_complete ?? null,
      valuation_model_schema_version: row.valuation_model_schema_version ?? null,
      valuation_model: stableValuationModel(row),
    }))
    .digest("hex");
const replayEvidenceScore = (row) => {
  const progress = row?.season_progress;
  const progressEntries =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? Object.keys(progress).length
      : 0;
  return (
    (valuationModelFeaturesFor(row) && hasCompleteModelEvidenceShape(row) ? 100 : 0) +
    (hasReplayableSeasonProgress(row, {
      orderedSeasonSlugs: seasonBandSeeds.map((seed) => seed.slug),
      requiredEndSlug: replaySeasonProgressEndSlug,
      graduationGiftCounts: seasonGraduationGiftCounts,
    }) ? 20 : 0) +
    Math.min(progressEntries, 19)
  );
};
export const preferredRow = (left, right) => {
  const evidenceDifference = evidenceRank(right.evidence_kind) - evidenceRank(left.evidence_kind);
  if (evidenceDifference) return evidenceDifference > 0 ? right : left;
  const timeDifference = timestampFor(right) - timestampFor(left);
  if (timeDifference) return timeDifference > 0 ? right : left;
  const replayEvidenceDifference = replayEvidenceScore(right) - replayEvidenceScore(left);
  if (replayEvidenceDifference) return replayEvidenceDifference > 0 ? right : left;
  return stableRowKey(right).localeCompare(stableRowKey(left)) < 0 ? right : left;
};
export const preferredSample = (left, right, { accountTrim = true } = {}) => {
  const evidenceDifference = evidenceRank(right.evidenceKind) - evidenceRank(left.evidenceKind);
  if (evidenceDifference) return evidenceDifference > 0 ? right : left;
  if (right.publishedAt !== left.publishedAt)
    return right.publishedAt > left.publishedAt ? right : left;
  const replayEvidenceDifference = replayEvidenceScore(right.row) - replayEvidenceScore(left.row);
  if (replayEvidenceDifference) return replayEvidenceDifference > 0 ? right : left;
  return stableRowKey(right.row, { accountTrim }).localeCompare(
    stableRowKey(left.row, { accountTrim }),
  ) < 0 ? right : left;
};
export const inHoldout = (accountKey, seed, { splitSecret = "" } = {}) =>
  createHash("sha256")
    .update(`${holdoutKeyFor(seed, splitSecret)}:${accountKey}`)
    .digest()
    .readUInt32BE(0) % 10 >= 8;
export const applyGroupCap = (samples, key = "groupKey") => {
  const weights = new Map();
  samples.forEach((sample) =>
    weights.set(sample[key], (weights.get(sample[key]) ?? 0) + sample.weight),
  );
  const rawTotal = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const [dominantGroup, dominantWeight = 0] = [...weights.entries()].sort(
    ([leftKey, leftWeight], [rightKey, rightWeight]) =>
      rightWeight - leftWeight || String(leftKey).localeCompare(String(rightKey)),
  )[0] ?? [];
  const otherWeight = rawTotal - dominantWeight;
  const cappedWeight = otherWeight > 0 ? Math.min(dominantWeight, otherWeight * 1.5) : dominantWeight;
  const multiplier = dominantWeight ? cappedWeight / dominantWeight : 1;
  const cappedSamples = multiplier === 1
    ? samples
    : samples.map((sample) =>
      sample[key] === dominantGroup ? { ...sample, weight: sample.weight * multiplier } : sample,
    );
  const effectiveTotal = cappedSamples.reduce((sum, sample) => sum + sample.weight, 0);
  const effectiveDominant = cappedSamples
    .filter((sample) => sample[key] === dominantGroup)
    .reduce((sum, sample) => sum + sample.weight, 0);
  return {
    samples: cappedSamples,
    groupCount: weights.size,
    rawLargestShare: rawTotal ? dominantWeight / rawTotal : 0,
    cappedLargestShare: effectiveTotal ? effectiveDominant / effectiveTotal : 0,
    capped: multiplier !== 1,
  };
};
