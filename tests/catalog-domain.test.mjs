import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const {
  closetSubSequence,
  closetGroups,
  allClosetTypeSet,
  compareCatalogItems,
  getNextClosetSub,
  graduationSeasonSlugs,
  heldClosetOrder,
  legacyCatalogGuidAliases,
  isProfessionalVideoFocus,
  matchesSub,
  matchesSourceFilter,
  seasonGraduationItems,
  searchIndex,
  saleItemName,
  officialHeldIdentities,
  showcaseClusterOrder,
  sourceCollectionName,
  sourceKind,
  wikiItems,
  zhItemName,
  zhItemSearchNames,
  zhName,
} = await loadRuntimeCatalog();

const item = (overrides = {}) => ({
  id: 1,
  order: 1,
  guid: "catalog-test",
  name: "Test Item",
  type: "Cape",
  group: "",
  icon: "",
  wiki: "https://example.com/item",
  section: "base",
  collection: "base",
  ...overrides,
});

test("translates verified and tokenized catalog names", () => {
  assert.equal(
    zhName("Lightseekers Ultimate Umbrella"),
    "追光季畢業禮雨傘",
  );
  assert.equal(zhName("Rainbow Cape"), "彩虹斗篷");
  assert.equal(zhName("Transverse Flute"), "橫笛");
  assert.equal(zhName("Sentry Shield"), "哨兵盾牌");
});

test("uses reviewed Wiki names by guid before legacy manual names", () => {
  const treasureCape = wikiItems.find((entry) => entry.guid === "aGS2A9wzQ8");
  assert.ok(treasureCape);
  assert.equal(zhItemName(treasureCape), "尋寶金幣斗篷");
  assert.equal(
    zhItemName(item({ guid: "aGS2A9wzQ8", name: "Unknown Catalog Label" })),
    "尋寶金幣斗篷",
  );
  assert.equal(
    zhItemName(item({ guid: "aGS2A9wzQ8", name: "Rainbow Cape" })),
    "尋寶金幣斗篷",
  );
});

test("uses player-friendly names while keeping Wiki names searchable", () => {
  const naturalHair = wikiItems.find((entry) => entry.guid === "57_e_eF6Ek");
  assert.ok(naturalHair);
  assert.equal(zhItemName(naturalHair), "自然潛水髮型");
  assert.ok(zhItemSearchNames(naturalHair).includes("自然潛游髮型"));
  assert.match(searchIndex.get(naturalHair.guid), /自然潛水髮型/);
  assert.match(searchIndex.get(naturalHair.guid), /自然潛游髮型/);
});

test("uses compact sale names without changing wardrobe display names", () => {
  const roseCape = wikiItems.find((entry) => entry.guid === "5F_G_puJb7");
  assert.ok(roseCape);
  assert.equal(zhItemName(roseCape), "花憩玫瑰刺繡斗篷");
  assert.equal(saleItemName(roseCape), "玫瑰斗");
  assert.equal(zhItemSearchNames(roseCape).includes("玫瑰斗"), false);
});

