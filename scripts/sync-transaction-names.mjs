import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import { serializeNameSnapshot } from "./lib/name-snapshot-serializer.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PLAYER_NAMES_PATH = resolve(ROOT, "app/player-zh-names.json");
const WIKI_NAMES_PATH = resolve(ROOT, "app/wiki-zh-names.json");
const REPORT_PATH = resolve(ROOT, "dist/tmp/transaction-name-sync.json");
const args = process.argv.slice(2);
const sourceArg = args.find((value) => !value.startsWith("--"));
const sourcePath = sourceArg || process.env.TRADE_NAME_SOURCE;
const shouldWrite = args.includes("--write");

if (!sourcePath) {
  throw new Error(
    "請提供交易用語清單：node scripts/sync-transaction-names.mjs <來源.txt> [--write]",
  );
}

const categorySpecs = {
  outfit_compat: { types: ["Outfit"] },
  shoes: { types: ["Shoes"] },
  outfit_fixed: { types: ["OutfitShoes"] },
  mask: { types: ["Mask"] },
  face_accessory: { types: ["FaceAccessory"] },
  neck_accessory: { types: ["Necklace"] },
  hair: { types: ["Hair"] },
  head_accessory: { types: ["HairAccessory"] },
  ear_accessory: { types: ["HeadAccessory"] },
  cape: { types: ["Cape"] },
  prop: { sub: "held", orderMode: "held" },
  furniture_large: { types: ["LargeProp"] },
  furniture_small: { types: ["SmallProp"] },
};

