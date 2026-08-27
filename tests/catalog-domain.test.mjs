import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const asModuleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )}`;

const loadCatalogDomain = async () => {
  const [wikiSource, valuationSource, catalogSource] = await Promise.all(
    ["wiki-data.ts", "valuation-items.ts", "catalog-domain.ts"].map((file) =>
      readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
    ),
  );
  const catalogModule = catalogSource
    .replace(
      'import { wikiItems as baseWikiItems } from "./wiki-data";',
      `const { wikiItems: baseWikiItems } = await import(${JSON.stringify(
        asModuleUrl(wikiSource),
      )});`,
    )
    .replace(
      /import \{([\s\S]*?)\} from "\.\/valuation-items";/,
      (_, imports) =>
        `const {${imports}} = await import(${JSON.stringify(
          asModuleUrl(valuationSource),
        )});`,
    );
  return import(asModuleUrl(catalogModule));
};

const {
  closetGroups,
  graduationSeasonSlugs,
  isProfessionalVideoFocus,
  matchesSub,
  matchesSourceFilter,
  seasonGraduationItems,
  showcaseClusterOrder,
  sourceKind,
  wikiItems,
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

test("uses verified game placement categories for representative props", () => {
  const byName = (name) => wikiItems.find((entry) => entry.name === name);
  const held = byName("Lightseekers Ultimate Umbrella");
  const large = byName("Challenge Bounce Pad Level 3");
  const small = byName("Tournament Skyball Set");
  assert.ok(held && large && small);
  assert.equal(matchesSub(held, "held"), true);
  assert.equal(matchesSub(held, "small"), false);
  assert.equal(matchesSub(large, "large"), true);
  assert.equal(matchesSub(large, "small"), false);
  assert.equal(matchesSub(small, "small"), true);
  assert.equal(matchesSub(small, "large"), false);

  const propTypes = new Set(["Instrument", "Prop", "Furniture"]);
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
