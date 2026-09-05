import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import {
  valuationConfidenceValues,
  valuationModelInputKeys,
} from "../app/valuation-model-core.js";
import {
  replaySeasonProgressEndSlug,
  seasonBandSeeds,
  seasonGraduationGiftCounts,
} from "../app/valuation-season-band-core.js";
import {
  accountKeyFor,
  accountStyles,
  applyGroupCap as applySharedGroupCap,
  breakClasses,
  breakClassFor as sharedBreakClassFor,
  evidenceWeights,
  groupKeyFor,
  hasCompleteModelEvidence,
  hasCompleteModelEvidenceSnapshot,
  hasReplayableSeasonProgress,
  holdoutSplitCommitmentFor,
  inHoldout,
  isExcludedFromModel,
  modelEvidenceFields,
  packageTiers,
  packageTierFor,
  preferredRow,
  priceFor as sharedPriceFor,
  priceRangeFor as sharedPriceRangeFor,
  sampleWeightFor,
  sourceFor,
  stableRowKey,
  timestampFor,
  qualityWeights,
  valuationModelFeaturesFor,
  valuationDatasetDigestFor,
} from "./lib/valuation-source-core.mjs";

const args = process.argv.slice(2);
const asOfArg = args.find((value) => value.startsWith("--as-of="));
const splitSeedArg = args.find((value) => value.startsWith("--split-seed="));
const includeHoldout = args.includes("--include-holdout");
const splitSeed = splitSeedArg?.slice("--split-seed=".length) || "sky-valuation-v3";
const valuationHashSalt = process.env.VALUATION_HASH_SALT ?? "";
const valuationHoldoutSecret = process.env.VALUATION_HOLDOUT_SECRET ?? "";
const sourcePaths = args.filter(
  (value) =>
    value !== "--include-holdout" &&
    !value.startsWith("--as-of=") &&
    !value.startsWith("--split-seed="),
);
const orderedSeasonSlugs = seasonBandSeeds.map((seed) => seed.slug);
const replaySeasonProgressOptions = {
  orderedSeasonSlugs,
  requiredEndSlug: replaySeasonProgressEndSlug,
  graduationGiftCounts: seasonGraduationGiftCounts,
};
if (!sourcePaths.length)
  throw new Error(
    "Usage: node scripts/audit-valuation-source.mjs [--as-of=YYYY-MM-DD] [--split-seed=value] [--include-holdout] <source.jsonl> [...more.jsonl]",
  );

const patterns = new Map([
  ["gratitude", "感恩季|感恩畢|鹿頭"],
  ["lightseekers", "追光季|追光畢|大傘"],
  ["belonging", "歸屬季|歸屬畢|篝火"],
  ["rhythm", "音韻季|音韻畢|白鳥"],
  ["enchantment", "魔法季|魔法畢|耳墜"],
  ["sanctuary", "聖島季|聖島畢|手碟"],
  ["prophecy", "預言季|預言畢|阿努比斯|阿努"],
  ["dreams", "夢想季|夢想畢|鳳凰"],
  ["assembly", "重組季|集結|重組畢|號角"],
  ["the-little-prince", "小王子季|王子畢|小王子畢"],
  ["flight", "飛行季|飛翔季|風行季|風行|飛行畢|飛翔畢"],
  ["abyss", "潛海季|深淵季|潛海畢|深淵畢"],
  ["performance", "表演季|表演畢"],
  ["shattering", "破碎季|破曉季|破碎畢|破曉畢"],
  ["aurora", "極光季|AURORA季|歐若拉季|極光畢|AURORA畢|歐若拉畢"],
  ["remembrance", "緬懷季|追憶|緬懷畢"],
  ["passage", "夜行季|夜行畢"],
  ["moments", "拾光季|拾光畢"],
  ["revival", "歸巢季|歸巢畢"],
  ["nine-colored-deer", "九色鹿季|九色鹿畢"],
  ["nesting", "築巢季|築巢畢"],
  ["duets", "協奏季|二重奏季|協奏畢|二重奏畢"],
  ["moomin", "姆明季|姆明畢"],
  ["radiance", "染色季|彩染季|染色畢|彩染畢"],
  ["blue-bird", "青鳥季|青鳥畢"],
  ["two-embers-part-1", "暮星季|雙星|暮星畢"],
  ["migration", "遷徙季|遷徙畢"],
  ["lightmending", "織光季|織光畢"],
  ["carnival", "狂歡季|狂歡畢"],
  ["dear-van-gogh", "梵谷季|致梵谷季"],
]);

