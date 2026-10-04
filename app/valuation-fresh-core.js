// Shared fresh numeric core. No imports of historical prices, caps or seeds.
// Caller supplies reviewed, deduplicated calibration rows in ONE market cohort.
export const freshModelRevision = "fresh-candidate-v1";

const finite = value => typeof value === "number" && Number.isFinite(value);
const quantile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
};
const validInput = row => Number.isSafeInteger(row.packageCount) && row.packageCount >= 0 &&
  finite(row.breakFraction) && row.breakFraction >= 0 && row.breakFraction <= 1 &&
  Number.isSafeInteger(row.bindingRiskCount) && row.bindingRiskCount >= 0 && row.bindingRiskCount <= 7;
const basis = (row, knots) => [
  ...knots.slice(0, -1).map((start, i) =>
    Math.max(0, Math.min(row.packageCount, knots[i + 1]) - start) / (knots[i + 1] - start)),
  row.breakFraction,
  row.bindingRiskCount / 7,
];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// Evidence-blended candidate model. This deliberately stays separate from
// fitFreshModel: headline/season-progress evidence often has no exact package
// count, so it may inform a season baseline but must not be coerced into a
// complete account row. Cross-season observations are supplied as explicit
// seasonEvidence entries with a caller-provided weight and normalized price.
export function fitEvidenceBlendedModel(rows, { seasons } = {}) {
  if (!Array.isArray(seasons) || !seasons.length) throw new Error("Canonical seasons required");
  const known = new Set(seasons);
  const evidence = [];
  for (const row of rows ?? []) {
    if (!Array.isArray(row.seasonEvidence) || !finite(row.price) || row.price <= 0) continue;
    for (const item of row.seasonEvidence) {
      if (!known.has(item.season) || !finite(item.weight) || item.weight <= 0 ||
          !finite(item.priceShare) || item.priceShare <= 0) continue;
      evidence.push({ season: item.season, price: item.priceShare, weight: item.weight,
        breakClass: item.breakClass ?? "unknown", packageCount: Number.isSafeInteger(row.packageCount) ? row.packageCount : null });
    }
  }
  const weightedMedian = values => {
    const sorted = [...values].sort((a, b) => a.value - b.value);
    const total = sorted.reduce((sum, item) => sum + item.weight, 0);
    if (!sorted.length || total <= 0) return null;
    let cursor = 0;
    for (const item of sorted) { cursor += item.weight; if (cursor >= total / 2) return item.value; }
    return sorted.at(-1).value;
  };
  const seasonRows = Object.fromEntries(seasons.map(season => {
    const group = evidence.filter(item => item.season === season);
    const median = weightedMedian(group.map(item => ({ value: item.price, weight: item.weight })));
    const values = group.map(item => item.price).sort((a, b) => a - b);
    const quantile = fraction => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] : null;
    return [season, { status: median === null ? "unavailable" : "blended", median,
      low: quantile(.25), high: quantile(.75), sampleCount: group.length,
      directCount: group.filter(item => item.weight >= 1).length,
      blendedCount: group.filter(item => item.weight < 1).length }];
  }));
  const packageRows = evidence.filter(item => Number.isSafeInteger(item.packageCount));
  const packageValues = packageRows.map(item => item.packageCount);
  const packageCenter = packageValues.length ? weightedMedian(packageValues.map(value => ({ value, weight: 1 }))) : 0;
  const packagePairs = packageRows.map(item => {
    const base = seasonRows[item.season]?.median;
    return base === null || base === undefined ? null : { x: item.packageCount - packageCenter,
      y: item.price - base, weight: item.weight };
  }).filter(Boolean);
  const denominator = packagePairs.reduce((sum, item) => sum + item.weight * item.x * item.x, 0);
  const slope = denominator > 0 ? Math.max(0, packagePairs.reduce((sum, item) => sum + item.weight * item.x * item.y, 0) / denominator) : 0;
  const breakMultipliers = Object.fromEntries(["none", "slight", "medium", "large", "unknown"].map(key => {
    const group = evidence.filter(item => item.breakClass === key);
    const baseline = evidence.filter(item => item.breakClass === "none");
    const groupMedian = weightedMedian(group.map(item => ({ value: item.price, weight: item.weight })));
    const baselineMedian = weightedMedian(baseline.map(item => ({ value: item.price, weight: item.weight })));
    const ratio = groupMedian && baselineMedian ? Math.max(.45, Math.min(1.1, groupMedian / baselineMedian)) : 1;
    return [key, ratio];
  }));
  return { revision: freshModelRevision, mode: "evidence-blended-v2", validation: "unvalidated",
    converged: evidence.length > 0, sourceEvidenceCount: evidence.length,
    packageCenter, packageSlope: slope, breakMultipliers, seasons: seasonRows,
    intervalKind: "weighted_empirical_quartiles_not_prediction_interval" };
}

