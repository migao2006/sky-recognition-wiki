import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const asOfArg = args.find((value) => value.startsWith("--as-of="));
const sourcePaths = args.filter((value) => !value.startsWith("--as-of="));
if (!sourcePaths.length)
  throw new Error(
    "Usage: node scripts/audit-valuation-source.mjs [--as-of=YYYY-MM-DD] <source.jsonl> [...more.jsonl]",
  );

const patterns = new Map([
  ["gratitude", "感恩季|感恩畢|鹿頭"],
  ["lightseekers", "追光季|追光畢|大傘"],
  ["belonging", "歸屬季|歸屬畢|篝火"],
  ["rhythm", "音韻季|音韻畢|白鳥"],
  ["enchantment", "魔法季|魔法畢|耳墜"],
  ["sanctuary", "聖島季|聖島畢|手碟"],
  ["prophecy", "預言季|預言畢|阿努比斯|阿努"],
  ["dreams", "夢想季|夢想畢|鳳凰"],
  ["assembly", "重組季|集結|重組畢|號角"],
  ["the-little-prince", "小王子季|王子畢|小王子畢"],
  ["flight", "飛行季|飛翔季|風行季|風行|飛行畢|飛翔畢"],
  ["abyss", "潛海季|深淵季|潛海畢|深淵畢"],
  ["performance", "表演季|表演畢"],
  ["shattering", "破碎季|破曉季|破碎畢|破曉畢"],
  ["aurora", "極光季|AURORA季|歐若拉季|極光畢|AURORA畢|歐若拉畢"],
  ["remembrance", "緬懷季|追憶|緬懷畢"],
  ["passage", "夜行季|夜行畢"],
  ["moments", "拾光季|拾光畢"],
  ["revival", "歸巢季|歸巢畢"],
  ["nine-colored-deer", "九色鹿季|九色鹿畢"],
  ["nesting", "築巢季|築巢畢"],
  ["duets", "協奏季|二重奏季|協奏畢|二重奏畢"],
  ["moomin", "姆明季|姆明畢"],
  ["radiance", "染色季|彩染季|染色畢|彩染畢"],
  ["blue-bird", "青鳥季|青鳥畢"],
  ["two-embers-part-1", "暮星季|雙星|暮星畢"],
  ["migration", "遷徙季|遷徙畢"],
  ["lightmending", "織光季|織光畢"],
  ["carnival", "狂歡季|狂歡畢"],
  ["dear-van-gogh", "梵谷季|致梵谷季"],
]);

const evidenceWeights = {
  ask: 1,
  quick_sale: 0.8,
  sold: 1.2,
  professional_estimate: 0.55,
  comment: 0.35,
};
const priceKindWeights = {
  ask: 0.9,
  quick_sale: 0.82,
  sold: 1,
  professional_estimate: 0.6,
  comment: 0.4,
};
const qualityWeights = { high: 1, medium: 0.75, low: 0.5 };
const breakClasses = ["none", "slight", "medium", "big"];
const packageTiers = ["few", "medium", "many", "hundred"];
const accountStyles = ["simple", "regular"];
const emptyBreakdown = () => ({ ask: 0, quick_sale: 0, sold: 0, professional_estimate: 0, comment: 0 });
const emptyQualityBreakdown = () => ({ high: 0, medium: 0, low: 0 });

