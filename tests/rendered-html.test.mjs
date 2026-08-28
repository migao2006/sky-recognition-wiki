import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the account organizer", async () => {
  const [
    html,
    source,
    runtimeSource,
    configSource,
    cardSource,
    cssSource,
    accountStepSource,
    catalogStepSource,
    valuationStepSource,
    draftSource,
  ] = await Promise.all([
    readFile(
      new URL("../.next/server/app/index.html", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/use-organizer-runtime.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/account-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog-item-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/account-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/valuation-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-account-draft.ts", import.meta.url), "utf8"),
  ]);
  const componentSource = [
    source,
    accountStepSource,
    catalogStepSource,
    valuationStepSource,
  ].join("\n");
  assert.match(html, /<title>光遇帳號整理｜衣櫃與估價<\/title>/i);
  assert.match(html, /帳號資料/);
  assert.match(html, /帳號整理步驟/);
  assert.match(html, /選擇物品/);
  assert.match(html, /估價與匯出/);
  [
    "姆明耳尾兩件套",
    "貓咪三件套",
    "貓咪耳尾兩件套",
    "海牛耳尾兩件套",
    "冥龍角尾兩件套",
    "飛蛾兩件套",
    "麻雀兩件套",
  ].forEach((name) => assert.match(configSource, new RegExp(name)));
  assert.match(html, /下一步：選擇物品/);
  assert.match(html, /資源／備註/);
  assert.match(html, /無綁/);
  assert.doesNotMatch(html, /搜尋名稱、季節或 ID/);
  assert.doesNotMatch(html, /先看成品，再一鍵下載/);
  assert.match(html, /資料來源：SkyGame-Data/);
  assert.match(html, /SkyGame-Data 1\.3\.10/);
  assert.match(html, /常用套組/);
  assert.match(html, /草稿保留在此裝置 30 天/);
  assert.doesNotMatch(html, /季節無斷|核心收藏|交易風險/);
  assert.doesNotMatch(componentSource, /依季節匯出|匯出付費物品與畢業禮/);
  assert.match(valuationStepSource, /出售文案/);
  assert.match(valuationStepSource, /saleCopyPresetGuids\.has\(item\.guid\)/);
  assert.match(
    accountStepSource,
    /key === "nintendo" && option\.key === "transfer"/,
  );
  assert.match(valuationStepSource, /匯出 JSON/);
  assert.match(valuationStepSource, /匯入 JSON/);
  assert.match(valuationStepSource, /分享摘要/);
  assert.match(runtimeSource, /import\("\.\/catalog-domain"\)/);
  assert.match(runtimeSource, /import\("\.\/valuation-analysis"\)/);
  assert.match(runtimeSource, /catalogPromise\.current = null/);
  assert.match(runtimeSource, /valuationPromise\.current = null/);
  assert.match(catalogStepSource, /INITIAL_VISIBLE_ITEMS = 40/);
  assert.match(catalogStepSource, /useCatalogStepState/);
  assert.match(source, /state=\{catalogStepState\}/);
  assert.match(valuationStepSource, /useValuationStepState/);
  assert.match(source, /state=\{valuationStepState\}/);
  assert.match(
    valuationStepSource,
    /includeCompletion \? "季節基準" : "快售～刊登"/,
  );
  assert.match(catalogStepSource, /new IntersectionObserver/);
  assert.match(accountStepSource, /seasonPickerOpen &&/);
  assert.match(accountStepSource, /quickSelectOpen &&/);
  assert.match(source, /<AccountStep/);
  assert.match(source, /<CatalogStep/);
  assert.match(source, /<ValuationStep/);
  assert.match(source, /useAccountDraft/);
  assert.doesNotMatch(source, /localStorage|搜尋物品|估價分析/);
  assert.match(draftSource, /localStorage/);
  assert.match(cardSource, /decoding="async"/);
  assert.match(cssSource, /content-visibility:\s*auto/);
  assert.doesNotMatch(html, /正在載入衣櫃/);
  assert.doesNotMatch(
    componentSource,
    /import\s*\{[\s\S]*?wikiItems[\s\S]*?\}\s*from\s*"\.\/catalog-domain"/,
  );
  assert.doesNotMatch(html, /Sunlight Snorkel/);
  const initialChunkPaths = [
    ...html.matchAll(/src="\/_next\/(static\/chunks\/[^"]+\.js)"/g),
  ].map((match) => match[1]);
  const initialCode = (
    await Promise.all(
      initialChunkPaths.map((path) =>
        readFile(new URL(`../.next/${path}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.doesNotMatch(initialCode, /Sunlight Snorkel/);
  assert.doesNotMatch(initialCode, /sourceRows:1022/);
});
