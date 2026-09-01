import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const catalog = await loadRuntimeCatalog();
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);

test("resolves a unique player-facing name to its official GUID", () => {
  const match = resolver.resolve("星夜之傘");
  assert.ok(match);
  assert.equal(match.candidates.length, 1);
  assert.equal(match.candidates[0].name, "Starry Night's Canopy");
  assert.ok(match.candidates[0].guid);
});

test("never guesses between same-named catalog items", () => {
  const match = resolver.resolve("Moonlight Lantern");
  assert.ok(match);
  assert.ok(match.candidates.length > 1);
  assert.deepEqual(
    new Set(match.candidates.map((item) => item.guid)).size,
    match.candidates.length,
  );
});

test("keeps bundle aliases as multiple candidates instead of one fake item", () => {
  const match = resolver.resolve("林克套組");
  assert.ok(match);
  assert.ok(match.candidates.length >= 3);
  assert.ok(match.candidates.every((item) => item.guid));
});

test("expands only confirmed player-facing set aliases during a text scan", () => {
  const result = resolver.scan("林克套組｜絆愛三件套");
  assert.equal(result.groups.length, 2);
  assert.equal(result.ambiguous.length, 0);
  assert.deepEqual(
    result.groups.map((group) => group.candidates.length),
    [3, 3],
  );
});

const confirmedSets = new Map([
  ["貓咪耳尾", ["Dhkf_3dAhf", "wXLGNti3db"]],
  ["冥龍耳尾組", ["Io4R50c-s1", "nBIm3PkDea"]],
  ["海牛耳尾組", ["cXaPt2zi0Q", "y69WKTTyw7"]],
  ["爆米花組", ["IZNxLq33GB", "vPenDMkJkY"]],
  ["超凡風旅", ["OfOc3xQdCQ", "RpAC3rlPrR", "TfItBIVTeP"]],
  ["姆明耳尾組", ["3gb3myYbBB", "JIMbTWase4"]],
  ["林克套組", ["4c9HLTfREP", "KtlqKC7whS", "MHArTLwxyq"]],
  ["絆愛三件套", ["FLMn1Hib7k", "daH57TClK7", "u7q3xg2y55"]],
]);

test("pins every confirmed player-facing set to its reviewed GUID members", () => {
  for (const [term, expected] of confirmedSets) {
    const result = resolver.scan(term);
    assert.equal(result.groups.length, 1, term);
    assert.deepEqual(
      result.groups[0].candidates.map((item) => item.guid).sort(),
      [...expected].sort(),
      term,
    );
  }
});

test("scans listing separators and excludes ambiguous or unknown terms", () => {
  const result = resolver.scan("星夜之傘⸝Moonlight Lantern⸝完全不存在的道具");
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].candidates[0].name, "Starry Night's Canopy");
  assert.equal(result.groups.length, 0);
  assert.equal(result.excluded.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.ok(result.ambiguous[0].candidates.length > 1);
  assert.equal(result.unmatched.length, 1);
});

test("does not turn explicitly missing items into owned GUIDs", () => {
  const result = resolver.scan(
    "沒有星夜之傘｜缺星夜之傘｜不含星夜之傘｜沒有：星夜之傘｜已售星夜之傘｜不帶星夜之傘｜未收星夜之傘｜星夜之傘拔掉",
  );
  assert.equal(result.matched.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].candidates[0].name, "Starry Night's Canopy");
});

test("finds multiple non-overlapping item names in one listing segment", () => {
  const result = resolver.scan("九色鹿鹿角 九色鹿面具");
  assert.deepEqual(
    new Set(result.matched.map((match) => match.candidates[0].name)),
    new Set([
      "Gift of the Nine-Colored Deer Antlers",
      "Gift of the Nine-Colored Deer Mask",
    ]),
  );
});

test("keeps the item name before a colon", () => {
  const result = resolver.scan("九色鹿面具：有");
  assert.equal(result.matched.length, 1);
  assert.equal(
    result.matched[0].candidates[0].name,
    "Gift of the Nine-Colored Deer Mask",
  );
});
