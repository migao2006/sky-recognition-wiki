import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const sourcePath = process.argv[2];
if (!sourcePath)
  throw new Error(
    "Usage: node scripts/audit-valuation-source.mjs <source.jsonl>",
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
  ["flight", "飛行季|風行|飛行畢"],
  ["abyss", "潛海季|深淵|潛海畢"],
  ["performance", "表演季|表演畢"],
  ["shattering", "破碎季|破碎畢"],
  ["aurora", "極光季|極光畢|歐若拉畢"],
  ["remembrance", "緬懷季|追憶|緬懷畢"],
  ["passage", "夜行季|夜行畢"],
  ["moments", "拾光季|拾光畢"],
  ["revival", "歸巢季|歸巢畢"],
  ["nine-colored-deer", "九色鹿季|九色鹿畢"],
  ["nesting", "築巢季|築巢畢"],
  ["duets", "協奏季|協奏畢"],
  ["moomin", "姆明季|姆明畢"],
  ["radiance", "染色季|染色畢"],
  ["blue-bird", "青鳥季|青鳥畢"],
  ["two-embers-part-1", "暮星季|雙星|暮星畢"],
  ["migration", "遷徙季|遷徙畢"],
  ["lightmending", "織光季|織光畢"],
  ["carnival", "狂歡季|狂歡畢"],
  ["dear-van-gogh", "梵谷季|致梵谷季"],
]);
const evidenceWeights = { ask: 1, professional_estimate: 0.55, comment: 0.35 };
const qualityWeights = { high: 1, medium: 0.75, low: 0.5 };
const emptyBreakdown = () => ({ ask: 0, professional_estimate: 0, comment: 0 });
const dateFor = (row) => {
  // Collection time is not publication time. Unknown post dates intentionally
  // keep the conservative fallback weight instead of appearing recent.
  const date = new Date(row.published_at ?? "");
  return Number.isFinite(date.getTime()) ? date : null;
};
const timeWeight = (date) => {
  if (!date) return 0.45;
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age <= 2) return 1;
  if (age <= 3) return 0.7;
  if (age <= 4) return 0.45;
  return 0.25;
};
const seasonSlugsFor = (row) => {
  const slugs = new Set();
  const add = (value) => {
    const slug = String(value ?? "").trim().toLowerCase();
    if (patterns.has(slug)) slugs.add(slug);
  };
  if (row.season_progress && typeof row.season_progress === "object")
    Object.keys(row.season_progress).forEach(add);
  if (Array.isArray(row.seasons))
    row.seasons.forEach((season) =>
      add(typeof season === "string" ? season : season?.slug),
    );
  if (slugs.size) return [...slugs];
  const text = `${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  for (const [slug, pattern] of patterns) if (new RegExp(pattern, "i").test(text)) slugs.add(slug);
  return [...slugs];
};
const invalidReason = (row) => {
  if (String(row.exclusion_reason ?? "").trim()) return "explicit";
  if (!Number.isFinite(row.price_twd) || row.price_twd <= 0) return "invalid_price";
  const text = `${row.region ?? ""} ${row.currency ?? ""} ${row.listing_text ?? ""} ${row.account_features ?? ""}`;
  if (/國服|中國服|陸服|\bcn\b/i.test(text)) return "china";
  if (/人民幣|rmb|cny|￥|¥|\busd\b|美金|港幣|hkd/i.test(text)) return "foreign_currency";
  if (!Object.hasOwn(evidenceWeights, row.evidence_kind)) return "invalid_evidence";
  if (!Object.hasOwn(qualityWeights, row.evidence_quality ?? "medium")) return "invalid_quality";
  return null;
};
const weightedQuantile = (samples, percentile) => {
  const ordered = [...samples].sort((a, b) => a.price - b.price);
  const total = ordered.reduce((sum, sample) => sum + sample.weight, 0);
  if (!total) return null;
  const target = total * percentile;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample.price;
  }
  return ordered.at(-1).price;
};

const rows = [];
for await (const line of createInterface({ input: createReadStream(sourcePath) }))
  if (line.trim()) rows.push(JSON.parse(line));
const metrics = Object.fromEntries(
  [...patterns.keys()].map((slug) => [
    slug,
    {
      samples: [],
      excludedCount: 0,
      duplicateCount: 0,
      evidenceBreakdown: emptyBreakdown(),
    },
  ]),
);
const seenHashes = new Set();
let eligibleRows = 0;
let excludedRows = 0;
let duplicateRows = 0;
for (const row of rows) {
  const slugs = seasonSlugsFor(row);
  const hash = String(row.post_hash ?? "").trim();
  if (hash && seenHashes.has(hash)) {
    duplicateRows += 1;
    slugs.forEach((slug) => metrics[slug].duplicateCount += 1);
    continue;
  }
  if (hash) seenHashes.add(hash);
  if (invalidReason(row)) {
    excludedRows += 1;
    slugs.forEach((slug) => metrics[slug].excludedCount += 1);
    continue;
  }
  const kind = row.evidence_kind;
  const weight = evidenceWeights[kind] * qualityWeights[row.evidence_quality ?? "medium"] * timeWeight(dateFor(row));
  eligibleRows += 1;
  slugs.forEach((slug) => {
    metrics[slug].samples.push({ price: row.price_twd, weight });
    metrics[slug].evidenceBreakdown[kind] += 1;
  });
}
const seasons = Object.fromEntries([...patterns.keys()].map((slug) => {
  const metric = metrics[slug];
  const effectiveWeight = metric.samples.reduce((sum, sample) => sum + sample.weight, 0);
  return [slug, {
    sampleCount: metric.samples.length,
    effectiveWeight: Number(effectiveWeight.toFixed(3)),
    p25: weightedQuantile(metric.samples, 0.25),
    median: weightedQuantile(metric.samples, 0.5),
    p75: weightedQuantile(metric.samples, 0.75),
    evidenceBreakdown: metric.evidenceBreakdown,
    excludedCount: metric.excludedCount,
    duplicateCount: metric.duplicateCount,
  }];
}));
console.log(JSON.stringify({ sourceRows: rows.length, eligibleRows, excludedRows, duplicateRows, seasons }, null, 2));
