import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";
import { marketCollectiblesModuleUrl } from "./helpers/market-collectibles.mjs";

const [source, configSource] = await Promise.all(
  ["sale-copy.ts", "account-config.ts"].map((file) =>
    readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
  ),
);
const marketUrl = await marketCollectiblesModuleUrl();
const marketModule = await import(marketUrl);
const marketGuidByName = new Map(
  marketModule.importantMarketCollectibles.flatMap((profile) =>
    [profile.name, ...profile.aliases].map((name) => [name, profile.guid]),
  ),
);
const moduleUrl = asModuleUrl(
  source
    .replace(
      /import \{([\s\S]*?)\} from "\.\/account-config";/,
      (_, names) =>
        `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(configSource))});`,
    )
    .replace(
      'import { marketCollectibleProfile } from "./market-collectibles";',
      `const { marketCollectibleProfile } = await import(${JSON.stringify(marketUrl)});`,
    ),
);
const { buildSaleCopy } = await import(moduleUrl);

const season = (slug, name, owned = 0, total = 3) => ({
  slug,
  name,
  owned,
  total,
});
const item = (overrides = {}) => {
  const value = {
    guid: "test-item",
    name: "Test Item",
    displayName: "測試物品",
    section: "store",
    collection: "store",
    group: "",
    wiki: "https://example.com/item",
    sourceName: "常駐商店",
    order: 1,
    ...overrides,
    guid: marketGuidByName.get(overrides.name) ?? overrides.guid ?? "test-item",
  };
  return {
    ...value,
    saleName:
      overrides.saleName ??
      marketModule.marketCollectibleProfile(value.name, value.guid)?.playerName ??
      value.displayName,
  };
};
const input = (overrides = {}) => ({
  seasons: [
    season("lightseekers", "追光季", 0, 2),
    season("moments", "拾光季", 2, 3),
    season("revival", "歸巢季", 0, 2),
    season("nine-colored-deer", "九色鹿季", 3, 3),
    season("nesting", "築巢季", 1, 2),
    season("duets", "協奏季", 1, 3),
    season("moomin", "姆明季", 0, 3),
    season("radiance", "染色季", 2, 2),
    season("blue-bird", "青鳥季", 2, 2),
  ],
  bindingsConfirmed: true,
  bindings: { google: "transfer", nintendo: "keep", steam: "issue" },
  items: [],
  ...overrides,
});

test("formats continuous graduation progress from the first owned season", () => {
  const copy = buildSaleCopy(input()).join("\n");
  assert.match(copy, /^✦ 季節進度$/m);
  assert.equal(copy.includes("追光"), false);
  for (const expected of [
    "拾光⅔",
    "歸巢⁰",
    "九色鹿畢",
    "築巢½",
    "協奏⅓",
    "姆明⁰",
    "染色畢",
    "青鳥畢",
  ]) {
    assert.match(copy, new RegExp(expected));
  }
  assert.ok(copy.indexOf("拾光⅔") < copy.indexOf("歸巢⁰"));
  assert.ok(copy.indexOf("歸巢⁰") < copy.indexOf("九色鹿畢"));
  const progressLines = copy.split("\n").slice(1, 4);
  assert.equal(progressLines[0], "拾光⅔｜歸巢⁰｜九色鹿畢｜築巢½");
  assert.equal(progressLines[1], "協奏⅓｜姆明⁰｜染色畢｜青鳥畢");
  assert.doesNotMatch(copy, /拾光\s+⅔|九色鹿季|畢業/);
  assert.match(copy, /✦ 綁定狀態\nGG 出｜NS 不出｜Steam 遺失／異常/);
});

test("adds an automatic market title and the entered resource quantities", () => {
  const copy = buildSaleCopy(
    input({
      summary: {
        seasonName: "拾光季",
        breakLabel: "微斷",
        packageLabel: "多禮",
      },
      resources: {
        candles: "1200",
        hearts: "300",
        ascended: "50",
        passes: "2",
      },
    }),
  ).join("\n");
  assert.match(copy, /^✦ 拾光微斷多禮號\n\n✦ 季節進度/);
  assert.match(
    copy,
    /✦ 資源數量\n白蠟 1,200｜愛心 300｜昇華蠟 50｜副卡 2/,
  );
});