let referenceDate = null;
const dateFor = (row) => {
  const date = new Date(row.published_at ?? "");
  return Number.isFinite(date.getTime()) ? date : null;
};
const timeWeight = (date) => {
  if (!date) return 0.45;
  const age = ((referenceDate?.getTime() ?? Date.now()) - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age <= 2) return 1;
  if (age <= 3) return 0.7;
  if (age <= 4) return 0.45;
  return 0.25;
};
const finitePositive = (value) => Number.isFinite(value) && value > 0;
const priceRangeFor = (row) => {
  if (finitePositive(row.price_twd)) return { low: row.price_twd, high: row.price_twd };
  const low = Number(row.price_twd_low);
  const high = Number(row.price_twd_high);
  if (!finitePositive(low) && !finitePositive(high)) return null;
  return { low: finitePositive(low) ? low : high, high: finitePositive(high) ? high : low };
};
const priceFor = (row) => {
  const range = priceRangeFor(row);
  if (!range) return null;
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  const kind = row.price_kind ?? row.evidence_kind ?? "ask";
  const position = kind === "quick_sale" ? 0.25 : kind === "sold" ? 0.5 : 0.58;
  return Math.round(low + (high - low) * position);
};
const seasonSlugsFor = (row) => {
  const start = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (patterns.has(start)) return [start];
  const slugs = new Set();
  const add = (value) => {
    const slug = String(value ?? "").trim().toLowerCase();
    if (patterns.has(slug)) slugs.add(slug);
  };
  if (row.season_progress && typeof row.season_progress === "object") Object.keys(row.season_progress).forEach(add);
  if (Array.isArray(row.seasons)) row.seasons.forEach((season) => add(typeof season === "string" ? season : season?.slug));
  if (slugs.size) return [...slugs];
  const text = `${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  for (const [slug, pattern] of patterns) if (new RegExp(pattern, "i").test(text)) slugs.add(slug);
  return [...slugs];
};
const structuredSeasonSlugsFor = (row) => {
  const slugs = new Set();
  const add = (value) => {
    const slug = String(value ?? "").trim().toLowerCase();
    if (patterns.has(slug)) slugs.add(slug);
  };
  add(row.start_season_slug);
  if (row.season_progress && typeof row.season_progress === "object")
    Object.keys(row.season_progress).forEach(add);
  if (Array.isArray(row.seasons))
    row.seasons.forEach((season) =>
      add(typeof season === "string" ? season : season?.slug),
    );
  return [...slugs];
};
const startSeasonFor = (row) => {
  const explicit = String(row.start_season_slug ?? "").trim().toLowerCase();
  if (patterns.has(explicit)) return explicit;
  if (row.season_progress && typeof row.season_progress === "object") {
    const hasProgress = (value) => {
      if (value === null || value === undefined || value === false) return false;
      if (typeof value === "number") return value > 0;
      const normalized = String(value).trim().toLowerCase();
      if (!normalized || /^(?:0|0\s*\/\s*\d+|⁰|none|no|false|-)$/.test(normalized))
        return false;
      return true;
    };
    for (const slug of patterns.keys()) {
      if (Object.hasOwn(row.season_progress, slug) && hasProgress(row.season_progress[slug]))
        return slug;
    }
  }
  const structured = structuredSeasonSlugsFor(row);
  return structured.length === 1 ? structured[0] : null;
};
const startSeasonFactorFor = (row, startSeason) => {
  if (!startSeason) return 0;
  const confidence = String(row.start_season_confidence ?? "").toLowerCase();
  if (confidence === "unknown") return 0;
  if (!patterns.has(String(row.start_season_slug ?? "").trim().toLowerCase()))
    return 0.45;
  if (confidence === "inferred") return 0.45;
  if (confidence === "structured") return 0.8;
  return 1;
};
const breakClassFor = (row) => {
  if (breakClasses.includes(row.computed_break_class)) return row.computed_break_class;
  const missing = Number(row.missing_season_count);
  const completion = Number(row.completion_ratio);
  if (Number.isFinite(missing) && Number.isFinite(completion)) {
    if (missing === 0) return "none";
    if (missing <= 2 && completion >= 0.8) return "slight";
    if (missing <= 5 || completion >= 0.5) return "medium";
    return "big";
  }
  const label = String(row.seller_break_label ?? "").toLowerCase();
  if (/無斷|none/.test(label)) return "none";
  if (/微斷|小斷|近無斷|偽無斷|slight/.test(label)) return "slight";
  if (/中斷|半斷|medium/.test(label)) return "medium";
  if (/大斷|多斷|big/.test(label)) return "big";
  return null;
};
const packageTierFor = (row) => {
  if (packageTiers.includes(row.computed_package_tier)) return row.computed_package_tier;
  const count = Number(row.paid_package_count);
  if (!Number.isFinite(count) || count < 0) return null;
  if (count >= 100) return "hundred";
  if (count >= 40) return "many";
  if (count >= 15) return "medium";
  return "few";
};
const accountStyleFor = (row) => accountStyles.includes(row.account_style) ? row.account_style : null;
const invalidReason = (row) => {
  if (String(row.exclusion_reason ?? "").trim()) return "explicit";
  if (!priceRangeFor(row)) return "invalid_price";
  const text = `${row.region ?? ""} ${row.currency ?? ""} ${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  if (/國服|中國服|陸服|\bcn\b/i.test(text)) return "china";
  if (/人民幣|rmb|cny|￥|¥|\busd\b|美金|港幣|hkd/i.test(text)) return "foreign_currency";
  if (!Object.hasOwn(evidenceWeights, row.evidence_kind)) return "invalid_evidence";
  if (!Object.hasOwn(qualityWeights, row.evidence_quality ?? "medium")) return "invalid_quality";
  return null;
};
const weightedQuantile = (samples, percentile, valueKey = "price") => {
  const ordered = [...samples].sort((a, b) => a[valueKey] - b[valueKey]);
  const total = ordered.reduce((sum, sample) => sum + sample.weight, 0);
  if (!total) return null;
  const target = total * percentile;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample[valueKey];
  }
  return ordered.at(-1)[valueKey];
};
const summarize = (samples, includeEvidenceProfile = false) => {
  const effectiveWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const evidenceBreakdown = emptyBreakdown();
  const qualityBreakdown = emptyQualityBreakdown();
  const sourceBreakdown = {};
  samples.forEach((sample) => {
    evidenceBreakdown[sample.kind] += 1;
    qualityBreakdown[sample.quality] += 1;
    sourceBreakdown[sample.source] = (sourceBreakdown[sample.source] ?? 0) + 1;
  });
  return {
    sampleCount: samples.length,
    effectiveWeight: Number(effectiveWeight.toFixed(3)),
    p25: weightedQuantile(samples, 0.25),
    median: weightedQuantile(samples, 0.5),
    p75: weightedQuantile(samples, 0.75),
    evidenceBreakdown,
    ...(includeEvidenceProfile
      ? {
          qualityBreakdown,
          sourceBreakdown: Object.fromEntries(
            Object.entries(sourceBreakdown).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          ),
        }
      : {}),
  };
};

