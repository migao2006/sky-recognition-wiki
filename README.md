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
- `app/wiki-data.ts`：SkyGame-Data 衣櫃物品快照
- `app/valuation-calibration.ts`：估價校正規則
- `app/export-showcase.ts`：圖片版衣櫃輸出
- `app/sale-copy.ts`：帳號分享摘要格式
- `app/valuation-season-bands.ts`：彙總後的季節價格帶與樣本信心
- `scripts/audit-valuation-source.mjs`：從原始 JSONL 重算合格樣本、季節樣本數與分位數
- `scripts/prepare-facebook-valuation-source.mjs`：將私人 Facebook 原始 JSONL 匿名成可供估價稽核的結構資料
- `scripts/reconstruct-drive-valuations.mjs`：將私人出售文案中的唯一名稱與確認套組還原成官方 GUID，並以網站估價流程逐筆重播

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

尚未進入 SkyGame-Data 正式版本的新品，只能依可追溯的上游 PR／commit 或明確 Wiki 項目建立暫時 overlay。目前梵谷「星夜之傘」與畫架取自 [SkyGame-Data PR #125](https://github.com/Silverfeelin/SkyGame-Data/pull/125)；上游合併並同步正式快照後，應遷移既有 overlay GUID 並移除對應例外。

玩家名稱以官方 GUID 對應，不用英文同名或圖片猜測。顯示名優先採台灣交易社群容易辨識的說法，舊名、Wiki 名與套組俗稱保留為搜尋別名；只有具有玩家用語依據的物品才另外設定 `saleName`，此短名只用於帳號分享摘要，不改變衣櫃、搜尋、備份或整理圖片。分享摘要會用估價系統已判定的最早畢業進度季、斷季程度及禮包級距產生標題，並列出已填寫的白蠟、愛心、昇華蠟與副卡數量；部分畢業可作為帳號年代起點但不算斷季，完全沒有畢業進度時不自行猜測斷季。季節部分畢業比例優先使用 `½`、`⅓`、`⅔` 等單字元分數，沒有對應字元時保留 `n/d`；物品列以 20 字為上限，四字短名通常一行四件，五至六字名稱通常一行三件，系列標題不占物品列額度。現行一般物品用語參考 2026-08-31 讀取的指定 Google Drive 資料夾 26 份出售文案。

## 備份相容性

目前匯出格式為 v3，物品保存 SkyGame-Data 官方 GUID；上游尚未收錄的新品則保存上述明確追蹤的 overlay GUID。v1、v2 與無版本的舊備份會在匯入時遷移；未知物品會被略過並顯示數量，較新的未知版本則拒絕匯入。本機草稿保存 30 天，舊 v2 草稿會自動搬移至 v3。

## AI 開發規範

所有 Agent 修改與合併都必須遵守 [AGENTS.md](./AGENTS.md)，並把 Documentation Impact Check 納入完成條件。

## 發佈流程

唯一正式來源為 GitHub `main`。合併或推送到 `main` 後，由 Vercel 自動建置及發佈；不使用手動 Sites 或 Vercel 部署。

## 私人 Facebook 行情資料

Facebook 原始貼文只能保存在被 Git 忽略的 `work/` 目錄。匿名化時設定未提交的 `VALUATION_HASH_SALT`，再將輸出資料送入估價稽核：

`$env:VALUATION_HASH_SALT = "至少 32 字元的本機專用隨機字串"; node scripts/prepare-facebook-valuation-source.mjs work/facebook-private.jsonl > work/facebook-anonymous.jsonl`

輸出不含貼文原文、網址、作者或留言，只保留價格、季節、禮包與匿名雜湊等結構欄位。

私人 Google Drive 文案同樣只可放在被 Git 忽略的 `work/`。逐筆 GUID 還原使用 `node scripts/reconstruct-drive-valuations.mjs`；腳本只接受唯一名稱與已明確定義的玩家套組，同名物品不會猜測，缺少逐件名稱的禮包也不會依數量杜撰。產生的逐筆結果與摘要仍留在 `work/`，只能用來比較刊登價是否落在估價區間，不能視為成交價驗證或直接發布成正式模型。

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定 20% 保留組比較現行模型。網站與 validator 共用相同的 seed 混合、先驗強度、跨季單調校正及完整數值核心；驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總。未滿 200 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，缺少完整 predictor、網站／validator parity 不一致，或誤差／區間覆蓋未達門檻時不得發布。樣本數門檻計算所有通過來源規則的唯一帳號；誤差只在具有可比較起季資料的帳號上計算。

目前正式彙總只有 164 筆可追溯原始列、148 筆合格帳號，狀態為 `legacy-unvalidated`；網站只顯示這組可追溯樣本數，仍提供低信心參考估價，但不得顯示為完整市場驗證。新樣本必須保存完整 `valuation_model` v2 predictor（包含信心與所有乘數），validator 會以候選的共用季節價格帶及市場乘數重播同一數值核心；通過 holdout 後才可改為 `validated`。

估價中的禮包、限定與資源只計入二手帳號市場可保留的部分價值。拾光季起始或更晚、目前進行中季節，以及無法確認早期季節證據的帳號使用較低的附加價值上限，避免禮包數量把簡號推到早期稀有帳號的價格帶；起始畢業季在拾光以前的帳號保留原本的稀有度校正，完全沒有畢業禮時才以最早季卡項鍊判斷年代。此分段目前同樣屬 `legacy-unvalidated` 參考規則，需待足量同型成交樣本與 holdout 驗證後才能視為正式市場模型。