/** Constrained ridge regression: season intercepts + shared continuous package
 * increments + nonpositive break/binding effects. Solver knobs are NOT prices.
 * Unknown predictors are not silently set to zero. Manual/header-only evidence
 * remains in the coverage report, not fabricated into complete training rows.
 */
export function fitFreshModel(rows, { seasons, ridge = 1, maxIterations = 10000, tolerance = 1e-8 } = {}) {
  if (!Array.isArray(seasons) || !seasons.length || new Set(seasons).size !== seasons.length ||
      seasons.some(slug => typeof slug !== "string" || !slug)) throw new Error("Canonical seasons required");
  if (!finite(ridge) || ridge <= 0 || !Number.isSafeInteger(maxIterations) || maxIterations < 1 ||
      !finite(tolerance) || tolerance <= 0) throw new Error("Invalid solver options");
  const known = new Set(seasons);
  if (rows.some(row => row.market !== "taiwan" || row.server !== "international" || row.currency !== "TWD" || row.converted === true))
    throw new Error("Only unconverted Taiwan international-server quotes may fit TWD prices");
  if (rows.some(row => typeof row.accountKey !== "string" || !row.accountKey) ||
      new Set(rows.map(row => row.accountKey)).size !== rows.length) throw new Error("Unique account identities required");
  const cohortKeys = new Set(rows.map(row => `${row.market}|${row.server}|${row.currency}|${row.priceKind}`));
  if (cohortKeys.size > 1) throw new Error("Do not mix markets, servers, currencies or price kinds");
  const training = rows.filter(row => known.has(row.season) && validInput(row) &&
    finite(row.price) && row.price > 0 && ["ask", "sold"].includes(row.priceKind));
  const groups = Object.fromEntries(seasons.map(slug => [slug, training.filter(row => row.season === slug)]));
  // At least five distinct accounts per fitted season. This is NOT the formal
  // publication gate or a substitute for private holdout validation.
  const fittedSeasons = seasons.filter(slug => groups[slug].length >= 5);
  const usable = training.filter(row => fittedSeasons.includes(row.season));
  const counts = usable.map(row => row.packageCount);
  const knots = [...new Set([quantile(counts, 0), quantile(counts, .25), quantile(counts, .5),
    quantile(counts, .75), quantile(counts, 1)].filter(value => value !== null))].sort((a, b) => a - b);
  const intercepts = Object.fromEntries(fittedSeasons.map(slug => [slug, quantile(groups[slug].map(row => row.price), .5)]));
  const coefficients = Array(Math.max(0, knots.length - 1) + 2).fill(0);
  const features = usable.map(row => basis(row, knots));
  let converged = usable.length === 0;
  let iterations = 0;
  for (; usable.length && iterations < maxIterations; iterations++) {
    let change = 0;
    for (const slug of fittedSeasons) {
      const indices = usable.flatMap((row, i) => row.season === slug ? [i] : []);
      const value = indices.reduce((sum, i) => sum + usable[i].price - dot(features[i], coefficients), 0) / indices.length;
      change = Math.max(change, Math.abs(value - intercepts[slug]));
      intercepts[slug] = value;
    }
    for (let j = 0; j < coefficients.length; j++) {
      let numerator = 0, denominator = ridge;
      for (let i = 0; i < usable.length; i++) {
        const x = features[i][j];
        numerator += x * (usable[i].price - intercepts[usable[i].season] - dot(features[i], coefficients) + x * coefficients[j]);
        denominator += x * x;
      }
      const value = j < coefficients.length - 2 ? Math.max(0, numerator / denominator) : Math.min(0, numerator / denominator);
      change = Math.max(change, Math.abs(value - coefficients[j]));
      coefficients[j] = value;
    }
    if (change <= tolerance) { converged = true; break; }
  }
  const residuals = usable.map((row, i) => row.price - intercepts[row.season] - dot(features[i], coefficients));
  return {
    revision: freshModelRevision, validation: "unvalidated", converged, iterations,
    cohort: rows.length ? { market: rows[0].market, server: rows[0].server, currency: rows[0].currency, priceKind: rows[0].priceKind } : null,
    ridge, knots, coefficients, intercepts,
    residualInterval: residuals.length ? [quantile(residuals, .1), quantile(residuals, .9)] : null,
    intervalKind: "in_sample_residual_not_prediction_interval",
    seasons: Object.fromEntries(seasons.map(slug => [slug, {
      status: Object.hasOwn(intercepts, slug) ? "direct" : "unavailable",
      sampleCount: groups[slug].length,
      packageRange: groups[slug].length ? [Math.min(...groups[slug].map(row => row.packageCount)), Math.max(...groups[slug].map(row => row.packageCount))] : null,
      breakRange: groups[slug].length ? [Math.min(...groups[slug].map(row => row.breakFraction)), Math.max(...groups[slug].map(row => row.breakFraction))] : null,
      bindingRange: groups[slug].length ? [Math.min(...groups[slug].map(row => row.bindingRiskCount)), Math.max(...groups[slug].map(row => row.bindingRiskCount))] : null,
    }])),
  };
}

