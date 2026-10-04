import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { loadValuationRuntime } from "../scripts/load-valuation-runtime.mjs";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";


const calibrationLoaded = await tsImport("../app/valuation-profile.ts", import.meta.url);
const marketModule = await tsImport(
  "../app/market-collectibles.ts",
  import.meta.url,
);
const marketGuidByName = new Map(
  marketModule.importantMarketCollectibles.flatMap((profile) =>
    [profile.name, ...profile.aliases].map((name) => [name, profile.guid]),
  ),
);
const loaded = await loadValuationRuntime();
const { analyzeValuation, estimateValuation } = loaded;
const bindings = (values = {}) => ({
  google: "none",
  nintendo: "none",
  gameCenter: "none",
  facebook: "none",
  steam: "none",
  twitch: "none",
  playstation: "none",
  ...values,
});
const item = (values = {}) => ({
  id: 1,
  order: 1,
  guid: Math.random().toString(),
  name: "Item",
  type: "Cape",
  group: "",
  icon: "",
  previewUrl: "",
  wiki: "https://example.test/Item",
  section: "events",
  collection: "event",
  ...values,
  guid: marketGuidByName.get(values.name) ?? values.guid ?? `test-${values.name ?? "item"}`,
});
const domain = {
  isValuationFocus: (value) => value.name !== "ordinary",
  isLimitedItem: (value) =>
    value.collection === "collab" || value.group === "Limited",
  sourceKind: (value) => (value.collection === "collab" ? "聯動" : "活動"),
  getZhName: (value) => value.name,
  getSource: (value) => value.collection,
  ongoingSeasonSlugs: new Set(),
  graduationSeasonSlugs: ["enchantment", "sanctuary"],
  seasonGraduationItems: new Map([
    [
      "enchantment",
      [
        item({ group: "Ultimate", section: "seasons" }),
        item({ group: "Ultimate", section: "seasons" }),
      ],
    ],
    ["sanctuary", [item({ group: "Ultimate", section: "seasons" })]],
  ]),
  sortSeasonSlugs: (slugs) => [...slugs].sort(),
};
const analyze = (
  chosen,
  selectedBindings = bindings(),
  bindingsConfirmed = false,
) =>
  analyzeValuation({
    chosen,
    bindings: selectedBindings,
    bindingNote: "",
    bindingsConfirmed,
    domain,
  });

test("candle redemptions do not increase paid package count or package contributions", async () => {
  const { loadRuntimeCatalog } = await import("../scripts/load-runtime-catalog.mjs");
  const catalog = await loadRuntimeCatalog();
  const chosen = ["si_8YhNtmr", "-HtIAPjYsa"].map(guid => catalog.wikiItems.find(item => item.guid === guid));
  assert.ok(chosen.every(Boolean));
  const result = estimateValuation({ analysis: analyze(chosen) });
  assert.ok(result);
  assert.equal(result.marketProfile.paidItemCount, 0);
  assert.equal(result.marketProfile.canonicalPackageCount, 0);
  assert.equal(result.contributions.filter(row => row.group === "package").length, 0);
});

test("a partial season is not treated as a break and kept platform content is excluded", () => {
  const partial = item({
    name: "Enchantment Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "enchantment",
  });
  const platform = item({
    name: "PlayStation Cape",
    wiki: "https://wiki.test/PlayStation_Pack",
    group: "Limited",
    collection: "collab",
  });
  const completeNextSeason = item({
    name: "Sanctuary Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "sanctuary",
  });
  const result = estimateValuation({
    analysis: analyze(
      [partial, completeNextSeason, platform],
      bindings({ playstation: "keep" }),
    ),
  });
  assert.ok(result);
  assert.equal(result.marketProfile.breakClass, "none");
  assert.equal(result.marketProfile.partialSeasons, 1);
  assert.equal(
    result.contributions.some(
      (row) => row.group === "market" && row.label.includes("缺少畢業禮"),
    ),
    false,
  );
  assert.equal(
    result.contributions.some((row) => row.group === "package"),
    false,
  );
  assert.ok(result.warnings.some((warning) => warning.includes("playstation")));
});

