// Whole-account asking prices only. No historical prices, item premiums or caps.
export const freshModelRevision = "whole-account-v3";
export const packageTiers = ["few", "medium", "many", "hundred"];
export const breakClasses = ["none", "slight", "medium", "large"];
export const packageTierForCount = count => Number.isSafeInteger(count) && count >= 0
  ? count >= 100 ? "hundred" : count >= 90 ? "many" : count >= 60 ? "medium" : "few"
  : null;
const finite = value => typeof value === "number" && Number.isFinite(value);
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const quantile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction, lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
};
const categories = row => [
  packageTiers.indexOf(row.packageTier ?? packageTierForCount(row.packageCount)),
  breakClasses.indexOf(row.breakClass === "big" ? "large" : row.breakClass),
];
// Unknown categories use the observed feature mean, not zero packages/no breaks.
const features = (row, centers) => categories(row).flatMap((level, group) =>
  [1, 2, 3].map((threshold, i) => level < 0 ? 0 : Number(level >= threshold) - centers[group * 3 + i]));
const roundPrice = value => {
  const unit = value >= 1000 ? 100 : value >= 100 ? 10 : 1;
  return Math.max(1, Math.round(value / unit) * unit);
};
const trend = points => {
  const count = points.reduce((sum, p) => sum + p.n, 0);
  const x = points.reduce((sum, p) => sum + p.x * p.n, 0) / count;
  const y = points.reduce((sum, p) => sum + p.y * p.n, 0) / count;
  const denominator = points.reduce((sum, p) => sum + p.n * (p.x - x) ** 2, 0);
  const slope = denominator ? points.reduce((sum, p) => sum + p.n * (p.x - x) * (p.y - y), 0) / denominator : 0;
  return { intercept: y - slope * x, slope };
};

/** Joint log-price fit: season intercepts shrink towards the learned season
 * trend, ordered package increments are nonnegative and break effects are
 * nonpositive. Ridge=1 is regularization, never a monetary anchor. A source
 * account remains one observation regardless of how many seasons it owns.
 */
