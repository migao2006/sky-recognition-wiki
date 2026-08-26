export type SeasonConfidence = "high" | "medium" | "low" | "inferred";

export type SeasonPriceBand = {
  slug: string;
  low: number;
  high: number;
  contributionLow: number;
  contributionHigh: number;
  sampleCount: number;
  confidence: SeasonConfidence;
  asOf: string;
};

export const valuationSampleSummary = {
  sourceRows: 1022,
  eligibleRows: 133,
  secondaryMarketRows: 74,
  asOf: "2026-08-16",
} as const;

// Seller-side TWD samples are aggregated before reaching the client.  The
// source listings and their free text deliberately never ship with the app.
// slug, prior midpoint, matching eligible samples, observed P25 and P75.
// Sparse quantiles are shrunk toward a ±25% prior with n/(n+8).
const seed: readonly [string, number, number, number?, number?][] = [
  ["gratitude", 180000, 0],
  ["lightseekers", 140000, 2, 1800, 5200],
  ["belonging", 70000, 3, 4000, 70000],
  ["rhythm", 50000, 5, 55000, 64100],
  ["enchantment", 12000, 16, 5000, 44300],
  ["sanctuary", 10000, 1, 5500, 5500],
  ["prophecy", 8000, 14, 6000, 22000],
  ["dreams", 6500, 2, 5000, 18000],
  ["assembly", 5000, 6, 5000, 18000],
  ["the-little-prince", 4000, 4, 3120, 5000],
  ["flight", 3400, 12, 5000, 11000],
  ["abyss", 3000, 6, 4000, 6000],
  ["performance", 2500, 8, 800, 7500],
  ["shattering", 2300, 0],
  ["aurora", 2200, 1, 56000, 56000],
  ["remembrance", 2100, 6, 4700, 5000],
  ["passage", 2000, 2, 4000, 5000],
  ["moments", 1900, 0],
  ["revival", 1800, 3, 2000, 5000],
  ["nine-colored-deer", 1700, 2, 5000, 7500],
  ["nesting", 1600, 3, 2500, 55000],
  ["duets", 1500, 0],
  ["moomin", 1400, 2, 1800, 5000],
  ["radiance", 1300, 0],
  ["blue-bird", 1200, 0],
  ["two-embers-part-1", 1100, 10, 1600, 6000],
  ["migration", 1000, 5, 1400, 6000],
  ["lightmending", 900, 3, 1600, 64100],
  ["carnival", 800, 15, 1600, 3500],
  ["dear-van-gogh", 700, 3, 5000, 22000],
];

const roundHundred = (value: number) => Math.round(value / 100) * 100;
const confidenceFor = (sampleCount: number): SeasonConfidence =>
  sampleCount >= 12
    ? "high"
    : sampleCount >= 5
      ? "medium"
      : sampleCount > 0
        ? "low"
        : "inferred";

const logBlend = (
  prior: number,
  observed: number | undefined,
  weight: number,
) =>
  observed
    ? Math.exp(Math.log(prior) * (1 - weight) + Math.log(observed) * weight)
    : prior;

let previousLow = Number.POSITIVE_INFINITY;
let previousHigh = Number.POSITIVE_INFINITY;
const ranges = seed.map(([, prior, sampleCount, observedLow, observedHigh]) => {
  const weight = sampleCount / (sampleCount + 8);
  const low = Math.min(
    logBlend(prior * 0.75, observedLow, weight),
    previousLow * 0.97,
  );
  const high = Math.max(
    low,
    Math.min(logBlend(prior * 1.25, observedHigh, weight), previousHigh * 0.97),
  );
  previousLow = low;
  previousHigh = high;
  return { low, high, midpoint: (low + high) / 2 };
});

export const seasonPriceBands: readonly SeasonPriceBand[] = seed.map(
  ([slug, , sampleCount], index) => {
    const { low, high, midpoint } = ranges[index];
    const next = ranges[index + 1]?.midpoint ?? midpoint * 0.88;
    const contributionMidpoint = Math.max(100, midpoint - next);
    return {
      slug,
      low: roundHundred(low),
      high: roundHundred(high),
      contributionLow: roundHundred(contributionMidpoint * 0.75),
      contributionHigh: roundHundred(contributionMidpoint * 1.25),
      sampleCount,
      confidence: confidenceFor(sampleCount),
      asOf: valuationSampleSummary.asOf,
    };
  },
);

export const seasonBandBySlug = new Map(
  seasonPriceBands.map((band) => [band.slug, band]),
);
