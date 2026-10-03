// User quotations, not transaction observations or a trained market model.
export const valuationRevision = "manual-reference-2026-10-04-v1";
export const manualAccountReferences = Object.freeze({
  gratitude: { count: 100, midpoint: 250000 },
  lightseekers: { count: 100, midpoint: 150000 },
  rhythm: { count: 100, midpoint: 100000 },
  enchantment: { count: 100, midpoint: 45000 },
});

export const interpolateIncreasing = (count, points) => {
  if (!Number.isFinite(count) || count < 0) throw new Error("Invalid package count");
  const upper = points.findIndex(([x]) => x > count);
  const i = upper < 0 ? points.length - 1 : Math.max(1, upper);
  const [x0, y0] = points[i - 1], [x1, y1] = points[i];
  return y0 + (count - x0) * (y1 - y0) / (x1 - x0);
};

// Preserve the previous price scale while joining the boundaries and removing
// the 150-package plateau. Classification labels do not enter this function.
export const progressivePackageValue = (count) => interpolateIncreasing(count,
  [[0, 0], [15, 600], [40, 1100], [100, 2600], [150, 5600]]);

export const referencePackageValue = (slug, count) => slug === "enchantment"
  ? interpolateIncreasing(count, [[0, 0], [15, 600], [40, 1100], [60, 1600], [100, 9600], [150, 12600]])
  : progressivePackageValue(count);

export const manualReferenceBase = (slug) => {
  const reference = manualAccountReferences[slug];
  if (!reference) return null;
  const included = referencePackageValue(slug, reference.count);
  // The shared summary uses a 0.64 position within the raw interval. These
  // bounds center that calculation exactly on the quoted reference midpoint.
  return {
    low: reference.midpoint * 0.84 - included,
    high: reference.midpoint * 1.09 - included,
  };
};
