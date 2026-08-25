import assert from "node:assert/strict";
import test from "node:test";

test("renders the account organizer", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>光遇帳號整理<\/title>/i);
  assert.match(html, /整理帳號資料/);
  assert.match(html, /帳號整理步驟/);
  assert.match(html, /選擇物品/);
  assert.match(html, /估價與匯出/);
  assert.match(html, /下一步：選擇物品/);
  assert.match(html, /搜尋物品/);
  assert.match(html, /資料來源：SkyGame-Data/);
  assert.match(html, /常用套組/);
  assert.doesNotMatch(html, /季節無斷|核心收藏|交易風險/);
});
