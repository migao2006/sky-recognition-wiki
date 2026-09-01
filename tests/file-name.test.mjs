import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";

const source = await readFile(
  new URL("../app/file-name.ts", import.meta.url),
  "utf8",
);
const { safeFileName } = await import(asModuleUrl(source));

test("creates portable download file name fragments", () => {
  assert.equal(safeFileName("  帳號:/\\?*  "), "帳號-----");
  assert.equal(safeFileName("\u0000帳號\u001F"), "-帳號-");
  assert.equal(safeFileName("名稱...   "), "名稱");
  assert.equal(safeFileName("con"), "con-帳號");
  assert.equal(safeFileName("AUX.txt"), "AUX.txt-帳號");
  assert.equal(safeFileName("LPT1."), "LPT1-帳號");
  assert.equal(safeFileName(" . "), "未命名");
});
