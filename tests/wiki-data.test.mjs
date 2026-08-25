import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the complete lean wiki catalog", async () => {
  const source = await readFile(
    new URL("../app/wiki-data.ts", import.meta.url),
    "utf8",
  );
  const match = source.match(
    /export const wikiItems: WikiItem\[\] = (\[.*\]);\s*$/s,
  );

  assert.ok(match, "wiki catalog must remain a JSON-compatible array");
  const items = JSON.parse(match[1]);
  const requiredKeys = [
    "id",
    "order",
    "guid",
    "name",
    "type",
    "group",
    "icon",
    "wiki",
    "section",
    "collection",
  ];

  assert.equal(items.length, 1640);
  assert.equal(new Set(items.map((item) => item.guid)).size, items.length);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.ok(
    items.every((item) =>
      requiredKeys.every((key) => Object.hasOwn(item, key)),
    ),
  );
  assert.ok(
    items.every(
      (item) =>
        Number.isInteger(item.id) &&
        Number.isFinite(item.order) &&
        item.guid &&
        item.name &&
        item.type &&
        item.icon &&
        item.wiki &&
        item.section &&
        item.collection,
    ),
  );
  assert.ok(items.every((item) => !("previewUrl" in item)));
});