// These entries were checked against the current official English identity,
// type, wardrobe order and GUID. They cover stable player nicknames whose
// source Chinese name is intentionally very different from the site label.
const reviewedGuidOverrides = {
  hair_0033: "T0wsTbmzvv", // Forest Elder Hair (雨媽)
  hair_0036: "SSrCZW8Cf-", // Wasteland Elder Hair (龍骨)
  head_accessory_0018: "-EBoN4AWqQ", // Pointed Snufkin Hat
  ear_accessory_0022: "evuvua13dC", // Mischief Withered Antlers
  head_accessory_0084: "jM8xKFwbTE", // Moth Antennae
  ear_accessory_0001: "bBQbGQh1PU", // Hairtousle Teen Earmuffs
  ear_accessory_0010: "v5NKOAkwza", // Royal Hairtousle Teen Head Accessory
  cape_0004: "DI0RLfo9Sj", // Founder's Cape
  cape_0031: "WCPTi8XYZy", // Wise Grandparent Cape
  cape_0033: "Bm0aFDGHk2", // Thoughtful Director Cape
  cape_0076: "EQYKoHE95s", // Wings of AURORA
  cape_0107: "mwv4iZI57S", // Divining Wise Grandparent Cape
  cape_0183: "bu7qgPtuB2", // Moth Cape
  cape_0189: "OfOc3xQdCQ", // Transcendent Journey Cape
  cape_0139: "YUqENRc8rQ", // Earth Cape
  cape_0186: "4c9HLTfREP", // Nintendo Red Switch Cape
  cape_0187: "KtlqKC7whS", // Nintendo Blue Switch Cape
  prop_0024: "K0NBv__mv8", // Voice of AURORA
  furniture_large_0035: "w7byhvh3Xa", // Days of Love Swing
  furniture_large_0036: "yWCpBlHsWa", // Days of Love Seesaw
  furniture_small_0013: "nrNcYrcZXy", // Little Prince Fox
  furniture_small_0025: "5xJ_mCzZQy", // Moonlight Lantern
  shoes_0022: "MuQrbnmbdp", // Moonlight Bunny Slippers
  neck_accessory_0056: "cXaPt2zi0Q", // Spirited Manatee Tail
  neck_accessory_0058: "inAM509HYO", // Moonlight Tufted Tail
  head_accessory_0066: "EEFIpR6x7Q", // Moonlight Bunny Accessory
  ear_accessory_0012: "y69WKTTyw7", // Spirited Manatee Ears
  furniture_large_0029: "P09UDA73qQ", // Anniversary Movie Seats
  furniture_small_0021: "bXyztrTj5R", // Manatee Plush
  face_accessory_0028: "IZNxLq33GB", // Anniversary Cinema 3D Glasses
  neck_accessory_0010: "TQUcvFL8k7", // Little Prince Ultimate Pendant
  neck_accessory_0023: "1uyZfKjJg5", // Moomin Ultimate Pendant
  neck_accessory_0035: "IKrJLeNVIL", // Remembrance Ultimate Sash
  neck_accessory_0054: "JIMbTWase4", // Moomintroll Tail
  head_accessory_0005: "cbWKMsAh7H", // Flight Ultimate Hair Accessory
  head_accessory_0011: "nBg1iBLlGM", // Moments Ultimate Hat
  head_accessory_0017: "3gb3myYbBB", // Moomintroll Ears
  head_accessory_0025: "8z8SeKQRk8", // Two Embers Part 1 Ultimate Hair Accessory
  ear_accessory_0002: "FlOSNmw_38", // Enchantment Ultimate Hair Tassels
  prop_0052: "nFWJUG7K6q", // Skyfest Jenova Fan
  prop_0061: "cTvlz4Z8-3", // Company Issued Laptop
  prop_0062: "vPenDMkJkY", // Anniversary Popcorn
  furniture_large_0074: "zRHFsHh3Z8", // Cozy Cafe Table
  neck_accessory_0015: "JCRIpETL35", // AURORA Ultimate Pendant
  neck_accessory_0020: "9uVcch8mbe", // Nine-Colored Deer Ultimate Pendant
  neck_accessory_0038: "Nf94RnTzOh", // Hattifattener Shoulder Buddy
  neck_accessory_0053: "yv8WuDrV-e", // Treasure Mate Companion
  mask_0066: "-66QzAlj3l", // Cure for Me Mask
  mask_0078: "Gn1DSb6m5E", // Spirit of Mural Mask
  mask_0079: "czsVJwqa_g", // Gift of the Nine-Colored Deer Mask
  cape_0068: "1IhlCcq61j", // Shattering Ultimate Krill Cape
  cape_0071: "FjxHIvszIu", // Shattering Ultimate Manta Cape
  cape_0078: "JFV-ZmGQiu", // Giving In Cape
  cape_0095: "BTogmcHcr5", // Radiance of the Nine-Colored Deer Cape
  prop_0032: "5V_r38RVGd", // Triumph Violin
  furniture_small_0036: "EZ_nfEHgOx", // Days of Love Gondola
  cape_0002: "xaX_sfWwKV", // Beta Cape
  cape_0166: "bcKjyS-_p3", // Mischief Gossamer Cape
  cape_0167: "txwX8D1yKh", // Mischief Crabula Cloak
  cape_0190: "VRB1mcOeYv", // FlOw Cape
  prop_0050: "kLfBsnAsUL", // Bloom Lilypad Umbrella
  prop_0051: "IP1yVVhLdv", // Bloom Sunflower Umbrella
  prop_0058: "8rYQfi8VP3", // Mischief Withered Broom
  head_accessory_0040: "KpS-2FdasB", // Rainbow Hair Flower
  head_accessory_0041: "gNWmRUkpFo", // Double Rainbow Flower
  head_accessory_0050: "fLbULqwumS", // Wonderland Primrose Pinafore Bow
  head_accessory_0052: "8aWnwc3_C6", // Fluffy Winter Pillbox Hat
  head_accessory_0054: "HdoyB06O4V", // Tournament Golden Garland
  head_accessory_0072: "2XujEQcN6n", // Green Folded Ears
  head_accessory_0073: "PpIpcfoNDH", // Blue Pinned Cap
  head_accessory_0074: "i9-S4tuhpn", // Yellow Paintbrush
  head_accessory_0077: "1YM9K1fWqF", // Treasure Seeker's Hat
  ear_accessory_0014: "XURacs6BHP", // Moonlight Earrings
};