test("uses reviewed player terms instead of generated IAP translations", () => {
  for (const [guid, expected] of [
    ["-ZIWymGtlX", "紫水晶頭飾"],
    ["6Kn8VMa4go", "泡沫斗"],
    ["8aWnwc3_C6", "冬日筒帽"],
    ["aoUa2jtXfL", "冬日腿套"],
    ["e8qFeoyXxK", "花朵髮飾"],
    ["EMG3a7883l", "泡沫靴"],
    ["EocwmiV_Vf", "海浪面具"],
    ["fLbULqwumS", "報春花蝴蝶結"],
    ["gHfkqCK-A8", "回音海螺"],
    ["rA-RHusWvS", "拼圖寬簷帽"],
    ["svUBdDQ945", "流星披肩"],
    ["tSAl1nV-qo", "報春花洋裝"],
    ["VRB1mcOeYv", "FlOw斗"],
    ["yv8WuDrV-e", "寶藏夥伴"],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(zhItemName(entry), expected, guid);
    assert.equal(saleItemName(entry), expected, guid);
  }
  const seaFoamCape = wikiItems.find((candidate) => candidate.guid === "6Kn8VMa4go");
  assert.ok(seaFoamCape);
  assert.ok(zhItemSearchNames(seaFoamCape).includes("海洋海洋泡沫斗篷"));
});

test("keeps established short player terms for collaboration Hair", () => {
  for (const [guid, expected] of [
    ["MHArTLwxyq", "林克"],
    ["FLMn1Hib7k", "絆愛髮"],
    ["8P8dL_Zp8q", "風之旅人"],
    ["TfItBIVTeP", "超凡風之旅人"],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(saleItemName(entry), expected, guid);
  }
});

test("uses player shorthand instead of tokenized event and painting names", () => {
  for (const [guid, expected] of [
    ["79IJJygQsw", "自畫像"],
    ["MV5iUIEMMH", "紫水晶擺飾"],
    ["P-7ozR83J8", "花拱門"],
    ["VBR5HI2-dU", "花冠"],
    ["rFRaOxnvXF", "玫瑰面具"],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(saleItemName(entry), expected, guid);
  }
});

test("player-friendly names use known catalog guids", async () => {
  const playerNames = JSON.parse(
    await readFile(new URL("../app/player-zh-names.json", import.meta.url), "utf8"),
  );
  const catalogGuids = new Set(wikiItems.map((entry) => entry.guid));
  assert.ok(Object.keys(playerNames.items).length >= 400);
  for (const [guid, entry] of Object.entries(playerNames.items)) {
    assert.ok(catalogGuids.has(guid), `unknown guid: ${guid}`);
    assert.equal(typeof entry, "object", guid);
    const aliases = entry.aliases ?? [];
    assert.ok(entry.displayName || entry.saleName || aliases.length, guid);
    if (entry.displayName) {
      assert.match(entry.displayName, /[\u3400-\u9fff]/);
      assert.doesNotMatch(
        entry.displayName,
        /(?:套組|組合|耳尾組|三件套|全圖|熱門復刻)/u,
        guid,
      );
    }
    if (entry.saleName) {
      assert.match(entry.saleName, /[\u3400-\u9fff]/);
      assert.ok(Array.from(entry.saleName).length <= 6, guid);
      assert.doesNotMatch(
        entry.saleName,
        /(?:套組|組合|耳尾組|三件套|全圖|熱門復刻)/u,
        guid,
      );
    }
    assert.ok(Array.isArray(aliases), guid);
    assert.equal(new Set(aliases).size, aliases.length, guid);
    assert.ok(aliases.every((alias) => alias.trim()), guid);
    assert.ok(aliases.every((alias) => alias !== entry.displayName), guid);
  }
});

test("reviewed player wording keeps seller habits as aliases", () => {
  for (const [guid, displayName, aliases] of [
    ["-EBoN4AWqQ", "史力奇尖帽", ["史力奇帽子"]],
    ["evuvua13dC", "枯枝角", ["巫樹犄角耳飾", "枯角"]],
    ["OfOc3xQdCQ", "超凡風旅斗篷", ["超凡風之旅人斗篷", "風旅斗"]],
    ["YUqENRc8rQ", "綠芽斗篷", ["綠芽斗"]],
    ["w7byhvh3Xa", "雙人鞦韆", ["情人鞦韆", "鞦韆"]],
    ["yWCpBlHsWa", "小蹺蹺板", ["雙人翹翹板", "情人蹺蹺板"]],
    ["nrNcYrcZXy", "王子小狐狸", ["小王子狐狸小型家具", "狐狸背包"]],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(zhItemName(entry), displayName, guid);
    for (const alias of aliases)
      assert.ok(zhItemSearchNames(entry).includes(alias), `${guid}: ${alias}`);
  }
});

test("Kizuna names use the global items without China-only variants", () => {
  const kizunaItems = wikiItems.filter((entry) =>
    ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"].includes(entry.name),
  );
  assert.deepEqual(
    kizunaItems.map((entry) => zhItemName(entry)).sort(),
    ["絆愛斗篷", "絆愛蝴蝶結", "絆愛髮型"].sort(),
  );
  assert.deepEqual(
    kizunaItems.map((entry) => saleItemName(entry)).sort(),
    ["絆愛斗", "絆愛蝴蝶結", "絆愛髮"].sort(),
  );
  for (const entry of kizunaItems)
    assert.doesNotMatch(zhItemSearchNames(entry).join("｜"), /中國/u, entry.guid);
});

test("Transcendent Journey keeps a distinct sale name from the regular Journey cape", () => {
  const transcendent = wikiItems.find((entry) => entry.guid === "OfOc3xQdCQ");
  const regular = wikiItems.find((entry) => entry.guid === "6Nac-p14-9");
  assert.ok(transcendent);
  assert.ok(regular);
  assert.equal(saleItemName(transcendent), "超凡風旅斗");
  assert.equal(saleItemName(regular), "風旅斗");
});

test("the Hair owner migration preserves the reviewed rainbow hat wording", () => {
  const rainbowHat = wikiItems.find((entry) => entry.guid === "cMLcvRtjoh");
  assert.ok(rainbowHat);
  assert.equal(zhItemName(rainbowHat), "彩虹毛帽");
  assert.ok(zhItemSearchNames(rainbowHat).includes("彩虹帽"));
});

test("reviewed transaction terms stay attached to their official guids", () => {
  for (const [guid, expectedSaleName, expectedAlias] of [
    ["VToGfUfrj1", "背帶褲", "傻笑童子軍服裝"],
    ["DI0RLfo9Sj", "創始人斗", "創始人斗篷"],
    ["Bm0aFDGHk2", "白鳥斗", "沉思編導斗篷"],
    ["EQYKoHE95s", "歐若拉之翼", "歐若拉之翼斗篷"],
    ["jM8xKFwbTE", "飛蛾觸角", "飛蛾裝扮髮飾"],
    ["K0NBv__mv8", "人聲樂器", "歐若拉之聲道具"],
    ["5xJ_mCzZQy", "夏日燈籠", "夏日回憶燈籠"],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(saleItemName(entry), expectedSaleName, guid);
    assert.ok(zhItemSearchNames(entry).includes(expectedAlias), `${guid}: ${expectedAlias}`);
  }
});

test("Drive player terms update display names while preserving old names and bundle search", () => {
  for (const [name, displayName, terms] of [
    ["Little Prince Scarf Cape", "王子圍巾斗", ["小王子圍巾"]],
    ["Wings of AURORA", "極光金翅膀", ["AURORA 之翼"]],
    ["Tiara We Can Touch", "金星月頭飾", ["觸碰之冠"]],
    ["Cinnamoroll Plushie", "大耳狗娃娃", ["大耳狗玩偶"]],
    ["Fledgling Upright Piano", "直立鋼琴", ["新手鋼琴"]],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.name === name);
    assert.ok(entry, name);
    assert.equal(zhItemName(entry), displayName);
    for (const term of terms)
      assert.ok(searchIndex.get(entry.guid).includes(term.toLowerCase()), `${name}: ${term}`);
  }

  for (const name of ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"]) {
    const entry = wikiItems.find((candidate) => candidate.name === name);
    assert.ok(entry, name);
    assert.ok(searchIndex.get(entry.guid).includes("絆愛三件套"), name);
  }
  for (const name of ["Moomintroll Ears", "Moomintroll Tail"]) {
    const entry = wikiItems.find((candidate) => candidate.name === name);
    assert.ok(entry, name);
    assert.ok(searchIndex.get(entry.guid).includes("姆明耳尾組"), name);
  }
});

test("player season shorthand is searchable without replacing standard season labels", () => {
  for (const [collection, alias, standardName] of [
    ["rhythm", "音韻", "音韻季"],
    ["nine-colored-deer", "彩鹿", "九色鹿季"],
    ["migration", "遷徒", "遷徙季"],
  ]) {
    const entry = wikiItems.find(
      (candidate) => candidate.collection === collection && allClosetTypeSet.has(candidate.type),
    );
    assert.ok(entry, collection);
    assert.ok(searchIndex.get(entry.guid).includes(alias), `${collection}: ${alias}`);
    assert.equal(sourceCollectionName(entry), standardName);
  }
});

test("hair-name research covers the complete Hair catalog and matches the runtime snapshot", async () => {
  const [research, runtime] = await Promise.all(
    ["hair-name-research.json", "../app/player-hair-names.json"].map(async (file) =>
      JSON.parse(
        await readFile(
          new URL(file.startsWith("..") ? file : `../data/${file}`, import.meta.url),
          "utf8",
        ),
      ),
    ),
  );
  const hairs = wikiItems.filter((entry) => entry.type === "Hair");
  assert.equal(research.items.length, 187);
  assert.equal(Object.keys(runtime.items).length, 187);
  assert.deepEqual(
    new Set(research.items.map((entry) => entry.guid)),
    new Set(hairs.map((entry) => entry.guid)),
  );
  const canonicalTerm = (value) =>
    value
      .toLowerCase()
      .replace(/[（(][^）)]*[）)]/g, "")
      .replace(/髮型|頭/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  for (const entry of research.items) {
    assert.deepEqual(runtime.items[entry.guid], {
      displayName: entry.displayName,
      aliases: entry.aliases,
    });
    if (entry.displayName === entry.currentName) continue;
    assert.equal(entry.confidence, "consensus");
    const supporters = new Set(
      entry.playerSources
        .filter(
          (source) =>
            source.name === entry.displayName &&
            source.author &&
            !source.platform.toLowerCase().includes("wiki") &&
            canonicalTerm(source.observedName || source.name).includes(
              canonicalTerm(entry.displayName),
            ),
        )
        .map((source) => source.author.toLowerCase()),
    );
    assert.ok(supporters.size >= 2, entry.guid);
  }
});

test("popular player hair names and aliases stay searchable", () => {
  for (const [guid, displayName, aliases] of [
    ["wXiFi4y6YU", "白鳥", ["白鳥頭", "白鳥髮型"]],
    ["Lw93RiDG46", "白梟", ["白梟頭", "白梟髮型", "貓貓頭"]],
    ["SSrCZW8Cf-", "龍骨", ["龍骨頭", "龍骨髮型"]],
    ["T0wsTbmzvv", "雨媽", ["雨媽頭", "雨媽髮型"]],
    ["1pSVV2aJ5S", "公主頭", []],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(zhItemName(entry), displayName);
    for (const term of [displayName, ...aliases, entry.name]) {
      assert.ok(searchIndex.get(guid).includes(term.toLowerCase()), `${guid}: ${term}`);
    }
  }
  const dragonHair = wikiItems.find((candidate) => candidate.guid === "TsL-GHL_RI");
  assert.ok(dragonHair);
  assert.doesNotMatch(searchIndex.get(dragonHair.guid), /龍骨/);
});

test("player-friendly names keep representative accessory, instrument, and prop identities", () => {
  for (const [guid, expected] of [
    ["_Y-80G-t_2", "海龜肩飾"],
    ["8KXtBlvNRO", "幸運鼓"],
    ["aU_ZGHomyy", "尋寶鏟"],
  ]) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(zhItemName(entry), expected);
  }
});

test("reviewed Wiki snapshot contains only catalog guids and complete Chinese names", async () => {
  const snapshot = JSON.parse(
    await readFile(new URL("../app/wiki-zh-names.json", import.meta.url), "utf8"),
  );
  const catalogGuids = new Set(wikiItems.map((entry) => entry.guid));
  assert.equal(Object.keys(snapshot.items).length, 105);
  assert.equal(Object.keys(snapshot.revisions).length, 10);
  assert.ok(Object.values(snapshot.revisions).every(Number.isInteger));
  for (const [guid, name] of Object.entries(snapshot.items)) {
    assert.ok(catalogGuids.has(guid), `unknown guid: ${guid}`);
    assert.match(name, /[\u3400-\u9fff]/);
    assert.doesNotMatch(name, /[A-Za-z]/);
  }
});

test("every visible wardrobe item has a Chinese display name", () => {
  const wardrobeItems = wikiItems.filter((entry) => allClosetTypeSet.has(entry.type));
  assert.equal(wardrobeItems.length, 1171);
  for (const entry of wardrobeItems) {
    assert.match(zhItemName(entry), /[\u3400-\u9fff]/, entry.name);
  }
});

test("keeps SkyGame-Data identities and every synthetic-guid migration target", () => {
  const byGuid = new Map(wikiItems.map((entry) => [entry.guid, entry]));
  assert.equal(Object.keys(legacyCatalogGuidAliases).length, 64);
  for (const identity of Object.values(officialHeldIdentities)) {
    const item = byGuid.get(identity.guid);
    assert.ok(item, identity.guid);
    assert.ok(["Held", "Prop", "Furniture"].includes(item.sourceType), identity.guid);
    assert.deepEqual(
      [item.id, item.order, item.name, item.group],
      [identity.id, identity.order, identity.name, identity.group],
      identity.guid,
    );
  }
  for (const [legacyGuid, officialGuid] of Object.entries(legacyCatalogGuidAliases))
    assert.ok(byGuid.has(officialGuid), `${legacyGuid} -> ${officialGuid}`);
  const manateeCane = byGuid.get("Ll1veXMDa9");
  assert.deepEqual(
    [manateeCane?.id, manateeCane?.order, manateeCane?.name, manateeCane?.group],
    [2694, 4200, "Stern Shepherd Cane", "SeasonPass"],
  );
  assert.equal(zhItemName(manateeCane), "海牛權杖");
  assert.equal(legacyCatalogGuidAliases["held-manatee-staff"], "Ll1veXMDa9");
});

test("uses held order only for the held closet, not cross-closet search", () => {
  const held = item({
    guid: "biKOov4qJQ",
    name: "Harp",
    type: "Instrument",
    order: 999,
  });
  const outfit = item({
    guid: "outfit-search-result",
    name: "Search Outfit",
    type: "Outfit",
    order: 1,
  });

  assert.ok(compareCatalogItems(held, outfit, "held") < 0);
  assert.ok(compareCatalogItems(held, outfit, "type") > 0);
});

test("keeps formerly ambiguous paid and held-prop names distinct", () => {
  const byName = (name) => wikiItems.find((entry) => entry.name === name);
  assert.equal(zhItemName(byName("Journey Cape")), "風之旅人斗篷");
  assert.equal(zhItemName(byName("FlOw Cape")), "FlOw斗");
  assert.equal(zhItemName(byName("Manatee Toy")), "海牛公仔");
  assert.equal(zhItemName(byName("Manatee Plush")), "小海牛玩偶");
});

test("syncs the SkyGame-Data 1.3.10 Summer Camping wardrobe items", () => {
  const expected = new Map([
    ["7a1iYLeV94", ["Feathery Lash Mask", "Mask", "羽睫面具"]],
    ["0ymZWXcz6Z", ["Yellow Tent Wall", "LargeProp", "黃色帳篷牆"]],
    ["PR2IFFsW_m", ["Yellow Tent Top", "LargeProp", "黃色帳篷頂"]],
    ["8KuMwTpL5V", ["Yellow Tent Window", "LargeProp", "黃色帳篷窗"]],
    ["jIwqjwvKnG", ["Yellow Tent Door", "LargeProp", "黃色帳篷門"]],
  ]);
  for (const [guid, [name, type, displayName]] of expected) {
    const entry = wikiItems.find((candidate) => candidate.guid === guid);
    assert.ok(entry, guid);
    assert.equal(entry.name, name);
    assert.equal(entry.type, type);
    assert.equal(entry.collection, "summer-camping");
    assert.equal(sourceKind(entry), "年度活動");
    assert.equal(sourceCollectionName(entry), "夏日露營");
    assert.equal(zhItemName(entry), displayName);
    if (guid === "7a1iYLeV94") assert.equal(entry.group, "");
  }
  const nonWardrobeGuids = [
    "UDK1UEXKdq",
    "zBMQsKfMDz",
    "uXHVKE2AgG",
    "LJpSY8FZdb",
    "COauF66x9N",
    "9I3_qKrP4G",
    "8HjnDXpnAJ",
    "GHuKao8XDH",
    "CCupxwATul",
    "9o-zXr9Zkk",
  ];
  for (const guid of nonWardrobeGuids) {
    assert.equal(wikiItems.some((entry) => entry.guid === guid), false, guid);
  }
});

test("includes the pending Dear Van Gogh umbrella and easel from upstream PR 125", () => {
  const umbrella = wikiItems.find((entry) => entry.guid === "OAGgi-B-xa");
  const easel = wikiItems.find((entry) => entry.guid === "KwENV96jIh");
  assert.equal(umbrella?.name, "Starry Night's Canopy");
  assert.equal(umbrella?.type, "HeldProp");
  assert.equal(zhItemName(umbrella), "星夜之傘");
  assert.equal(matchesSub(umbrella, "held"), true);
  assert.equal(easel?.name, "Easel");
  assert.equal(easel?.type, "LargeProp");
});

test("matches the three in-game prop closet tabs", () => {
  const propsCloset = closetGroups.find((group) => group.key === "props");
  assert.ok(propsCloset);
  assert.deepEqual(
    propsCloset.subs.map((sub) => [sub.key, sub.name]),
    [
      ["held", "手持道具"],
      ["large", "大型可放置道具"],
      ["small", "小型可放置道具"],
    ],
  );

  const instruments = wikiItems.filter((entry) => entry.type === "Instrument");
  assert.equal(instruments.length, 38);
  assert.equal(new Set(instruments.map((entry) => entry.guid)).size, 38);
  assert.ok(instruments.some((entry) => entry.name === "Harp"));
  assert.ok(
    instruments.some((entry) => entry.name === "Lightmending Light Catcher Flute"),
  );
  for (const [name, guid] of [
    ["Sanctuary Ultimate Handpan", "Hvq52gCeih"],
    ["Prophecy Ultimate Drum", "wGQSuhVWXD"],
    ["Assembly Ultimate Bugle", "B59f4_ru60"],
    ["The Musicians' Legacy Piano", "WuZeLoUATs"],
    ["Duets Ultimate Instrument", "O9jSph-v7e"],
    ["Fledgling Upright Piano", "10Ol7H9jKg"],
    ["Jam Station", "WMNr4yo_35"],
  ]) {
    assert.equal(instruments.find((entry) => entry.name === name)?.guid, guid);
  }
  assert.equal(
    instruments.find((entry) => entry.name === "The Musicians' Legacy Piano")?.group,
    "SeasonPass",
  );
  for (const name of [
    "Triumph Violin",
    "Triumph Saxophone",
    "Fledgling Upright Piano",
    "Jam Station",
  ]) {
    const entry = instruments.find((item) => item.name === name);
    assert.equal(entry?.section, "store");
    assert.equal(entry?.group, "");
  }
  const instrumentByName = (name) =>
    instruments.find((entry) => entry.name === name);
  assert.deepEqual(
    ["held", "large", "small"].map(
      (tab) => instruments.filter((entry) => matchesSub(entry, tab)).length,
    ),
    [34, 4, 0],
  );
  assert.equal(matchesSub(instrumentByName("Jam Station"), "large"), true);
  for (const [name, order] of [
    ["Jam Station", 4700],
    ["The Musicians' Legacy Piano", 10000],
    ["Duets Ultimate Instrument", 10100],
    ["Fledgling Upright Piano", 11700],
  ]) {
    assert.equal(instrumentByName(name)?.order, order, name);
  }
  const orderedLargeProps = wikiItems
    .filter((entry) => matchesSub(entry, "large"))
    .sort((left, right) => compareCatalogItems(left, right, "shared"));
  assert.deepEqual(
    orderedLargeProps.map((entry) => entry.order),
    [...orderedLargeProps].map((entry) => entry.order).sort((a, b) => a - b),
  );
  assert.ok(
    orderedLargeProps
      .slice(0, 3)
      .every((entry) => !["The Musicians' Legacy Piano", "Duets Ultimate Instrument", "Fledgling Upright Piano"].includes(entry.name)),
  );
  for (const name of [
    "The Musicians' Legacy Piano",
    "Duets Ultimate Instrument",
    "Fledgling Upright Piano",
  ]) {
    assert.equal(matchesSub(instrumentByName(name), "large"), true);
    assert.equal(matchesSub(instrumentByName(name), "held"), false);
    assert.equal(matchesSub(instrumentByName(name), "small"), false);
  }
});

test("walks all wardrobe subcategories in game order", () => {
  assert.equal(closetSubSequence.length, 13);
  assert.deepEqual(closetSubSequence[0], {
    closetKey: "outfit",
    closetName: "服裝衣櫃",
    subKey: "Outfit",
    subName: "一般服裝",
  });
  assert.deepEqual(getNextClosetSub("outfit", "OutfitShoes"), {
    closetKey: "face",
    closetName: "臉部衣櫃",
    subKey: "Mask",
    subName: "面具",
  });
  assert.deepEqual(getNextClosetSub("cape", "Cape"), {
    closetKey: "props",
    closetName: "道具衣櫃",
    subKey: "held",
    subName: "手持道具",
  });
  assert.equal(getNextClosetSub("props", "small"), null);
});

test("uses verified game placement categories for representative props", () => {
  const byName = (name) => wikiItems.find((entry) => entry.name === name);
  const held = byName("Lightseekers Ultimate Umbrella");
  const heldFromScreenshot = byName("Company Issued Laptop");
  const large = byName("Challenge Bounce Pad Level 3");
  const small = byName("Tournament Skyball Set");
  assert.ok(held && heldFromScreenshot && large && small);
  assert.equal(matchesSub(held, "held"), true);
  assert.equal(matchesSub(held, "small"), false);
  assert.equal(matchesSub(heldFromScreenshot, "held"), true);
  assert.equal(matchesSub(large, "large"), true);
  assert.equal(matchesSub(large, "small"), false);
  assert.equal(matchesSub(small, "small"), true);
  assert.equal(matchesSub(small, "large"), false);

  const propTypes = new Set([
    "Instrument",
    "HeldProp",
    "LargeProp",
    "SmallProp",
  ]);
  assert.equal(
    wikiItems.filter((entry) => matchesSub(entry, "held")).length,
    64,
  );
  const heldItems = wikiItems
    .filter((entry) => matchesSub(entry, "held"))
    .sort(
      (a, b) =>
        heldClosetOrder.get(a.guid) - heldClosetOrder.get(b.guid),
    );
  assert.deepEqual(
    heldItems.map((entry) => entry.guid),
    [...heldClosetOrder.keys()],
  );
  for (const name of [
    "Dark Horn",
    "Laidback Pioneer Umbrella",
    "Stern Shepherd Cane",
    "Scarred Sentry Spear",
  ]) {
    assert.equal(byName(name)?.group, "SeasonPass");
  }
  for (const entry of wikiItems.filter((item) => propTypes.has(item.type))) {
    assert.equal(
      ["held", "large", "small"].filter((tab) => matchesSub(entry, tab))
        .length,
      1,
      `${entry.name} must appear in exactly one prop closet tab`,
    );
  }
});

test("keeps the verified Lightseekers graduation gift in valuation order", () => {
  assert.equal(graduationSeasonSlugs.includes("lightseekers"), true);
  assert.ok((seasonGraduationItems.get("lightseekers")?.length ?? 0) > 0);
});

test("classifies representative catalog sources", () => {
  assert.equal(
    sourceKind(item({ section: "seasons", collection: "lightseekers" })),
    "季節",
  );
  assert.equal(
    sourceKind(item({ section: "events", collection: "event-cinnamoroll" })),
    "聯動",
  );
  assert.equal(
    sourceKind(item({ section: "store", wiki: "https://example.com/PlayStation" })),
    "平台限定",
  );
});

test("uses one display name mapping for showcase and sale sources", () => {
  assert.equal(
    sourceCollectionName(item({ section: "seasons", collection: "lightseekers" })),
    "追光季",
  );
  assert.equal(
    sourceCollectionName(item({ section: "events", collection: "event-cinnamoroll" })),
    "大耳狗聯動",
  );
  assert.equal(
    sourceCollectionName(item({ section: "realms", collection: "hidden-forest" })),
    "雨林",
  );
  assert.equal(
    sourceCollectionName(item({ section: "store", wiki: "https://example.com/Nintendo" })),
    "Nintendo Switch 專屬",
  );
  for (const name of ["Journey Hair", "Journey Cape", "Journey Mask"]) {
    const journey = wikiItems.find((entry) => entry.name === name);
    assert.equal(sourceKind(journey), "聯動", name);
    assert.equal(sourceCollectionName(journey), "風之旅人聯動", name);
    assert.equal(matchesSourceFilter(journey, "platform"), false, name);
    assert.equal(matchesSourceFilter(journey, "collab"), true, name);
  }
});

test("filters catalog items by source category", () => {
  assert.equal(
    matchesSourceFilter(item({ section: "seasons" }), "seasons"),
    true,
  );
  assert.equal(
    matchesSourceFilter(
      item({ section: "events", collection: "event-cinnamoroll" }),
      "collab",
    ),
    true,
  );
  assert.equal(matchesSourceFilter(item({ section: "base" }), "permanent"), true);
  assert.equal(matchesSourceFilter(item({ section: "base" }), "collab"), false);
});

test("focuses professional video checks on globally relevant market items", () => {
  assert.equal(
    isProfessionalVideoFocus(
      item({ section: "seasons", group: "Ultimate", type: "Hair" }),
    ),
    true,
  );
  assert.equal(
    isProfessionalVideoFocus(
      item({ section: "events", collection: "event-cinnamoroll" }),
    ),
    true,
  );
  assert.equal(
    isProfessionalVideoFocus(
      item({ section: "store", wiki: "https://example.com/PlayStation" }),
    ),
    true,
  );
  assert.equal(isProfessionalVideoFocus(item({ section: "base" })), false);
  const companionCube = wikiItems.find((entry) => entry.name === "Companion Cube");
  assert.ok(companionCube);
  assert.equal(sourceKind(companionCube), "平台限定");
  assert.equal(isProfessionalVideoFocus(companionCube), true);
  assert.equal(
    isProfessionalVideoFocus(
      item({
        section: "other",
        collection: "china",
        group: "Limited",
        wiki: "https://example.com/china-only",
      }),
    ),
    false,
  );
});

test("orders showcase sources consistently", () => {
  const season = item({ section: "seasons", collection: "aurora" });
  const collaboration = item({
    section: "events",
    collection: "event-cinnamoroll",
  });
  const platform = item({
    section: "store",
    wiki: "https://example.com/PlayStation",
  });
  const annual = item({ section: "events", collection: "days-of-love" });
  assert.ok(showcaseClusterOrder(season) < showcaseClusterOrder(collaboration));
  assert.ok(
    showcaseClusterOrder(collaboration) < showcaseClusterOrder(platform),
  );
  assert.ok(showcaseClusterOrder(platform) < showcaseClusterOrder(annual));
});