const emptyBreakdown = () => ({ ask: 0, quick_sale: 0, sold: 0, professional_estimate: 0, comment: 0 });
const emptyQualityBreakdown = () => ({ high: 0, medium: 0, low: 0 });

let referenceDate = null;
const priceRangeFor = (row) => sharedPriceRangeFor(row, {
  coercePoint: false,
  coerceRange: true,
});
const priceFor = (row) => sharedPriceFor(row, {
  round: true,
  coercePoint: false,
  coerceRange: true,
});
const seasonSlugsFor = (row) => {
  const start = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (patterns.has(start)) return [start];
  const slugs = new Set();
  const add = (value) => {
    const slug = String(value ?? "").trim().toLowerCase();
    if (patterns.has(slug)) slugs.add(slug);
  };
  if (row.season_progress && typeof row.season_progress === "object") Object.keys(row.season_progress).forEach(add);
  if (Array.isArray(row.seasons)) row.seasons.forEach((season) => add(typeof season === "string" ? season : season?.slug));
  if (slugs.size) return [...slugs];
  const text = `${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  for (const [slug, pattern] of patterns) if (new RegExp(pattern, "i").test(text)) slugs.add(slug);
  return [...slugs];
};
const structuredSeasonSlugsFor = (row) => {
  const slugs = new Set();
  const add = (value) => {
    const slug = String(value ?? "").trim().toLowerCase();
    if (patterns.has(slug)) slugs.add(slug);
  };
  add(row.start_season_slug);
  if (row.season_progress && typeof row.season_progress === "object")
    Object.keys(row.season_progress).forEach(add);
  if (Array.isArray(row.seasons))
    row.seasons.forEach((season) =>
      add(typeof season === "string" ? season : season?.slug),
    );
  return [...slugs];
};
const startSeasonFor = (row) => {
  const explicit = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (patterns.has(explicit)) return explicit;
  if (row.season_progress && typeof row.season_progress === "object") {
    const hasProgress = (value) => {
      if (value === null || value === undefined || value === false) return false;
      if (typeof value === "number") return value > 0;
      const normalized = String(value).trim().toLowerCase();
      if (!normalized || /^(?:0|0\s*\/\s*\d+|⁰|none|no|false|-)$/.test(normalized))
        return false;
      return true;
    };
    for (const slug of patterns.keys()) {
      if (Object.hasOwn(row.season_progress, slug) && hasProgress(row.season_progress[slug]))
        return slug;
    }
  }
  const structured = structuredSeasonSlugsFor(row);
  return structured.length === 1 ? structured[0] : null;
};
const startSeasonFactorFor = (row, startSeason) => {
  if (!startSeason) return 0;
  const confidence = String(row.start_season_confidence ?? "").toLowerCase();
  if (confidence === "unknown") return 0;
  if (!patterns.has(String(row.start_season_slug ?? "").trim().toLowerCase()))
    return 0.45;
  if (confidence === "inferred") return 0.45;
  if (confidence === "structured") return 0.8;
  return 1;
};
const auditBreakClassFor = (row) => {
  const structured = sharedBreakClassFor(row);
  if (structured) return structured;
  const label = String(row.seller_break_label ?? "").toLowerCase();
  if (/無斷|none/.test(label)) return "none";
  if (/微斷|小斷|近無斷|偽無斷|slight/.test(label)) return "slight";
  if (/中斷|半斷|medium/.test(label)) return "medium";
  if (/大斷|多斷|big/.test(label)) return "big";
  return null;
};
const accountStyleFor = (row) => accountStyles.includes(row.account_style) ? row.account_style : null;
const invalidReason = (row) => {
  if (isExcludedFromModel(row)) return "explicit";
  if (!priceRangeFor(row)) return "invalid_price";
  const text = `${row.region ?? ""} ${row.currency ?? ""} ${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  if (/國服|中國服|陸服|\b(?:cn|china)\b/i.test(text)) return "china";
  if (/人民幣|rmb|cny|￥|¥|\busd\b|美金|港幣|hkd/i.test(text)) return "foreign_currency";
  if (!Object.hasOwn(evidenceWeights, row.evidence_kind)) return "invalid_evidence";
  if (!Object.hasOwn(qualityWeights, row.evidence_quality ?? "medium")) return "invalid_quality";
  return null;
};
const weightedQuantile = (samples, percentile, valueKey = "price") => {
  const ordered = [...samples].sort((a, b) => a[valueKey] - b[valueKey]);
  const total = ordered.reduce((sum, sample) => sum + sample.weight, 0);
  if (!total) return null;
  const target = total * percentile;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample[valueKey];
  }
  return ordered.at(-1)[valueKey];
};
const summarize = (samples, includeEvidenceProfile = false) => {
  const effectiveWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const evidenceBreakdown = emptyBreakdown();
  const qualityBreakdown = emptyQualityBreakdown();
  const sourceBreakdown = {};
  samples.forEach((sample) => {
    evidenceBreakdown[sample.kind] += 1;
    qualityBreakdown[sample.quality] += 1;
    sourceBreakdown[sample.source] = (sourceBreakdown[sample.source] ?? 0) + 1;
  });
  return {
    sampleCount: samples.length,
    effectiveWeight: Number(effectiveWeight.toFixed(3)),
    p25: weightedQuantile(samples, 0.25),
    median: weightedQuantile(samples, 0.5),
    p75: weightedQuantile(samples, 0.75),
    evidenceBreakdown,
    ...(includeEvidenceProfile
      ? {
          qualityBreakdown,
          sourceBreakdown: Object.fromEntries(
            Object.entries(sourceBreakdown).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          ),
        }
      : {}),
  };
};
const isCalibrationAccount = (accountKey) => {
  if (!accountKey) return true;
  return !inHoldout(accountKey, splitSeed, {
    splitSecret: valuationHoldoutSecret,
  });
};
const applyGroupCap = (samples) => {
  const result = applySharedGroupCap(samples);
  return {
    ...result,
    largestEffectiveShare: result.cappedLargestShare
      ? Number(result.cappedLargestShare.toFixed(3))
      : 0,
  };
};
const applyAnonymousCap = (samples) => {
  const identifiedWeight = samples
    .filter((sample) => sample.accountKey)
    .reduce((sum, sample) => sum + sample.weight, 0);
  const anonymousWeight = samples
    .filter((sample) => !sample.accountKey)
    .reduce((sum, sample) => sum + sample.weight, 0);
  const weightLimit = identifiedWeight ? identifiedWeight / 9 : anonymousWeight;
  const multiplier = anonymousWeight ? Math.min(1, weightLimit / anonymousWeight) : 1;
  return {
    samples: multiplier === 1
      ? samples
      : samples.map((sample) =>
        sample.accountKey ? sample : { ...sample, weight: sample.weight * multiplier },
      ),
    capped: multiplier < 1,
  };
};

