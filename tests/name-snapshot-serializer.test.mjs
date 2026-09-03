import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeNameSnapshot } from "../scripts/lib/name-snapshot-serializer.mjs";

test("serializes player-name snapshots in the established compact layout", () => {
  const snapshot = {
    description: "名稱快照",
    items: {
      first: { displayName: "短名", aliases: ["原名", "別名"] },
      second: { playerName: "禮包名" },
    },
  };

  assert.equal(
    serializeNameSnapshot(snapshot),
    [
      "{",
      '  "description": "名稱快照",',
      '  "items": {',
      '    "first": { "displayName": "短名", "aliases": ["原名", "別名"] },',
      '    "second": { "playerName": "禮包名" }',
      "  }",
      "}",
      "",
    ].join("\n"),
  );
});

test("preserves the checked-in player-name snapshot bytes", async () => {
  for (const path of [
    "../app/player-zh-names.json",
    "../app/reviewed-iap-player-names.json",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.equal(serializeNameSnapshot(JSON.parse(source)), source, path);
  }
});
