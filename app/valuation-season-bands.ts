export type SeasonConfidence = "high" | "medium" | "low" | "inferred";

export type SeasonEvidenceBreakdown = {
  directSale: number;
  professionalEstimate: number;
  commentSignal: number;
};

export type SeasonPriceBand = {
  slug: string;
  low: number;
  median: number;
  high: number;
  contributionLow: number;
  contributionHigh: number;
  sampleCount: number;
  effectiveWeight: number;
  evidenceBreakdown: SeasonEvidenceBreakdown;
  confidence: SeasonConfidence;
  asOf: string;
};

export const valuationSampleSummary = {
  sourceRows: 1038,
  eligibleRows: 147,
  facebookRows: 16,
  facebookEligibleRows: 14,
  secondaryMarketRows: 74,
  asOf: "2026-08-30",
} as const;

type FacebookEvidence = {
  count: number;
  effectiveWeight: number;
  p25: number;
  median: number;
  p75: number;
};

type SeasonSeed = {
  slug: string;
  prior: number;
  sampleCount: number;
  p25?: number;
  p75?: number;
  facebook?: FacebookEvidence;
};

// Only anonymous aggregates reach the client. Raw post text, authors and URLs
// stay in the ignored research workspace. The first dataset contains 1,022
// seller-side records; `facebook` contains the manually checked 2026-08-30
// group-search additions. Unknown publication dates receive conservative weight.
const seed: readonly SeasonSeed[] = [
  { slug: "gratitude", prior: 180000, sampleCount: 0 },
  { slug: "lightseekers", prior: 140000, sampleCount: 2, p25: 1800, p75: 5200 },
  { slug: "belonging", prior: 70000, sampleCount: 3, p25: 4000, p75: 70000 },
  { slug: "rhythm", prior: 50000, sampleCount: 5, p25: 55000, p75: 64100 },
  { slug: "enchantment", prior: 12000, sampleCount: 16, p25: 5000, p75: 44300, facebook: { count: 3, effectiveWeight: 1.35, p25: 9500, median: 18000, p75: 18000 } },
  { slug: "sanctuary", prior: 10000, sampleCount: 1, p25: 5500, p75: 5500 },
  { slug: "prophecy", prior: 8000, sampleCount: 14, p25: 6000, p75: 22000, facebook: { count: 1, effectiveWeight: 0.45, p25: 7800, median: 7800, p75: 7800 } },
  { slug: "dreams", prior: 6500, sampleCount: 2, p25: 5000, p75: 18000 },
  { slug: "assembly", prior: 5000, sampleCount: 6, p25: 5000, p75: 18000, facebook: { count: 1, effectiveWeight: 0.338, p25: 6000, median: 6000, p75: 6000 } },
  { slug: "the-little-prince", prior: 4000, sampleCount: 4, p25: 3120, p75: 5000, facebook: { count: 3, effectiveWeight: 1.125, p25: 4500, median: 6000, p75: 9000 } },
  { slug: "flight", prior: 3400, sampleCount: 12, p25: 5000, p75: 11000, facebook: { count: 1, effectiveWeight: 0.338, p25: 2000, median: 2000, p75: 2000 } },
  { slug: "abyss", prior: 3000, sampleCount: 6, p25: 4000, p75: 6000, facebook: { count: 1, effectiveWeight: 0.45, p25: 4500, median: 4500, p75: 4500 } },
  { slug: "performance", prior: 2500, sampleCount: 8, p25: 800, p75: 7500, facebook: { count: 1, effectiveWeight: 0.45, p25: 3800, median: 3800, p75: 3800 } },
  { slug: "shattering", prior: 2300, sampleCount: 0 },
  { slug: "aurora", prior: 2200, sampleCount: 1, p25: 56000, p75: 56000, facebook: { count: 1, effectiveWeight: 0.45, p25: 4500, median: 4500, p75: 4500 } },
  { slug: "remembrance", prior: 2100, sampleCount: 6, p25: 4700, p75: 5000 },
  { slug: "passage", prior: 2000, sampleCount: 2, p25: 4000, p75: 5000 },
  { slug: "moments", prior: 1900, sampleCount: 0 },
  { slug: "revival", prior: 1800, sampleCount: 3, p25: 2000, p75: 5000 },
  { slug: "nine-colored-deer", prior: 1700, sampleCount: 2, p25: 5000, p75: 7500 },
  { slug: "nesting", prior: 1600, sampleCount: 3, p25: 2500, p75: 55000, facebook: { count: 1, effectiveWeight: 0.45, p25: 2500, median: 2500, p75: 2500 } },
  { slug: "duets", prior: 1500, sampleCount: 0 },
  { slug: "moomin", prior: 1400, sampleCount: 2, p25: 1800, p75: 5000, facebook: { count: 1, effectiveWeight: 0.45, p25: 4500, median: 4500, p75: 4500 } },
  { slug: "radiance", prior: 1300, sampleCount: 0 },
  { slug: "blue-bird", prior: 1200, sampleCount: 0 },
  { slug: "two-embers-part-1", prior: 1100, sampleCount: 10, p25: 1600, p75: 6000 },
  { slug: "migration", prior: 1000, sampleCount: 5, p25: 1400, p75: 6000 },
  { slug: "lightmending", prior: 900, sampleCount: 3, p25: 1600, p75: 64100 },
  { slug: "carnival", prior: 800, sampleCount: 15, p25: 1600, p75: 3500 },
  { slug: "dear-van-gogh", prior: 700, sampleCount: 3, p25: 5000, p75: 22000 },
];