// A source term can be a useful alias without being the best primary label.
// These names normalize seller-specific shortening back to the established
// player wording observed across the wider Drive corpus.
const reviewedDisplayNameOverrides = {
  head_accessory_0018: "史力奇尖帽",
  ear_accessory_0022: "枯枝角",
  cape_0189: "超凡風旅斗篷",
  cape_0139: "綠芽斗篷",
  cape_0186: "任天堂紅斗",
  cape_0187: "任天堂藍斗",
  furniture_large_0035: "雙人鞦韆",
  furniture_large_0036: "小蹺蹺板",
  furniture_small_0013: "王子小狐狸",
  furniture_small_0021: "小海牛玩偶",
  face_accessory_0028: "週年電影院 3D 眼鏡",
  prop_0061: "公司配發筆電",
  prop_0062: "週年爆米花",
  neck_accessory_0015: "極光季項鍊",
  mask_0066: "Cure for Me 面具",
  cape_0068: "破碎冥龍斗篷",
  cape_0071: "破碎遙鯤斗篷",
  cape_0078: "極光臣服斗篷",
  cape_0095: "九色鹿斗篷",
  furniture_small_0036: "貢多拉船",
  cape_0002: "Beta 斗篷",
  cape_0166: "惡作劇薄紗斗篷",
  cape_0167: "惡作劇蟹伯爵披風",
  cape_0190: "FlOw 斗篷",
  prop_0058: "飛行掃帚",
  cape_0055: "王子圍巾斗",
};

const reviewedSaleNameOverrides = {
  furniture_small_0021: "小海牛玩偶",
  face_accessory_0028: "3D眼鏡",
  prop_0061: "公司筆電",
  prop_0062: "週年爆米花",
  neck_accessory_0015: "極光項鍊",
  mask_0066: "Cure面具",
  cape_0068: "冥龍斗",
  cape_0071: "遙鯤斗",
  cape_0078: "臣服斗",
  cape_0095: "九色鹿斗",
  furniture_small_0036: "貢多拉船",
  cape_0002: "Beta斗",
  cape_0166: "薄紗斗",
  cape_0167: "蟹伯爵斗",
  cape_0190: "FlOw斗",
  prop_0058: "飛行掃帚",
  cape_0189: "超凡風旅斗",
  cape_0186: "紅斗",
  cape_0187: "藍斗",
};

const ignoredNameParts = /(?:季節|畢業禮|畢業|裝扮|服裝|服飾|衣服|衣|長褲|褲子|褲|長裙|裙子|裙|套裝|斗篷|披風|面具|臉部配件|配件|髮型|髮飾|頭飾|耳飾|耳環|耳機|頸飾|項鍊|道具|背飾|大型家具|小型家具|家具|玩偶|公仔)/gu;
const synonymParts = [
  [/躲貓貓拓荒者/gu, "躲貓貓先驅"],
  [/偷窺郵差/gu, "偷看郵差"],
  [/傻笑童子軍/gu, "竊笑童子軍"],
  [/沾沾自喜的自戀者/gu, "得意自戀者"],
  [/引蝶人/gu, "蝴蝶引蝶人"],
  [/踏舞孩童/gu, "舞步孩童"],
  [/拋球雜耍/gu, "劇團雜耍"],
  [/旋轉舞者/gu, "節慶旋轉舞者"],
  [/獻情演員/gu, "崇敬演員"],
  [/火先知/gu, "先知之火焰"],
  [/歐若拉/gu, "極光"],
  [/文雀/gu, "麻雀"],
  [/創始人/gu, "創辦人"],
  [/巫樹犄角/gu, "枯枝角"],
  [/白雪/gu, "雪花"],
  [/情人/gu, "愛之日"],
];

const normalize = (value, stripGeneric = false) => {
  let normalized = String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s\u200b-\u200d\ufeff"'’‘`´.,，。:：;；!?！？·・|｜/\\()[\]{}<>《》〈〉「」『』【】_\-—–~～+＋=＝]/gu, "");
  for (const [pattern, replacement] of synonymParts)
    normalized = normalized.replace(pattern, replacement);
  return stripGeneric ? normalized.replace(ignoredNameParts, "") : normalized;
};