const rows = [];
for (const sourcePath of sourcePaths)
  for await (const line of createInterface({ input: createReadStream(sourcePath) }))
    if (line.trim())
      rows.push({
        ...JSON.parse(line),
        __sourceHint: /facebook/i.test(sourcePath)
          ? "facebook"
          : /drive/i.test(sourcePath)
            ? "google_drive"
            : "unknown",
      });

const referenceCandidates = rows.flatMap((row) =>
  [row.observed_at, row.published_at]
    .map((value) => new Date(value ?? ""))
    .filter((date) => Number.isFinite(date.getTime())),
);
referenceDate = asOfArg
  ? new Date(`${asOfArg.slice("--as-of=".length)}T23:59:59.999Z`)
  : referenceCandidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date();
if (!Number.isFinite(referenceDate.getTime()))
  throw new Error("Invalid --as-of date; expected YYYY-MM-DD");

const seasonMetrics = Object.fromEntries([...patterns.keys()].map((slug) => [slug, { samples: [], excludedCount: 0, duplicateCount: 0 }]));
const eligible = [];
const seenHashes = new Set();
let excludedRows = 0;
let duplicateRows = 0;
for (const row of rows) {
  const slugs = seasonSlugsFor(row);
  const hash = String(row.post_hash ?? "").trim();
  if (hash && seenHashes.has(hash)) {
    duplicateRows += 1;
    slugs.forEach((slug) => (seasonMetrics[slug].duplicateCount += 1));
    continue;
  }
  if (hash) seenHashes.add(hash);
  if (invalidReason(row)) {
    excludedRows += 1;
    slugs.forEach((slug) => (seasonMetrics[slug].excludedCount += 1));
    continue;
  }
  const kind = row.evidence_kind;
  const priceKind = row.price_kind ?? kind;
  const startSeason = startSeasonFor(row);
  const priceKindWeight = row.price_kind
    ? (priceKindWeights[priceKind] ?? 0.75)
    : 1;
  const sample = {
    price: priceFor(row),
    weight: evidenceWeights[kind] * priceKindWeight * qualityWeights[row.evidence_quality ?? "medium"] * timeWeight(dateFor(row)),
    kind,
    quality: row.evidence_quality ?? "medium",
    source: String(row.source ?? row.__sourceHint ?? "unknown"),
    startSeason,
    startSeasonFactor: startSeasonFactorFor(row, startSeason),
    breakClass: breakClassFor(row),
    packageTier: packageTierFor(row),
    accountStyle: accountStyleFor(row),
  };
  const affectsCalibration =
    slugs.length > 0 ||
    sample.startSeasonFactor > 0 ||
    sample.breakClass !== null ||
    sample.packageTier !== null ||
    sample.accountStyle !== null;
  if (!affectsCalibration) {
    excludedRows += 1;
    continue;
  }
  eligible.push(sample);
  slugs.forEach((slug) => seasonMetrics[slug].samples.push(sample));
}

