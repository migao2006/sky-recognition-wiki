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

const rows = [];
for await (const line of createInterface({
  input: createReadStream(sourcePath),
})) {
  if (line.trim()) rows.push(JSON.parse(line));
}
const eligible = rows.filter(
  (row) =>
    Number.isFinite(row.price_twd) &&
    !String(row.exclusion_reason ?? "").trim() &&
    ["high", "medium"].includes(row.evidence_quality),
);
const quantile = (values, position) =>
  values[
    Math[position < 0.5 ? "floor" : "ceil"]((values.length - 1) * position)
  ];
const seasons = Object.fromEntries(
  [...patterns].map(([slug, pattern]) => {
    const prices = eligible
      .filter((row) =>
        `${row.listing_text} ${row.account_features}`.match(
          new RegExp(pattern, "i"),
        ),
      )
      .map((row) => row.price_twd)
      .sort((a, b) => a - b);
    return [
      slug,
      {
        sampleCount: prices.length,
        p25: quantile(prices, 0.25) ?? null,
        p75: quantile(prices, 0.75) ?? null,
      },
    ];
  }),
);
console.log(
  JSON.stringify(
    {
      sourceRows: rows.length,
      eligibleRows: eligible.length,
      observedAt: [...new Set(rows.map((row) => row.observed_at))],
      seasons,
    },
    null,
    2,
  ),
);