const bigrams = (value) => {
  const chars = Array.from(value);
  if (chars.length < 2) return new Set(chars);
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
};

const dice = (left, right) => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const a = bigrams(left);
  const b = bigrams(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return (2 * shared) / (a.size + b.size);
};

const nameScore = (row, item, zhItemName) => {
  // The transaction term is the value being imported, not identity evidence.
  // Matching it here could attach a shared nickname to the wrong GUID.
  const sourceNames = [row.original];
  // Use a stable source-backed name only. Imported player names and aliases
  // must not influence a later run, otherwise this sync is not idempotent.
  const itemNames = [zhItemName(item)];
  let best = 0;
  let exact = false;
  for (const sourceName of sourceNames) {
    for (const itemName of itemNames) {
      const sourceFull = normalize(sourceName);
      const itemFull = normalize(itemName);
      if (sourceFull && sourceFull === itemFull) {
        exact = true;
        best = 1;
        continue;
      }
      const sourceCore = normalize(sourceName, true);
      const itemCore = normalize(itemName, true);
      best = Math.max(
        best,
        dice(sourceFull, itemFull),
        dice(sourceCore, itemCore),
        sourceCore.length >= 2 && itemCore.includes(sourceCore) ? 0.82 : 0,
        itemCore.length >= 2 && sourceCore.includes(itemCore) ? 0.78 : 0,
      );
    }
  }
  return { score: best, exact };
};

const parseSource = (text) => {
  const rows = [];
  for (const [lineIndex, line] of text.split(/\r?\n/u).entries()) {
    const parts = line.split("｜").map((part) => part.trim());
    if (parts.length !== 5 || !/^[a-z_]+_\d+$/u.test(parts[0])) continue;
    const [id, term, grade, category, original] = parts;
    const prefix = id.replace(/_\d+$/u, "");
    if (!categorySpecs[prefix])
      throw new Error(`第 ${lineIndex + 1} 行使用未知分類：${prefix}`);
    if (!/^[ABC]$/u.test(grade))
      throw new Error(`第 ${lineIndex + 1} 行使用未知信心等級：${grade}`);
    rows.push({ id, prefix, term, grade, category, original, line: lineIndex + 1 });
  }
  const duplicateIds = rows.filter(
    (row, index) => rows.findIndex((candidate) => candidate.id === row.id) !== index,
  );
  if (duplicateIds.length)
    throw new Error(`來源含重複資料 ID：${duplicateIds[0].id}`);
  return rows;
};

