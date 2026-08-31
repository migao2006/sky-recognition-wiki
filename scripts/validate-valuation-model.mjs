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
} from "./lib/valuation-source-core.mjs";

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
const predict = (aggregate, sample) => {
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
    return [{ row, price, weight, accountGroup, postGroup: postKeyFor(row, { trim: false }), marketGroup: marketGroupFor(row), evidenceKind: row.evidence_kind, publishedAt: new Date(row.published_at ?? row.observed_at ?? 0).getTime() || 0 }];
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
  const errorMetrics = (aggregate) => {
    const valid = holdout.flatMap((sample) => {
      if (!aggregate.segments?.startSeason?.[sample.startSeason]?.median)
        return [{ absoluteLogError: Math.log(10), ape: 9, covered: false, missingPrediction: true, weight: sample.weight }];
      const prediction = predict(aggregate, sample);
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
  const candidateMetrics = errorMetrics(candidate);
  const baselineMetrics = errorMetrics(baseline);
  const candidateError = candidateMetrics.medianAbsoluteLogError;
  const baselineError = baselineMetrics.medianAbsoluteLogError;
  const accuracyStatus = candidateError === null || baselineError === null ? "fail" : candidateError <= baselineError * 0.9 ? "pass" : candidateError <= baselineError * 1.03 ? "needsBiasJustification" : "fail";
  const criteria = {
    candidateProvenance: {
      trainingMode: candidate.split?.trainingMode ?? null,
      candidateSplitSeed: candidate.split?.splitSeed ?? null,
      expectedSplitSeed: splitSeed,
      pass:
        candidate.split?.trainingMode === "calibration-only" &&
        candidate.split?.splitSeed === splitSeed,
    },
    minimumEligibleRows: { actual: sourceEligible.length, minimum: minimumEligibleAccounts, pass: sourceEligible.length >= minimumEligibleAccounts },
    marketGroups: { actual: sourceGroupCap.groupCount, minimum: 3, pass: sourceGroupCap.groupCount >= 3 },
    maximumGroupEffectiveShare: { raw: Number(sourceGroupCap.rawLargestShare.toFixed(4)), actual: Number(sourceGroupCap.cappedLargestShare.toFixed(4)), maximum: 0.6, pass: sourceGroupCap.rawLargestShare <= 0.6 },
    holdout: { actual: holdout.length, minimum: 1, pass: holdout.length > 0 },
    candidatePredictionCoverage: { actual: candidateMetrics.predictionCoverage, minimum: 1, pass: candidateMetrics.predictionCoverage === 1 },
    coverage: { actual: candidateMetrics.p25P75Coverage, minimum: 0.5, maximum: 0.9, pass: candidateMetrics.p25P75Coverage !== null && candidateMetrics.p25P75Coverage >= 0.5 && candidateMetrics.p25P75Coverage <= 0.9 },
    accuracy: { status: accuracyStatus, candidateMedianAbsoluteLogError: candidateError, baselineMedianAbsoluteLogError: baselineError },
  };
  const hardPass = Object.entries(criteria).every(([key, criterion]) => key === "accuracy" ? criterion.status === "pass" : criterion.pass);
  const canJustifyBias = Object.entries(criteria).every(([key, criterion]) => key === "accuracy" ? criterion.status === "needsBiasJustification" : criterion.pass);
  return { schemaVersion: 1, split: { seed: splitSeed, method: "sha256 account-group 20% holdout" }, sourceEligibleRows: sourceEligible.length, eligibleRows: eligible.length, holdoutRows: holdout.length, candidate: candidateMetrics, baseline: baselineMetrics, criteria, outcome: hardPass ? "pass" : canJustifyBias ? "needsBiasJustification" : "fail" };
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