test("omits empty resources and never invents a break class without a season", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [],
      summary: {
        seasonName: "畢業未明",
        breakLabel: "",
        packageLabel: "少禮",
      },
      resources: { candles: "0", hearts: "", ascended: "abc", passes: -1 },
    }),
  ).join("\n");
  assert.match(copy, /^✦ 畢業未明少禮號/);
  assert.doesNotMatch(copy, /資源數量|大斷/);
});

test("uses compact Unicode fractions and falls back when Unicode has no fraction", () => {
  const copy = buildSaleCopy(
    input({
      bindingsConfirmed: false,
      seasons: [
        season("one-half", "二分季", 1, 2),
        season("one-third", "三分季", 1, 3),
        season("two-thirds", "三分二季", 2, 3),
        season("one-fourth", "四分季", 1, 4),
        season("three-fourths", "四分三季", 3, 4),
        season("unsupported", "十一分季", 2, 11),
      ],
    }),
  ).join("\n");
  assert.match(copy, /二分½｜三分⅓｜三分二⅔｜四分¼/);
  assert.match(copy, /四分三¾｜十一分2\/11/);
});

test("groups collaborations, anniversaries, and special collections", () => {
  const items = [
    item({
      guid: "deer-antlers",
      name: "Gift of the Nine-Colored Deer Antlers",
      displayName: "禮物之九色鹿鹿角",
      section: "seasons",
      collection: "nine-colored-deer",
      group: "Limited",
      sourceName: "九色鹿季",
    }),
    item({
      guid: "deer-mask",
      name: "Gift of the Nine-Colored Deer Mask",
      displayName: "禮物之九色鹿面具",
      section: "seasons",
      collection: "nine-colored-deer",
      group: "Limited",
      sourceName: "九色鹿季",
      order: 2,
    }),
    item({
      guid: "nintendo-hair",
      name: "Nintendo Elf Hair",
      displayName: "Nintendo 精靈髮型",
      collection: "store",
      wiki: "https://example.com/Nintendo_Pack",
      sourceName: "Nintendo Switch 專屬",
      order: 3,
    }),
    item({
      guid: "healing-poppy",
      name: "Days of Healing Poppy",
      displayName: "療癒罌粟花",
      section: "events",
      collection: "days-of-healing",
      group: "Limited",
      sourceName: "療癒日",
      order: 4,
    }),
    item({
      guid: "skyfest-wireframe",
      name: "Skyfest Wireframe Cape",
      displayName: "天空慶典線框斗篷",
      saleName: "天空慶典線框斗篷",
      section: "events",
      collection: "event-sky-anniversary",
      group: "Limited",
      sourceName: "光遇週年慶",
      order: 5,
    }),
    item({
      guid: "sixth-hat",
      name: "6th Anniversary Hat",
      displayName: "6週年帽",
      section: "events",
      collection: "event-sky-anniversary",
      wiki: "https://example.com/wiki/Sky_Anniversary/2025#Hat",
      sourceName: "光遇週年慶",
      order: 4,
    }),
    item({
      guid: "fifth-shirt",
      name: "Anniversary T-Shirt",
      displayName: "週年T恤",
      section: "events",
      collection: "event-sky-anniversary",
      wiki: "https://example.com/wiki/Sky_Anniversary/2024#Shirt",
      sourceName: "光遇週年慶",
      order: 5,
    }),
    item({
      guid: "unknown-anniversary",
      name: "Anniversary Teacup Headband",
      displayName: "茶杯頭飾",
      section: "events",
      collection: "event-sky-anniversary",
      wiki: "https://example.com/wiki/Sky_Anniversary#Teacup",
      sourceName: "光遇週年慶",
      order: 6,
    }),
    item({
      guid: "witch-hair",
      name: "Mischief Witch Hair",
      displayName: "女巫髮型",
      section: "events",
      collection: "days-of-mischief",
      sourceName: "惡作劇之日",
      order: 7,
    }),
    item({
      guid: "piano",
      name: "Fledgling Upright Piano",
      displayName: "新手鋼琴",
      sourceName: "常駐商店",
      order: 8,
    }),
    item({
      guid: "china-clover",
      name: "Spring Clover Sprout",
      displayName: "春日幸運草嫩芽",
      group: "Limited",
      sourceName: "國服限定",
      order: 9,
    }),
    item({
      guid: "duplicate-hair",
      name: "Duplicate Hair",
      displayName: "精靈髮型",
      sourceName: "常駐商店",
      order: 10,
    }),
  ];
  const copy = buildSaleCopy(input({ items: [...items, items[0]] })).join("\n");
  assert.match(copy, /✦ 限定聯動\n九色鹿｜九色鹿頭角・九色鹿面具\nNintendo｜林克髮型/);
  assert.match(copy, /✦ 重要禮包\n治癒小白花/);
  assert.match(copy, /✦ 週年收藏\n6th｜週年帽\n5th｜週年T恤\n其他｜天空慶典線框斗篷・茶杯頭飾/);
  assert.match(copy, /✦ 特殊限定\n巫師髮型・直立鋼琴/);
  assert.doesNotMatch(copy, /(?:Days of|Pack|Fledgling Upright Piano)/);
  assert.match(copy, /巫師髮型/);
  assert.doesNotMatch(copy, /春日幸運草嫩芽/);
  assert.doesNotMatch(copy, /惡作劇之日｜|國服限定｜/);
  assert.doesNotMatch(copy, /✦ 其他收藏\n直立鋼琴/);
  assert.doesNotMatch(copy, /常駐商店｜/);
  assert.equal(copy.match(/九色鹿頭角/g)?.length, 1);
  assert.equal(copy.match(/林克髮型/g)?.length, 1);
  assert.equal(copy.match(/╶────── ✦ ──────╴/g)?.length, 5);
});