const rows = [];
for (const sourcePath of sourcePaths)
  for await (const line of createInterface({ input: createReadStream(sourcePath) }))
    if (line.trim())
      rows.push({
        ...JSON.parse(line),
        __sourceHint: /facebook/i.test(sourcePath)
          ? "facebook"
          : /drive/i.test(sourcePath)
            ? "google_drive"
            : "unknown",
      });

const datasetDigest = valuationDatasetDigestFor(rows);
const splitCommitment = holdoutSplitCommitmentFor(
  splitSeed,
  valuationHoldoutSecret,
);

const referenceCandidates = rows.flatMap((row) =>
  [row.observed_at, row.published_at]
    .map((value) => new Date(value ?? ""))
    .filter((date) => Number.isFinite(date.getTime())),
);
referenceDate = asOfArg
  ? new Date(`${asOfArg.slice("--as-of=".length)}T23:59:59.999Z`)
  : referenceCandidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
if (!Number.isFinite(referenceDate.getTime()))
  throw new Error("Invalid --as-of date; expected YYYY-MM-DD");

const seasonMetrics = Object.fromEntries([...patterns.keys()].map((slug) => [slug, { samples: [], excludedCount: 0, duplicateCount: 0 }]));
const postRows = new Map();
let duplicatePostRows = 0;
for (const row of rows) {
  const hash = String(row.post_hash ?? "").trim();
  if (!hash) {
    postRows.set(`row:${postRows.size}`, row);
    continue;
  }
  const existing = postRows.get(`post:${hash}`);
  if (existing) {
    duplicatePostRows += 1;
    const retained = preferredRow(existing, row);
    postRows.set(`post:${hash}`, retained);
    seasonSlugsFor(row).forEach((slug) => (seasonMetrics[slug].duplicateCount += 1));
  } else {
    postRows.set(`post:${hash}`, row);
  }
}

