import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
import { asModuleUrl } from "./helpers/transpile.mjs";

const marketSource = await readFile(
  new URL("../app/market-collectibles.ts", import.meta.url),
  "utf8",
);
const { importantMarketCollectibles } = await import(asModuleUrl(marketSource));
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
    assert.ok(["collaboration", "special"].includes(profile.saleSection));
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
    ["AURORA", 3],
    ["姆明", 7],
    ["大耳狗", 6],
    ["Nintendo", 4],
    ["風之旅人", 3],
  ]) {
    assert.ok((counts.get(series) ?? 0) >= minimum, series);
  }
  const flute = catalog.wikiItems.find((item) => item.name === "Vessel Flute");
  assert.equal(catalog.sourceKind(flute), "平台限定");
  assert.equal(catalog.sourceCollectionName(flute), "Nintendo Switch 專屬");
});
