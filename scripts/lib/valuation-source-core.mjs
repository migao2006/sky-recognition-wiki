import { createHash } from "node:crypto";
import {
  hasCompleteValuationModelFeatures,
  valuationModelInputKeys,
} from "../../app/valuation-model-core.js";

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
  const result = Object.fromEntries(
    valuationModelInputKeys.map((key) => [key, Number(value[key])]),
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

const numberOrNull = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
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
export const timestampFor = (row) => dateFor(row)?.getTime() ?? Number.NEGATIVE_INFINITY;
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
  const explicit = numberOrNull(row.effective_weight ?? row.sample_weight);
  if (explicit) return explicit;
  const priceKind = row.price_kind ?? row.evidence_kind ?? "ask";
  return (evidenceWeights[row.evidence_kind] ?? 0) *
    (priceKindWeights[priceKind] ?? 0.75) *
    qualityWeights[row.evidence_quality ?? "medium"] *
    timeWeightFor(row, referenceDate);
};
export const accountKeyFor = (row, { trim = true } = {}) => {
  const value = row.account_group_hash ?? row.account_hash ?? row.account_fingerprint;
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
  const groupHash = String(row.group_hash ?? "").trim();
  if (groupHash) return `group:${groupHash}`;
  return `source:${String(row.source ?? row.__sourceHint ?? "unknown").trim() || "unknown"}`;
};
export const marketGroupFor = (row) =>
  String(row.group_hash ?? row.market_group_hash ?? row.source_group_hash ?? row.source ?? "unknown");
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
      paid_package_count: row.paid_package_count ?? "",
    }))
    .digest("hex");
export const preferredRow = (left, right) => {
  const evidenceDifference = evidenceRank(right.evidence_kind) - evidenceRank(left.evidence_kind);
  if (evidenceDifference) return evidenceDifference > 0 ? right : left;
  const timeDifference = timestampFor(right) - timestampFor(left);
  if (timeDifference) return timeDifference > 0 ? right : left;
  return stableRowKey(right).localeCompare(stableRowKey(left)) < 0 ? right : left;
};
export const preferredSample = (left, right, { accountTrim = true } = {}) => {
  const evidenceDifference = evidenceRank(right.evidenceKind) - evidenceRank(left.evidenceKind);
  if (evidenceDifference) return evidenceDifference > 0 ? right : left;
  if (right.publishedAt !== left.publishedAt)
    return right.publishedAt > left.publishedAt ? right : left;
  return stableRowKey(right.row, { accountTrim }).localeCompare(
    stableRowKey(left.row, { accountTrim }),
  ) < 0 ? right : left;
};
export const inHoldout = (accountKey, seed) =>
  createHash("sha256").update(`${seed}:${accountKey}`).digest().readUInt32BE(0) % 10 >= 8;
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