const eligibleCandidates = [];
let excludedRows = 0;
for (const row of postRows.values()) {
  const slugs = seasonSlugsFor(row);
  if (invalidReason(row)) {
    excludedRows += 1;
    slugs.forEach((slug) => (seasonMetrics[slug].excludedCount += 1));
    continue;
  }
  const kind = row.evidence_kind;
  const startSeason = startSeasonFor(row);
  const sample = {
    price: priceFor(row),
    weight: sampleWeightFor(row, referenceDate),
    kind,
    quality: row.evidence_quality ?? "medium",
    source: sourceFor(row),
    startSeason,
    startSeasonFactor: startSeasonFactorFor(row, startSeason),
    breakClass: auditBreakClassFor(row),
    packageTier: packageTierFor(row),
    accountStyle: accountStyleFor(row),
    accountKey: accountKeyFor(row),
    groupKey: groupKeyFor(row),
    publishedAt: timestampFor(row),
    recordId: stableRowKey(row),
  };
  const affectsCalibration =
    slugs.length > 0 ||
    sample.startSeasonFactor > 0 ||
    sample.breakClass !== null ||
    sample.packageTier !== null ||
    sample.accountStyle !== null;
  if (!affectsCalibration) {
    excludedRows += 1;
    continue;
  }
  eligibleCandidates.push({ sample, slugs, row });
}

const selectedCandidates = [];
const relistedByAccount = new Map();
let relistedAccountRows = 0;
for (const candidate of eligibleCandidates) {
  const key = candidate.sample.accountKey;
  if (!key) {
    selectedCandidates.push(candidate);
    continue;
  }
  const existing = relistedByAccount.get(key);
  if (!existing) {
    relistedByAccount.set(key, candidate);
    continue;
  }
  relistedAccountRows += 1;
  relistedByAccount.set(
    key,
    preferredRow(existing.row, candidate.row) === candidate.row ? candidate : existing,
  );
}
selectedCandidates.push(...relistedByAccount.values());

const deduplicatedCandidates = [];
const bySnapshot = new Map();
let duplicateSnapshotRows = 0;
for (const candidate of selectedCandidates) {
  const snapshotHash = String(candidate.row.snapshot_hash ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(snapshotHash)) {
    deduplicatedCandidates.push(candidate);
    continue;
  }
  const existing = bySnapshot.get(snapshotHash);
  if (!existing) {
    bySnapshot.set(snapshotHash, candidate);
    continue;
  }
  duplicateSnapshotRows += 1;
  bySnapshot.set(
    snapshotHash,
    preferredRow(existing.row, candidate.row) === candidate.row ? candidate : existing,
  );
}
deduplicatedCandidates.push(...bySnapshot.values());

