# 光遇帳號整理

單頁式 Sky 光遇帳號整理工具，用於記錄帳號綁定、資源、季節畢業禮與衣櫃物品，並提供估價、備份及匯出功能。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/use-account-backup-actions.ts`：第一步的 JSON 備份匯入與匯出
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/valuation-step.tsx`：估價與匯出頁面組裝
- `app/use-valuation-export-actions.ts`：估價摘要分享與圖片匯出動作
- `app/valuation-showcase-preview.tsx`：成品圖片預覽
- `app/valuation-model-core.js`：瀏覽器估價與留出驗證共用的數值核心
- `app/use-account-draft.ts`：本機草稿保存與還原
- `app/account-config.ts`：登入綁定與帳號型別設定
- `app/bundle-presets.ts`：常用套組設定
- `app/catalog-legacy-guids.ts`：舊版備份人工 GUID 到官方 GUID 的遷移表
- `app/catalog-*.ts`：物品資料、分類、中文名稱與來源規則
- `app/player-zh-names.json`：以官方 GUID 保存玩家顯示名、出售短名與搜尋別名；標準 Wiki 名稱仍可搜尋
- `app/reviewed-iap-player-names.json`：以官方 GUID 保存人工核對的付費物品玩家稱呼；未核對的自動翻譯不直接進入出售文案
- `app/wiki-data.ts`：SkyGame-Data 衣櫃物品快照
- `app/valuation-calibration.ts`：估價校正規則
- `app/export-showcase.ts`：圖片版衣櫃輸出
- `app/sale-copy.ts`：帳號分享摘要格式
- `app/valuation-season-bands.ts`：彙總後的季節價格帶與樣本信心
- `scripts/audit-valuation-source.mjs`：從原始 JSONL 重算合格樣本、季節樣本數與分位數
- `scripts/prepare-facebook-valuation-source.mjs`：將私人 Facebook 原始 JSONL 匿名成可供估價稽核的結構資料
- `scripts/reconstruct-drive-valuations.mjs`：將私人出售文案中的唯一名稱與確認套組還原成官方 GUID，並以網站估價流程逐筆重播
- `scripts/create-valuation-sample-from-backup.mjs`：將完整帳號備份與人工／成交價格轉成含完整 predictor 的匿名本機樣本
- `scripts/recognize-wardrobe-image.mjs`：將衣櫃截圖格子比對成官方 GUID 候選，低信心結果只供人工複核
- `scripts/collect-public-market-listings.mjs`：蒐集公開刊登價並保留原幣與官方匯率換算台幣欄位

## 本機開發

- `npm install`：安裝相依套件
- `npm run dev`：啟動 Next.js 開發伺服器
- `npm run build`：建立正式版 Next.js 產物

## 檢查指令

- `npm run lint`：程式風格與 React 規則檢查
- `npm run typecheck`：TypeScript 型別檢查
- `npm test`：驗證髮型名稱快照、正式建置與全部 Node 測試
- `npm run test:e2e`：以 Chromium 與 WebKit 的 iPhone 13 視窗驗證帳號資料、選物與估價流程

## 資料同步

- `npm run sync:iap:check`：檢查 SkyGame-Data 付費物品快照；資料不同時只回報，不寫檔
- `npm run sync:iap:write`：人工確認後更新付費物品快照
- `npm run sync:catalog:check`：以 SkyGame-Data 1.3.10 逐 GUID 核對所有可對應物品的身分與原始類型
- `npm run sync:names:check`：產生中文 Wiki 名稱比對報告至 `dist/tmp`
- `npm run sync:names:write`：通過來源與縮減保護後更新中文名稱快照
- `npm run sync:trade-names:check -- <清單.txt>`：以分類順序與既有名稱交叉比對交易用語，產生 GUID 對照報告但不寫檔；未採用資料會再區分「目前別名已可唯一辨識」及「仍需外部核對」
- `npm run sync:trade-names:write -- <清單.txt>`：只將報告中的唯一高信心對應寫入玩家名稱快照；C 級名稱只保留搜尋別名，不會建立出售短名
- `npm run collect:wiki-market -- --ocr`：透過兩站 MediaWiki API 蒐集禮包、活動、限定、聯動與週年證據，並辨識含文字的海報／公告；報告與圖片只存於未提交的 `work/wiki-market-evidence/`
- `npm run verify:wiki-market`：將蒐集報告逐張核對 runtime catalog；Fandom 只有圖示檔名與官方資料完全相同才算國際服身分證據，BWiki 名稱則先轉繁體、依現有玩家別名解析並核對衣櫃類型，結果只寫入未提交的核對報告
- `npm run sync:wiki-player-names:check`：將國際服精確 icon 的中文圖片標籤與台灣玩家名稱快照交叉核對，只產生名稱與別名差異報告
- `npm run sync:wiki-player-names:write`：確認報告後補入國際服 Wiki 搜尋別名，並把已具台灣交易稱呼的付費物品升級為人工核對名稱；不寫入 BWiki 國服名稱

