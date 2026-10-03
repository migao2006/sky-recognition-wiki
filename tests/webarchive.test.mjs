import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { tsImport } from "tsx/esm/api";
import { webarchiveFixture } from "./helpers/webarchive-fixture.mjs";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";
const { readWebarchive, WEBARCHIVE_MAX_BYTES } = await tsImport("../app/webarchive.ts", import.meta.url);

test("webarchive extracts only main HTML including unicode", () => {
  const html = "<div>禮包測試</div>";
  assert.equal(readWebarchive(webarchiveFixture(html)), html);
});
test("webarchive rejects malformed, oversized and foreign resources", () => {
  for (const bytes of [new Uint8Array(), new Uint8Array(WEBARCHIVE_MAX_BYTES + 1), webarchiveFixture("x", "https://evil.example/"), webarchiveFixture("x").subarray(0, 50)])
    assert.throws(() => readWebarchive(bytes));
  const broken = webarchiveFixture("x");
  broken[broken.length - 26] = 0;
  assert.throws(() => readWebarchive(broken));
  assert.throws(() => readWebarchive(webarchiveFixture("x".repeat(2 * 1024 * 1024 + 1))));
});
test("all explicit Sky Info mappings resolve to unique paid catalog items", async () => {
  const mapping = JSON.parse(await readFile(new URL("../app/sky-info-item-guids.json", import.meta.url), "utf8"));
  const catalog = await loadRuntimeCatalog();
  assert.equal(Object.keys(mapping).length, 39);
  assert.equal(new Set(Object.values(mapping)).size, 39);
  for (const [internal, guid] of Object.entries(mapping)) {
    assert.match(internal, /^CharSkyKid_/);
    const item = catalog.wikiItems.find(x => x.guid === guid);
    assert.ok(item, guid);
    assert.ok(catalog.isPaidItem(item), guid);
  }
  assert.equal(mapping.CharSkyKid_Horn_KizunaAi, "daH57TClK7");
  assert.equal(mapping.CharSkyKid_Wing_KizunaAi_Pink, "u7q3xg2y55");
  assert.equal(mapping.CharSkyKid_Hair_KizunaAi_Pink, "FLMn1Hib7k");
});