const uncappedSamples = deduplicatedCandidates.map(({ sample }) => sample);
const allEligible = uncappedSamples;
const identifiedAccountRows = new Set(
  allEligible.map((sample) => sample.accountKey).filter(Boolean),
).size;
const anonymousEligibleRows = allEligible.filter((sample) => !sample.accountKey).length;
const calibrationOnly = allEligible.filter((sample) => isCalibrationAccount(sample.accountKey));
const holdout = allEligible.filter((sample) => !isCalibrationAccount(sample.accountKey));
const trainingSamples = includeHoldout ? allEligible : calibrationOnly;
const identifiedTraining = trainingSamples.filter((sample) => sample.accountKey);
const anonymousTraining = trainingSamples.filter((sample) => !sample.accountKey);
const groupCap = applyGroupCap(identifiedTraining.length ? identifiedTraining : trainingSamples);
const anonymousCap = applyAnonymousCap(
  identifiedTraining.length ? [...groupCap.samples, ...anonymousTraining] : groupCap.samples,
);
const eligible = anonymousCap.samples;
const calibrationEligible = eligible.filter((sample) =>
  isCalibrationAccount(sample.accountKey),
);
const eligibleByRecordId = new Map(eligible.map((sample) => [sample.recordId, sample]));
for (const candidate of deduplicatedCandidates) {
  if (!includeHoldout && !isCalibrationAccount(candidate.sample.accountKey)) continue;
  candidate.slugs.forEach((slug) => seasonMetrics[slug].samples.push(
    eligibleByRecordId.get(candidate.sample.recordId) ?? candidate.sample,
  ));
}

const seasons = Object.fromEntries([...patterns.keys()].map((slug) => {
  const metric = seasonMetrics[slug];
  return [slug, { ...summarize(metric.samples), excludedCount: metric.excludedCount, duplicateCount: metric.duplicateCount }];
}));
const segmentFor = (key, values) => Object.fromEntries(values.map((value) => [value, summarize(eligible.filter((sample) => sample[key] === value))]));
const segments = {
  startSeason: Object.fromEntries([...patterns.keys()].map((slug) => [slug, summarize(eligible
    .filter((sample) => sample.startSeason === slug && sample.startSeasonFactor > 0)
    .map((sample) => ({ ...sample, weight: sample.weight * sample.startSeasonFactor })), true)])),
  breakClass: segmentFor("breakClass", breakClasses),
  packageTier: segmentFor("packageTier", packageTiers),
  accountStyle: segmentFor("accountStyle", accountStyles),
};