const alignCategory = (rows, items, scoreFor) => {
  const rowCount = rows.length;
  const itemCount = items.length;
  const gap = -0.65;
  const matrix = Array.from({ length: rowCount + 1 }, () =>
    new Float64Array(itemCount + 1),
  );
  const steps = Array.from({ length: rowCount + 1 }, () =>
    new Uint8Array(itemCount + 1),
  );
  for (let i = 1; i <= rowCount; i += 1) matrix[i][0] = matrix[i - 1][0] + gap;
  for (let j = 1; j <= itemCount; j += 1) matrix[0][j] = matrix[0][j - 1] + gap;
  for (let i = 1; i <= rowCount; i += 1) {
    for (let j = 1; j <= itemCount; j += 1) {
      const similarity = scoreFor(rows[i - 1], items[j - 1]).score;
      // Both lists are ordered wardrobe snapshots. A small positive baseline
      // keeps their order aligned when two translations share few characters;
      // gaps are still chosen where later name anchors prove an insertion.
      const match = matrix[i - 1][j - 1] + similarity * 3 + 0.2;
      const skipRow = matrix[i - 1][j] + gap;
      const skipItem = matrix[i][j - 1] + gap;
      if (match >= skipRow && match >= skipItem) {
        matrix[i][j] = match;
        steps[i][j] = 1;
      } else if (skipRow >= skipItem) {
        matrix[i][j] = skipRow;
        steps[i][j] = 2;
      } else {
        matrix[i][j] = skipItem;
        steps[i][j] = 3;
      }
    }
  }
  const aligned = [];
  let i = rowCount;
  let j = itemCount;
  while (i > 0 || j > 0) {
    const step = steps[i]?.[j] || (i > 0 ? 2 : 3);
    if (step === 1) {
      const confidence = scoreFor(rows[i - 1], items[j - 1]);
      aligned.push({ row: rows[i - 1], item: items[j - 1], ...confidence });
      i -= 1;
      j -= 1;
    } else if (step === 2) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return aligned.reverse();
};

const unique = (values) => [...new Set(values.filter(Boolean))];
const saleNameAllowed = (row) =>
  row.grade !== "C" &&
  Array.from(row.term).length >= 2 &&
  Array.from(row.term).length <= 6;
const saleNameFor = (row) =>
  reviewedSaleNameOverrides[row.id] ?? (saleNameAllowed(row) ? row.term : undefined);

// Display names may be longer than sale-copy labels, but they must still name
// one concrete catalog item. Bundle/status vocabulary from seller copy stays a
// shared search alias and never replaces the individual item name.
const collectiveDisplayTerm = /(?:套組|組合|耳尾組|三件套|全圖|熱門復刻)/u;
const displayNameFor = (row, termCounts) => {
  // Hair display names have their own evidence-backed snapshot. Keeping one
  // owner prevents this broader transaction source from changing its baseline.
  if (row.prefix === "hair") return undefined;
  if (reviewedDisplayNameOverrides[row.id])
    return reviewedDisplayNameOverrides[row.id];
  const length = Array.from(row.term).length;
  return (
    row.grade !== "C" &&
    length >= 2 &&
    length <= 12 &&
    !collectiveDisplayTerm.test(row.term) &&
    termCounts.get(row.term) === 1
      ? row.term
      : undefined
  );
};

const sourceText = await readFile(resolve(sourcePath), "utf8");
const rows = parseSource(sourceText);
if (rows.length !== 1149)
  throw new Error(`預期 1,149 筆交易用語，實際解析 ${rows.length} 筆`);

const runtime = await loadRuntimeCatalog();
const { compareCatalogItems, matchesSub, wikiItems, zhName } = runtime;
const itemMatchesRowCategory = (row, item) => {
  const spec = categorySpecs[row.prefix];
  if (!spec) return false;
  return spec.sub ? matchesSub(item, spec.sub) : spec.types.includes(item.type);
};
const wikiNames = JSON.parse(await readFile(WIKI_NAMES_PATH, "utf8"));
const stableZhItemName = (item) => wikiNames.items[item.guid] ?? zhName(item.name);
const allAligned = [];
const candidatesByPrefix = new Map();
for (const [prefix, spec] of Object.entries(categorySpecs)) {
  const sourceRows = rows.filter((row) => row.prefix === prefix);
  const candidates = wikiItems
    .filter((item) =>
      spec.sub ? matchesSub(item, spec.sub) : spec.types.includes(item.type),
    )
    .sort((left, right) =>
      compareCatalogItems(left, right, spec.orderMode || "type"),
    );
  candidatesByPrefix.set(prefix, candidates);
  allAligned.push(
    ...alignCategory(sourceRows, candidates, (row, item) =>
      nameScore(row, item, stableZhItemName),
    ),
  );
}

const itemByGuid = new Map(wikiItems.map((item) => [item.guid, item]));
const overrideRows = new Set(Object.keys(reviewedGuidOverrides));
const overrideGuids = new Set(Object.values(reviewedGuidOverrides));
// Exact source-name matches do not depend on list offsets. Resolve them first
// within the declared wardrobe category, then align only the remaining rows.
// This keeps upstream insertions from hiding otherwise unambiguous GUIDs.
const directMatches = [];
for (const row of rows) {
  if (overrideRows.has(row.id)) continue;
  const sourceName = normalize(row.original);
  const candidates = (candidatesByPrefix.get(row.prefix) ?? []).filter(
    (item) => normalize(stableZhItemName(item)) === sourceName,
  );
  if (candidates.length === 1 && !overrideGuids.has(candidates[0].guid))
    directMatches.push({
      row,
      item: candidates[0],
      score: 1,
      exact: true,
      direct: true,
    });
}
const directRows = new Set(directMatches.map(({ row }) => row.id));
const directGuids = new Set(directMatches.map(({ item }) => item.guid));
const anchoredMatches = [];
for (const prefix of Object.keys(categorySpecs)) {
  const sourceRows = rows.filter((row) => row.prefix === prefix);
  const candidates = candidatesByPrefix.get(prefix) ?? [];
  const anchors = directMatches
    .filter(({ row }) => row.prefix === prefix)
    .map((match) => ({
      rowIndex: sourceRows.findIndex((row) => row.id === match.row.id),
      itemIndex: candidates.findIndex((item) => item.guid === match.item.guid),
    }))
    .filter((anchor) => anchor.rowIndex >= 0 && anchor.itemIndex >= 0)
    .sort((left, right) => left.rowIndex - right.rowIndex);
  if (
    anchors.some(
      (anchor, index) =>
        index > 0 && anchor.itemIndex <= anchors[index - 1].itemIndex,
    )
  )
    continue;
  const boundaries = [
    { rowIndex: -1, itemIndex: -1, sentinel: true },
    ...anchors,
    {
      rowIndex: sourceRows.length,
      itemIndex: candidates.length,
      sentinel: true,
    },
  ];
  for (let index = 1; index < boundaries.length; index += 1) {
    const left = boundaries[index - 1];
    const right = boundaries[index];
    const rowCount = right.rowIndex - left.rowIndex - 1;
    const itemCount = right.itemIndex - left.itemIndex - 1;
    const maximumGap = left.sentinel || right.sentinel ? 8 : 16;
    if (!rowCount || rowCount !== itemCount || rowCount > maximumGap) continue;
    for (let offset = 1; offset <= rowCount; offset += 1) {
      const row = sourceRows[left.rowIndex + offset];
      const item = candidates[left.itemIndex + offset];
      if (
        overrideRows.has(row.id) ||
        overrideGuids.has(item.guid) ||
        directRows.has(row.id) ||
        directGuids.has(item.guid)
      )
        continue;
      const similarity = nameScore(row, item, stableZhItemName).score;
      anchoredMatches.push({
        row,
        item,
        // Ordering confirms the position, but a minimum lexical relationship
        // is still required so a missing item cannot shift a whole segment.
        score: Math.min(0.85, similarity + 0.2),
        exact: false,
        ordered: true,
      });
    }
  }
}
const anchoredRows = new Set(anchoredMatches.map(({ row }) => row.id));
const anchoredGuids = new Set(anchoredMatches.map(({ item }) => item.guid));
const inferredAligned = allAligned.filter(
  ({ row, item }) =>
    !overrideRows.has(row.id) &&
    !overrideGuids.has(item.guid) &&
    !directRows.has(row.id) &&
    !directGuids.has(item.guid) &&
    !anchoredRows.has(row.id) &&
    !anchoredGuids.has(item.guid),
);
inferredAligned.push(...directMatches, ...anchoredMatches);
for (const [id, guid] of Object.entries(reviewedGuidOverrides)) {
  const row = rows.find((candidate) => candidate.id === id);
  const item = itemByGuid.get(guid);
  if (!row || !item) throw new Error(`人工核對表失效：${id} → ${guid}`);
  inferredAligned.push({ row, item, score: 1, exact: true, reviewed: true });
}

const accepted = inferredAligned.filter(({ score, exact }) => exact || score >= 0.58);
const acceptedDisplayTermCounts = new Map();
for (const { row } of accepted) {
  if (row.grade === "C") continue;
  acceptedDisplayTermCounts.set(
    row.term,
    (acceptedDisplayTermCounts.get(row.term) || 0) + 1,
  );
}
const acceptedIds = new Set(accepted.map(({ row }) => row.id));
const unresolvedRows = rows.filter((row) => !acceptedIds.has(row.id));
const resolver = runtime.buildCatalogNameResolver(
  wikiItems,
  runtime.zhItemSearchNames,
);
const searchableUnresolved = unresolvedRows.flatMap((row) => {
  // China-only labels may intentionally reuse the international item name.
  // They are evidence for a different catalog and must not resolve here.
  if (/(?:中国|中國|国服|國服)/u.test(row.original)) return [];
  let match;
  for (const term of unique([row.original, row.term])) {
    const candidate = resolver.resolve(term);
    if (
      candidate?.candidates.length === 1 &&
      candidate.method === "exact" &&
      candidate.candidates.every((item) => itemMatchesRowCategory(row, item))
    ) {
      match = candidate;
      break;
    }
  }
  if (!match) return [];
  const items = match.candidates;
  return [{
    row,
    items,
    mode: "item",
    valuationRelevant: items.some(
      (item) =>
        runtime.isPaidItem(item) ||
        runtime.isGraduationGift(item) ||
        runtime.isLimitedItem(item),
    ),
  }];
});
const searchableUnresolvedIds = new Set(
  searchableUnresolved.map(({ row }) => row.id),
);
const valuationRelevantSearchableGuids = new Set(
  searchableUnresolved
    .filter(({ valuationRelevant }) => valuationRelevant)
    .flatMap(({ items }) => items.map((item) => item.guid)),
);
const acceptedGuids = new Set();
const duplicateGuidMatches = [];
for (const match of accepted) {
  if (acceptedGuids.has(match.item.guid)) duplicateGuidMatches.push(match);
  acceptedGuids.add(match.item.guid);
}
if (duplicateGuidMatches.length)
  throw new Error(`多筆來源錯配至同一 GUID：${duplicateGuidMatches[0].item.guid}`);

const report = {
  source: {
    file: resolve(sourcePath),
    version: "2026-09-01",
    rows: rows.length,
    grades: Object.fromEntries(
      ["A", "B", "C"].map((grade) => [grade, rows.filter((row) => row.grade === grade).length]),
    ),
  },
  catalog: { items: wikiItems.length },
  result: {
    aligned: inferredAligned.length,
    accepted: accepted.length,
    displayNames: accepted.filter(({ row }) => displayNameFor(row, acceptedDisplayTermCounts))
      .length,
    saleNames: accepted.filter(({ row }) => saleNameFor(row)).length,
    unresolved: rows.length - accepted.length,
    alreadySearchable: searchableUnresolved.length,
    researchRequired: unresolvedRows.length - searchableUnresolved.length,
    valuationRelevantAlreadySearchableGuids:
      valuationRelevantSearchableGuids.size,
  },
  accepted: accepted.map(({ row, item, score, exact, reviewed = false }) => ({
    id: row.id,
    guid: item.guid,
    grade: row.grade,
    term: row.term,
    original: row.original,
    current: stableZhItemName(item),
    score: Number(score.toFixed(3)),
    exact,
    reviewed,
    displayName: displayNameFor(row, acceptedDisplayTermCounts),
    writesDisplayName: Boolean(displayNameFor(row, acceptedDisplayTermCounts)),
    saleName: saleNameFor(row),
    writesSaleName: Boolean(saleNameFor(row)),
  })),
  unresolved: unresolvedRows.map((row) => {
    const searchable = searchableUnresolved.find(
      (candidate) => candidate.row.id === row.id,
    );
    return {
      id: row.id,
      grade: row.grade,
      term: row.term,
      original: row.original,
      category: row.category,
      ...(searchable
        ? {
            status: "already-searchable",
            resolution: searchable.mode,
            guids: searchable.items.map((item) => item.guid),
            current: searchable.items.map(stableZhItemName),
            valuationRelevant: searchable.valuationRelevant,
          }
        : { status: "research-required" }),
    };
  }),
  researchRequired: unresolvedRows
    .filter((row) => !searchableUnresolvedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      grade: row.grade,
      term: row.term,
      original: row.original,
      category: row.category,
    })),
};

