import assert from "node:assert/strict";
import test from "node:test";

test("renders the production wiki shell", async () => {
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
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>光遇辨識學習 Wiki<\/title>/i);
  assert.match(html, /找到(?:<!-- -->\s*)*1,640(?:<!-- -->\s*)*件物品/);
  assert.match(html, /BWiki 中文清單（2026-08-24）/);
});