export function fitWholeAccountModel(rows, { seasons, ridge = 1 } = {}) {
  if (!Array.isArray(seasons) || !seasons.length || new Set(seasons).size !== seasons.length)
    throw new Error("Canonical seasons required");
  if (!finite(ridge) || ridge <= 0) throw new Error("Invalid ridge");
  if (!rows.length) throw new Error("No eligible whole-account observations");
  if (rows.some(row => !row.accountKey) || new Set(rows.map(row => row.accountKey)).size !== rows.length)
    throw new Error("Unique account identities required");
  if (rows.some(row => row.market !== "taiwan" || row.server !== "international" || row.currency !== "TWD" ||
      row.converted === true || row.excludeFromModel === true || row.accountOnly === false ||
      row.priceKind !== "ask" || !finite(row.price) || row.price <= 0 ||
      (row.season !== null && !seasons.includes(row.season))))
    throw new Error("Only unconverted Taiwan international-server whole-account asks may fit");
  const training = rows.filter(row => row.season !== null);
  if (!training.length) throw new Error("At least one identified season required");
  const groups = seasons.map(season => training.flatMap((row, i) => row.season === season ? [i] : []));
  const centers = [0, 1].flatMap(group => [1, 2, 3].map(threshold =>
    mean(training.map(categories).filter(levels => levels[group] >= 0).map(levels => Number(levels[group] >= threshold)))));
  const x = training.map(row => features(row, centers));
  const y = training.map(row => Math.log(row.price));
  const coefficients = Array(6).fill(0);
  const bases = groups.map(indices => mean(indices.map(i => y[i])));
  let line, converged = false, iterations = 0;
  for (; iterations < 5000; iterations++) {
    line = trend(groups.flatMap((indices, s) => indices.length ? [{ x: s, y: bases[s], n: indices.length }] : []));
    let change = 0;
    groups.forEach((indices, s) => {
      if (!indices.length) return;
      const next = (indices.reduce((sum, i) => sum + y[i] - dot(x[i], coefficients), 0) +
        ridge * (line.intercept + line.slope * s)) / (indices.length + ridge);
      change = Math.max(change, Math.abs(next - bases[s]));
      bases[s] = next;
    });
    for (let j = 0; j < coefficients.length; j++) {
      let numerator = 0, denominator = ridge;
      training.forEach((row, i) => {
        numerator += x[i][j] * (y[i] - bases[seasons.indexOf(row.season)] - dot(x[i], coefficients) + x[i][j] * coefficients[j]);
        denominator += x[i][j] ** 2;
      });
      const next = j < 3 ? Math.max(0, numerator / denominator) : Math.min(0, numerator / denominator);
      change = Math.max(change, Math.abs(next - coefficients[j]));
      coefficients[j] = next;
    }
    if (change < 1e-8) { converged = true; break; }
  }
  if (!converged) throw new Error("Whole-account fit did not converge");
  const residuals = training.map((row, i) => y[i] - bases[seasons.indexOf(row.season)] - dot(x[i], coefficients));
  const spread = Math.max(Math.abs(quantile(residuals, .1)), Math.abs(quantile(residuals, .9)));
  const globalSpread = Math.sqrt(mean(y.map(value => (value - mean(y)) ** 2)));
  const observed = groups.flatMap((indices, i) => indices.length ? [i] : []);
  const seasonModels = Object.fromEntries(seasons.map((slug, i) => {
    const before = observed.filter(s => s < i).at(-1), after = observed.find(s => s > i);
    let logBase = bases[i], method = "direct", distance = 0;
    if (!groups[i].length) {
      distance = Math.min(...observed.map(s => Math.abs(s - i)));
      if (before !== undefined && after !== undefined) {
        method = "interpolated";
        logBase = bases[before] + (bases[after] - bases[before]) * (i - before) / (after - before);
      } else {
        method = "extrapolated";
        const nearest = before ?? after;
        logBase = bases[nearest] + line.slope * (i - nearest);
      }
    }
    return [slug, { logBase, method, sampleCount: groups[i].length,
      logSpread: Math.max(spread, globalSpread / Math.sqrt(groups[i].length + 1)) *
        (1 + distance / Math.max(1, seasons.length - 1)) }];
  }));
  const unknown = rows.filter(row => row.season === null);
  const pooledRows = unknown.length ? unknown : rows;
  const adjusted = pooledRows.map(row => Math.log(row.price) - dot(features(row, centers), coefficients));
  const pooledBase = mean(adjusted);
  const pooled = { logBase: pooledBase, method: "pooled", sampleCount: pooledRows.length,
    logSpread: Math.max(spread, ...[.1, .9].map(q => Math.abs(quantile(adjusted, q) - pooledBase))) };
  return { revision: freshModelRevision, mode: "whole-account", validation: "unvalidated", converged,
    iterations, ridge, centers, coefficients, trend: line, seasons: seasonModels, pooled,
    sourceEvidenceCount: rows.length, knownSeasonCount: training.length,
    intervalKind: "exploratory_log_spread_not_prediction_interval" };
}

export function predictFreshModel(model, input) {
  const unavailable = reason => ({ status: "unavailable", midpoint: null, range: null, reason,
    method: null, sampleCount: 0, revision: model?.revision ?? freshModelRevision });
  if (model?.revision !== freshModelRevision || model.mode !== "whole-account" || !model.converged ||
      !Array.isArray(model.centers) || model.centers.length !== 6 || !model.centers.every(finite) ||
      !Array.isArray(model.coefficients) || model.coefficients.length !== 6 ||
      !model.coefficients.every((value, i) => finite(value) && (i < 3 ? value >= 0 : value <= 0)))
    return unavailable("model_not_ready");
  if (!input) return unavailable("invalid_input");
  const season = input.season == null ? model.pooled : model.seasons?.[input.season];
  if (!season || !finite(season.logBase) || !finite(season.logSpread) || season.logSpread < 0)
    return unavailable("invalid_model_season");
  const logPrice = season.logBase + dot(features(input, model.centers), model.coefficients);
  const values = [logPrice, logPrice - season.logSpread, logPrice + season.logSpread].map(Math.exp);
  if (values.some(value => !finite(value) || value <= 0)) return unavailable("invalid_prediction");
  const [midpoint, low, high] = values.map(roundPrice);
  return { status: "unvalidated", midpoint, range: { low: Math.min(low, midpoint), high: Math.max(high, midpoint) },
    revision: model.revision, method: season.method, sampleCount: season.sampleCount, reason: null,
    intervalKind: model.intervalKind };
}