const roundHundred = (value: number) => Math.round(value / 100) * 100;
const confidenceFor = (sampleCount: number): SeasonConfidence =>
  sampleCount >= 12 ? "high" : sampleCount >= 5 ? "medium" : sampleCount > 0 ? "low" : "inferred";

const logBlend = (left: number, right: number, rightWeight: number) =>
  Math.exp(Math.log(left) * (1 - rightWeight) + Math.log(right) * rightWeight);

const combineObserved = (
  original: number | undefined,
  facebook: number | undefined,
  originalWeight: number,
  facebookWeight: number,
) => {
  if (!original) return facebook;
  if (!facebook) return original;
  return logBlend(original, facebook, facebookWeight / (originalWeight + facebookWeight));
};

let previousLow = Number.POSITIVE_INFINITY;
let previousMedian = Number.POSITIVE_INFINITY;
let previousHigh = Number.POSITIVE_INFINITY;
const ranges = seed.map((row) => {
  const facebookWeight = row.facebook?.effectiveWeight ?? 0;
  const effectiveWeight = row.sampleCount + facebookWeight;
  const observedLow = combineObserved(row.p25, row.facebook?.p25, row.sampleCount, facebookWeight);
  const originalMedian = row.p25 && row.p75 ? Math.sqrt(row.p25 * row.p75) : undefined;
  const observedMedian = combineObserved(originalMedian, row.facebook?.median, row.sampleCount, facebookWeight);
  const observedHigh = combineObserved(row.p75, row.facebook?.p75, row.sampleCount, facebookWeight);
  const priorStrength = row.sampleCount < 5 ? 24 : 8;
  const weight = effectiveWeight / (effectiveWeight + priorStrength);
  const low = Math.min(
    observedLow ? logBlend(row.prior * 0.75, observedLow, weight) : row.prior * 0.75,
    previousLow * 0.97,
  );
  const median = Math.max(
    low,
    Math.min(
      observedMedian ? logBlend(row.prior, observedMedian, weight) : row.prior,
      previousMedian * 0.97,
    ),
  );
  const high = Math.max(
    median,
    Math.min(
      observedHigh ? logBlend(row.prior * 1.25, observedHigh, weight) : row.prior * 1.25,
      previousHigh * 0.97,
    ),
  );
  previousLow = low;
  previousMedian = median;
  previousHigh = high;
  return { low, median, high, effectiveWeight };
});

export const seasonPriceBands: readonly SeasonPriceBand[] = seed.map((row, index) => {
  const { low, median, high, effectiveWeight } = ranges[index];
  const nextMedian = ranges[index + 1]?.median ?? median * 0.88;
  const contributionMedian = Math.max(100, median - nextMedian);
  const sampleCount = row.sampleCount + (row.facebook?.count ?? 0);
  return {
    slug: row.slug,
    low: roundHundred(low),
    median: roundHundred(median),
    high: roundHundred(high),
    contributionLow: roundHundred(contributionMedian * 0.75),
    contributionHigh: roundHundred(contributionMedian * 1.25),
    sampleCount,
    effectiveWeight: Number(effectiveWeight.toFixed(2)),
    evidenceBreakdown: {
      directSale: sampleCount,
      professionalEstimate: 0,
      commentSignal: 0,
    },
    confidence: confidenceFor(sampleCount),
    asOf: valuationSampleSummary.asOf,
  };
});

export const seasonBandBySlug = new Map(
  seasonPriceBands.map((band) => [band.slug, band]),
);
