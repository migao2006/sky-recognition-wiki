import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { asModuleUrl } from "./helpers/transpile.mjs";
import { marketCollectiblesModuleUrl } from "./helpers/market-collectibles.mjs";

const [bundleSource] = await Promise.all(
  ["bundle-presets.ts"].map((file) =>
    readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
  ),
);
const marketUrl = await marketCollectiblesModuleUrl();
const { importantMarketCollectibles, marketCollectibleProfile } = await import(marketUrl);
const { bundlePresets } = await import(
  asModuleUrl(
    bundleSource.replace(
      'import { marketProfileNamesForSeries } from "./market-collectibles";',
      `const { marketProfileNamesForSeries } = await import(${JSON.stringify(marketUrl)});`,
    ),
  )
);
const catalog = await loadRuntimeCatalog();
const iapCatalog = JSON.parse(
  await readFile(new URL("../app/iap-catalog.json", import.meta.url), "utf8"),
);

test("generated IAP metadata covers every mapped catalog item by GUID", () => {
  assert.match(iapCatalog.sourceVersion, /^\d+\.\d+\.\d+$/);
  assert.match(iapCatalog.sourceUrl, new RegExp(`@${iapCatalog.sourceVersion}/`));
  assert.ok(iapCatalog.items.length >= 200);
  assert.equal(new Set(iapCatalog.items.map((item) => item.guid)).size, iapCatalog.items.length);
  for (const row of iapCatalog.items) {
    const item = catalog.wikiItems.find((entry) => entry.guid === row.guid);
    assert.ok(item, `missing catalog item for ${row.guid}`);
    assert.equal(item.name, row.name, row.guid);
    const profile = marketCollectibleProfile(item.name, item.guid);
    assert.equal(typeof row.paid, "boolean", row.name);
    assert.equal(typeof profile?.paid, "boolean", row.name);
    assert.ok(profile?.packageKey, row.name);
    assert.ok(profile?.playerName, row.name);
  }
});

test("uses exact GUID mappings for the corrected paid held props", () => {
  const rows = new Map(iapCatalog.items.map((item) => [item.guid, item]));
  for (const [guid, name] of [
    ["5xJ_mCzZQy", "Moonlight Lantern"],
    ["uzos22Ysp3", "Fortune Enchanted Umbrella"],
    ["HEV8fvTQwQ", "Fortune Hand Fan"],
    ["4CYafmMUql", "Days of Summer Umbrella"],
    ["vPenDMkJkY", "Anniversary Popcorn"],
  ]) {
    const row = rows.get(guid);
    assert.equal(row?.name, name);
    assert.equal(row?.paid, true);
  }
  assert.equal(rows.has("vx4vxVJ0L1"), false, "furniture Moonlight Lantern is not the paid held prop");
});

test("important market collectibles have complete structured metadata", () => {
  assert.ok(importantMarketCollectibles.length >= 30);
  assert.equal(
    new Set(importantMarketCollectibles.map((profile) => profile.name)).size,
    importantMarketCollectibles.length,
  );
  importantMarketCollectibles.forEach((profile) => {
    assert.ok(profile.playerName && /[^\x00-\x7f]/.test(profile.playerName));
    assert.ok(profile.series);
    assert.ok(["global", "china", "platform"].includes(profile.availability));
    assert.ok(profile.valuationMultiplier > 0);
    assert.equal(profile.saleCopy, true);
    assert.equal(typeof profile.paid, "boolean");
    assert.ok(["high", "standard"].includes(profile.valuationTier));
    assert.ok(
      ["collaboration", "important", "special"].includes(profile.saleSection),
    );
    assert.ok(Number.isFinite(profile.salePriority));
    assert.ok(Array.isArray(profile.aliases));
    if (profile.availability === "platform") assert.ok(profile.platform);
  });
});

test("important market profiles resolve to one real wardrobe item", () => {
  importantMarketCollectibles.forEach((profile) => {
    const matches = catalog.wikiItems.filter((item) =>
      profile.guid ? item.guid === profile.guid : item.name === profile.name,
    );
    assert.equal(matches.length, 1, profile.name);
    assert.notEqual(catalog.zhItemName(matches[0]), matches[0].name, profile.name);
  });
});

test("keeps major collaboration series and Nintendo source coverage", () => {
  const counts = new Map();
  importantMarketCollectibles.forEach((profile) =>
    counts.set(profile.series, (counts.get(profile.series) ?? 0) + 1),
  );
  for (const [series, minimum] of [
    ["絆愛", 3],
    ["九色鹿", 3],
    ["小王子", 3],
    ["AURORA", 10],
    ["姆明", 7],
    ["大耳狗", 6],
    ["Nintendo", 4],
    ["風之旅人", 3],
    ["PlayStation", 3],
  ]) {
    assert.ok((counts.get(series) ?? 0) >= minimum, series);
  }
  const flute = catalog.wikiItems.find((item) => item.name === "Vessel Flute");
  assert.equal(catalog.sourceKind(flute), "平台限定");
  assert.equal(catalog.sourceCollectionName(flute), "Nintendo Switch 專屬");
  const playstationCape = importantMarketCollectibles.find(
    (profile) => profile.name === "Transcendent Journey Cape",
  );
  assert.equal(playstationCape?.platform, "playstation");
  assert.equal(playstationCape?.packageKey, "transcendent-journey-pack");
});

test("separates important visibility from paid valuation", () => {
  const byName = new Map(
    importantMarketCollectibles.map((profile) => [profile.name, profile]),
  );
  assert.equal(byName.get("Days of Healing Poppy")?.paid, true);
  assert.equal(byName.get("Days of Healing Poppy")?.saleSection, "important");
  assert.equal(byName.get("Skyfest Wireframe Cape")?.paid, false);
  assert.equal(byName.get("Skyfest Wireframe Cape")?.saleSection, "important");
  assert.equal(byName.get("AURORA Runaway Hair")?.paid, false);
  assert.equal(byName.get("AURORA Runaway Hair")?.saleSection, "collaboration");
  assert.equal(byName.get("Starry Night's Canopy")?.playerName, "星夜之傘");
  assert.equal(byName.get("Starry Night's Canopy")?.packageName, "星夜之傘");
  assert.equal(byName.get("Starry Night's Canopy")?.saleSection, "important");
  assert.equal(byName.get("Starry Night's Canopy")?.paid, true);
});

test("every common bundle only references real international items", () => {
  bundlePresets.forEach((preset) => {
    if (!("names" in preset)) return;
    assert.ok(preset.names.length > 0, preset.key);
    preset.names.forEach((name) => {
      const matches = catalog.wikiItems.filter((item) => item.name === name);
      assert.equal(matches.length, 1, `${preset.key}: ${name}`);
      assert.doesNotMatch(
        `${matches[0].name} ${matches[0].wiki} ${matches[0].collection}`,
        /netease|國服|国服/i,
      );
    });
  });
});
