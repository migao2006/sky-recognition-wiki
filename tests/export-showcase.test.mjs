import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCatalogRuntime,
  loadShowcaseRuntime,
} from "./helpers/catalog-runtime.mjs";

const {
  buildShowcaseGroups,
  orderShowcaseItems,
  source: showcaseSource,
  measureShowcaseCanvas,
  planShowcasePageItems,
  planShowcasePages,
} = await loadShowcaseRuntime();

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
  const settings = options([
    item({ guid: "prop", type: "Prop" }),
    item({ guid: "platform", group: "Limited", section: "store", collection: "platform", order: 30 }),
    item({ guid: "cape", type: "Cape" }),
    item({ guid: "season-collab", group: "Limited", section: "seasons", collection: "aurora" }),
    item({ guid: "outfit", type: "Outfit" }),
    item({ guid: "event-collab", group: "Limited", section: "events", collection: "event-collab", order: 20 }),
  ]);
  const groups = buildShowcaseGroups(settings);
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
  assert.deepEqual(
    orderShowcaseItems(settings).map((entry) => entry.guid),
    groups.flatMap((group) =>
      group.clusters.flatMap((cluster) =>
        cluster.items.map((entry) => entry.guid),
      ),
    ),
  );
});

test("keeps store items with different displayed sources in separate clusters", () => {
  const settings = {
    ...options([
      item({ guid: "regular", group: "Limited", section: "store", collection: "store", wiki: "regular" }),
      item({ guid: "nintendo", group: "Limited", section: "store", collection: "store", wiki: "nintendo" }),
      item({ guid: "playstation", group: "Limited", section: "store", collection: "store", wiki: "playstation" }),
    ]),
    getClusterName: (entry) => entry.wiki,
    getClusterOrder: (entry) =>
      entry.wiki === "regular" ? 5000 : 3000,
  };
  const limited = buildShowcaseGroups(settings).find(
    (group) => group.key === "limited",
  );
  assert.deepEqual(
    limited.clusters.map((cluster) => cluster.name),
    ["nintendo", "playstation", "regular"],
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

test("includes the valuation summary in pagination without clipping items", () => {
  const entries = [item({ guid: "valuation-cape", type: "Cape" })];
  const settings = {
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
  };
  const measured = measureShowcaseCanvas(settings);
  const plan = planShowcasePageItems(settings);

  assert.equal(
    plan.pages.reduce((total, page) => total + page.height, 0),
    measured.height,
  );
  assert.deepEqual(
    plan.pageItems.flat().map((entry) => entry.guid),
    ["valuation-cape"],
  );
});

test("uses the shared valuation wording in image summaries", () => {
  assert.match(showcaseSource, /估價摘要/);
  assert.match(showcaseSource, /參考中位價/);
  assert.match(showcaseSource, /價格區間/);
  assert.match(showcaseSource, /估價完整度/);
  assert.doesNotMatch(showcaseSource, /合理區間|尚無足夠估價重點|`完整度 \$\{/);
});

test("splits oversized exports into safe numbered canvas pages", () => {
  const entries = Array.from({ length: 4_000 }, (_, index) =>
    item({ guid: `oversized-${index}`, type: "Cape", order: index }),
  );
  const pages = planShowcasePages({ ...options(entries), preset: "collection" });
  assert.ok(pages.length > 1);
  assert.equal(pages[0].offsetY, 0);
  assert.equal(pages.at(-1).offsetY, pages[0].height * (pages.length - 1));
  assert.ok(pages.every((page) => page.height <= 10_000));
});

test("keeps a fitting showcase group together before splitting a later group", () => {
  const entries = [
    ...Array.from({ length: 1_700 }, (_, index) =>
      item({ guid: `ultimate-${index}`, group: "Ultimate", order: index }),
    ),
    ...Array.from({ length: 1_700 }, (_, index) =>
      item({ guid: `wardrobe-${index}`, group: "", order: index }),
    ),
  ];
  const firstGroup = entries.slice(0, 1_700);
  const firstGroupPages = planShowcasePages({
    ...options(firstGroup),
    preset: "collection",
  });
  const pages = planShowcasePages({ ...options(entries), preset: "collection" });
  assert.ok(pages.length > 1);
  assert.equal(firstGroupPages.length, 1);
  assert.ok(pages[0].height >= firstGroupPages[0].height - 12);
  assert.equal(pages[1].offsetY, pages[0].height);
  assert.equal(
    pages.reduce((total, page) => total + page.height, 0),
    measureShowcaseCanvas({ ...options(entries), preset: "collection" }).height,
  );
});

test("assigns every icon to each canvas page it crosses", () => {
  const entries = Array.from({ length: 4_000 }, (_, index) =>
    item({ guid: `boundary-${index}`, type: "Cape", order: index }),
  );
  const plan = planShowcasePageItems({ ...options(entries), preset: "collection" });
  assert.ok(plan.pages.length > 1);
  assert.equal(
    new Set(plan.pageItems.flat().map((entry) => entry.guid)).size,
    entries.length,
  );
  assert.ok(plan.pageItems.every((entries) => entries.length > 0));
});

test("reports image load outcomes and progress through the export API", () => {
  assert.match(showcaseSource, /loadedIconCount/);
  assert.match(showcaseSource, /failedIconCount/);
  assert.match(showcaseSource, /onProgress/);
  assert.match(showcaseSource, /phase: "loading-icons"/);
  assert.match(showcaseSource, /phase: "rendering"/);
});

test("decodes and releases icon batches one export page at a time", () => {
  assert.match(showcaseSource, /const loadPageIcons/);
  assert.match(showcaseSource, /image\.decode\(\)/);
  assert.match(showcaseSource, /exportIconBatchSize = 12/);
  assert.match(showcaseSource, /exportDrawBatchSize = 48/);
  assert.match(showcaseSource, /await yieldToBrowser\(\)/);
  assert.match(showcaseSource, /icons\.clear\(\)/);
  assert.match(showcaseSource, /releasePageIcons/);
  assert.match(showcaseSource, /iconCache\.delete/);
  assert.match(showcaseSource, /completedIconCount = Math\.min/);
});

test("keeps the complete catalog export within mobile canvas limits", async () => {
  const catalog = await loadCatalogRuntime();
  const valuation = catalog;
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
  assert.equal(selected.length, 1171);
  assert.equal(size.width, 1600);
  const pages = planShowcasePages({
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
  assert.ok(pages.every((page) => page.height <= 10_000));
  assert.equal(
    pages.reduce((total, page) => total + page.height, 0),
    size.height,
  );
});
