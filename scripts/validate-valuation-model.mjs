import { readFile } from "node:fs/promises";
import {
  accountKeyFor,
  accountStyles,
  applyGroupCap,
  breakClasses,
  evidenceWeights,
  inHoldout,
  marketGroupFor,
  packageTiers,
  postKeyFor,
  preferredSample,
  priceFor,
  qualityWeights,
  sampleWeightFor,
  valuationModelFeaturesFor,
} from "./lib/valuation-source-core.mjs";
import { calculateValuationModel } from "../app/valuation-model-core.js";
import {
  deriveSeasonBands,
  seasonBandSeeds,
} from "../app/valuation-season-band-core.js";

const minimumEligibleAccounts = 200;

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
const startSeasonFor = (row, aggregate) => {
  const explicit = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (aggregate.segments?.startSeason?.[explicit]?.median) return explicit;
  if (!row.season_progress || typeof row.season_progress !== "object") return null;
  for (const slug of Object.keys(aggregate.segments?.startSeason ?? {})) {
    const value = row.season_progress[slug];
    if (value === undefined || value === null || value === false || value === 0) continue;
    if (/^(?:0|0\s*\/\s*\d+|⁰|none|no|false|-)?$/i.test(String(value).trim())) continue;
    if (aggregate.segments.startSeason[slug]?.median) return slug;
  }
  return null;
};
const breakClassFor = (row) => {
  if (breakClasses.includes(row.computed_break_class)) return row.computed_break_class;
  const missing = Number(row.missing_season_count);
  const completion = Number(row.completion_ratio);
  if (!Number.isFinite(missing) || !Number.isFinite(completion)) return null;
  if (missing === 0) return "none";
  if (missing <= 2 && completion >= 0.8) return "slight";
  if (missing <= 5 || completion >= 0.5) return "medium";
  return "big";
};
const packageTierFor = (row) => {
  if (packageTiers.includes(row.computed_package_tier)) return row.computed_package_tier;
  const count = Number(row.paid_package_count);
  if (!Number.isFinite(count) || count < 0) return null;
  if (count >= 100) return "hundred";
  if (count >= 40) return "many";
  if (count >= 15) return "medium";
  return "few";
};
const multiplierFor = (aggregate, key, value) => Number(aggregate.modifiers?.[key]?.[value]?.multiplier) || 1;
const supportedSeasonSlugsFor = (aggregate) =>
  Object.entries(aggregate?.segments?.startSeason ?? {}).flatMap(([slug, segment]) =>
    Number(segment?.median) > 0 ? [slug] : [],
  );
const hasFullModelPredictor = (aggregate) =>
  aggregate?.provenance?.predictorSchema === "valuation_model" &&
  Number(aggregate?.provenance?.modelSchemaVersion) >= 2;
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
            },
          ]),
        ),
      },
    },
  };
};

export const predictValuationAggregate = (aggregate, sample) => {
  if (hasFullModelPredictor(aggregate)) {
    if (!sample.modelFeatures) return null;
    const segment = aggregate.segments?.startSeason?.[sample.startSeason];
    if (!segment?.median) return null;
    const packageMultiplier = multiplierFor(
      aggregate,
      "packageTier",
      sample.packageTier,
    );
    const summary = calculateValuationModel({
      ...sample.modelFeatures,
      // Schema v2 stores the catalog-derived additive terms, but the market
      // base and calibrated multipliers must come from the candidate being
      // evaluated. This prevents a candidate from passing on predictions
      // produced by a different aggregate embedded in source rows.
      baseLow: segment.p25 ?? segment.median,
      baseHigh: segment.p75 ?? segment.median,
      breakMultiplier: multiplierFor(aggregate, "breakClass", sample.breakClass),
      packageLow:
        (sample.modelFeatures.packageLow /
          sample.modelFeatures.packageMarketMultiplier) *
        packageMultiplier,
      packageHigh:
        (sample.modelFeatures.packageHigh /
          sample.modelFeatures.packageMarketMultiplier) *
        packageMultiplier,
      accountStyleMultiplier: multiplierFor(aggregate, "accountStyle", sample.accountStyle),
    });
    return { price: summary.midpoint, low: summary.low, high: summary.high };
  }
  const segment = aggregate.segments.startSeason[sample.startSeason];
  const modifier = multiplierFor(aggregate, "breakClass", sample.breakClass) * multiplierFor(aggregate, "packageTier", sample.packageTier) * multiplierFor(aggregate, "accountStyle", sample.accountStyle);
  return { price: segment.median * modifier, low: (segment.p25 ?? segment.median) * modifier, high: (segment.p75 ?? segment.median) * modifier };
};

