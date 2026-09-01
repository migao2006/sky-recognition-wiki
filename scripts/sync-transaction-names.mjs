import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PLAYER_NAMES_PATH = resolve(ROOT, "app/player-zh-names.json");
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
  head_accessory_0084: "jM8xKFwbTE", // Moth Antennae
  ear_accessory_0001: "bBQbGQh1PU", // Hairtousle Teen Earmuffs
  ear_accessory_0010: "v5NKOAkwza", // Royal Hairtousle Teen Head Accessory
  cape_0004: "DI0RLfo9Sj", // Founder's Cape
  cape_0031: "WCPTi8XYZy", // Wise Grandparent Cape
  cape_0033: "Bm0aFDGHk2", // Thoughtful Director Cape
  cape_0076: "EQYKoHE95s", // Wings of AURORA
  cape_0107: "mwv4iZI57S", // Divining Wise Grandparent Cape
  cape_0183: "bu7qgPtuB2", // Moth Cape
  prop_0024: "K0NBv__mv8", // Voice of AURORA
  furniture_small_0025: "5xJ_mCzZQy", // Moonlight Lantern
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
  // Use the stable rendered name only. Imported aliases must not influence a
  // later run, otherwise the same source could produce a different GUID map.
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
const compactEntry = (entry) => {
  const json = JSON.stringify(entry).replaceAll(":", ": ").replaceAll(",", ", ");
  return `{ ${json.slice(1, -1)} }`;
};
const serializeSnapshot = (snapshot) => {
  const entries = Object.entries(snapshot.items);
  const itemLines = entries.map(
    ([guid, entry], index) =>
      `    ${JSON.stringify(guid)}: ${compactEntry(entry)}${index + 1 < entries.length ? "," : ""}`,
  );
  return [
    "{",
    `  \"description\": ${JSON.stringify(snapshot.description)},`,
    '  "items": {',
    ...itemLines,
    "  }",
    "}",
    "",
  ].join("\n");
};
const saleNameAllowed = (row) =>
  row.grade !== "C" &&
  Array.from(row.term).length >= 2 &&
  Array.from(row.term).length <= 6;

const sourceText = await readFile(resolve(sourcePath), "utf8");
const rows = parseSource(sourceText);
if (rows.length !== 1149)
  throw new Error(`預期 1,149 筆交易用語，實際解析 ${rows.length} 筆`);

const runtime = await loadRuntimeCatalog();
const { compareCatalogItems, matchesSub, wikiItems, zhItemName } = runtime;
const allAligned = [];
for (const [prefix, spec] of Object.entries(categorySpecs)) {
  const sourceRows = rows.filter((row) => row.prefix === prefix);
  const candidates = wikiItems
    .filter((item) =>
      spec.sub ? matchesSub(item, spec.sub) : spec.types.includes(item.type),
    )
    .sort((left, right) =>
      compareCatalogItems(left, right, spec.orderMode || "type"),
    );
  allAligned.push(
    ...alignCategory(sourceRows, candidates, (row, item) =>
      nameScore(row, item, zhItemName),
    ),
  );
}

const itemByGuid = new Map(wikiItems.map((item) => [item.guid, item]));
const overrideRows = new Set(Object.keys(reviewedGuidOverrides));
const overrideGuids = new Set(Object.values(reviewedGuidOverrides));
const inferredAligned = allAligned.filter(
  ({ row, item }) => !overrideRows.has(row.id) && !overrideGuids.has(item.guid),
);
for (const [id, guid] of Object.entries(reviewedGuidOverrides)) {
  const row = rows.find((candidate) => candidate.id === id);
  const item = itemByGuid.get(guid);
  if (!row || !item) throw new Error(`人工核對表失效：${id} → ${guid}`);
  inferredAligned.push({ row, item, score: 1, exact: true, reviewed: true });
}

const accepted = inferredAligned.filter(({ score, exact }) => exact || score >= 0.58);
const acceptedIds = new Set(accepted.map(({ row }) => row.id));
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
    saleNames: accepted.filter(({ row }) => saleNameAllowed(row)).length,
    unresolved: rows.length - accepted.length,
  },
  accepted: accepted.map(({ row, item, score, exact, reviewed = false }) => ({
    id: row.id,
    guid: item.guid,
    grade: row.grade,
    term: row.term,
    original: row.original,
    current: zhItemName(item),
    score: Number(score.toFixed(3)),
    exact,
    reviewed,
    writesSaleName: saleNameAllowed(row),
  })),
  unresolved: rows
    .filter((row) => !acceptedIds.has(row.id))
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
  for (const { row, item } of accepted) {
    const current = snapshot.items[item.guid];
    const entry = typeof current === "string" ? { displayName: current } : { ...(current || {}) };
    const aliases = unique([
      ...(entry.aliases || []),
      row.original,
      row.term,
    ]).filter((alias) => alias !== entry.displayName);
    // A previously reviewed GUID-specific short name has higher priority than
    // a newer bulk source. Keep it and add the new wording as a search alias.
    if (saleNameAllowed(row) && !entry.saleName) entry.saleName = row.term;
    if (aliases.length) entry.aliases = aliases;
    snapshot.items[item.guid] = entry;
  }
  snapshot.description =
    "台灣玩家容易理解的顯示短名、出售短名與搜尋別名。以 SkyGame-Data GUID 為鍵；Wiki 名稱仍保留在 wiki-zh-names.json。玩家用語參考 2026-08-31 Google Drive 26 份出售文案，以及 2026-09-01 全物件交易用語重查清單；只寫入唯一且高信心對應。";
  await writeFile(PLAYER_NAMES_PATH, serializeSnapshot(snapshot), "utf8");
}

console.log(
  [
    `來源：${rows.length} 筆（A ${report.source.grades.A}／B ${report.source.grades.B}／C ${report.source.grades.C}）`,
    `目錄：${wikiItems.length} 件`,
    `高信心 GUID 對應：${report.result.accepted} 筆`,
    `可寫入出售短名：${report.result.saleNames} 筆`,
    `保留待查：${report.result.unresolved} 筆`,
    `報告：${REPORT_PATH}`,
    shouldWrite ? `已更新：${PLAYER_NAMES_PATH}` : "檢查模式：未修改名稱快照",
  ].join("\n"),
);
