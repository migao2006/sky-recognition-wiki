import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";

const [source, configSource, marketSource] = await Promise.all(
  ["sale-copy.ts", "account-config.ts", "market-collectibles.ts"].map((file) =>
    readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
  ),
);
const marketUrl = asModuleUrl(marketSource);
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
const { buildSaleCopy, buildShareSummary } = await import(moduleUrl);

const season = (slug, name, owned = 0, total = 3) => ({
  slug,
  name,
  owned,
  total,
});
const item = (overrides = {}) => ({
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
});
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
    "拾光2/3",
    "歸巢⁰",
    "九色鹿畢",
    "築巢1/2",
    "協奏1/3",
    "姆明⁰",
    "染色畢",
    "青鳥畢",
  ]) {
    assert.match(copy, new RegExp(expected.replace("/", "\\/")));
  }
  assert.ok(copy.indexOf("拾光2/3") < copy.indexOf("歸巢⁰"));
  assert.ok(copy.indexOf("歸巢⁰") < copy.indexOf("九色鹿畢"));
  const progressLines = copy.split("\n").slice(1, 4);
  assert.equal(progressLines[0], "拾光2/3｜歸巢⁰｜九色鹿畢｜築巢1/2");
  assert.equal(progressLines[1], "協奏1/3｜姆明⁰｜染色畢｜青鳥畢");
  assert.doesNotMatch(copy, /拾光\s+2\/3|九色鹿季|畢業/);
  assert.match(copy, /✦ 綁定狀態\nGG 出｜NS 不出｜Steam 遺失／異常/);
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
  assert.match(copy, /✦ 限定聯動\n九色鹿｜鹿角・九色鹿面具\nNintendo｜精靈髮型/);
  assert.match(copy, /✦ 重要禮包\n小白花・SkyFest 線框斗篷/);
  assert.match(copy, /✦ 週年收藏\n6th｜週年帽\n5th｜週年T恤\n其他｜茶杯頭飾/);
  assert.match(copy, /✦ 特殊限定/);
  assert.match(copy, /女巫髮型/);
  assert.doesNotMatch(copy, /春日幸運草嫩芽/);
  assert.doesNotMatch(copy, /惡作劇之日｜|國服限定｜/);
  assert.match(copy, /✦ 其他收藏\n新手鋼琴/);
  assert.doesNotMatch(copy, /常駐商店｜/);
  assert.equal(copy.match(/鹿角/g)?.length, 1);
  assert.equal(copy.match(/精靈髮型/g)?.length, 1);
  assert.equal(copy.match(/╶────── ✦ ──────╴/g)?.length, 6);
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
  assert.match(copy, /AURORA｜逃跑髮型/);
  assert.match(copy, /✦ 重要禮包\n蝙蝠斗篷/);
  assert.equal(copy.match(/逃跑髮型/g)?.length, 1);
  assert.equal(copy.match(/蝙蝠斗篷/g)?.length, 1);
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
  assert.match(copy, /當前1\/2/);
});

test("download and share use the exact same listing", () => {
  assert.deepEqual(buildShareSummary(input()), buildSaleCopy(input()));
});
