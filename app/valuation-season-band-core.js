// Kept free of React and Node APIs so the browser estimate and the anonymous
// market validator derive the exact same season ranges.
export const seasonBandSeeds = [
  { slug: "gratitude", prior: 180000, sampleCount: 0 },
  { slug: "lightseekers", prior: 140000, sampleCount: 2, p25: 1800, p75: 5200 },
  { slug: "belonging", prior: 70000, sampleCount: 3, p25: 4000, p75: 70000 },
  { slug: "rhythm", prior: 50000, sampleCount: 5, p25: 55000, p75: 64100 },
  { slug: "enchantment", prior: 12000, sampleCount: 16, p25: 5000, p75: 44300 },
  { slug: "sanctuary", prior: 10000, sampleCount: 1, p25: 5500, p75: 5500 },
  { slug: "prophecy", prior: 8000, sampleCount: 14, p25: 6000, p75: 22000 },
  { slug: "dreams", prior: 6500, sampleCount: 2, p25: 5000, p75: 18000 },
  { slug: "assembly", prior: 5000, sampleCount: 6, p25: 5000, p75: 18000 },
  { slug: "the-little-prince", prior: 4000, sampleCount: 4, p25: 3120, p75: 5000 },
  { slug: "flight", prior: 3400, sampleCount: 12, p25: 5000, p75: 11000 },
  { slug: "abyss", prior: 3000, sampleCount: 6, p25: 4000, p75: 6000 },
  { slug: "performance", prior: 2500, sampleCount: 8, p25: 800, p75: 7500 },
  { slug: "shattering", prior: 2300, sampleCount: 0 },
  { slug: "aurora", prior: 2200, sampleCount: 1, p25: 56000, p75: 56000 },
  { slug: "remembrance", prior: 2100, sampleCount: 6, p25: 4700, p75: 5000 },
  { slug: "passage", prior: 2000, sampleCount: 2, p25: 4000, p75: 5000 },
  { slug: "moments", prior: 1900, sampleCount: 0 },
  { slug: "revival", prior: 1800, sampleCount: 3, p25: 2000, p75: 5000 },
  { slug: "nine-colored-deer", prior: 1700, sampleCount: 2, p25: 5000, p75: 7500 },
  { slug: "nesting", prior: 1600, sampleCount: 3, p25: 2500, p75: 55000 },
  { slug: "duets", prior: 1500, sampleCount: 0 },
  { slug: "moomin", prior: 1400, sampleCount: 2, p25: 1800, p75: 5000 },
  { slug: "radiance", prior: 1300, sampleCount: 0 },
  { slug: "blue-bird", prior: 1200, sampleCount: 0 },
  { slug: "two-embers-part-1", prior: 1100, sampleCount: 10, p25: 1600, p75: 6000 },
  { slug: "migration", prior: 1000, sampleCount: 5, p25: 1400, p75: 6000 },
  { slug: "lightmending", prior: 900, sampleCount: 3, p25: 1600, p75: 64100 },
  { slug: "carnival", prior: 800, sampleCount: 15, p25: 1600, p75: 3500 },
  { slug: "dear-van-gogh", prior: 700, sampleCount: 3, p25: 5000, p75: 22000 },
];

// Schema-v3 predictor snapshots are rebuilt against the latest completed
// season in the catalog. Keep this in sync with catalog-derived graduation
// data; the catalog tests intentionally fail when a season completes or its
// graduation-gift inventory changes.
export const replaySeasonProgressEndSlug = "carnival";
export const seasonGraduationGiftCounts = Object.freeze({
  gratitude: 1,
  lightseekers: 1,
  belonging: 1,
  rhythm: 2,
  enchantment: 2,
  sanctuary: 2,
  prophecy: 2,
  dreams: 2,
  assembly: 4,
  "the-little-prince": 3,
  flight: 2,
  abyss: 3,
  performance: 3,
  shattering: 2,
  aurora: 3,
  remembrance: 2,
  passage: 2,
  moments: 3,
  revival: 2,
  "nine-colored-deer": 3,
  nesting: 2,
  duets: 3,
  moomin: 3,
  radiance: 2,
  "blue-bird": 2,
  "two-embers-part-1": 2,
  migration: 3,
  lightmending: 3,
  carnival: 2,
  "dear-van-gogh": 3,
});

const roundHundred = (value) => Math.round(value / 100) * 100;
const logBlend = (left, right, rightWeight) =>
  Math.exp(Math.log(left) * (1 - rightWeight) + Math.log(right) * rightWeight);

export const confidenceForEffectiveWeight = (effectiveWeight) =>
  effectiveWeight >= 12
    ? "high"
    : effectiveWeight >= 5
      ? "medium"
      : effectiveWeight > 0
        ? "low"
        : "inferred";

/**
 * @returns {{
 *   evidenceQuality: "strong" | "mixed" | "limited";
 *   priceStage: "成交樣本" | "刊登樣本" | "混合參考" | "低資訊參考";
 *   sourceConcentration: number;
 * }}
 */
