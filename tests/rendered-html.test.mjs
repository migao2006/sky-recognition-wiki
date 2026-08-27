import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the account organizer", async () => {
  const html = await readFile(
    new URL("../.next/server/app/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<title>光遇帳號整理<\/title>/i);
  assert.match(html, /帳號資料/);
  assert.match(html, /帳號整理步驟/);
  assert.match(html, /選擇物品/);
  assert.match(html, /估價與匯出/);
  assert.match(html, /姆明耳尾兩件套/);
  assert.match(html, /貓咪三件套/);
  assert.match(html, /貓咪耳尾兩件套/);
  assert.match(html, /海牛耳尾兩件套/);
  assert.match(html, /冥龍角尾兩件套/);
  assert.match(html, /飛蛾兩件套/);
  assert.match(html, /麻雀兩件套/);
  assert.match(html, /下一步：選擇物品/);
  assert.match(html, /補充資料/);
  assert.match(html, /全部 7 項未綁定/);
  assert.doesNotMatch(html, /搜尋名稱、季節或 ID/);
  assert.doesNotMatch(html, /先看成品，再一鍵下載/);
  assert.match(html, /資料來源：SkyGame-Data/);
  assert.match(html, /常用套組/);
  assert.match(html, /草稿會自動儲存在此裝置 30 天/);
  assert.doesNotMatch(html, /季節無斷|核心收藏|交易風險/);
});
