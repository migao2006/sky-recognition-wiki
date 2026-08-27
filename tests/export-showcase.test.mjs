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

const showcaseSource = (
  await readFile(new URL("../app/export-showcase.ts", import.meta.url), "utf8")
).replace('import type { WikiItem } from "./wiki-data";', "");
const {
  buildShowcaseGroups,
  measureShowcaseCanvas,
} = await import(
  asModuleUrl(showcaseSource)
);

let fixtureId = 0;
const item = (overrides = {}) => ({
  id: 1,
  order: 1,
  guid: `item-${fixtureId++}`,
  name: "Test Item",
  type: "Cape",
  group: "",
  icon: "",
  wiki: "",
  section: "base",
  collection: "base",
  ...overrides,
});

const options = (items) => ({
  items,
  isUltimate: (entry) => entry.group === "Ultimate",
  isLimited: (entry) => entry.group === "Limited",
  isPendant: (entry) => entry.type === "Necklace",
  getClusterName: (entry) => entry.collection,
  getClusterOrder: (entry) =>
    ({ gratitude: 0, rhythm: 3, sanctuary: 5, aurora: 14 }[
      entry.collection
    ] ?? entry.order),
  getItemTypeName: (entry) => entry.type,
  getItemTypeOrder: (entry) =>
    ({ Outfit: 0, Cape: 1, Prop: 2 }[entry.type] ?? 99),
});

test("sorts season graduation clusters from oldest to newest", () => {
  const groups = buildShowcaseGroups(
    options([
      item({ guid: "sanctuary", group: "Ultimate", section: "seasons", collection: "sanctuary" }),
      item({ guid: "rhythm", group: "Ultimate", section: "seasons", collection: "rhythm" }),
      item({ guid: "gratitude", group: "Ultimate", section: "seasons", collection: "gratitude" }),
    ]),
  );
  assert.equal(groups[0].name, "季節畢業");
  assert.deepEqual(
    groups[0].clusters.map((cluster) => cluster.name),
    ["gratitude", "rhythm", "sanctuary"],
  );
});

test("places a season pendant before its graduation gifts", () => {
  const groups = buildShowcaseGroups(
    options([
      item({ guid: "gift", id: 1, group: "Ultimate", section: "seasons", collection: "gratitude", type: "Cape" }),
      item({ guid: "pendant", id: 99, group: "Ultimate", section: "seasons", collection: "gratitude", type: "Necklace" }),
    ]),
  );
  assert.deepEqual(
    groups[0].clusters[0].items.map((entry) => entry.guid),
    ["pendant", "gift"],
  );
});

test("uses fixed cluster and wardrobe type ordering", () => {
  const groups = buildShowcaseGroups(
    options([
      item({ guid: "prop", type: "Prop" }),
      item({ guid: "platform", group: "Limited", section: "store", collection: "platform", order: 30 }),
      item({ guid: "cape", type: "Cape" }),
      item({ guid: "season-collab", group: "Limited", section: "seasons", collection: "aurora" }),
      item({ guid: "outfit", type: "Outfit" }),
      item({ guid: "event-collab", group: "Limited", section: "events", collection: "event-collab", order: 20 }),
    ]),
  );
  const limited = groups.find((group) => group.key === "limited");
  const other = groups.find((group) => group.key === "other");
  assert.deepEqual(
    limited.clusters.map((cluster) => cluster.name),
    ["aurora", "event-collab", "platform"],
  );
  assert.deepEqual(
    other.clusters.map((cluster) => cluster.name),
    ["Outfit", "Cape", "Prop"],
  );
});

test("adds a compact valuation summary without changing collection layout", () => {
  const entries = [item({ guid: "cape", type: "Cape" })];
  const collection = measureShowcaseCanvas({
    ...options(entries),
    preset: "collection",
  });
  const valuation = measureShowcaseCanvas({
    ...options(entries),
    preset: "valuation",
    valuation: {
      midpoint: 35000,
      range: { low: 32000, high: 38000 },
      confidence: "高信心",
      completeness: 100,
      itemCount: 1,
      highlights: ["追光季"],
    },
  });
  assert.equal(collection.width, 1600);
  assert.equal(valuation.width, collection.width);
  assert.equal(valuation.height, collection.height + 236);
});

test("uses the shared valuation wording in image summaries", () => {
  assert.match(showcaseSource, /估價摘要/);
  assert.match(showcaseSource, /參考中位價/);
  assert.match(showcaseSource, /價格區間/);
  assert.match(showcaseSource, /估價完整度/);
  assert.doesNotMatch(showcaseSource, /合理區間|尚無足夠估價重點|`完整度 \$\{/);
});

test("keeps the complete catalog export within mobile canvas limits", async () => {
  const [wikiSource, valuationSource, catalogSource, wikiZhSource, playerZhSource, playerHairSource] = await Promise.all(
    ["wiki-data.ts", "valuation-items.ts", "catalog-domain.ts", "wiki-zh-names.json", "player-zh-names.json", "player-hair-names.json"].map((file) =>
      readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
    ),
  );
  const valuationUrl = asModuleUrl(valuationSource);
  const catalogUrl = asModuleUrl(
    catalogSource
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
          `const {${imports}} = await import(${JSON.stringify(valuationUrl)});`,
      ),
  );
  const [catalog, valuation] = await Promise.all([
    import(catalogUrl),
    import(valuationUrl),
  ]);
  const selected = catalog.wikiItems.filter((entry) =>
    catalog.allClosetTypeSet.has(entry.type),
  );
  const size = measureShowcaseCanvas({
    items: selected,
    isUltimate: valuation.isSeasonUltimate,
    isLimited: (entry) =>
      valuation.isPaidItem(entry) || catalog.isLimitedItem(entry),
    isPendant: valuation.isSeasonPendant,
    getClusterName: (entry) =>
      entry.section === "seasons"
        ? catalog.seasonZh[entry.collection] || entry.collection
        : entry.section === "events"
          ? catalog.eventZh[entry.collection] || entry.collection
          : entry.section === "realms"
            ? catalog.realmZh[entry.collection] || "常駐地圖"
            : entry.section === "store"
              ? catalog.storeSource(entry)
              : catalog.sourceKind(entry),
    getClusterOrder: catalog.showcaseClusterOrder,
    getItemTypeName: (entry) => catalog.labels[entry.type] || entry.type,
    getItemTypeOrder: (entry) => catalog.typeOrder.get(entry.type) ?? 999,
  });
  assert.equal(selected.length, 1164);
  assert.equal(size.width, 1600);
  assert.ok(size.height <= 16384);
  assert.ok(size.width * size.height <= 16777216);
});