const startMedians = new Map(Object.entries(segments.startSeason).filter(([, metric]) => metric.median).map(([slug, metric]) => [slug, metric.median]));
const normalized = eligible.flatMap((sample) => {
  const baseline = startMedians.get(sample.startSeason);
  return baseline && sample.startSeasonFactor > 0
    ? [{ ...sample, weight: sample.weight * sample.startSeasonFactor, logRatio: Math.log(sample.price / baseline) }]
    : [];
});
const modifierFor = (key, values, priorStrength = 12, priors = {}) => Object.fromEntries(values.map((value) => {
  const samples = normalized.filter((sample) => sample[key] === value).map((sample) => ({ ...sample, price: sample.logRatio }));
  const medianLog = weightedQuantile(samples, 0.5) ?? 0;
  const effectiveWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const shrink = effectiveWeight / (effectiveWeight + priorStrength);
  return [value, {
    multiplier: Number(Math.min(1.35, Math.max(0.55, Math.exp(Math.log(priors[value] ?? 1) * (1 - shrink) + medianLog * shrink))).toFixed(3)),
    sampleCount: samples.length,
    effectiveWeight: Number(effectiveWeight.toFixed(3)),
  }];
}));
const rawBreakModifiers = modifierFor("breakClass", breakClasses, 16, {
  none: 1,
  slight: 0.94,
  medium: 0.84,
  big: 0.7,
});
let breakCeiling = 1.05;
const breakCaps = { none: 1, slight: 0.97, medium: 0.9, big: 0.78 };
for (const key of breakClasses) {
  rawBreakModifiers[key].multiplier = Number(
    Math.min(
      breakCeiling,
      breakCaps[key],
      rawBreakModifiers[key].multiplier,
    ).toFixed(3),
  );
  breakCeiling = rawBreakModifiers[key].multiplier;
}
const rawPackageModifiers = modifierFor("packageTier", packageTiers, 16, {
  few: 0.92,
  medium: 1,
  many: 1.09,
  hundred: 1.18,
});
let packageFloor = 0.88;
for (const key of packageTiers) {
  rawPackageModifiers[key].multiplier = Number(
    Math.max(packageFloor, rawPackageModifiers[key].multiplier).toFixed(3),
  );
  packageFloor = rawPackageModifiers[key].multiplier;
}
const packageModifierCaps = { few: 1, medium: 1.08, many: 1.15, hundred: 1.21 };
let cappedPackageFloor = 0;
for (const key of packageTiers) {
  rawPackageModifiers[key].multiplier = Number(
    Math.max(
      cappedPackageFloor,
      Math.min(packageModifierCaps[key], rawPackageModifiers[key].multiplier),
    ).toFixed(3),
  );
  cappedPackageFloor = rawPackageModifiers[key].multiplier;
}
const modifiers = {
  breakClass: rawBreakModifiers,
  packageTier: rawPackageModifiers,
  accountStyle: modifierFor("accountStyle", accountStyles, 20, {
    simple: 0.86,
    regular: 1,
  }),
};
const sourceBreakdown = Object.fromEntries([...new Set(allEligible.map((sample) => sample.source))].sort().map((source) => [source, allEligible.filter((sample) => sample.source === source).length]));
const sourceRowsBySource = Object.fromEntries(
  [...new Set(rows.map(sourceFor))]
    .sort()
    .map((source) => [
      source,
      rows.filter((row) => sourceFor(row) === source).length,
    ]),
);
const predictorFields = [
  ...valuationModelInputKeys,
  "confidence",
  "valuation_model_semantics",
  "season_progress",
  ...modelEvidenceFields,
];
const missingPredictorFields = (row) => {
  const predictor = row?.valuation_model;
  if (!predictor || typeof predictor !== "object" || Array.isArray(predictor))
    return predictorFields;
  const missing = predictorFields.filter((field) =>
    field === "valuation_model_semantics"
      ? false
      :
    field === "season_progress"
      ? !hasReplayableSeasonProgress(row, replaySeasonProgressOptions)
      : field === "account_fingerprint" || field === "snapshot_hash" || field === "identity_namespace"
      ? !/^[a-f0-9]{64}$/u.test(String(row[field] ?? ""))
      : field === "account_identity_scheme"
      ? row[field] !== "stable-hmac-v1"
      : field === "valuation_model_schema_version"
      ? row[field] !== 3
      : field === "inventory_complete" || field === "bindings_complete"
      ? row[field] !== true
      : field === "model_evidence"
      ? !hasCompleteModelEvidenceSnapshot(row)
      : field === "evidence_signature"
      ? !hasCompleteModelEvidence(row, { hashSalt: valuationHashSalt })
      : field === "confidence"
      ? !valuationConfidenceValues.includes(predictor[field])
      : typeof predictor[field] !== "number" || !Number.isFinite(predictor[field]),
  );
  const hasMissingModelField = missing.some(
    (field) => field === "confidence" || valuationModelInputKeys.includes(field),
  );
  if (!hasMissingModelField && !valuationModelFeaturesFor(row)) {
    missing.push("valuation_model_semantics");
  }
  return missing;
};
const predictorCandidates = selectedCandidates
  .filter(({ sample }) =>
    sample.accountKey && sample.startSeason && sample.startSeasonFactor > 0,
  )
  .map(({ row }) => ({
    source: sourceFor(row),
    missing: missingPredictorFields(row),
  }));
