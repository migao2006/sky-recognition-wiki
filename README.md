# 光遇帳號整理

單頁式 Sky 光遇帳號整理工具，用於記錄帳號綁定、資源、季節畢業禮與衣櫃物品，並提供估價、備份及匯出功能。

## 專案結構

- `app/page.tsx`：帳號資料、衣櫃選取、估價與匯出流程
- `app/wiki-data.ts`：物品資料庫
- `app/valuation-calibration.ts`：估價校正規則
- `app/export-showcase.ts`：圖片版衣櫃輸出
- `app/sale-copy.ts`：出售文案輸出
- `public/data/`：估價模型與市場參考資料

## 檢查指令

- `npm run lint`：程式風格與 React 規則檢查
- `npm run typecheck`：TypeScript 型別檢查
- `npm test`：建置後驗證主要頁面內容