test("keeps a paid package together without publishing an event or English package heading", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [],
      items: [
        item({ guid: "cat-cape", name: "Cat Cape", displayName: "貓咪斗篷" }),
        item({ guid: "cat-mask", name: "Cat Mask", displayName: "貓咪面具", order: 2 }),
      ],
    }),
  ).join("\n");
  assert.match(copy, /✦ 重要禮包\n貓咪斗篷・貓咪面具/);
  assert.doesNotMatch(copy, /Days of|Cat Costume Pack|惡作劇之日｜/);
});

test("uses player names and keeps every selected item in only one section", () => {
  const copy = buildSaleCopy(
    input({
      items: [
        item({
          guid: "runaway-hair",
          name: "AURORA Runaway Hair",
          displayName: "AURORA 逃跑髮型",
          section: "seasons",
          collection: "aurora",
          group: "Limited",
          sourceName: "AURORA 季",
        }),
        item({
          guid: "bat-cape",
          name: "Spooky Bat Cape",
          displayName: "惡作劇蝙蝠斗篷",
          section: "events",
          collection: "days-of-mischief",
          sourceName: "惡作劇之日",
        }),
      ],
    }),
  ).join("\n");
  assert.match(copy, /AURORA｜極光短髮型/);
  assert.match(copy, /✦ 重要禮包\n蝙蝠斗篷/);
  assert.equal(copy.match(/極光短髮型/g)?.length, 1);
  assert.doesNotMatch(copy, /逃跑髮型/);
  assert.equal(copy.match(/蝙蝠斗篷/g)?.length, 1);
});