Wiki 蒐集可用 `--source=fandom-zh` 或 `--source=bwiki-zh-cn` 分站更新，遇到站點節流時會沿用已完成的頁面快取；`--cached --ocr` 可不重抓頁面，直接為現有證據增量補做圖片辨識。

尚未進入 SkyGame-Data 正式版本的新品，只能依可追溯的上游 PR／commit 或明確 Wiki 項目建立暫時 overlay。目前梵谷「星夜之傘」與畫架取自 [SkyGame-Data PR #125](https://github.com/Silverfeelin/SkyGame-Data/pull/125)；上游合併並同步正式快照後，應遷移既有 overlay GUID 並移除對應例外。

玩家名稱以官方 GUID 對應，不用英文同名或圖片猜測。顯示名優先採台灣交易社群容易辨識的通用說法，作者個人縮寫、錯字或套組俗稱只保留為搜尋別名；髮型顯示名由獨立的玩家證據快照維護，交易清單只補髮型出售短名與搜尋別名。只有具有玩家用語依據的物品才另外設定 `saleName`，此短名只用於帳號分享摘要，不改變衣櫃、備份或整理圖片。交易用語同步先在衣櫃分類內以原清單名完全一致的唯一項目鎖定 GUID；兩個已鎖定錨點之間只有在資料筆數相同、區段不超過 16 件且名稱仍達相似門檻時才採用順序補配，其餘項目留在 `dist/tmp/transaction-name-sync.json`，不會猜配。國際服 Wiki 的精確 icon 圖片標籤只補搜尋別名，付費主名稱仍須來自台灣交易用語。分享摘要會用估價系統已判定的最早畢業進度季、斷季程度及禮包級距產生標題，並列出已填寫的白蠟、愛心、昇華蠟與副卡數量；部分畢業可作年代起點但不算斷季，完全沒有畢業進度時不自行猜測斷季。季節部分畢業比例優先使用 `½`、`⅓`、`⅔` 等單字元分數，沒有對應字元時保留 `n/d`；物品列以 20 字為上限，四字短名通常一行四件，五至六字名稱通常一行三件，系列標題不占物品列額度。現行一般物品用語參考 2026-08-31 至 2026-09-01 讀取的指定 Google Drive 資料夾 116 份出售文案、2026-09-01 的 1,149 件全物件交易用語重查清單，以及 2026-09-04 從五個 Facebook 交易社團兩輪搜尋整理的 642 篇貼文核對結果。社團核對只會以官方 GUID 寫入可唯一確認的單件出售短名；待核對、語境詞與帳號描述不會取代物品名稱。

兩個中文 Wiki 僅作名稱與市場分類證據：Fandom 資料標記為國際服，BWiki 資料標記為中國服，不得自動跨服合併。蒐集器只保存與禮包、活動、限定及價格相關的短行和來源 revision，不鏡像完整文章；OCR 排除一般物品 icon，只處理公告、海報與禮包展示圖。核對器輸出 `work/wiki-market-evidence/verification.json`，分開保存國際服精確圖示、國服名稱／類型參考、類型衝突及未解析名稱；所有結果都只供人工複核，不會自動改寫顯示名、禮包、出售文案或估價資料。

## 備份相容性

目前匯出格式為 v3，物品保存 SkyGame-Data 官方 GUID；上游尚未收錄的新品則保存上述明確追蹤的 overlay GUID。v1、v2 與無版本的舊備份會在匯入時遷移；未知物品會被略過並顯示數量，較新的未知版本則拒絕匯入。本機草稿保存 30 天，舊 v2 草稿會自動搬移至 v3。

## AI 開發規範

所有 Agent 修改與合併都必須遵守 [AGENTS.md](./AGENTS.md)，並把 Documentation Impact Check 納入完成條件。

## 發佈流程

唯一正式來源為 GitHub `main`。合併或推送到 `main` 後，由 Vercel 自動建置及發佈；不使用手動 Sites 或 Vercel 部署。

## 私人 Facebook 行情資料

Facebook 原始貼文只能保存在被 Git 忽略的 `work/` 目錄。匿名化時設定未提交的 `VALUATION_HASH_SALT`，再將輸出資料送入估價稽核：

實體徽章、實體周邊、多帳號合售或其他無法拆分帳號價格的刊登，必須在私人來源標記 `exclude_from_model: true`。匿名化只保留布林標記與受控的排除原因，不保留賣家備註；稽核與 validator 都會硬排除這些資料，不能拿來校準任何季節價格。

`$env:VALUATION_HASH_SALT = "至少 32 字元的本機專用隨機字串"; node scripts/prepare-facebook-valuation-source.mjs work/facebook-private.jsonl > work/facebook-anonymous.jsonl`

輸出不含貼文原文、網址、作者或留言，只保留價格、季節、禮包與匿名雜湊等結構欄位。

私人 Google Drive 文案同樣只可放在被 Git 忽略的 `work/`。逐筆 GUID 還原使用 `node scripts/reconstruct-drive-valuations.mjs`；腳本只接受唯一名稱與已明確定義的玩家套組，同名物品不會猜測，缺少逐件名稱的禮包也不會依數量杜撰。產生的逐筆結果與摘要仍留在 `work/`，只能用來比較刊登價是否落在估價區間，不能視為成交價驗證或直接發布成正式模型。

已由網站匯出的完整帳號備份可用 `npm run prepare:valuation-sample -- --backup <備份.json> --price-twd <人工或成交價> --evidence-kind professional_estimate --out work/sample.jsonl` 產生可重播的匿名樣本。執行前必須在本機設定至少 32 字元的 `VALUATION_HASH_SALT`；工具只接受 `sold` 或 `professional_estimate`，備份必須確認所有綁定、不得包含未知或被略過的 GUID，且輸出強制留在 `work/`。帳號指紋以 HMAC 產生，帳號名稱、備註與原始檔案路徑不會寫入樣本。

衣櫃截圖可用 `npm run recognize:wardrobe -- <圖片> --grid=左,上,格寬,格高,欄數,列數,水平間距,垂直間距 --out=work/wardrobe-candidates.json` 產生官方 GUID 候選。工具只在圖示相似度至少 0.93、且第一名比第二名至少高 0.03 時標記 `accepted`；其餘一律標記 `review` 或 `unreadable`，必須對照原圖人工確認，輸出也不會自動改寫 catalog、帳號備份或估價樣本。

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定 20% 保留組比較現行模型。驗證多批來源時可重複傳入 `--source <anonymous-source.jsonl>`，工具會合併後再統一去重與切分，不必先手動串接檔案。稽核結果的 `predictorCoverage` 只計算具帳號識別與結構化起季的候選列，並列出完整 predictor 比例、逐欄缺口與各來源覆蓋率，供下一輪優先補齊可重播樣本；正式 validator 還會排除基準彙總中沒有可比較起季中位數的列。網站與 validator 共用相同的 seed 混合、先驗強度、跨季單調校正及完整數值核心；驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總。未滿 200 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，缺少完整 predictor、網站／validator parity 不一致，或誤差／區間覆蓋未達門檻時不得發布。樣本數門檻計算所有通過來源規則的唯一帳號；誤差只在具有可比較起季資料的帳號上計算。

目前正式彙總只有 164 筆可追溯原始列、162 筆合格資料列，狀態為 `unvalidated`；網站只顯示這組可追溯樣本數，仍提供低信心參考估價，但不得顯示為完整市場驗證。禮包校準分組會優先使用唯一真實禮包數；缺少數量時只接受既有的有效級距，兩者皆無才排除，不會再把未知數量當成少禮。新樣本必須保存完整 `valuation_model` v2 predictor（包含信心與所有乘數），validator 會以候選的共用季節價格帶及市場乘數重播同一數值核心；通過 holdout 後才可改為 `validated`。

估價中的禮包、限定與資源只計入二手帳號市場可保留的部分價值。同一真實禮包即使包含多件物品，禮包級距、帳號類型與加值上限都只計一次；原始付費物品數只保留作診斷，不參與跨級。拾光季起始或更晚、目前進行中季節，以及無法確認早期季節證據的帳號使用較低的附加價值上限，避免禮包數量把簡號推到早期稀有帳號的價格帶；起始畢業季在拾光以前的帳號保留原本的稀有度校正，完全沒有畢業禮時才以最早季卡項鍊判斷年代。此分段目前同樣屬 `unvalidated` 參考規則，需待足量同型成交樣本與 holdout 驗證後才能視為正式市場模型。

## 公開市場刊登價

`npm run collect:market-listings` 會將淘手游國服帳號與 FunPay 國際市場的公開刊登資料寫入被 Git 忽略的 `work/market-listings/snapshots/`。每次執行建立獨立快照，並同步產生依「來源＋刊登 ID」去重的 `work/market-listings/combined/` 累積資料；累積列保留首次／最後觀察時間、觀察次數與實際改價歷程，不會讓重複刊登膨脹樣本數。既有快照可用 `npm run consolidate:market-listings` 重新整理。蒐集器預設讀取淘手游 40 頁、補抓前 120 筆商品詳情，並保留來源市場、原幣價格、刊登時間、已移除聯絡方式的公開帳號描述及平台識別碼；不保存賣家姓名、聯絡資料、個人頁面或完整網頁。資料列會另外保存文案中明確出現的 `season_mentions`，也會依官方時間順序解析 FunPay 的 `Seasons: 6, 8, 11` 等編號格式；只有淘手游「畢業季節」欄位或 FunPay `Full Seasons` 清單才會形成 `season_graduation_mentions`，淘手游資料並可在完整季數一致時形成保守的 `start_season_candidate`。半季、普通季節提及、單純季卡和 `on schedule` 季節都不會被推定為完整畢業。摘要提供 30 季的 `season_coverage`，一般季節提及不能直接當作起季或畢業。最小化 JSON 解析快取預設保留六小時，失敗後可續跑；需要刷新時加入 `--refresh`。若分頁中間出現空白、請求失敗或頁面異常，蒐集器會略過快取自動補抓一次；真正位於分頁結尾之後的空頁不會重試。可用 `-- --taoshouyou-pages=10 --taoshouyou-details=100 --concurrency=2 --delay-ms=3000 --cache-hours=6` 調整範圍與全域請求速率。摘要的 `source_health` 會分別檢查匯率、FunPay 與淘手游；重試後仍有請求失敗、站點空殼、內部分頁缺口或必要來源空資料都會令快照不完整。只有至少讀取 40 頁、確認分頁結尾且所有來源健康時，才會以 `latest_eligible: true` 更新 `latest.json`。

台幣換算使用臺灣期貨交易所 `DailyForeignExchangeRates` 對應刊登日期以前最近一個匯率日，輸出欄位為 `price_twd_fx`。這只代表匯率換算值：所有資料仍標記為 `ask` 刊登價，不能當成交價，也不能把國服或國際市場的絕對金額直接併入台灣估價。蒐集器會以各來源原幣價格的對數中位數與 MAD 標記極端 `price_outlier`，保留原始列但不將其列為候選。`relative_price_candidate` 只供同一來源、同一幣別內比較季節相對差異；`ratio_candidate` 另要求刊登日期有官方匯率，才可進行跨幣別比例研究。後續市場校準應在起季、斷季、禮包級距與綁定條件相近的帳號間，估計 `台灣刊登／成交台幣 ÷ 外站匯率換算台幣` 的穩健中位比例；樣本不足的分組不得單獨發布。

`npm run analyze:market-season-ratios` 會依「來源＋原幣」分組，僅使用可確認最早完整畢業季且非離群的帳號刊登，輸出季節中位數、四分位與市場內相對倍率。每季預設至少 3 筆才標記可比較；可能的年代倒掛只供診斷，不會自動改寫網站估價。
