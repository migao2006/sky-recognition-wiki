import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { asModuleUrl } from "./helpers/transpile.mjs";

const [marketSource, bundleSource] = await Promise.all(
  ["market-collectibles.ts", "bundle-presets.ts"].map((file) =>
    readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
  ),
);
const marketUrl = asModuleUrl(marketSource);
const { importantMarketCollectibles } = await import(marketUrl);
const { bundlePresets } = await import(
  asModuleUrl(
    bundleSource.replace(
      'import { marketProfileNamesForSeries } from "./market-collectibles";',
      `const { marketProfileNamesForSeries } = await import(${JSON.stringify(marketUrl)});`,
    ),
  )
);
const catalog = await loadRuntimeCatalog();

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
    const matches = catalog.wikiItems.filter((item) => item.name === profile.name);
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