test("uses GUID-specific sale names and wraps item rows for mobile reading", () => {
  const items = [
    item({ guid: "short-1", displayName: "花憩玫瑰刺繡斗篷", saleName: "玫瑰斗" }),
    item({ guid: "short-2", displayName: "花憩向日葵夏日洋裝", saleName: "向日葵裙", order: 2 }),
    item({ guid: "short-3", displayName: "彩虹臉部彩繪面具", saleName: "彩繪面具", order: 3 }),
    item({ guid: "short-4", displayName: "日之愛之日優雅領巾", saleName: "優雅領巾", order: 4 }),
    item({ guid: "short-5", displayName: "錦標賽俐落滑冰服裝", saleName: "錦標滑冰服", order: 5 }),
  ];
  const copy = buildSaleCopy(input({ seasons: [], items })).join("\n");
  assert.match(copy, /✦ 其他收藏\n玫瑰斗・向日葵裙・彩繪面具・優雅領巾\n錦標滑冰服/);
  assert.doesNotMatch(copy, /花憩玫瑰刺繡斗篷|錦標賽俐落滑冰服裝/);
});

test("qualifies colliding short names instead of dropping an item", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [],
      items: [
        item({ guid: "wireframe-sky", displayName: "天空線框斗篷", saleName: "線框斗", sourceName: "週年慶" }),
        item({ guid: "wireframe-tgc", displayName: "TGC 線框斗篷", saleName: "線框斗", sourceName: "TGC", order: 2 }),
      ],
    }),
  ).join("\n");
  assert.match(copy, /週年慶線框斗・TGC線框斗/);
});

test("falls back to distinct display names when source prefixes still collide", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [],
      items: [
        item({ guid: "same-source-a", displayName: "先知髮型", saleName: "髮型", sourceName: "預言季" }),
        item({ guid: "same-source-b", displayName: "長老髮型", saleName: "髮型", sourceName: "預言季", order: 2 }),
      ],
    }),
  ).join("\n");
  assert.match(copy, /先知髮型・長老髮型/);
});

test("keeps same-named anniversary hats when they belong to different years", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [],
      items: [
        item({ guid: "fifth-hat", name: "5th Anniversary Hat", displayName: "週年帽", collection: "event-sky-anniversary", wiki: "https://example.com/Sky_Anniversary/2024#Hat" }),
        item({ guid: "sixth-hat", name: "6th Anniversary Hat", displayName: "週年帽", collection: "event-sky-anniversary", wiki: "https://example.com/Sky_Anniversary/2025#Hat", order: 2 }),
      ],
    }),
  ).join("\n");
  assert.match(copy, /6th｜週年帽\n5th｜週年帽/);
});

test("includes account transaction notes only when supplied", () => {
  const copy = buildSaleCopy(
    input({ seasons: [], bindingNote: "Google 可協助移轉", notes: "售出不退換" }),
  ).join("\n");
  assert.match(copy, /✦ 交易說明\n綁定說明｜Google 可協助移轉\n交易前須知｜售出不退換/);
});

test("omits empty optional sections and never adds the removed market copy", () => {
  const copy = buildSaleCopy(
    input({ seasons: [], bindingsConfirmed: true, bindings: {}, items: [] }),
  ).join("\n");
  assert.equal(copy, "✦ 綁定狀態\n無綁");
  for (const forbidden of [
    "最早畢業季",
    "季節物品",
    "起季",
    "帳號資源",
    "備註",
    "♤",
    "♡",
    "◇",
    "☁",
  ]) {
    assert.equal(copy.includes(forbidden), false);
  }
});

test("omits bindings until the seller explicitly confirms them", () => {
  const copy = buildSaleCopy(
    input({ bindingsConfirmed: false, bindings: {} }),
  ).join("\n");
  assert.match(copy, /^✦ 季節進度$/m);
  assert.doesNotMatch(copy, /綁定狀態|無綁/);
});

test("drops invalid future-season ratios instead of publishing 1/0", () => {
  const copy = buildSaleCopy(
    input({
      seasons: [
        season("future", "未來季", 1, 0),
        season("current", "當前季", 1, 2),
      ],
    }),
  ).join("\n");
  assert.doesNotMatch(copy, /未來|1\/0/);
  assert.match(copy, /當前½/);
});
