import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  accountKeyFor,
  accountStyles,
  applyGroupCap,
  breakClasses,
  breakClassFor,
  canonicalJson,
  evidenceWeights,
  groupKeyFor,
  hasCompleteModelEvidence,
  hasReplayableSeasonProgress,
  holdoutSplitCommitmentFor,
  inHoldout,
  isExcludedFromModel,
  packageTiers,
  packageTierFor,
  postKeyFor,
  preferredSample,
  priceFor,
  qualityWeights,
  sampleWeightFor,
  seasonProgressParts,
  valuationModelFeaturesFor,
  valuationDatasetDigestFor,
} from "./lib/valuation-source-core.mjs";
import { calculateValuationModel } from "../app/valuation-model-core.js";
import {
  adjustConfidenceForEvidence,
  confidenceForEffectiveWeight,
  deriveSeasonBands,
  replaySeasonProgressEndSlug,
  seasonBandSeeds,
  seasonGraduationGiftCounts,
} from "../app/valuation-season-band-core.js";

const minimumEligibleAccounts = 200;
export const officialValuationSplitSeed = "sky-valuation-v3";
const minimumHoldoutShare = 0.15;
const maximumHoldoutShare = 0.25;
const minimumEligiblePerDimension = 5;
const minimumHoldoutPerDimension = 2;
const maximumDimensionMedianLogError = Math.log(2);
const orderedSeasonSlugs = seasonBandSeeds.map((seed) => seed.slug);
const replaySeasonProgressOptions = {
  orderedSeasonSlugs,
  requiredEndSlug: replaySeasonProgressEndSlug,
  graduationGiftCounts: seasonGraduationGiftCounts,
};
export const officialValuationBaselineDigest =
  "0cac6ae051ea3a2c80adb89a8a3442398d7520da9ac1a4f09a8aa72fd0d2988c";
const execFileAsync = promisify(execFile);
const auditScriptPath = fileURLToPath(
  new URL("./audit-valuation-source.mjs", import.meta.url),
);
const candidateModelArtifact = (candidate) => ({
  schemaVersion: candidate?.schemaVersion ?? null,
  asOf: candidate?.asOf ?? null,
  provenance: candidate?.provenance ?? null,
  split: candidate?.split ?? null,
  segments: candidate?.segments ?? null,
  modifiers: candidate?.modifiers ?? null,
});
export const valuationModelArtifactDigest = (aggregate) =>
  createHash("sha256")
    .update(canonicalJson(candidateModelArtifact(aggregate)))
    .digest("hex");
export const candidateMatchesRebuild = (candidate, rebuiltCandidate) =>
  Boolean(rebuiltCandidate) &&
  canonicalJson(candidateModelArtifact(candidate)) ===
    canonicalJson(candidateModelArtifact(rebuiltCandidate));