await mkdir(resolve(ROOT, "dist/tmp"), { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (shouldWrite) {
  const snapshot = JSON.parse(await readFile(PLAYER_NAMES_PATH, "utf8"));
  for (const [guid, current] of Object.entries(snapshot.items)) {
    if (typeof current === "string") continue;
    if (Array.isArray(current.aliases)) {
      current.aliases = unique(current.aliases).filter(
        (alias) => alias !== current.displayName,
      );
      if (!current.aliases.length) delete current.aliases;
    }
    if (itemByGuid.get(guid)?.type !== "Hair") continue;
    // player-hair-names.json is the canonical owner of Hair display names;
    // sale names and search aliases remain in this general player dictionary.
    delete current.displayName;
  }
  for (const { row, item } of accepted) {
    const current = snapshot.items[item.guid];
    const entry = typeof current === "string" ? { displayName: current } : { ...(current || {}) };
    // Existing GUID-reviewed display names outrank bulk sources. Promote a
    // transaction term only when the item has no explicit display override and
    // the term is unique, concrete and supported by an A/B-grade source row.
    const preferredDisplayName = displayNameFor(row, acceptedDisplayTermCounts);
    const previousDisplayName = entry.displayName;
    const previousSaleName = entry.saleName;
    if (reviewedDisplayNameOverrides[row.id] && preferredDisplayName)
      entry.displayName = preferredDisplayName;
    else if (!entry.displayName && preferredDisplayName)
      entry.displayName = preferredDisplayName;
    const aliases = unique([
      ...(entry.aliases || []),
      previousDisplayName !== entry.displayName ? previousDisplayName : undefined,
      reviewedSaleNameOverrides[row.id] && previousSaleName !== saleNameFor(row)
        ? previousSaleName
        : undefined,
      row.original,
      row.term,
    ]).filter((alias) => alias !== entry.displayName);
    // A previously reviewed GUID-specific short name has higher priority than
    // a newer bulk source. Keep it and add the new wording as a search alias.
    const preferredSaleName = saleNameFor(row);
    if (reviewedSaleNameOverrides[row.id] && preferredSaleName)
      entry.saleName = preferredSaleName;
    else if (preferredSaleName && !entry.saleName)
      entry.saleName = preferredSaleName;
    if (aliases.length) entry.aliases = aliases;
    snapshot.items[item.guid] = entry;
  }
  snapshot.description =
    "台灣玩家容易理解的顯示短名、出售短名與搜尋別名。以 SkyGame-Data GUID 為鍵；Wiki 名稱仍保留在 wiki-zh-names.json。玩家用語參考 2026-08-31 Google Drive 116 份出售文案，以及 2026-09-01 全物件交易用語重查清單；作者個人寫法會正規化，且只寫入唯一、高信心的單件對應。";
  await writeFile(PLAYER_NAMES_PATH, serializeNameSnapshot(snapshot), "utf8");
}

console.log(
  [
    `來源：${rows.length} 筆（A ${report.source.grades.A}／B ${report.source.grades.B}／C ${report.source.grades.C}）`,
    `目錄：${wikiItems.length} 件`,
    `高信心 GUID 對應：${report.result.accepted} 筆`,
    `可寫入玩家顯示名：${report.result.displayNames} 筆`,
    `可寫入出售短名：${report.result.saleNames} 筆`,
    `保留待查：${report.result.unresolved} 筆`,
    `目前別名已可唯一辨識：${report.result.alreadySearchable} 筆`,
    `仍需外部核對：${report.result.researchRequired} 筆`,
    `報告：${REPORT_PATH}`,
    shouldWrite ? `已更新：${PLAYER_NAMES_PATH}` : "檢查模式：未修改名稱快照",
  ].join("\n"),
);