export const validateValuationModel = ({ candidate, baseline, rows, splitSeed = "sky-valuation-v3" }) => {
  const asOf = new Date(`${candidate.asOf ?? baseline.asOf ?? "1970-01-01"}T23:59:59.999Z`);
  if (!Number.isFinite(asOf.getTime())) throw new Error("candidate or baseline requires a valid asOf date");
  const sourceCandidates = rows.flatMap((row) => {
    if (String(row.exclusion_reason ?? "").trim()) return [];
    if (!Object.hasOwn(evidenceWeights, row.evidence_kind) || !Object.hasOwn(qualityWeights, row.evidence_quality ?? "medium")) return [];
    if (/^(?:cn|china|國服|中國服|陸服)$/i.test(String(row.region ?? "").trim())) return [];
    if (/^(?:cny|rmb|usd|hkd)$/i.test(String(row.currency ?? "").trim())) return [];
    const price = priceFor(row);
    const weight = sampleWeightFor(row, asOf);
    const accountGroup = accountKeyFor(row, { trim: false });
    if (!price || !weight || !accountGroup) return [];
    return [{ row, price, weight, accountGroup, postGroup: postKeyFor(row, { trim: false }), marketGroup: marketGroupFor(row), evidenceKind: row.evidence_kind, publishedAt: new Date(row.published_at ?? row.observed_at ?? 0).getTime() || 0, modelFeatures: valuationModelFeaturesFor(row) }];
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
      previous ? preferredSample(previous, sample, { accountTrim: false }) : sample,
    );
  });
  const sourceByAccount = new Map();
  [...sourceWithoutPostIdentity, ...sourceByPost.values()].forEach((sample) => {
    const previous = sourceByAccount.get(sample.accountGroup);
    sourceByAccount.set(
      sample.accountGroup,
      previous ? preferredSample(previous, sample, { accountTrim: false }) : sample,
    );
  });
  const sourceEligible = [...sourceByAccount.values()];
  const sourceGroupCap = applyGroupCap(sourceEligible, "marketGroup");
  const candidates = sourceGroupCap.samples.flatMap((sample) => {
    const startSeason = startSeasonFor(sample.row, baseline);
    if (!startSeason || !baseline.segments?.startSeason?.[startSeason]?.median) return [];
    return [{ ...sample, startSeason, breakClass: breakClassFor(sample.row), packageTier: packageTierFor(sample.row), accountStyle: accountStyles.includes(sample.row.account_style) ? sample.row.account_style : null }];
  });
  const eligible = candidates;
  const holdout = eligible.filter((sample) => inHoldout(sample.accountGroup, splitSeed));
  const fullPredictorRows = eligible.filter((sample) => sample.modelFeatures);
  const errorMetrics = (aggregate) => {
    const valid = holdout.flatMap((sample) => {
      if (!hasFullModelPredictor(aggregate) && !aggregate.segments?.startSeason?.[sample.startSeason]?.median)
        return [{ absoluteLogError: Math.log(10), ape: 9, covered: false, missingPrediction: true, weight: sample.weight }];
      const prediction = predictValuationAggregate(aggregate, sample);
      if (!prediction)
        return [{ absoluteLogError: Math.log(10), ape: 9, covered: false, missingPrediction: true, weight: sample.weight }];
      return [{ absoluteLogError: Math.abs(Math.log(prediction.price / sample.price)), ape: Math.abs(prediction.price - sample.price) / sample.price, covered: sample.price >= prediction.low && sample.price <= prediction.high, missingPrediction: false, weight: sample.weight }];
    });
    const totalWeight = valid.reduce((sum, row) => sum + row.weight, 0);
    const coveredWeight = valid
      .filter((row) => row.covered)
      .reduce((sum, row) => sum + row.weight, 0);
    const missingPredictionCount = valid.filter((row) => row.missingPrediction).length;
    const missingPredictionWeight = valid
      .filter((row) => row.missingPrediction)
      .reduce((sum, row) => sum + row.weight, 0);
    return { count: valid.length, effectiveWeight: totalWeight, missingPredictionCount, predictionCoverage: totalWeight ? 1 - missingPredictionWeight / totalWeight : null, medianAbsoluteLogError: weightedMedian(valid, "absoluteLogError"), mdape: weightedMedian(valid, "ape"), p25P75Coverage: totalWeight ? coveredWeight / totalWeight : null };
  };
  const candidateMetrics = errorMetrics(withDerivedSeasonBands(candidate));
  const baselineMetrics = errorMetrics(withDerivedSeasonBands(baseline));
  const requiredSeasonSlugs = supportedSeasonSlugsFor(baseline);
  const candidateSeasonSlugs = new Set(supportedSeasonSlugsFor(candidate));
  const missingCandidateSeasons = requiredSeasonSlugs.filter(
    (slug) => !candidateSeasonSlugs.has(slug),
  );
  const candidateError = candidateMetrics.medianAbsoluteLogError;
  const baselineError = baselineMetrics.medianAbsoluteLogError;
  const accuracyStatus = candidateError === null || baselineError === null ? "fail" : candidateError <= baselineError * 0.9 ? "pass" : candidateError <= baselineError * 1.03 ? "needsBiasJustification" : "fail";
  const criteria = {
    candidateProvenance: {
      schemaVersion: candidate.schemaVersion ?? null,
      trainingMode: candidate.split?.trainingMode ?? null,
      candidateSplitSeed: candidate.split?.splitSeed ?? null,
      expectedSplitSeed: splitSeed,
      pass:
        candidate.split?.trainingMode === "calibration-only" &&
        candidate.split?.splitSeed === splitSeed &&
        candidate.schemaVersion >= 4 &&
        hasFullModelPredictor(candidate),
    },
    minimumEligibleRows: { actual: sourceEligible.length, minimum: minimumEligibleAccounts, pass: sourceEligible.length >= minimumEligibleAccounts },
    marketGroups: { actual: sourceGroupCap.groupCount, minimum: 3, pass: sourceGroupCap.groupCount >= 3 },
    maximumGroupEffectiveShare: { raw: Number(sourceGroupCap.rawLargestShare.toFixed(4)), actual: Number(sourceGroupCap.cappedLargestShare.toFixed(4)), maximum: 0.6, pass: sourceGroupCap.rawLargestShare <= 0.6 },
    holdout: { actual: holdout.length, minimum: 1, pass: holdout.length > 0 },
    candidatePredictionCoverage: { actual: candidateMetrics.predictionCoverage, minimum: 1, pass: candidateMetrics.predictionCoverage === 1 },
    candidateSeasonCoverage: {
      required: requiredSeasonSlugs,
      missing: missingCandidateSeasons,
      pass: missingCandidateSeasons.length === 0,
    },
    completeModelPredictors: {
      actual: fullPredictorRows.length,
      eligible: eligible.length,
      missing: eligible.length - fullPredictorRows.length,
      minimum: 1,
      pass: eligible.length > 0 && fullPredictorRows.length === eligible.length,
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

const usage = "Usage: node scripts/validate-valuation-model.mjs --candidate <aggregate.json> --baseline <aggregate.json> --source <anonymous-source.jsonl> [--split-seed=value]";
const readJsonLines = async (path) => (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const readFlag = (args, name) => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; };
const isMain = process.argv[1] && new URL(`file:${process.argv[1]}`).href === import.meta.url;
if (isMain) {
  const args = process.argv.slice(2);
  const candidatePath = readFlag(args, "--candidate");
  const baselinePath = readFlag(args, "--baseline");
  const sourcePath = readFlag(args, "--source");
  const seedArg = args.find((value) => value.startsWith("--split-seed="));
  if (!candidatePath || !baselinePath || !sourcePath) throw new Error(usage);
  const report = validateValuationModel({ candidate: JSON.parse(await readFile(candidatePath, "utf8")), baseline: JSON.parse(await readFile(baselinePath, "utf8")), rows: await readJsonLines(sourcePath), splitSeed: seedArg?.slice("--split-seed=".length) });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.outcome === "pass" ? 0 : report.outcome === "needsBiasJustification" ? 2 : 1;
}