const weightedMedian = (rows, valueKey) => {
  const ordered = [...rows].sort((left, right) => left[valueKey] - right[valueKey]);
  const total = ordered.reduce((sum, row) => sum + row.weight, 0);
  if (!total) return null;
  let cumulative = 0;
  for (const row of ordered) {
    cumulative += row.weight;
    if (cumulative >= total / 2) return row[valueKey];
  }
  return ordered.at(-1)?.[valueKey] ?? null;
};
const startSeasonFor = (row) => {
  const explicit = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (explicit) return orderedSeasonSlugs.includes(explicit) ? explicit : null;
  if (!row.season_progress || typeof row.season_progress !== "object") return null;
  for (const slug of orderedSeasonSlugs) {
    const value = row.season_progress[slug];
    if (value === undefined || value === null || value === false || value === 0) continue;
    if (/^(?:0|0\s*\/\s*\d+|⁰|none|no|false|-)?$/i.test(String(value).trim())) continue;
    return slug;
  }
  return null;
};
const multiplierFor = (aggregate, key, value) => Number(aggregate.modifiers?.[key]?.[value]?.multiplier) || 1;
const strictMultiplierFor = (aggregate, key, value, allowedValues) => {
  if (!allowedValues.includes(value)) return null;
  const multiplier = Number(aggregate.modifiers?.[key]?.[value]?.multiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : null;
};
const supportedSeasonSlugsFor = (aggregate) =>
  Object.entries(aggregate?.segments?.startSeason ?? {}).flatMap(([slug, segment]) =>
    Number(segment?.median) > 0 ? [slug] : [],
  );
const dimensionCoverageFor = (eligible, holdout, values, selector) => {
  const counts = Object.fromEntries(values.map((value) => [value, {
    eligible: eligible.filter((sample) => selector(sample) === value).length,
    holdout: holdout.filter((sample) => selector(sample) === value).length,
  }]));
  return {
    minimumEligible: minimumEligiblePerDimension,
    minimumHoldout: minimumHoldoutPerDimension,
    counts,
    missingEligible: values.filter(
      (value) => counts[value].eligible < minimumEligiblePerDimension,
    ),
    missingHoldout: values.filter(
      (value) => counts[value].holdout < minimumHoldoutPerDimension,
    ),
  };
};
const missingModifierValues = (candidate, key, values) =>
  values.filter((value) => {
    const multiplier = candidate.modifiers?.[key]?.[value]?.multiplier;
    return typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier <= 0;
  });
const hasFullModelPredictor = (aggregate) =>
  aggregate?.provenance?.predictorSchema === "valuation_model" &&
  Number(aggregate?.provenance?.modelSchemaVersion) >= 2;
const hasReplayableCandidatePredictor = (aggregate) =>
  aggregate?.provenance?.predictorSchema === "valuation_model" &&
  Number(aggregate?.provenance?.modelSchemaVersion) >= 3 &&
  aggregate?.provenance?.seasonProgressEndSlug === replaySeasonProgressEndSlug;
const supportedSeedsFor = (aggregate) => {
  const startSeason = aggregate?.segments?.startSeason ?? {};
  return seasonBandSeeds.filter((seed) => Object.hasOwn(startSeason, seed.slug));
};

/**
 * Candidate aggregates store anonymous observations. Convert their declared
 * seasons into the exact blended ranges used by the browser before replaying
 * a persisted predictor. Missing declared seasons intentionally stay missing
 * so the validator can reject a candidate that drops coverage.
 */
export const withDerivedSeasonBands = (aggregate) => {
  const startSeason = aggregate?.segments?.startSeason;
  if (!startSeason) return aggregate;
  const bands = deriveSeasonBands(aggregate, supportedSeedsFor(aggregate));
  if (!bands.length) return aggregate;
  return {
    ...aggregate,
    segments: {
      ...aggregate.segments,
      startSeason: {
        ...startSeason,
        ...Object.fromEntries(
          bands.map((band) => [
            band.slug,
            {
              ...startSeason[band.slug],
              p25: band.low,
              median: band.median,
              p75: band.high,
              contributionLow: band.contributionLow,
              contributionHigh: band.contributionHigh,
              effectiveWeight: band.effectiveWeight,
            },
          ]),
        ),
      },
    },
  };
};

const partialDiscountFor = (aggregate, row) => {
  if (!hasReplayableSeasonProgress(row, replaySeasonProgressOptions)) return null;
  let low = 0;
  let high = 0;
  for (const [slug, value] of Object.entries(row.season_progress)) {
    const progress = seasonProgressParts(value);
    if (
      !progress ||
      progress.expected <= 0 ||
      progress.selected < 0 ||
      progress.selected > progress.expected
    )
      return null;
    if (!progress.selected || progress.selected === progress.expected) continue;
    const band = aggregate.segments?.startSeason?.[slug];
    if (!Number.isFinite(band?.contributionLow) || !Number.isFinite(band?.contributionHigh))
      return null;
    const missingRatio = 1 - progress.selected / progress.expected;
    low += band.contributionLow * missingRatio;
    high += band.contributionHigh * missingRatio;
  }
  return { low, high };
};

export const predictValuationAggregate = (
  aggregate,
  sample,
  { assumeValidated = aggregate?.validationStatus === "validated" } = {},
) => {
  if (hasFullModelPredictor(aggregate)) {
    if (!sample.modelFeatures) return null;
    if (
      Number(aggregate?.provenance?.modelSchemaVersion) >= 3 &&
      !hasReplayableCandidatePredictor(aggregate)
    )
      return null;
    const segment = aggregate.segments?.startSeason?.[sample.startSeason];
    if (!segment?.median) return null;
    const replayCandidate = hasReplayableCandidatePredictor(aggregate);
    if (
      replayCandidate &&
      String(sample.row?.start_season_slug ?? "").trim().toLowerCase() !==
        sample.startSeason
    )
      return null;
    const breakMultiplier = replayCandidate
      ? strictMultiplierFor(aggregate, "breakClass", sample.breakClass, breakClasses)
      : multiplierFor(aggregate, "breakClass", sample.breakClass);
    const packageMultiplier = replayCandidate
      ? strictMultiplierFor(aggregate, "packageTier", sample.packageTier, packageTiers)
      : multiplierFor(aggregate, "packageTier", sample.packageTier);
    const accountStyleMultiplier = replayCandidate
      ? strictMultiplierFor(aggregate, "accountStyle", sample.accountStyle, accountStyles)
      : multiplierFor(aggregate, "accountStyle", sample.accountStyle);
    if (
      breakMultiplier === null ||
      packageMultiplier === null ||
      accountStyleMultiplier === null
    )
      return null;
    const partialDiscount = replayCandidate
      ? partialDiscountFor(aggregate, sample.row)
      : {
          low: sample.modelFeatures.partialDiscountLow,
          high: sample.modelFeatures.partialDiscountHigh,
        };
    if (!partialDiscount) return null;
    const confidence = replayCandidate
      ? adjustConfidenceForEvidence({
          aggregate,
          confidence: confidenceForEffectiveWeight(segment.effectiveWeight),
          evidence: segment,
          validated: assumeValidated,
        })
      : sample.modelFeatures.confidence;
    const summary = calculateValuationModel({
      ...sample.modelFeatures,
      // Schema v2 stores the catalog-derived additive terms, but the market
      // base and calibrated multipliers must come from the candidate being
      // evaluated. This prevents a candidate from passing on predictions
      // produced by a different aggregate embedded in source rows.
      baseLow: segment.p25 ?? segment.median,
      baseHigh: segment.p75 ?? segment.median,
      breakMultiplier,
      partialDiscountLow: partialDiscount.low,
      partialDiscountHigh: partialDiscount.high,
      packageLow:
        (sample.modelFeatures.packageLow /
          sample.modelFeatures.packageMarketMultiplier) *
        packageMultiplier,
      packageHigh:
        (sample.modelFeatures.packageHigh /
          sample.modelFeatures.packageMarketMultiplier) *
        packageMultiplier,
      accountStyleMultiplier,
      confidence,
    });
    return { price: summary.midpoint, low: summary.low, high: summary.high };
  }
  const segment = aggregate.segments?.startSeason?.[sample.startSeason];
  if (!segment?.median) return null;
  const modifier = multiplierFor(aggregate, "breakClass", sample.breakClass) * multiplierFor(aggregate, "packageTier", sample.packageTier) * multiplierFor(aggregate, "accountStyle", sample.accountStyle);
  return { price: segment.median * modifier, low: (segment.p25 ?? segment.median) * modifier, high: (segment.p75 ?? segment.median) * modifier };
};

export const validateValuationModel = ({
  candidate,
  baseline,
  rows,
  splitSeed = officialValuationSplitSeed,
  rebuiltCandidate = null,
  hashSalt = process.env.VALUATION_HASH_SALT ?? "",
  splitSecret = process.env.VALUATION_HOLDOUT_SECRET ?? "",
  expectedBaselineDigest = officialValuationBaselineDigest,
}) => {
  const asOf = new Date(`${candidate.asOf ?? baseline.asOf ?? "1970-01-01"}T23:59:59.999Z`);
  if (!Number.isFinite(asOf.getTime())) throw new Error("candidate or baseline requires a valid asOf date");
  const datasetDigest = valuationDatasetDigestFor(rows);
  const splitCommitment = holdoutSplitCommitmentFor(splitSeed, splitSecret);
  const claimedModelEvidenceRows = rows.filter((row) =>
    row?.account_identity_scheme === "stable-hmac-v1" ||
    row?.evidence_signature !== undefined ||
    row?.model_evidence !== undefined,
  );
  const invalidModelEvidenceRows = claimedModelEvidenceRows.filter(
    (row) => !hasCompleteModelEvidence(row, { hashSalt }),
  );
  const authenticatedRows = rows.filter((row) =>
    hasCompleteModelEvidence(row, { hashSalt }),
  );
  const authenticatedPostKeys = new Set(authenticatedRows.map(postKeyFor).filter(Boolean));
  const authenticatedAccountKeys = new Set(authenticatedRows.map(accountKeyFor).filter(Boolean));
  const authenticatedSnapshotHashes = new Set(
    authenticatedRows
      .map((row) => String(row.snapshot_hash ?? "").trim().toLowerCase())
      .filter((value) => /^[a-f0-9]{64}$/u.test(value)),
  );
  const unsignedIdentityCollisions = rows.filter((row) => {
    if (hasCompleteModelEvidence(row, { hashSalt })) return false;
    const snapshotHash = String(row.snapshot_hash ?? "").trim().toLowerCase();
    return (
      authenticatedPostKeys.has(postKeyFor(row)) ||
      authenticatedAccountKeys.has(accountKeyFor(row)) ||
      (/^[a-f0-9]{64}$/u.test(snapshotHash) &&
        authenticatedSnapshotHashes.has(snapshotHash))
    );
  });
  const sourceCandidates = rows.flatMap((row) => {
    if (isExcludedFromModel(row)) return [];
    if (!Object.hasOwn(evidenceWeights, row.evidence_kind) || !Object.hasOwn(qualityWeights, row.evidence_quality ?? "medium")) return [];
    const eligibilityText = `${row.region ?? ""} ${row.currency ?? ""} ${row.listing_text ?? ""} ${row.account_features ?? ""}`;
    if (/國服|中國服|陸服|\b(?:cn|china)\b/i.test(eligibilityText)) return [];
    if (/人民幣|rmb|cny|￥|¥|\busd\b|美金|港幣|hkd/i.test(eligibilityText)) return [];
    const price = priceFor(row, {
      coercePoint: false,
      coerceRange: true,
    });
    const weight = sampleWeightFor(row, asOf);
    const accountGroup = accountKeyFor(row);
    if (!price || !weight || !accountGroup) return [];
    return [{ row, price, weight, accountGroup, postGroup: postKeyFor(row), marketGroup: groupKeyFor(row), evidenceKind: row.evidence_kind, publishedAt: new Date(row.published_at ?? row.observed_at ?? 0).getTime() || 0, modelFeatures: hasCompleteModelEvidence(row, { hashSalt }) ? valuationModelFeaturesFor(row) : null }];
  });
  const sourceWithoutPostIdentity = [];
  const sourceByPost = new Map();
  sourceCandidates.forEach((sample) => {
    if (!sample.postGroup) {
      sourceWithoutPostIdentity.push(sample);
      return;
    }
    const previous = sourceByPost.get(sample.postGroup);
    sourceByPost.set(
      sample.postGroup,
      previous ? preferredSample(previous, sample) : sample,
    );
  });
  const sourceByAccount = new Map();
  [...sourceWithoutPostIdentity, ...sourceByPost.values()].forEach((sample) => {
    const previous = sourceByAccount.get(sample.accountGroup);
    sourceByAccount.set(
      sample.accountGroup,
      previous ? preferredSample(previous, sample) : sample,
    );
  });
  const sourceBySnapshot = new Map();
  const sourceWithoutSnapshot = [];
  for (const sample of sourceByAccount.values()) {
    const snapshotHash = String(sample.row.snapshot_hash ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/u.test(snapshotHash)) {
      sourceWithoutSnapshot.push(sample);
      continue;
    }
    const previous = sourceBySnapshot.get(snapshotHash);
    sourceBySnapshot.set(
      snapshotHash,
      previous ? preferredSample(previous, sample) : sample,
    );
  }
  const sourceEligible = [...sourceWithoutSnapshot, ...sourceBySnapshot.values()];
  const comparableCandidates = sourceEligible.flatMap((sample) => {
    const startSeason = startSeasonFor(sample.row);
    if (!startSeason) return [];
    return [{ ...sample, startSeason, breakClass: breakClassFor(sample.row), packageTier: packageTierFor(sample.row), accountStyle: accountStyles.includes(sample.row.account_style) ? sample.row.account_style : null }];
  });
  const comparableGroupCap = applyGroupCap(comparableCandidates, "marketGroup");
  const eligible = comparableGroupCap.samples;
  const holdout = eligible.filter((sample) => inHoldout(
    sample.accountGroup,
    splitSeed,
    { splitSecret },
  ));
  const holdoutGroupCap = applyGroupCap(holdout, "marketGroup");
  const minimumHoldoutAccounts = Math.ceil(eligible.length * minimumHoldoutShare);
  const maximumHoldoutAccounts = Math.floor(eligible.length * maximumHoldoutShare);
  const errorDetails = (aggregate, options) =>
    holdout.flatMap((sample) => {
      if (!hasFullModelPredictor(aggregate) && !aggregate.segments?.startSeason?.[sample.startSeason]?.median)
        return [{ sample, absoluteLogError: Math.log(10), ape: 9, covered: false, missingPrediction: true, weight: sample.weight }];
      const prediction = predictValuationAggregate(aggregate, sample, options);
      if (!prediction)
        return [{ sample, absoluteLogError: Math.log(10), ape: 9, covered: false, missingPrediction: true, weight: sample.weight }];
      return [{ sample, absoluteLogError: Math.abs(Math.log(prediction.price / sample.price)), ape: Math.abs(prediction.price - sample.price) / sample.price, covered: sample.price >= prediction.low && sample.price <= prediction.high, missingPrediction: false, weight: sample.weight }];
    });
  const summarizeErrors = (valid) => {
    const totalWeight = valid.reduce((sum, row) => sum + row.weight, 0);
    const coveredWeight = valid
      .filter((row) => row.covered)
      .reduce((sum, row) => sum + row.weight, 0);
    const missingPredictionCount = valid.filter((row) => row.missingPrediction).length;
    const missingPredictionWeight = valid
      .filter((row) => row.missingPrediction)
      .reduce((sum, row) => sum + row.weight, 0);
    const orderedErrors = valid
      .map(({ absoluteLogError }) => absoluteLogError)
      .sort((left, right) => left - right);
    const upperMedianAbsoluteLogError = orderedErrors.length
      ? orderedErrors[Math.floor(orderedErrors.length / 2)]
      : null;
    const maximumAbsoluteLogError = orderedErrors.at(-1) ?? null;
    return { count: valid.length, effectiveWeight: totalWeight, missingPredictionCount, predictionCoverage: totalWeight ? 1 - missingPredictionWeight / totalWeight : null, medianAbsoluteLogError: weightedMedian(valid, "absoluteLogError"), upperMedianAbsoluteLogError, maximumAbsoluteLogError, mdape: weightedMedian(valid, "ape"), p25P75Coverage: totalWeight ? coveredWeight / totalWeight : null };
  };
  const replayCandidate = withDerivedSeasonBands(candidate);
  const replayBaseline = withDerivedSeasonBands(baseline);
  const replayablePredictorRows = eligible.filter((sample) =>
    predictValuationAggregate(replayCandidate, sample, { assumeValidated: true }),
  );
  const completeEvidenceRows = eligible.filter((sample) =>
    hasCompleteModelEvidence(sample.row, { hashSalt }),
  );
  const identityNamespaces = new Set(
    completeEvidenceRows.map((sample) => sample.row.identity_namespace),
  );
  const candidateErrorDetails = errorDetails(replayCandidate, { assumeValidated: true });
  const baselineErrorDetails = errorDetails(replayBaseline);
  const candidateMetrics = summarizeErrors(candidateErrorDetails);
  const baselineMetrics = summarizeErrors(baselineErrorDetails);
  const replayEndIndex = orderedSeasonSlugs.indexOf(replaySeasonProgressEndSlug);
  const validationSeasonSlugs = replayEndIndex >= 0
    ? orderedSeasonSlugs.slice(0, replayEndIndex + 1)
    : [];
  const requiredSeasonSlugs = validationSeasonSlugs;
  const candidateSeasonSlugs = new Set(supportedSeasonSlugsFor(candidate));
  const missingCandidateSeasons = requiredSeasonSlugs.filter(
    (slug) => !candidateSeasonSlugs.has(slug),
  );
  const candidateError = candidateMetrics.medianAbsoluteLogError;
  const baselineError = baselineMetrics.medianAbsoluteLogError;
  const seasonDimensionCoverage = dimensionCoverageFor(
    eligible,
    holdout,
    validationSeasonSlugs,
    (sample) => sample.startSeason,
  );
  const modifierDimensionCoverage = {
    breakClass: dimensionCoverageFor(
      eligible,
      holdout,
      breakClasses,
      (sample) => sample.breakClass,
    ),
    packageTier: dimensionCoverageFor(
      eligible,
      holdout,
      packageTiers,
      (sample) => sample.packageTier,
    ),
    accountStyle: dimensionCoverageFor(
      eligible,
      holdout,
      accountStyles,
      (sample) => sample.accountStyle,
    ),
  };
  const missingCandidateModifiers = {
    breakClass: missingModifierValues(candidate, "breakClass", breakClasses),
    packageTier: missingModifierValues(candidate, "packageTier", packageTiers),
    accountStyle: missingModifierValues(candidate, "accountStyle", accountStyles),
  };
  const dimensionAccuracyFor = (values, selector) => {
    const metrics = Object.fromEntries(values.map((value) => {
      const candidateValueMetrics = summarizeErrors(
        candidateErrorDetails.filter(({ sample }) => selector(sample) === value),
      );
      const baselineValueMetrics = summarizeErrors(
        baselineErrorDetails.filter(({ sample }) => selector(sample) === value),
      );
      const candidateValueError = candidateValueMetrics.upperMedianAbsoluteLogError;
      const baselineValueError = baselineValueMetrics.upperMedianAbsoluteLogError;
      return [value, {
        candidate: candidateValueMetrics,
        baseline: baselineValueMetrics,
        pass:
          candidateValueMetrics.count >= minimumHoldoutPerDimension &&
          candidateValueMetrics.predictionCoverage === 1 &&
          candidateValueMetrics.p25P75Coverage !== null &&
          candidateValueMetrics.p25P75Coverage >= 0.5 &&
          candidateValueError !== null &&
          candidateValueError <= maximumDimensionMedianLogError &&
          baselineValueError !== null &&
          candidateValueError <= baselineValueError * 1.15 + 0.05,
      }];
    }));
    return {
      maximumMedianLogError: Number(maximumDimensionMedianLogError.toFixed(4)),
      metrics,
      failing: values.filter((value) => !metrics[value].pass),
    };
  };
  const seasonDimensionAccuracy = dimensionAccuracyFor(
    validationSeasonSlugs,
    (sample) => sample.startSeason,
  );
  const modifierDimensionAccuracy = {
    breakClass: dimensionAccuracyFor(breakClasses, (sample) => sample.breakClass),
    packageTier: dimensionAccuracyFor(packageTiers, (sample) => sample.packageTier),
    accountStyle: dimensionAccuracyFor(accountStyles, (sample) => sample.accountStyle),
  };
  const accuracyStatus = candidateError === null || baselineError === null ? "fail" : candidateError <= baselineError * 0.9 ? "pass" : candidateError <= baselineError * 1.03 ? "needsBiasJustification" : "fail";
  const criteria = {
    baselineProvenance: {
      actualDigest: valuationModelArtifactDigest(baseline),
      expectedDigest: expectedBaselineDigest,
      pass: valuationModelArtifactDigest(baseline) === expectedBaselineDigest,
    },
    authenticatedModelEvidence: {
      claimed: claimedModelEvidenceRows.length,
      invalid: invalidModelEvidenceRows.length,
      pass:
        claimedModelEvidenceRows.length > 0 &&
        invalidModelEvidenceRows.length === 0,
    },
    unsignedIdentityCollisions: {
      actual: unsignedIdentityCollisions.length,
      maximum: 0,
      pass: unsignedIdentityCollisions.length === 0,
    },
    candidateRebuild: {
      pass: candidateMatchesRebuild(candidate, rebuiltCandidate),
    },
    candidateProvenance: {
      schemaVersion: candidate.schemaVersion ?? null,
      trainingMode: candidate.split?.trainingMode ?? null,
      candidateSplitSeed: candidate.split?.splitSeed ?? null,
      expectedSplitSeed: splitSeed,
      requiredSplitSeed: officialValuationSplitSeed,
      strategy: candidate.split?.strategy ?? null,
      datasetDigest: candidate.split?.datasetDigest ?? null,
      expectedDatasetDigest: datasetDigest,
      splitCommitment: candidate.split?.splitCommitment ?? null,
      expectedSplitCommitment: splitCommitment,
      pass:
        candidate.split?.trainingMode === "calibration-only" &&
        splitSeed === officialValuationSplitSeed &&
        candidate.split?.splitSeed === splitSeed &&
        candidate.split?.strategy === "secret-hmac-v1" &&
        splitSecret.length >= 32 &&
        splitSecret !== hashSalt &&
        candidate.split?.datasetDigest === datasetDigest &&
        candidate.split?.splitCommitment === splitCommitment &&
        candidate.schemaVersion >= 4 &&
        hasReplayableCandidatePredictor(candidate),
    },
    minimumEligibleRows: { actual: eligible.length, minimum: minimumEligibleAccounts, pass: eligible.length >= minimumEligibleAccounts },
    marketGroups: { actual: comparableGroupCap.groupCount, minimum: 3, pass: comparableGroupCap.groupCount >= 3 },
    maximumGroupEffectiveShare: { raw: Number(comparableGroupCap.rawLargestShare.toFixed(4)), actual: Number(comparableGroupCap.cappedLargestShare.toFixed(4)), maximum: 0.6, pass: comparableGroupCap.rawLargestShare <= 0.6 },
    holdoutMarketGroups: {
      actual: holdoutGroupCap.groupCount,
      minimum: 3,
      pass: holdoutGroupCap.groupCount >= 3,
    },
    holdoutMaximumGroupEffectiveShare: {
      raw: Number(holdoutGroupCap.rawLargestShare.toFixed(4)),
      maximum: 0.6,
      pass: holdoutGroupCap.rawLargestShare <= 0.6,
    },
    holdout: {
      actual: holdout.length,
      minimum: minimumHoldoutAccounts,
      maximum: maximumHoldoutAccounts,
      share: eligible.length ? Number((holdout.length / eligible.length).toFixed(4)) : 0,
      pass:
        eligible.length >= minimumEligibleAccounts &&
        holdout.length >= minimumHoldoutAccounts &&
        holdout.length <= maximumHoldoutAccounts,
    },
    candidatePredictionCoverage: { actual: candidateMetrics.predictionCoverage, minimum: 1, pass: candidateMetrics.predictionCoverage === 1 },
    candidateSeasonCoverage: {
      required: requiredSeasonSlugs,
      missing: missingCandidateSeasons,
      pass: missingCandidateSeasons.length === 0,
    },
    candidateModifierCoverage: {
      missing: missingCandidateModifiers,
      pass: Object.values(missingCandidateModifiers).every(
        (values) => values.length === 0,
      ),
    },
    seasonHoldoutCoverage: {
      ...seasonDimensionCoverage,
      pass:
        validationSeasonSlugs.length > 0 &&
        seasonDimensionCoverage.missingEligible.length === 0 &&
        seasonDimensionCoverage.missingHoldout.length === 0,
    },
    modifierHoldoutCoverage: {
      dimensions: modifierDimensionCoverage,
      pass: Object.values(modifierDimensionCoverage).every(
        (coverage) =>
          coverage.missingEligible.length === 0 &&
          coverage.missingHoldout.length === 0,
      ),
    },
    seasonAccuracy: {
      ...seasonDimensionAccuracy,
      pass: seasonDimensionAccuracy.failing.length === 0,
    },
    modifierAccuracy: {
      dimensions: modifierDimensionAccuracy,
      pass: Object.values(modifierDimensionAccuracy).every(
        ({ failing }) => failing.length === 0,
      ),
    },
    completeModelPredictors: {
      actual: replayablePredictorRows.length,
      eligible: eligible.length,
      missing: eligible.length - replayablePredictorRows.length,
      minimum: 1,
      pass:
        eligible.length > 0 && replayablePredictorRows.length === eligible.length,
    },
    identityNamespaceConsistency: {
      actual: identityNamespaces.size,
      maximum: 1,
      pass:
        eligible.length > 0 &&
        completeEvidenceRows.length === eligible.length &&
        identityNamespaces.size === 1,
    },
    coverage: { actual: candidateMetrics.p25P75Coverage, minimum: 0.5, maximum: 0.9, pass: candidateMetrics.p25P75Coverage !== null && candidateMetrics.p25P75Coverage >= 0.5 && candidateMetrics.p25P75Coverage <= 0.9 },
    accuracy: { status: accuracyStatus, candidateMedianAbsoluteLogError: candidateError, baselineMedianAbsoluteLogError: baselineError },
  };
  const hardPass = Object.entries(criteria).every(([key, criterion]) => key === "accuracy" ? criterion.status === "pass" : criterion.pass);
  const canJustifyBias = Object.entries(criteria).every(([key, criterion]) => key === "accuracy" ? criterion.status === "needsBiasJustification" : criterion.pass);
  const outcome = candidate.validationStatus === "legacy-unvalidated" || candidate.schemaVersion < 4
    ? "legacy-unvalidated"
    : hardPass
      ? "pass"
      : canJustifyBias
        ? "needsBiasJustification"
        : "fail";
  return { schemaVersion: 2, split: { seed: splitSeed, method: "sha256 account-group 20% holdout" }, sourceEligibleRows: sourceEligible.length, eligibleRows: eligible.length, holdoutRows: holdout.length, candidate: candidateMetrics, baseline: baselineMetrics, criteria, outcome };
};

const usage = "Usage: node scripts/validate-valuation-model.mjs --candidate <aggregate.json> --baseline <aggregate.json> --source <anonymous-source.jsonl> [--source <anonymous-source.jsonl> ...] [--split-seed=value]";
const readJsonLines = async (path) => (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const isFlagValue = (value) => value && !value.startsWith("--");
const readFlag = (args, name) => { const index = args.indexOf(name); return index !== -1 && isFlagValue(args[index + 1]) ? args[index + 1] : null; };
const readFlags = (args, name) => args.flatMap((value, index) => value === name && isFlagValue(args[index + 1]) ? [args[index + 1]] : []);

export const parseValidationArgs = (args) => {
  const seedArg = args.find((value) => value.startsWith("--split-seed="));
  return {
    candidatePath: readFlag(args, "--candidate"),
    baselinePath: readFlag(args, "--baseline"),
    sourcePaths: readFlags(args, "--source"),
    splitSeed: seedArg?.slice("--split-seed=".length),
  };
};

const isMain = process.argv[1] && new URL(`file:${process.argv[1]}`).href === import.meta.url;
if (isMain) {
  const { candidatePath, baselinePath, sourcePaths, splitSeed } = parseValidationArgs(process.argv.slice(2));
  if (!candidatePath || !baselinePath || sourcePaths.length === 0) throw new Error(usage);
  const rows = (await Promise.all(sourcePaths.map(readJsonLines))).flat();
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const auditArgs = [
    auditScriptPath,
    `--as-of=${candidate.asOf}`,
    `--split-seed=${officialValuationSplitSeed}`,
    ...sourcePaths,
  ];
  const { stdout: rebuiltOutput } = await execFileAsync(
    process.execPath,
    auditArgs,
    { maxBuffer: 4 * 1024 * 1024 },
  );
  const rebuiltCandidate = JSON.parse(rebuiltOutput);
  const report = validateValuationModel({
    candidate,
    rebuiltCandidate,
    baseline: JSON.parse(await readFile(baselinePath, "utf8")),
    rows,
    splitSeed,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.outcome === "pass" ? 0 : report.outcome === "needsBiasJustification" ? 2 : 1;
}
