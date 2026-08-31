import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

test("renders the account organizer", async () => {
  const [
    html,
    source,
    runtimeSource,
    bundleSource,
    cardSource,
    cssSource,
    accountStepSource,
    catalogStepSource,
    valuationStepSource,
    stepStateSource,
    draftSource,
  ] = await Promise.all([
    readBuildOutput(
      new URL("../.next/server/app/index.html", import.meta.url),
    ),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/use-organizer-runtime.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/bundle-presets.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog-item-card.tsx", import.meta.url), "utf8"),
    Promise.all([
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      ...(
        await readdir(new URL("../app/styles", import.meta.url))
      ).filter((name) => name.endsWith(".css")).map((name) =>
        readFile(new URL(`../app/styles/${name}`, import.meta.url), "utf8"),
      ),
    ]).then((parts) => parts.join("\n")),
    readFile(new URL("../app/account-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/valuation-step.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/organizer-step-state.ts", import.meta.url), "utf8"),
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
  assert.doesNotMatch(html, /帳號整理步驟/);
  assert.doesNotMatch(source, /workflow-steps/);
  assert.match(catalogStepSource, /選擇物品/);
  assert.match(valuationStepSource, /估價與匯出/);
  [
    "姆明耳尾兩件套",
    "貓咪三件套",
    "貓咪耳尾兩件套",
    "海牛耳尾兩件套",
    "冥龍角尾兩件套",
    "飛蛾兩件套",
    "麻雀兩件套",
  ].forEach((name) => assert.match(bundleSource, new RegExp(name)));
  assert.match(html, /下一步：選擇物品/);
  assert.match(html, /資源／備註/);
  assert.match(html, /無綁/);
  assert.doesNotMatch(html, /搜尋名稱、季節或 ID/);
  assert.doesNotMatch(html, /先看成品，再一鍵下載/);
  assert.match(html, /資料來源：SkyGame-Data/);
  assert.match(html, /SkyGame-Data 1\.3\.10/);
  assert.match(html, /常用套組/);
  assert.match(html, /草稿保存 30 天/);
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
  assert.match(stepStateSource, /INITIAL_VISIBLE_ITEMS = 40/);
  assert.doesNotMatch(catalogStepSource, /useCatalogStepState/);
  assert.match(source, /const catalogStepState = useCatalogStepState\(\)/);
  assert.match(source, /state=\{catalogStepState\}/);
  assert.doesNotMatch(valuationStepSource, /useValuationStepState/);
  assert.match(source, /const valuationStepState = useValuationStepState\(\)/);
  assert.match(source, /useOwnedItems/);
  assert.doesNotMatch(source, /useState<Set<string>>/);
  assert.match(source, /state=\{valuationStepState\}/);
  assert.match(valuationStepSource, /<th>起季帳號<\/th>/);
  assert.match(valuationStepSource, /中位 \{formatTwd\(row\.median\)\}/);
  assert.match(catalogStepSource, /new IntersectionObserver/);
  assert.match(accountStepSource, /seasonPickerOpen &&/);
  assert.match(accountStepSource, /quickSelectOpen &&/);
  assert.match(source, /<AccountStep/);
  assert.match(source, /dynamic\([\s\S]*?import\("\.\/catalog-step"\)/);
  assert.match(source, /dynamic\([\s\S]*?import\("\.\/valuation-step"\)/);
  assert.match(source, /useAccountDraft/);
  assert.doesNotMatch(source, /localStorage|搜尋物品|估價分析/);
  assert.match(draftSource, /localStorage/);
  assert.match(cardSource, /decoding="async"/);
  assert.match(cardSource, /aria-label=.*取消選取/);
  assert.doesNotMatch(cardSource, /typeLabel|type-badge/);
  assert.doesNotMatch(catalogStepSource, /entry\.order/);
  assert.doesNotMatch(cssSource, /\.closet-nav\s+b\s*\{/);
  assert.match(cssSource, /\.closet-nav button\s*\{[\s\S]*?min-height:\s*46px/);
  assert.match(catalogStepSource, /className="filter-backdrop"/);
  assert.match(catalogStepSource, /aria-modal=\{mobileFilters \|\| undefined\}/);
  assert.match(catalogStepSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(catalogStepSource, /\{ inert: boolean \}.*?\.inert = true/);
  assert.match(catalogStepSource, /element\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(catalogStepSource, /event\.key !== "Tab"/);
  assert.match(catalogStepSource, /htmlFor="catalog-search"/);
  assert.match(catalogStepSource, /id="catalog-search"/);
  assert.match(catalogStepSource, /effectiveType/);
  assert.match(source, /已切換至\$\{stepName\}/);
  assert.match(catalogStepSource, /前往估價/);
  assert.match(catalogStepSource, /已選 \{owned\.size\.toLocaleString\(\)\}/);
  assert.match(cssSource, /\.discovery-primary\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(cssSource, /\.filter-panel\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(cssSource, /item-card\.selectable\.owned\s*\{[\s\S]*?border:\s*2px solid #8fc7ff/);
  assert.doesNotMatch(catalogStepSource, /只看已選/);
  assert.doesNotMatch(
    componentSource,
    /步驟 [123]／3|先填帳號類型|搜尋或選分類|核對參考價格|預覽後直接下載|更多條件|白蠟、愛心、副卡/,
  );
  assert.doesNotMatch(catalogStepSource, /catalog-sub-next/);
  assert.match(catalogStepSource, /if \(!query\.trim\(\) && nextClosetSub\)/);
  assert.match(catalogStepSource, /selectClosetSub\(nextClosetSub, true\)/);
  assert.match(catalogStepSource, /else \{\s*onNext\(\)/);
  assert.match(valuationStepSource, /資源採小額封頂，季卡項鍊不代表畢業/);
  assert.match(valuationStepSource, /國服資料不混入台幣價格/);
  assert.match(cssSource, /--glass:\s*#09111dcc/);
  assert.match(cssSource, /backdrop-filter:\s*blur\(16px\)/);
  assert.doesNotMatch(
    cssSource,
    /\.source-badge,\s*\.discontinued-badge\s*\{[^}]*backdrop-filter/,
  );
  assert.doesNotMatch(cssSource, /\.type-badge\s*\{[^}]*backdrop-filter/);
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
  assert.doesNotMatch(initialCode, /showcase-preview|前往估價/);
});