export function predictFreshModel(model, input) {
  const unavailable = reason => ({ status: "unavailable", midpoint: null, range: null, reason, revision: model?.revision ?? freshModelRevision });
  if (model?.revision !== freshModelRevision || !model.converged) return unavailable("model_not_ready");
  if (!input || !validInput(input)) return unavailable("unknown_predictors");
  if (model.mode === "evidence-blended-v2") {
    const season = model.seasons?.[input.season];
    if (!season || season.status === "unavailable" || !finite(season.median)) return unavailable("season_without_fresh_evidence");
    const breakKey = input.breakFraction <= .1 ? "none" : input.breakFraction <= .35 ? "slight" : input.breakFraction <= .7 ? "medium" : "large";
    const multiplier = model.breakMultipliers?.[breakKey] ?? 1;
    const midpoint = (season.median + (input.packageCount - (model.packageCenter ?? 0)) * (model.packageSlope ?? 0)) * multiplier;
    const spread = Math.max(100, (season.high ?? season.median) - (season.low ?? season.median));
    if (!finite(midpoint) || midpoint <= 0) return unavailable("invalid_prediction");
    return { status: "unvalidated", revision: model.revision, midpoint,
      range: { low: Math.max(0, midpoint - spread), high: midpoint + spread }, intervalKind: model.intervalKind };
  }
  if (!Object.hasOwn(model.intercepts, input.season)) return unavailable("season_without_fresh_evidence");
  const support = model.seasons[input.season].packageRange;
  if (!support || input.packageCount < support[0] || input.packageCount > support[1]) return unavailable("package_count_outside_evidence");
  for (const [key, range] of [["breakFraction", "breakRange"], ["bindingRiskCount", "bindingRange"]]) {
    const bounds = model.seasons[input.season][range];
    if (!bounds || input[key] < bounds[0] || input[key] > bounds[1]) return unavailable("risk_conditions_outside_evidence");
  }
  const midpoint = model.intercepts[input.season] + dot(basis(input, model.knots), model.coefficients);
  if (!finite(midpoint) || midpoint <= 0 || !model.residualInterval) return unavailable("invalid_prediction");
  return { status: "unvalidated", revision: model.revision, midpoint,
    range: { low: Math.max(0, midpoint + model.residualInterval[0]), high: Math.max(midpoint, midpoint + model.residualInterval[1]) },
    intervalKind: model.intervalKind };
}
