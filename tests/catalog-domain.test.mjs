import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";
import { marketCollectiblesModuleUrl } from "./helpers/market-collectibles.mjs";
import { injectSeasonItems } from "./helpers/season-items.mjs";

const loadCatalogDomain = async () => {
  const [wikiSource, valuationSource, catalogSource, wikiZhSource, playerZhSource, playerHairSource] = await Promise.all(
    ["wiki-data.ts", "valuation-items.ts", "catalog-domain.ts", "wiki-zh-names.json", "player-zh-names.json", "player-hair-names.json"].map((file) =>
      readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
    ),
  );
  const marketUrl = await marketCollectiblesModuleUrl();
  const valuationUrl = asModuleUrl(
    (await injectSeasonItems(valuationSource)).replace(
      'import { marketCollectibleProfile } from "./market-collectibles";',
      `const { marketCollectibleProfile } = await import(${JSON.stringify(marketUrl)});`,
    ),
  );
  const catalogModule = (await injectSeasonItems(catalogSource))
    .replace(
      'import { marketCollectibleProfile } from "./market-collectibles";',
      `const { marketCollectibleProfile } = await import(${JSON.stringify(marketUrl)});`,
    )
    .replace(
      'import playerHairNames from "./player-hair-names.json";',
      `const playerHairNames = ${playerHairSource};`,
    )
    .replace(
      'import playerZhNames from "./player-zh-names.json";',
      `const playerZhNames = ${playerZhSource};`,
    )
    .replace(
      'import { wikiItems as baseWikiItems } from "./wiki-data";',
      `const { wikiItems: baseWikiItems } = await import(${JSON.stringify(
        asModuleUrl(wikiSource),
      )});`,
    )
    .replace(
      'import wikiZhNames from "./wiki-zh-names.json";',
      `const wikiZhNames = ${wikiZhSource};`,
    )
    .replace(
      /import \{([\s\S]*?)\} from "\.\/valuation-items";/,
      (_, imports) =>
        `const {${imports}} = await import(${JSON.stringify(
          valuationUrl,
        )});`,
    );
  return import(asModuleUrl(catalogModule));
};

const {
  closetSubSequence,
  closetGroups,
  allClosetTypeSet,
  getNextClosetSub,
  graduationSeasonSlugs,
  heldClosetOrder,
  isProfessionalVideoFocus,
  matchesSub,
  matchesSourceFilter,
  seasonGraduationItems,
  searchIndex,
  showcaseClusterOrder,
  sourceCollectionName,
  sourceKind,
  wikiItems,
  zhItemName,
  zhItemSearchNames,
  zhName,
} = await loadCatalogDomain();

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

test("player-friendly names use known catalog guids", async () => {
  const playerNames = JSON.parse(
    await readFile(new URL("../app/player-zh-names.json", import.meta.url), "utf8"),
  );
  const catalogGuids = new Set(wikiItems.map((entry) => entry.guid));
  assert.equal(Object.keys(playerNames.items).length, 39);
  for (const [guid, name] of Object.entries(playerNames.items)) {
    assert.ok(catalogGuids.has(guid), `unknown guid: ${guid}`);
    assert.match(name, /[\u3400-\u9fff]/);
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
    ["instrument-fortune-drum", "幸運鼓"],
    ["held-treasure-shovel", "尋寶鏟"],
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
  assert.equal(wardrobeItems.length, 1169);
  for (const entry of wardrobeItems) {
    assert.match(zhItemName(entry), /[\u3400-\u9fff]/, entry.name);
  }
});

test("keeps formerly ambiguous paid and held-prop names distinct", () => {
  const byName = (name) => wikiItems.find((entry) => entry.name === name);
  assert.equal(zhItemName(byName("Journey Cape")), "風之旅人斗篷");
  assert.equal(zhItemName(byName("FlOw Cape")), "FlOw 斗篷");
  assert.equal(zhItemName(byName("Manatee Toy")), "海牛公仔");
  assert.equal(zhItemName(byName("Manatee Plush")), "海牛玩偶");
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
  assert.ok(instruments.some((entry) => entry.name === "Transverse Flute"));
  for (const [name, guid] of [
    ["Sanctuary Handpan", "Hvq52gCeih"],
    ["Prophecy Drum", "wGQSuhVWXD"],
    ["Bugle", "B59f4_ru60"],
    ["Grand Piano", "WuZeLoUATs"],
    ["Duets Grand Piano", "O9jSph-v7e"],
    ["Fledgling Upright Piano", "10Ol7H9jKg"],
    ["Jam Station", "WMNr4yo_35"],
  ]) {
    assert.equal(instruments.find((entry) => entry.name === name)?.guid, guid);
  }
  assert.equal(
    instruments.find((entry) => entry.name === "Grand Piano")?.group,
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
    [34, 1, 3],
  );
  assert.equal(matchesSub(instrumentByName("Jam Station"), "large"), true);
  for (const name of [
    "Grand Piano",
    "Duets Grand Piano",
    "Fledgling Upright Piano",
  ]) {
    assert.equal(matchesSub(instrumentByName(name), "small"), true);
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
  const heldFromScreenshot = byName("Company-Issued Laptop");
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
    63,
  );
  const heldItems = wikiItems
    .filter((entry) => matchesSub(entry, "held"))
    .sort(
      (a, b) =>
        heldClosetOrder.get(a.name) - heldClosetOrder.get(b.name),
    );
  assert.deepEqual(
    heldItems.map((entry) => entry.name),
    [...heldClosetOrder.keys()],
  );
  for (const name of [
    "Dark Horn",
    "Blue Umbrella",
    "Manatee Staff",
    "Sentry Spear",
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