test("cat costume and ear-tail duo are distinct packages with deduplicated members", async () => {
  const catalog = await loadRuntimeCatalog();
  const resolver = catalog.buildCatalogNameResolver(catalog.wikiItems, catalog.zhItemSearchNames);
  const price = text => {
    const matches = resolver.scan(text);
    const chosen = [...new Map([...matches.matched, ...matches.groups].flatMap(m => m.candidates.map(i => [i.guid, i]))).values()];
    return estimateValuation({ analysis: analyzeValuation({
      chosen, bindings: bindings(), bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName },
    }) }).marketProfile.canonicalPackageCount;
  };
  assert.equal(price("貓貓套裝｜貓咪面具｜貓咪斗篷｜貓貓禮包"), 1);
  assert.equal(price("貓貓套裝｜貓咪耳尾"), 2);
  assert.equal(price("貓貓套裝｜貓咪耳尾｜炸毛貓貓｜炸毛貓玩偶"), 3);
});

test("fortune doll set aliases reconstruct three cosmetics but one paid package", async () => {
  const catalog = await loadRuntimeCatalog();
  const resolver = catalog.buildCatalogNameResolver(catalog.wikiItems, catalog.zhItemSearchNames);
  const matches = resolver.scan("福娃套裝｜新春福娃套裝｜雙丸子頭");
  const chosen = [...new Map([...matches.matched, ...matches.groups].flatMap(match => match.candidates.map(item => [item.guid, item]))).values()];
  assert.equal(chosen.length, 3);
  const result = estimateValuation({ analysis: analyzeValuation({
    chosen, bindings: bindings(), bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName },
  }) });
  assert.equal(result.marketProfile.canonicalPackageCount, 1);
});

test("moonlight set aliases count two cosmetics once and earrings separately", async () => {
  const catalog = await loadRuntimeCatalog();
  const resolver = catalog.buildCatalogNameResolver(catalog.wikiItems, catalog.zhItemSearchNames);
  const matches = resolver.scan("嫦娥套裝｜月華套裝｜嫦娥髮型｜月華服裝");
  const chosen = [...new Map([...matches.matched, ...matches.groups].flatMap(match => match.candidates.map(item => [item.guid, item]))).values()];
  assert.equal(chosen.length, 2);
  const price = items => estimateValuation({ analysis: analyzeValuation({
    chosen: items, bindings: bindings(), bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName },
  }) });
  assert.equal(price(chosen).marketProfile.canonicalPackageCount, 1);
  const earrings = catalog.wikiItems.find(item => item.guid === "XURacs6BHP");
  assert.equal(price([...chosen, earrings]).marketProfile.canonicalPackageCount, 2);
});

test("Alice dress and bow remain one paid package even with repeated set names", async () => {
  const catalog = await loadRuntimeCatalog();
  const resolver = catalog.buildCatalogNameResolver(catalog.wikiItems, catalog.zhItemSearchNames);
  const matches = resolver.scan("愛麗絲套裝｜愛麗絲裙裝｜愛麗絲蝴蝶結");
  const chosen = [...new Map([...matches.matched, ...matches.groups].flatMap(match => match.candidates.map(item => [item.guid, item]))).values()];
  assert.equal(chosen.length, 2);
  const result = estimateValuation({ analysis: analyzeValuation({
    chosen, bindings: bindings(), bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName },
  }) });
  assert.equal(result.marketProfile.canonicalPackageCount, 1);
});

test("fortune fish pack excludes the separately purchased fish accessory", async () => {
  const catalog = await loadRuntimeCatalog();
  const resolver = catalog.buildCatalogNameResolver(catalog.wikiItems, catalog.zhItemSearchNames);
  const [group] = resolver.scan("錦鯉套裝").groups;
  assert.deepEqual(group.candidates.map(item => item.guid).sort(), ["A26TJj3cSl", "mzF6ZaHa1s"]);
  const accessory = catalog.wikiItems.find(item => item.guid === "OjSfpOgFoR");
  assert.deepEqual([accessory.id, accessory.order, accessory.name, accessory.type], [1731, 3600, "Fortune Fish Accessory", "HairAccessory"]);
  assert.equal(catalog.isPaidItem(accessory), true);
  const price = chosen => estimateValuation({ analysis: analyzeValuation({
    chosen, bindings: bindings(), bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName },
  }) });
  const packOnly = price(group.candidates);
  const withAccessory = price([...group.candidates, accessory]);
  assert.equal(packOnly.marketProfile.canonicalPackageCount, 1);
  assert.equal(withAccessory.marketProfile.canonicalPackageCount, 2);
  assert.ok(withAccessory.midpoint >= packOnly.midpoint);
  assert.equal(resolver.scan("沒有錦鯉套裝").groups.length, 0);
});

