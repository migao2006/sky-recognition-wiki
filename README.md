# 光遇帳號整理

單頁式 Sky 光遇帳號整理工具，用於記錄帳號綁定、資源、季節畢業禮與衣櫃物品，並提供估價、備份及匯出功能。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：帳號資料、衣櫃選取、估價與匯出流程
- `app/account-config.ts`：登入綁定、帳號型別與常用套組設定
- `app/wiki-data.ts`：物品資料庫
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
- `npm test`：建置後驗證主要頁面內容

## 發佈流程

唯一正式來源為 GitHub `main`。合併或推送到 `main` 後，由 Vercel 自動建置及發佈；不使用手動 Sites 或 Vercel 部署。

## 私人 Facebook 行情資料

Facebook 原始貼文只能保存在被 Git 忽略的 `work/` 目錄。匿名化時設定未提交的 `VALUATION_HASH_SALT`，再將輸出資料送入估價稽核：

`$env:VALUATION_HASH_SALT = "本機專用隨機字串"; node scripts/prepare-facebook-valuation-source.mjs work/facebook-private.jsonl > work/facebook-anonymous.jsonl`

輸出不含貼文原文、網址、作者或留言，只保留價格、季節、禮包與匿名雜湊等結構欄位。

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定 20% 保留組比較現行模型。驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總；未滿 500 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，或誤差／區間覆蓋未達門檻時不得發布。