const completePredictorRows = predictorCandidates.filter(
  ({ missing }) => !missing.length,
).length;
const missingByField = Object.fromEntries(
  predictorFields.map((field) => [
    field,
    predictorCandidates.filter(({ missing }) => missing.includes(field)).length,
  ]),
);
const predictorSourceCoverage = Object.fromEntries(
  [...new Set(predictorCandidates.map(({ source }) => source))]
    .sort()
    .map((source) => {
      const sourceRows = predictorCandidates.filter(
        (candidate) => candidate.source === source,
      );
      const completeRows = sourceRows.filter(({ missing }) => !missing.length).length;
      return [source, {
        eligibleRows: sourceRows.length,
        completeRows,
        missingRows: sourceRows.length - completeRows,
        coverage: Number((completeRows / sourceRows.length).toFixed(4)),
      }];
    }),
);

console.log(JSON.stringify({
  schemaVersion: 4,
  validationStatus: "unvalidated",
  provenance: {
    modelSchemaVersion: 3,
    predictorSchema: "valuation_model",
    seasonProgressEndSlug: replaySeasonProgressEndSlug,
    validation: "requires validate-valuation-model full holdout pass before publishing as validated",
  },
  asOf: referenceDate.toISOString().slice(0, 10),
  sourceRows: rows.length,
  eligibleRows: allEligible.length,
  excludedRows,
  duplicateRows: duplicatePostRows,
  duplicatePostRows,
  duplicateSnapshotRows,
  relistedAccountRows,
  uniqueAccountRows: identifiedAccountRows,
  anonymousEligibleRows,
  anonymousCalibration: {
    rowCount: anonymousEligibleRows,
    effectiveWeight: Number(
      eligible
        .filter((sample) => !sample.accountKey)
        .reduce((sum, sample) => sum + sample.weight, 0)
        .toFixed(3),
    ),
    effectiveShare: Number(
      (
        eligible.length
          ? eligible
              .filter((sample) => !sample.accountKey)
              .reduce((sum, sample) => sum + sample.weight, 0) /
            eligible.reduce((sum, sample) => sum + sample.weight, 0)
          : 0
      ).toFixed(3),
    ),
    maximumShareWhenIdentified: 0.1,
    capped: anonymousCap.capped,
  },
  split: {
    splitSeed,
    strategy: splitCommitment ? "secret-hmac-v1" : "public-seed-legacy",
    datasetDigest,
    splitCommitment,
    trainingMode: includeHoldout ? "all-eligible" : "calibration-only",
    trainingRows: eligible.length,
    calibrationRows: calibrationEligible.length,
    holdoutRows: holdout.length,
    anonymousCalibrationRows: eligible.filter((sample) => !sample.accountKey).length,
    trainingEffectiveWeight: Number(eligible.reduce((sum, sample) => sum + sample.weight, 0).toFixed(3)),
    calibrationEffectiveWeight: Number(calibrationEligible.reduce((sum, sample) => sum + sample.weight, 0).toFixed(3)),
    holdoutEffectiveWeight: Number(holdout.reduce((sum, sample) => sum + sample.weight, 0).toFixed(3)),
  },
  groupConcentration: {
    groupCount: groupCap.groupCount,
    largestEffectiveShare: groupCap.largestEffectiveShare,
    cap: 0.6,
    capped: groupCap.capped,
    sampleScope: identifiedTraining.length ? "identified-accounts" : "legacy-anonymous",
  },
  predictorCoverage: {
    schema: "valuation_model",
    scope: "identified accounts with structured start-season evidence",
    requiredFields: predictorFields,
    eligibleRows: predictorCandidates.length,
    completeRows: completePredictorRows,
    missingRows: predictorCandidates.length - completePredictorRows,
    coverage: Number(
      (completePredictorRows / Math.max(1, predictorCandidates.length)).toFixed(4),
    ),
    missingByField,
    bySource: predictorSourceCoverage,
  },
  sourceRowsBySource,
  sourceBreakdown,
  seasons,
  segments,
  modifiers,
}, null, 2));
