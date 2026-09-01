import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { safeFileName } = await tsImport("../app/file-name.ts", import.meta.url);

test("creates portable download file name fragments", () => {
  assert.equal(safeFileName("  帳號:/\\?*  "), "帳號-----");
  assert.equal(safeFileName("\u0000帳號\u001F"), "-帳號-");
  assert.equal(safeFileName("名稱...   "), "名稱");
  assert.equal(safeFileName("con"), "con-帳號");
  assert.equal(safeFileName("AUX.txt"), "AUX.txt-帳號");
  assert.equal(safeFileName("LPT1."), "LPT1-帳號");
  assert.equal(safeFileName(" . "), "未命名");
});
