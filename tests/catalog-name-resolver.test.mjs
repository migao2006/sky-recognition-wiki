import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const catalog = await loadRuntimeCatalog();
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);

test("reviewed short names agree across wardrobe and sharing without losing old searches", () => {
  for (const [guid, id, order, name, terms] of [
    // Taiwan player usage: https://www.dcard.tw/f/sky/p/256468904
    // Shoulder item also named by https://www.youtube.com/watch?v=1eSi02ackQg
    ["Ay3g-0JAeW", 1913, 4800, "水母肩飾", ["果凍肩部夥伴"]],
    ["gsACsrp16_", 1921, 1700, "夏日涼鞋", ["陽光厚底涼鞋", "夏日涼鞋禮包"]],
    ["NEmfcbHb-I", 1922, 6600, "夏日衝浪板", ["陽光衝浪板", "夏日衝浪禮包"]],
    // Existing reviewed sale names; 3D glasses corroborated by
    // https://www.dcard.tw/f/sky/p/259260519 (not the whole cinema bundle).
    ["5F_G_puJb7", 2539, 13500, "玫瑰斗", ["花憩玫瑰刺繡斗篷"]],
    ["c1sclAR_k8", 3003, 6600, "錦標滑冰服", ["錦標賽俐落滑冰服裝"]],
    ["jcCb_Tc5ms", 3051, 4600, "向日葵裙", ["花憩向日葵夏日洋裝"]],
    ["PuFWddickP", 1755, 4400, "優雅領巾", ["日之愛之日優雅領巾"]],
    ["eruG9WiyJZ", 1908, 6400, "貝殼髮飾", ["日之夏日貝殼髮夾", "貝殼髮夾"]],
    ["IZNxLq33GB", 2657, 2800, "3D眼鏡", ["週年電影院 3D 眼鏡"]],
    // Taiwan player usage: https://www.dcard.tw/f/sky/p/256819080
    ["4c-yCAGV5U", 2323, 6000, "襯衫套裝", ["時尚紳士西裝"]],
    ["gZoseEbqGz", 2324, 2500, "單邊眼鏡", ["時尚紳士單片眼鏡"]],
    ["yuO7uDMle8", 2325, 4900, "領帶", ["時尚紳士領帶"]],
    ["BWUjIgnjnu", 1844, 2300, "火焰墨鏡", ["時尚火焰墨鏡", "時尚火焰太陽眼鏡"]],
    ["3HeVKqT39a", 1843, 2400, "愛心墨鏡", ["時尚愛心墨鏡", "時尚愛心太陽眼鏡"]],
    ["E7RAu04_xI", 1841, 5800, "闊腿牛仔褲", ["時尚寬型腿部牛仔褲", "闊腿牛仔褲禮包"]],
    ["bcKjyS-_p3", 1870, 16500, "薄紗斗", ["惡作劇薄紗斗篷", "蛛絲斗篷", "蛛絲斗"]],
    ["txwX8D1yKh", 1871, 16600, "蟹伯爵斗", ["惡作劇蟹伯爵披風", "吸蟹伯爵斗篷", "吸蟹伯爵斗"]],
    ["jc8Pyt7eLR", 2716, 2400, "蝴蝶白靈花", ["蝴蝶花紀念品", "蝴蝶花朵紀念物"]],
  ]) {
    const item = catalog.wikiItems.find(item => item.guid === guid);
    assert.equal(item.id, id);
    assert.equal(item.order, order);
    assert.equal(catalog.zhItemName(item), name);
    assert.equal(catalog.saleItemName(item), name);
    assert.equal(catalog.isPaidItem(item), true);
    for (const term of [name, ...terms]) {
      assert.deepEqual(resolver.resolve(term).candidates.map(item => item.guid), [guid], term);
    }
  }
});

test("paid summer surfboard stays distinct from the 2026 sporty surfboard", () => {
  // SkyGame-Data 1.3.10: separate official IDs/orders; only the 2023 board has IAPs.
  const item = catalog.wikiItems.find(item => item.guid === "amo581C-E4");
  assert.equal(item.id, 3274);
  assert.equal(item.order, 6650);
  assert.equal(item.name, "Sunlight Sporty Surfboard");
  assert.equal(catalog.isPaidItem(item), false);
  assert.deepEqual(resolver.resolve(catalog.zhItemName(item)).candidates.map(item => item.guid), [item.guid]);
});

test("spider hair uses the evidenced short name and preserves old searches", () => {
  const item = catalog.wikiItems.find(item => item.guid === "ARZC1Eg2jx");
  assert.equal(item.type, "Hair");
  assert.equal(catalog.zhItemName(item), "蜘蛛頭");
  assert.equal(catalog.isPaidItem(item), true);
  for (const name of ["蜘蛛頭", "蜘蛛龐克", "惡作劇蜘蛛飛機頭"]) {
    assert.deepEqual(resolver.resolve(name).candidates.map(item => item.guid), [item.guid]);
  }
});

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
    ["兔兔頭飾", "EEFIpR6x7Q", true],
    ["兔兔拖鞋", "MuQrbnmbdp", true],
    ["南瓜擺飾", "nMt5KsLO6Y", true],
    ["雪花頭飾", "VZyiD3Wmtp", true],
    ["宏音海螺", "gHfkqCK-A8", true],
    ["海浪斗篷", "wMsUtkvt3s", true],
    ["擬人聲樂器", "K0NBv__mv8", true],
    ["雛鳥之琴", "1xIwQnxHV-", true],
    ["星夜斗篷", "tz-IwazQ7k", true],
    ["彩繪面具", "Z9HZ5p9DX7", true],
    ["大耳狗娃娃", "Pyk6fYvTVM", true],
    ["蝴蝶白靈花", "jc8Pyt7eLR", true],
    ["星夜面具", "C3Amjr4SgJ", true],
  ];
  for (const [term, guid, paid] of cases) {
    const match = resolver.resolve(term);
    assert.ok(match, term);
    assert.equal(match.method, "exact", term);
    assert.deepEqual(match.candidates.map((item) => item.guid), [guid], term);
    assert.equal(catalog.isPaidItem(match.candidates[0]), paid, term);
  }
});

test("uses reviewed player display names for the Drive-confirmed paid items", () => {
  const cases = [
    ["EEFIpR6x7Q", "兔兔頭飾"],
    ["MuQrbnmbdp", "兔兔拖鞋"],
    ["nMt5KsLO6Y", "南瓜擺飾"],
    ["VZyiD3Wmtp", "雪花頭飾"],
    ["gHfkqCK-A8", "宏音海螺"],
    ["wMsUtkvt3s", "海浪斗篷"],
    ["1xIwQnxHV-", "雛鳥之琴"],
    ["tz-IwazQ7k", "星夜斗篷"],
    ["Z9HZ5p9DX7", "彩繪面具"],
    ["Pyk6fYvTVM", "大耳狗娃娃"],
    ["jc8Pyt7eLR", "蝴蝶白靈花"],
    ["C3Amjr4SgJ", "星夜面具"],
    ["K0NBv__mv8", "人聲樂器"],
  ];
  for (const [guid, displayName] of cases) {
    const item = catalog.wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(item, guid);
    assert.equal(catalog.zhItemName(item), displayName, guid);
    assert.equal(catalog.isPaidItem(item), true, guid);
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
