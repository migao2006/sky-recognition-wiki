// This module deliberately has no React, catalog or Node dependencies.  It is
// imported by the browser estimate and the Node validation script so the
// published calculation and the holdout calculation cannot drift apart.
const roundHundred = (value) => Math.round(value / 100) * 100;
const roundFiveHundred = (value) => Math.round(value / 500) * 500;

export const summarizeValuationRange = (rawLow, rawHigh, confidence) => {
  if (rawHigh <= 0) return { low: 0, high: 0, midpoint: 0 };
  const midpoint = roundFiveHundred(rawLow + (rawHigh - rawLow) * 0.64);
  const spread = confidence === "high" ? 0.12 : confidence === "medium" ? 0.14 : confidence === "low" ? 0.16 : 0.18;
  return {
    low: roundHundred(Math.max(rawLow, midpoint * (1 - spread))),
    high: roundHundred(Math.min(rawHigh, midpoint * (1 + spread))),
    midpoint,
  };
};

/**
 * Apply every numeric adjustment used by the browser estimate.  Callers are
 * responsible for deriving catalog-specific package and limited-item values.
 */
export const calculateValuationModel = ({
  baseLow,
  baseHigh,
  breakMultiplier = 1,
  partialDiscountLow = 0,
  partialDiscountHigh = 0,
  packageLow = 0,
  packageHigh = 0,
  limitedLow = 0,
  limitedHigh = 0,
  resourceLow = 0,
  resourceHigh = 0,
  accountStyleMultiplier = 1,
  bindingRisk = 1,
  transferHighMultiplier = 1,
  confidence = "inferred",
}) => {
  let low = baseLow * breakMultiplier;
  let high = baseHigh * breakMultiplier;
  low = Math.max(300, low - partialDiscountLow);
  high = Math.max(low, high - partialDiscountHigh);
  low += packageLow + limitedLow + resourceLow;
  high += packageHigh + limitedHigh + resourceHigh;
  low *= accountStyleMultiplier;
  high *= accountStyleMultiplier * transferHighMultiplier;
  low = roundHundred(Math.max(300, low));
  high = roundHundred(Math.max(low, high));

  const marketSummary = summarizeValuationRange(low, high, confidence);
  if (bindingRisk >= 1) return marketSummary;
  const riskLow = roundHundred(Math.max(300, marketSummary.low * bindingRisk));
  const riskHigh = roundHundred(Math.max(riskLow, marketSummary.high * bindingRisk));
  return {
    low: riskLow,
    high: riskHigh,
    midpoint: Math.min(
      riskHigh,
      Math.max(riskLow, roundFiveHundred(marketSummary.midpoint * bindingRisk)),
    ),
  };
};

/** Every persisted predictor required to replay the browser calculation. */
export const valuationModelInputKeys = [
  "baseLow",
  "baseHigh",
  "breakMultiplier",
  "partialDiscountLow",
  "partialDiscountHigh",
  "packageLow",
  "packageHigh",
  "packageMarketMultiplier",
  "limitedLow",
  "limitedHigh",
  "resourceLow",
  "resourceHigh",
  "accountStyleMultiplier",
  "bindingRisk",
  "transferHighMultiplier",
];

export const valuationConfidenceValues = ["high", "medium", "low", "inferred"];

export const hasCompleteValuationModelFeatures = (features) =>
  Boolean(features) &&
  valuationModelInputKeys.every((key) =>
    Number.isFinite(Number(features[key])),
  ) &&
  valuationConfidenceValues.includes(features.confidence);
