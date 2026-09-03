import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readBuildOutput = async (url) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await readFile(url, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT" || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Build output did not become available.");
};

test("ships only the account step in the initial organizer response", async () => {
  const html = await readBuildOutput(
    new URL("../.next/server/app/index.html", import.meta.url),
  );

  assert.match(html, /<title>光遇帳號整理｜衣櫃與估價<\/title>/i);
  assert.match(html, /帳號資料/);
  assert.match(html, /下一步：選擇物品/);
  assert.doesNotMatch(html, /搜尋名稱、季節或 ID/);
  assert.doesNotMatch(html, /估價分析/);
  assert.doesNotMatch(html, /Sunlight Snorkel/);

  const initialChunkPaths = [
    ...html.matchAll(/src="\/_next\/(static\/chunks\/[^"?]+\.js)(?:\?[^"?]*)?"/g),
  ].map((match) => match[1]);
  assert.ok(initialChunkPaths.length > 0, "initial HTML references client chunks");

  const initialCode = (
    await Promise.all(
      initialChunkPaths.map((path) =>
        readFile(new URL(`../.next/${path}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.doesNotMatch(initialCode, /Sunlight Snorkel/);
  assert.doesNotMatch(initialCode, /showcase-preview|前往估價/);
});