test("sale package wording uses conservative unique-package thresholds", () => {
  const { classifySalePackageTier } = calibrationLoaded;
  assert.equal(classifySalePackageTier(0).key, "few");
  assert.equal(classifySalePackageTier(59).key, "few");
  assert.equal(classifySalePackageTier(60).key, "medium");
  assert.equal(classifySalePackageTier(89).key, "medium");
  assert.equal(classifySalePackageTier(90).key, "many");
  assert.equal(classifySalePackageTier(189).key, "many");
});

test("confirmed all-none bindings count as complete account information", () => {
  const unconfirmed = analyze([item({ wiki: "https://wiki.test/Pack" })]);
  const confirmed = analyze([item({ wiki: "https://wiki.test/Pack" })], bindings(), true);
  assert.ok(confirmed.completeness > unconfirmed.completeness);
  assert.equal(confirmed.bindingsConfirmed, true);
});

test("no old price is returned even for all items, resources and known bindings", async () => {
  const catalog = await loadRuntimeCatalog();
  const analysis = analyzeValuation({ chosen: catalog.wikiItems, bindings: bindings(),
    bindingsConfirmed: true, bindingNote: "", domain: { ...catalog, getZhName: catalog.zhItemName } });
  const result = estimateValuation({ analysis, resources: { candles: 999999, hearts: 999999, passes: 999 } });
  assert.equal(result.status, "unavailable");
  assert.equal(result.range, null);
  assert.equal(result.midpoint, null);
  assert.deepEqual(result.contributions, []);
  assert.equal(result.modelFeatures.modelRevision, "tabpfn-v2-extended-2026-10-04");
  assert.equal(result.confidence, "inferred");
  assert.ok(result.warnings.some(text => text.includes("未通過獨立成交驗證")));
});

test("pendants cannot create a graduation start, and unknown binding remains null", () => {
  const analysis = analyze([item({ name: "Enchantment Ultimate Pendant", type: "Necklace", group: "Ultimate", section: "seasons", collection: "enchantment" })]);
  assert.equal(analysis.startSeasonSlug, null);
  const result = estimateValuation({ analysis });
  assert.equal(result.modelFeatures.bindingRiskCount, null);
  assert.equal(result.midpoint, null);
  assert.equal(result.modelFeatures.breakClass, null);
  assert.equal(result.evidence.method, "tabpfn");
});

test("empty selection has no estimate; all prices require the local model response", () => {
  assert.equal(estimateValuation({ analysis: analyze([]) }), null);
  const result = estimateValuation({ analysis: analyze([item({ name: "China Pack", wiki: "https://example.test/China_Pack" })]) });
  assert.equal(result.marketProfile.canonicalPackageCount, 0);
  assert.equal(result.range, null);
  assert.equal(result.midpoint, null);
  const ordinary = estimateValuation({ analysis: analyze([item({ name: "ordinary" })]) });
  assert.equal(ordinary.evidence.method, "tabpfn");
  assert.equal(ordinary.midpoint, null);
});

test("an ongoing season gift can establish origin without inventing later breaks", () => {
  const analysis = analyzeValuation({ chosen: [item({ name: "Current gift", group: "Ultimate", section: "seasons", collection: "dear-van-gogh" })],
    bindings: bindings(), bindingNote: "", domain: { ...domain, ongoingSeasonSlugs: new Set(["dear-van-gogh"]) } });
  assert.equal(analysis.startSeasonSlug, "dear-van-gogh");
  const result = estimateValuation({ analysis });
  assert.equal(result.modelFeatures.breakClass, null);
  assert.equal(result.midpoint, null);
});
