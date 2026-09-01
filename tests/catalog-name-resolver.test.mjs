import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const catalog = await loadRuntimeCatalog();
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);

test("resolves a unique player-facing name to its official GUID", () => {
  const match = resolver.resolve("星夜之傘");
  assert.ok(match);
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].name, "Starry Night's Canopy");
  assert.ok(match.candidates[0].guid);
});

test("resolves the Little Prince sword outfit from seller wording", () => {
  const match = resolver.resolve("小王子佩劍禮服");
  assert.ok(match);
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].guid, "l_C7GM60an");
  assert.equal(catalog.isLimitedItem(match.candidates[0]), true);
});

test("resolves reviewed event wording without changing paid identity", () => {
  const cases = [
    ["玉兔拖鞋", "MuQrbnmbdp", true],
    ["玉兔髮飾", "EEFIpR6x7Q", true],
    ["玉兔尾巴頸飾", "inAM509HYO", false],
    ["活力海牛耳飾", "y69WKTTyw7", true],
    ["活力海牛頸飾", "cXaPt2zi0Q", true],
    ["週年影院沙發椅", "P09UDA73qQ", false],
    ["白底TGC斗篷", "xaX_sfWwKV", true],
    ["蛛絲斗篷", "bcKjyS-_p3", true],
    ["惡作劇飛行掃帚道具", "8rYQfi8VP3", true],
    ["彩虹小花髮飾", "KpS-2FdasB", true],
  ];
  for (const [term, guid, paid] of cases) {
    const match = resolver.resolve(term);
    assert.ok(match, term);
    assert.equal(match.method, "exact", term);
    assert.deepEqual(match.candidates.map((item) => item.guid), [guid], term);
    assert.equal(catalog.isPaidItem(match.candidates[0]), paid, term);
  }
});

test("does not import a China-only store term into the global resolver", () => {
  assert.equal(resolver.resolve("四葉草頭飾"), null);
});

test("keeps reviewed ultimate gifts distinct from season pendants", () => {
  const graduationGuids = [
    "1IhlCcq61j",
    "FjxHIvszIu",
    "cbWKMsAh7H",
    "nBg1iBLlGM",
    "8z8SeKQRk8",
    "FlOSNmw_38",
  ];
  const pendantGuids = ["TQUcvFL8k7", "JCRIpETL35", "9uVcch8mbe", "1uyZfKjJg5"];
  for (const guid of graduationGuids) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.isGraduationGift(item), true, guid);
  }
  for (const guid of pendantGuids) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.isGraduationGift(item), false, guid);
  }
});

test("never guesses between same-named catalog items", () => {
  const match = resolver.resolve("Moonlight Lantern");
  assert.ok(match);
  assert.ok(match.candidates.length > 1);
  assert.deepEqual(
    new Set(match.candidates.map((item) => item.guid)).size,
    match.candidates.length,
  );
});

test("keeps bundle aliases as multiple candidates instead of one fake item", () => {
  const match = resolver.resolve("林克套組");
  assert.ok(match);
  assert.ok(match.candidates.length >= 3);
  assert.ok(match.candidates.every((item) => item.guid));
});

test("expands only confirmed player-facing set aliases during a text scan", () => {
  const result = resolver.scan("林克套組｜絆愛三件套");
  assert.equal(result.groups.length, 2);
  assert.equal(result.ambiguous.length, 0);
  assert.deepEqual(
    result.groups.map((group) => group.candidates.length),
    [3, 3],
  );
});

const confirmedSets = new Map([
  ["貓咪耳尾", ["Dhkf_3dAhf", "wXLGNti3db"]],
  ["冥龍耳尾組", ["Io4R50c-s1", "nBIm3PkDea"]],
  ["海牛耳尾組", ["cXaPt2zi0Q", "y69WKTTyw7"]],
  ["爆米花組", ["IZNxLq33GB", "vPenDMkJkY"]],
  ["週年影院套餐", ["IZNxLq33GB", "vPenDMkJkY"]],
  ["超凡風旅", ["OfOc3xQdCQ", "RpAC3rlPrR", "TfItBIVTeP"]],
  ["姆明耳尾組", ["3gb3myYbBB", "JIMbTWase4"]],
  ["姆明飾品套裝", ["3gb3myYbBB", "JIMbTWase4"]],
  ["冥龍套裝", ["Io4R50c-s1", "nBIm3PkDea"]],
  ["活力海牛套裝", ["cXaPt2zi0Q", "y69WKTTyw7"]],
  ["星夜披風套裝", ["tgeTchWQfN", "tz-IwazQ7k"]],
  ["林克套組", ["4c9HLTfREP", "KtlqKC7whS", "MHArTLwxyq"]],
  ["絆愛三件套", ["FLMn1Hib7k", "daH57TClK7", "u7q3xg2y55"]],
]);

test("pins every confirmed player-facing set to its reviewed GUID members", () => {
  for (const [term, expected] of confirmedSets) {
    const result = resolver.scan(term);
    assert.equal(result.groups.length, 1, term);
    assert.deepEqual(
      result.groups[0].candidates.map((item) => item.guid).sort(),
      [...expected].sort(),
      term,
    );
  }
});

test("scans listing separators and excludes ambiguous or unknown terms", () => {
  const result = resolver.scan("星夜之傘⸝Moonlight Lantern⸝完全不存在的道具");
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].candidates[0].name, "Starry Night's Canopy");
  assert.equal(result.groups.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.ok(result.ambiguous[0].candidates.length > 1);
  assert.equal(result.unmatched.length, 1);
});

test("does not turn explicitly missing items into owned GUIDs", () => {
  const result = resolver.scan(
    "沒有星夜之傘｜缺星夜之傘｜不含星夜之傘｜沒有：星夜之傘｜已售星夜之傘｜不帶星夜之傘｜未收星夜之傘｜星夜之傘拔掉",
  );
  assert.equal(result.matched.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].candidates[0].name, "Starry Night's Canopy");
});

test("finds multiple non-overlapping item names in one listing segment", () => {
  const result = resolver.scan("九色鹿鹿角 九色鹿面具");
  assert.deepEqual(
    new Set(result.matched.map((match) => match.candidates[0].name)),
    new Set([
      "Gift of the Nine-Colored Deer Antlers",
      "Gift of the Nine-Colored Deer Mask",
    ]),
  );
});

test("keeps the item name before a colon", () => {
  const result = resolver.scan("九色鹿面具：有");
  assert.equal(result.matched.length, 1);
  assert.equal(
    result.matched[0].candidates[0].name,
    "Gift of the Nine-Colored Deer Mask",
  );
});
