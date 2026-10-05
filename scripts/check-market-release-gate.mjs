import { readFile } from "node:fs/promises";

const [oldReportPath, newReportPath] = process.argv.slice(2);
if (!oldReportPath || !newReportPath) throw new Error("Usage: node scripts/check-market-release-gate.mjs <old-report.json> <new-report.json>");
const oldReport = JSON.parse(await readFile(oldReportPath, "utf8"));
const newReport = JSON.parse(await readFile(newReportPath, "utf8"));
const model = "baseline_enriched_title_binding_blend";
const oldModel = oldReport.cohorts.ask_title_evidenced.models[model];
const newModel = newReport.cohorts.ask_title_evidenced.models[model];
const oldKeys = new Set(oldModel.folds.flatMap(fold => fold.pairs.map(pair => pair.accountKey)));
const newPairs = newModel.folds.flatMap(fold => fold.pairs);
const oldCohortPairs = newPairs.filter(pair => oldKeys.has(pair.accountKey));
const metric = pairs => {
  const errors = pairs.map(pair => Math.abs(pair.predicted - pair.actual) / pair.actual).sort((a, b) => a - b);
  const quantile = fraction => {
    const index = (errors.length - 1) * fraction, lower = Math.floor(index), upper = Math.ceil(index);
    return errors[lower] + (errors[upper] - errors[lower]) * (index - lower);
  };
  return { count: errors.length, hit20: errors.filter(error => error <= .2 + 1e-12).length / errors.length,
    medianApe: quantile(.5), p90Ape: quantile(.9) };
};
const previous = oldModel.summary.overall;
const combined = newModel.summary.overall;
const frozenOld = metric(oldCohortPairs);
const gates = {
  combinedMedianImprovesByOnePoint: combined.medianApe <= previous.medianApe - .01,
  combinedHit20NotLower: combined.hit20 >= previous.hit20,
  combinedP90NotWorse: combined.p90Ape <= previous.p90Ape,
  frozenOldMedianDegradationWithinThreePoints: frozenOld.medianApe <= previous.medianApe + .03,
  noPredictionFailures: combined.failed === 0,
};
const result = { model, previous, combined, frozenOld, gates, release: Object.values(gates).every(Boolean) ? "publish" : "retain_current" };
console.log(JSON.stringify(result, null, 2));
if (result.release !== "publish") process.exitCode = 2;
