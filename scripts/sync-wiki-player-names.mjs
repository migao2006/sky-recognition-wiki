#!/usr/bin/env node
/**
 * Promote only exact global Wiki icon labels into player-name snapshots.
 * Existing reviewed names always win. BWiki evidence is deliberately ignored
 * because it cannot establish an international-server player name.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as OpenCC from "opencc-js";
import { tsImport } from "tsx/esm/api";
import { serializeNameSnapshot } from "./lib/name-snapshot-serializer.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const VERIFICATION_PATH = resolve(
  ROOT,
  "work",
  "wiki-market-evidence",
  "verification.json",
);
const PLAYER_NAMES_PATH = resolve(ROOT, "app", "player-zh-names.json");
const REVIEWED_IAP_PATH = resolve(
  ROOT,
  "app",
  "reviewed-iap-player-names.json",
);
const IAP_PATH = resolve(ROOT, "app", "iap-catalog.json");
const REPORT_PATH = resolve(ROOT, "dist", "tmp", "wiki-player-name-sync.json");
const shouldWrite = process.argv.includes("--write");
const toTaiwan = OpenCC.Converter({ from: "cn", to: "tw" });

const [verification, playerNames, reviewedIap, iapCatalog] = await Promise.all([
  readFile(VERIFICATION_PATH, "utf8").then(JSON.parse),
  readFile(PLAYER_NAMES_PATH, "utf8").then(JSON.parse),
  readFile(REVIEWED_IAP_PATH, "utf8").then(JSON.parse),
  readFile(IAP_PATH, "utf8").then(JSON.parse),
]);
const iapByGuid = new Map(iapCatalog.items.map((item) => [item.guid, item]));
const { marketCollectibleProfile } = await tsImport(
  "../app/market-collectibles.ts",
  import.meta.url,
);
const protectedReviewedIapGuids = new Set([
  "-ZIWymGtlX",
  "6Kn8VMa4go",
  "8aWnwc3_C6",
  "aoUa2jtXfL",
  "e8qFeoyXxK",
  "EMG3a7883l",
  "EocwmiV_Vf",
  "fLbULqwumS",
  "gHfkqCK-A8",
  "rA-RHusWvS",
  "svUBdDQ945",
  "tSAl1nV-qo",
  "VRB1mcOeYv",
  "yv8WuDrV-e",
]);
const unique = (values) => [...new Set(values.filter(Boolean))];
const cleanTerm = (value) =>
  toTaiwan(String(value ?? ""))
    .normalize("NFKC")
    .replace(/\s*圖標$/u, "")
    .replace(/[《》〈〉]/gu, "")
    .replace(/[\s\u200b-\u200d\ufeff]+/gu, "")
    .trim();
const genericTerm =
  /^(?:髮型|髮飾|頭飾|耳飾|面飾|面具|頸飾|項鍊|斗篷|披風|服裝|服飾|褲子|鞋子|道具|大型道具|小型道具|大型傢俱|小型傢俱)$/u;
const itemWordByType = new Map([
  ["Hair", /髮|頭|辮|馬尾|髻|造型/u],
  ["HairAccessory", /髮飾|頭飾|帽|角|耳|花|冠|蝴蝶結|佩飾/u],
  ["HeadAccessory", /髮飾|頭飾|帽|角|耳|環|耳機|花|冠|眼鏡|佩飾/u],
  ["FaceAccessory", /面具|面飾|眼鏡|單片鏡|彩繪/u],
  ["Mask", /面具|面飾|眼鏡|彩繪/u],
  ["Necklace", /項鍊|頸飾|領巾|圍巾|耳飾|耳環|吊墜|領結/u],
  ["Cape", /斗篷|披風|斗$/u],
  ["Outfit", /服|衣|褲|裙|袍|套裝|圍裙/u],
  ["OutfitShoes", /服|衣|褲|裙|袍|套裝|鞋|靴/u],
  ["Shoes", /鞋|靴|拖鞋|涼鞋|腿套/u],
  ["Instrument", /琴|鼓|笛|號角|樂器|手碟/u],
  ["LargeProp", /道具|傢俱|桌|椅|沙發|浴缸|櫃|床|燈|盆|架|玩偶|地毯|鞦韆|蹺蹺板/u],
  ["SmallProp", /道具|傢俱|傘|扇|燈|玩偶|夥伴|佩飾|盆|罐|花|狐狸|海龜/u],
]);
const qualifies = (term, type) => {
  const length = Array.from(term).length;
  if (length < 2 || length > 14 || genericTerm.test(term) || /季$/u.test(term))
    return false;
  const typeWords = itemWordByType.get(type);
  return Boolean(typeWords?.test(term));
};

const evidenceRows = verification.matches
  .filter(
    (match) =>
      match.status === "verified-global-icon" &&
      match.region === "global" &&
      match.candidates?.length === 1,
  )
  .flatMap((match) =>
    (match.sourceTerms ?? []).map((sourceTerm) => ({
      guid: match.candidates[0].guid,
      type: match.candidates[0].type,
      currentName: match.candidates[0].zhName,
      term: cleanTerm(sourceTerm),
      pageTitle: match.pageTitle,
      pageUrl: match.pageUrl,
      revisionId: match.revisionId,
    })),
  )
  .filter((row) => qualifies(row.term, row.type));
const guidsByTerm = new Map();
for (const row of evidenceRows) {
  const guids = guidsByTerm.get(row.term) ?? new Set();
  guids.add(row.guid);
  guidsByTerm.set(row.term, guids);
}
const uniqueRows = evidenceRows.filter(
  (row) => guidsByTerm.get(row.term)?.size === 1,
);
const rowsByGuid = new Map();
for (const row of uniqueRows) {
  const rows = rowsByGuid.get(row.guid) ?? [];
  rows.push(row);
  rowsByGuid.set(row.guid, rows);
}

const planned = [];
for (const [guid, rows] of rowsByGuid) {
  const termCounts = new Map();
  for (const row of rows)
    termCounts.set(row.term, (termCounts.get(row.term) ?? 0) + 1);
  const terms = [...termCounts]
    .sort(
      ([left, leftCount], [right, rightCount]) =>
        rightCount - leftCount ||
        Array.from(left).length - Array.from(right).length ||
        left.localeCompare(right, "zh-Hant"),
    )
    .map(([term]) => term);
  const preferred = terms[0];
  const currentPlayer = playerNames.items[guid];
  const currentEntry =
    typeof currentPlayer === "string"
      ? { displayName: currentPlayer }
      : { ...(currentPlayer ?? {}) };
  const iap = iapByGuid.get(guid);
  const reviewed = reviewedIap.items[guid];
  planned.push({
    guid,
    type: rows[0].type,
    currentName: rows[0].currentName,
    preferred,
    aliases: terms,
    evidence: unique(
      rows.map(
        (row) => `${row.pageTitle}#${row.revisionId ?? "unknown"} ${row.pageUrl}`,
      ),
    ),
    fillsDisplayName: false,
    addsPlayerAliases: terms.filter(
      (term) =>
        term !== currentEntry.displayName &&
        !(currentEntry.aliases ?? []).includes(term),
    ),
    isIap: Boolean(iap),
    addsReviewedIap: Boolean(iap && !reviewed),
  });
}
planned.sort((left, right) => left.guid.localeCompare(right.guid));
const wikiPlanByGuid = new Map(planned.map((row) => [row.guid, row]));
const reviewedIapPlans = [];
const curatedGeneratedGuids = new Set();
for (const iap of iapCatalog.items) {
  if (protectedReviewedIapGuids.has(iap.guid)) continue;
  if (marketCollectibleProfile(iap.name, iap.guid)?.curated) {
    curatedGeneratedGuids.add(iap.guid);
    continue;
  }
  const current = playerNames.items[iap.guid];
  const playerEntry =
    typeof current === "string" ? { displayName: current } : current;
  const playerTerm = playerEntry?.displayName;
  if (!playerTerm) continue;
  const wikiPlan = wikiPlanByGuid.get(iap.guid);
  const aliases = unique([
    ...(playerEntry?.aliases ?? []),
    ...(wikiPlan?.aliases ?? []),
    iap.playerName !== playerTerm ? iap.playerName : undefined,
  ]).filter((alias) => alias !== playerTerm);
  const existing = reviewedIap.items[iap.guid];
  if (
    existing?.playerName === playerTerm &&
    JSON.stringify(existing.aliases ?? []) === JSON.stringify(aliases)
  )
    continue;
  reviewedIapPlans.push({
    guid: iap.guid,
    preferred: playerTerm,
    aliases,
    source: "taiwan-player-corpus",
    existing: Boolean(existing),
  });
}

const report = {
  source: {
    verification: VERIFICATION_PATH,
    generatedAt: verification.generatedAt,
    policy:
      "Only exact global icon labels with a type-specific item word and one-to-one term/GUID identity are eligible.",
  },
  totals: {
    exactLabelRows: evidenceRows.length,
    uniqueGuidTerms: uniqueRows.length,
    guids: planned.length,
    displayNamesFilled: planned.filter((row) => row.fillsDisplayName).length,
    playerAliasesAdded: planned.reduce(
      (sum, row) => sum + row.addsPlayerAliases.length,
      0,
    ),
    reviewedIapNamesAdded: reviewedIapPlans.filter((row) => !row.existing).length,
    reviewedIapNamesUpdated: reviewedIapPlans.filter((row) => row.existing).length,
  },
  planned,
  reviewedIapPlans,
};
await mkdir(resolve(ROOT, "dist", "tmp"), { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (shouldWrite) {
  for (const row of planned) {
    const current = playerNames.items[row.guid];
    const entry =
      typeof current === "string" ? { displayName: current } : { ...(current ?? {}) };
    const aliases = unique([
      ...(entry.aliases ?? []),
      ...row.aliases,
    ]).filter((alias) => alias !== entry.displayName);
    if (aliases.length) entry.aliases = aliases;
    playerNames.items[row.guid] = entry;

  }
  for (const row of reviewedIapPlans)
    reviewedIap.items[row.guid] = {
      playerName: row.preferred,
      aliases: row.aliases,
    };
  for (const guid of curatedGeneratedGuids) delete reviewedIap.items[guid];
  playerNames.description =
    "台灣玩家容易理解的顯示短名、出售短名與搜尋別名。以 SkyGame-Data GUID 為鍵；Wiki 名稱仍保留在 wiki-zh-names.json。玩家用語參考 2026-08-31 Google Drive 116 份出售文案、2026-09-01 全物件交易用語重查清單，以及以官方 icon 精確核對的國際服中文 Wiki 圖片標籤；國服名稱不會自動寫入。";
  await Promise.all([
    writeFile(PLAYER_NAMES_PATH, serializeNameSnapshot(playerNames), "utf8"),
    writeFile(REVIEWED_IAP_PATH, serializeNameSnapshot(reviewedIap), "utf8"),
  ]);
}

process.stdout.write(
  `${JSON.stringify({ report: REPORT_PATH, ...report.totals, wrote: shouldWrite }, null, 2)}\n`,
);
