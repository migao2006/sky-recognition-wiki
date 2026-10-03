import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const { filterCatalogItems } = await tsImport("../app/catalog-filter.ts", import.meta.url);
const catalog = await loadRuntimeCatalog();
const defaults = {
  closetTypes: ["Outfit", "Shoes", "OutfitShoes"], sub: "Outfit",
  query: "", season: "全部季節", sourceFilter: "all", focusMode: "all",
};
const filter = (options = {}, runtime = catalog) => filterCatalogItems(runtime, { ...defaults, ...options });
const guids = (items) => items.map((item) => item.guid);

test("every closet tab preserves its catalog membership and order without mutating the catalog", () => {
  const original = guids(catalog.wikiItems);
  for (const closet of catalog.closetGroups) {
    for (const sub of closet.subs) {
      const order = sub.key === "held" ? "held" : sub.key === "large" ? "shared" : "type";
      const expected = catalog.wikiItems.filter((item) => closet.types.includes(item.type) && catalog.matchesSub(item, sub.key))
        .sort((a, b) => catalog.compareCatalogItems(a, b, order));
      assert.ok(expected.length, sub.key);
      assert.deepEqual(guids(filter({ closetTypes: closet.types, sub: sub.key })), guids(expected), sub.key);
    }
  }
  assert.deepEqual(guids(catalog.wikiItems), original);
});

test("search is case-insensitive, trims whitespace and spans closets while blank search stays in its tab", () => {
  const harp = catalog.officialHeldIdentities.Harp.guid;
  assert.ok(guids(filter({ query: "  HARP  " })).includes(harp));
  assert.ok(!guids(filter({ query: "   " })).includes(harp));
  assert.deepEqual(filter({ query: "no-such-item-for-catalog-filter-test" }), []);
});

test("search never bypasses source, season, closet eligibility or missing search entries", () => {
  const item = (guid, overrides = {}) => ({
    guid, id: 1, order: 1, name: guid, type: "Hair", section: "seasons",
    collection: "season-a", group: "", wiki: "", icon: "", ...overrides,
  });
  const runtime = {
    ...catalog,
    wikiItems: [item("match"), item("other-season", { collection: "season-b" }),
      item("other-source", { section: "base" }), item("not-in-closets", { type: "Emote" }), item("unindexed")],
    searchIndex: new Map(["match", "other-season", "other-source", "not-in-closets"].map((guid) => [guid, "needle"])),
  };
  assert.deepEqual(guids(filter({ query: "needle", sourceFilter: "seasons", season: "season-a" }, runtime)), ["match"]);
  assert.deepEqual(new Set(guids(filter({ query: "needle", sourceFilter: "seasons" }, runtime))), new Set(["match", "other-season"]));
  assert.deepEqual(new Set(guids(filter({ query: "needle", season: "unused-season" }, runtime))), new Set(["match", "other-season", "other-source"]));
});

test("focus shortcuts include only their existing membership, including paid and free limited items", () => {
  const base = { id: 1, order: 1, type: "Outfit", collection: "test", icon: "", wiki: "", section: "base", group: "" };
  const items = [
    { ...base, guid: "ordinary", name: "ordinary" },
    { ...base, guid: "ultimate", name: "ultimate", section: "seasons", group: "Ultimate" },
    { ...base, guid: "paid", name: "paid", wiki: "https://example.com/Pack" },
    { ...base, guid: "limited", name: "limited" },
  ];
  const runtime = { ...catalog, wikiItems: items,
    isLimitedItem: (item) => item.guid === "limited",
    isProfessionalVideoFocus: (item) => ["ultimate", "paid"].includes(item.guid),
  };
  assert.deepEqual(guids(filter({ focusMode: "ultimate" }, runtime)), ["ultimate"]);
  assert.deepEqual(new Set(guids(filter({ focusMode: "limited" }, runtime))), new Set(["paid", "limited"]));
  assert.deepEqual(new Set(guids(filter({ focusMode: "video" }, runtime))), new Set(["ultimate", "paid"]));
  assert.equal(filter({}, runtime).length, 4);
});

test("search uses type order instead of the active held or large-prop order", () => {
  const modes = [];
  const runtime = { ...catalog, compareCatalogItems: (a, b, mode) => {
    modes.push(mode);
    return catalog.compareCatalogItems(a, b, mode);
  } };
  const props = catalog.closetGroups.find((closet) => closet.key === "props");
  for (const sub of ["held", "large"]) {
    modes.length = 0;
    assert.ok(filter({ closetTypes: props.types, sub, query: "piano" }, runtime).length > 1);
    assert.deepEqual(new Set(modes), new Set(["type"]));
  }
});