export const valuationEvidenceProfile = ({ aggregate, evidence }) => {
  const total = Number(evidence?.sampleCount) || 0;
  const stages = evidence?.evidenceBreakdown ?? {};
  const quality = evidence?.qualityBreakdown ?? {};
  const sources = Object.values(
    evidence?.sourceBreakdown ?? aggregate?.sourceBreakdown ?? {},
  ).map(Number);
  const sourceConcentration = total ? Math.max(0, ...sources) / total : 1;
  const sold = Number(stages.sold) || 0;
  const listed = (Number(stages.ask) || 0) + (Number(stages.quick_sale) || 0);
  const auxiliary =
    (Number(stages.professional_estimate) || 0) + (Number(stages.comment) || 0);
  const highQuality = Number(quality.high) || 0;
  const evidenceQuality =
    evidence?.qualityBreakdown &&
    total >= 8 &&
    highQuality / total >= 0.7 &&
    sourceConcentration <= 0.75
      ? "strong"
      : total >= 5 && sourceConcentration <= 0.9
        ? "mixed"
        : "limited";
  const priceStage = sold
    ? listed || auxiliary
      ? "混合參考"
      : "成交樣本"
    : listed
      ? auxiliary
        ? "混合參考"
        : "刊登樣本"
      : "低資訊參考";
  return { evidenceQuality, priceStage, sourceConcentration };
};

export const adjustConfidenceForEvidence = ({
  aggregate,
  confidence,
  evidence,
  validated,
}) => {
  const { evidenceQuality, priceStage, sourceConcentration } =
    valuationEvidenceProfile({ aggregate, evidence });
  const rank = { inferred: 0, low: 1, medium: 2, high: 3 };
  let next = rank[confidence] ?? 0;
  if (evidenceQuality === "mixed") next = Math.min(next, 2);
  if (evidenceQuality === "limited") next = Math.min(next, 1);
  if (priceStage === "刊登樣本") next = Math.min(next, 2);
  if (priceStage === "低資訊參考") next = Math.min(next, 1);
  if (sourceConcentration > 0.9) next = Math.min(next, 1);
  const adjusted = ["inferred", "low", "medium", "high"][next];
  if (validated || adjusted === "inferred") return adjusted;
  return adjusted === "high" || adjusted === "medium" ? "low" : adjusted;
};
const combineObserved = (original, market, originalWeight, marketWeight) => {
  if (!original) return market ?? undefined;
  if (!market) return original;
  return logBlend(original, market, marketWeight / (originalWeight + marketWeight));
};

/** Blend anonymous observations with priors and enforce older-to-newer order. */
export const deriveSeasonBands = (aggregate, seeds = seasonBandSeeds) => {
  const startSeason = aggregate?.segments?.startSeason ?? {};
  let previousLow = Number.POSITIVE_INFINITY;
  let previousMedian = Number.POSITIVE_INFINITY;
  let previousHigh = Number.POSITIVE_INFINITY;
  const ranges = seeds.map((row) => {
    const market = startSeason[row.slug];
    const marketWeight = Number(market?.effectiveWeight) || 0;
    const effectiveWeight = row.sampleCount + marketWeight;
    const observedLow = combineObserved(row.p25, market?.p25, row.sampleCount, marketWeight);
    const originalMedian = row.p25 && row.p75 ? Math.sqrt(row.p25 * row.p75) : undefined;
    const observedMedian = combineObserved(originalMedian, market?.median, row.sampleCount, marketWeight);
    const observedHigh = combineObserved(row.p75, market?.p75, row.sampleCount, marketWeight);
    const priorStrength = row.sampleCount + (Number(market?.sampleCount) || 0) < 5 ? 24 : 8;
    const weight = effectiveWeight / (effectiveWeight + priorStrength);
    const low = Math.min(
      observedLow ? logBlend(row.prior * 0.75, observedLow, weight) : row.prior * 0.75,
      previousLow * 0.97,
    );
    const median = Math.max(
      low,
      Math.min(observedMedian ? logBlend(row.prior, observedMedian, weight) : row.prior, previousMedian * 0.97),
    );
    const high = Math.max(
      median,
      Math.min(observedHigh ? logBlend(row.prior * 1.25, observedHigh, weight) : row.prior * 1.25, previousHigh * 0.97),
    );
    previousLow = low;
    previousMedian = median;
    previousHigh = high;
    return { low, median, high, effectiveWeight };
  });
  return seeds.map((row, index) => {
    const range = ranges[index];
    const nextMedian = ranges[index + 1]?.median ?? range.median * 0.88;
    const contributionMedian = Math.max(100, range.median - nextMedian);
    const market = startSeason[row.slug];
    return {
      slug: row.slug,
      low: roundHundred(range.low),
      median: roundHundred(range.median),
      high: roundHundred(range.high),
      contributionLow: roundHundred(contributionMedian * 0.75),
      contributionHigh: roundHundred(contributionMedian * 1.25),
      sampleCount: row.sampleCount + (Number(market?.sampleCount) || 0),
      effectiveWeight: Number(range.effectiveWeight.toFixed(2)),
    };
  });
};
