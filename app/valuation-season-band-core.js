// Kept free of React and Node APIs so the browser estimate and the anonymous
// market validator derive the exact same season ranges.
export const seasonBandSeeds = [
  { slug: "gratitude", prior: 180000 },
  { slug: "lightseekers", prior: 140000 },
  { slug: "belonging", prior: 70000 },
  { slug: "rhythm", prior: 50000 },
  { slug: "enchantment", prior: 12000 },
  { slug: "sanctuary", prior: 10000 },
  { slug: "prophecy", prior: 8000 },
  { slug: "dreams", prior: 6500 },
  { slug: "assembly", prior: 5000 },
  { slug: "the-little-prince", prior: 4000 },
  { slug: "flight", prior: 3400 },
  { slug: "abyss", prior: 3000 },
  { slug: "performance", prior: 2500 },
  { slug: "shattering", prior: 2300 },
  { slug: "aurora", prior: 2200 },
  { slug: "remembrance", prior: 2100 },
  { slug: "passage", prior: 2000 },
  { slug: "moments", prior: 1900 },
  { slug: "revival", prior: 1800 },
  { slug: "nine-colored-deer", prior: 1700 },
  { slug: "nesting", prior: 1600 },
  { slug: "duets", prior: 1500 },
  { slug: "moomin", prior: 1400 },
  { slug: "radiance", prior: 1300 },
  { slug: "blue-bird", prior: 1200 },
  { slug: "two-embers-part-1", prior: 1100 },
  { slug: "migration", prior: 1000 },
  { slug: "lightmending", prior: 900 },
  { slug: "carnival", prior: 800 },
  { slug: "dear-van-gogh", prior: 700 },
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
/** Blend anonymous observations with priors and enforce older-to-newer order. */
export const deriveSeasonBands = (aggregate, seeds = seasonBandSeeds) => {
  const startSeason = aggregate?.segments?.startSeason ?? {};
  let previousLow = Number.POSITIVE_INFINITY;
  let previousMedian = Number.POSITIVE_INFINITY;
  let previousHigh = Number.POSITIVE_INFINITY;
  const ranges = seeds.map((row) => {
    const market = startSeason[row.slug];
    // Only audited start-season observations count as market evidence. Priors
    // express a fallback value, never extra samples or confidence.
    const effectiveWeight = Number(market?.effectiveWeight) || 0;
    const observedLow = market?.p25;
    const observedMedian = market?.median;
    const observedHigh = market?.p75;
    const priorStrength = (Number(market?.sampleCount) || 0) < 5 ? 24 : 8;
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
      sampleCount: Number(market?.sampleCount) || 0,
      effectiveWeight: Number(range.effectiveWeight.toFixed(2)),
    };
  });
};
