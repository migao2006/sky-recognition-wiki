# 光遇帳號整理

單頁式 Sky 光遇帳號整理工具，用於記錄帳號綁定、資源、季節畢業禮與衣櫃物品，並提供估價、備份及匯出功能。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/valuation-step.tsx`：估價與匯出頁面組裝
- `app/use-valuation-export-actions.ts`：備份、出售文案、分享與圖片匯出動作
- `app/valuation-showcase-preview.tsx`：成品圖片預覽
- `app/valuation-model-core.js`：瀏覽器估價與留出驗證共用的數值核心
- `app/use-account-draft.ts`：本機草稿保存與還原
- `app/account-config.ts`：登入綁定與帳號型別設定
- `app/bundle-presets.ts`：常用套組設定
- `app/catalog-legacy-guids.ts`：舊版備份人工 GUID 到官方 GUID 的遷移表
- `app/catalog-*.ts`：物品資料、分類、中文名稱與來源規則
- `app/wiki-data.ts`：SkyGame-Data 衣櫃物品快照
- `app/valuation-calibration.ts`：估價校正規則
- `app/export-showcase.ts`：圖片版衣櫃輸出
- `app/sale-copy.ts`：出售文案輸出
- `app/valuation-season-bands.ts`：彙總後的季節價格帶與樣本信心
- `scripts/audit-valuation-source.mjs`：從原始 JSONL 重算合格樣本、季節樣本數與分位數
- `scripts/prepare-facebook-valuation-source.mjs`：將私人 Facebook 原始 JSONL 匿名成可供估價稽核的結構資料

## 本機開發

- `npm install`：安裝相依套件
- `npm run dev`：啟動 Next.js 開發伺服器
- `npm run build`：建立正式版 Next.js 產物

## 檢查指令

- `npm run lint`：程式風格與 React 規則檢查
- `npm run typecheck`：TypeScript 型別檢查
- `npm test`：驗證髮型名稱快照、正式建置與全部 Node 測試
- `npm run test:e2e`：以 Chromium 的 iPhone 13 視窗驗證帳號資料、選物與估價流程

## 資料同步

- `npm run sync:iap:check`：檢查 SkyGame-Data 付費物品快照；資料不同時只回報，不寫檔
- `npm run sync:iap:write`：人工確認後更新付費物品快照
- `npm run sync:catalog:check`：以 SkyGame-Data 1.3.10 逐 GUID 核對所有可對應物品的身分與原始類型
- `npm run sync:names:check`：產生中文 Wiki 名稱比對報告至 `dist/tmp`
- `npm run sync:names:write`：通過來源與縮減保護後更新中文名稱快照

尚未進入 SkyGame-Data 正式版本的新品，只能依可追溯的上游 PR／commit 或明確 Wiki 項目建立暫時 overlay。目前梵谷「星夜之傘」與畫架取自 [SkyGame-Data PR #125](https://github.com/Silverfeelin/SkyGame-Data/pull/125)；「海牛手杖」是等待上游正式 GUID 的 Wiki overlay。上游合併並同步正式快照後，應遷移既有 overlay GUID 並移除對應例外。

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

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定 20% 保留組比較現行模型。驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總；未滿 200 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，或誤差／區間覆蓋未達門檻時不得發布。樣本數門檻計算所有通過來源規則的唯一帳號；誤差只在具有可比較起季資料的帳號上計算。

目前正式彙總只有 148 筆合格帳號，狀態為 `legacy-unvalidated`；網站仍提供低信心參考估價，但不得顯示為完整市場驗證。新樣本必須保存完整 `valuation_model` v2 predictor（包含信心與所有乘數），validator 會以候選的起季區間及市場乘數重播共用核心；通過 holdout 後才可改為 `validated`。