const seasons = Object.fromEntries([...patterns.keys()].map((slug) => {
  const metric = seasonMetrics[slug];
  return [slug, { ...summarize(metric.samples), excludedCount: metric.excludedCount, duplicateCount: metric.duplicateCount }];
}));
const segmentFor = (key, values) => Object.fromEntries(values.map((value) => [value, summarize(eligible.filter((sample) => sample[key] === value))]));
const segments = {
  startSeason: Object.fromEntries([...patterns.keys()].map((slug) => [slug, summarize(eligible
    .filter((sample) => sample.startSeason === slug && sample.startSeasonFactor > 0)
    .map((sample) => ({ ...sample, weight: sample.weight * sample.startSeasonFactor })), true)])),
  breakClass: segmentFor("breakClass", breakClasses),
  packageTier: segmentFor("packageTier", packageTiers),
  accountStyle: segmentFor("accountStyle", accountStyles),
};

const startMedians = new Map(Object.entries(segments.startSeason).filter(([, metric]) => metric.median).map(([slug, metric]) => [slug, metric.median]));
const normalized = eligible.flatMap((sample) => {
  const baseline = startMedians.get(sample.startSeason);
  return baseline && sample.startSeasonFactor > 0
    ? [{ ...sample, weight: sample.weight * sample.startSeasonFactor, logRatio: Math.log(sample.price / baseline) }]
    : [];
});
const modifierFor = (key, values, priorStrength = 12, priors = {}) => Object.fromEntries(values.map((value) => {
  const samples = normalized.filter((sample) => sample[key] === value).map((sample) => ({ ...sample, price: sample.logRatio }));
  const medianLog = weightedQuantile(samples, 0.5) ?? 0;
  const effectiveWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const shrink = effectiveWeight / (effectiveWeight + priorStrength);
  return [value, {
    multiplier: Number(Math.min(1.35, Math.max(0.55, Math.exp(Math.log(priors[value] ?? 1) * (1 - shrink) + medianLog * shrink))).toFixed(3)),
    sampleCount: samples.length,
    effectiveWeight: Number(effectiveWeight.toFixed(3)),
  }];
}));
const rawBreakModifiers = modifierFor("breakClass", breakClasses, 16, {
  none: 1,
  slight: 0.94,
  medium: 0.84,
  big: 0.7,
});
let breakCeiling = 1.05;
const breakCaps = { none: 1, slight: 0.97, medium: 0.9, big: 0.78 };
for (const key of breakClasses) {
  rawBreakModifiers[key].multiplier = Number(
    Math.min(
      breakCeiling,
      breakCaps[key],
      rawBreakModifiers[key].multiplier,
    ).toFixed(3),
  );
  breakCeiling = rawBreakModifiers[key].multiplier;
}
const rawPackageModifiers = modifierFor("packageTier", packageTiers, 16, {
  few: 0.92,
  medium: 1,
  many: 1.09,
  hundred: 1.18,
});
let packageFloor = 0.88;
for (const key of packageTiers) {
  rawPackageModifiers[key].multiplier = Number(
    Math.max(packageFloor, rawPackageModifiers[key].multiplier).toFixed(3),
  );
  packageFloor = rawPackageModifiers[key].multiplier;
}
const modifiers = {
  breakClass: rawBreakModifiers,
  packageTier: rawPackageModifiers,
  accountStyle: modifierFor("accountStyle", accountStyles, 20, {
    simple: 0.86,
    regular: 1,
  }),
};
const sourceBreakdown = Object.fromEntries([...new Set(eligible.map((sample) => sample.source))].sort().map((source) => [source, eligible.filter((sample) => sample.source === source).length]));
const sourceRowsBySource = Object.fromEntries(
  [...new Set(rows.map((row) => String(row.source ?? row.__sourceHint ?? "unknown")))]
    .sort()
    .map((source) => [
      source,
      rows.filter(
        (row) => String(row.source ?? row.__sourceHint ?? "unknown") === source,
      ).length,
    ]),
);

console.log(JSON.stringify({
  schemaVersion: 2,
  asOf: referenceDate.toISOString().slice(0, 10),
  sourceRows: rows.length,
  eligibleRows: eligible.length,
  excludedRows,
  duplicateRows,
  sourceRowsBySource,
  sourceBreakdown,
  seasons,
  segments,
  modifiers,
}, null, 2));
