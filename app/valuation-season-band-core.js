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

const roundHundred = (value) => Math.round(value / 100) * 100;
const logBlend = (left, right, rightWeight) =>
  Math.exp(Math.log(left) * (1 - rightWeight) + Math.log(right) * rightWeight);
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
