# 光遇帳號整理

Sky 光遇帳號整理工具，支援綁定與資源記錄、衣櫃選取、估價、備份及圖片／文案匯出。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/valuation-step.tsx`：估價、預覽與匯出
- `app/valuation-analysis.ts`：估價輸入整理與前端結果組裝
- `app/valuation-fresh-core.js`：目前唯一的數值估價核心
- `app/valuation-fresh-data.json`：未驗證行情候選模型與來源摘要
- `app/valuation-season-bands.ts`：依候選證據產生季節價格帶
- `app/catalog-*.ts`：物品資料、分類、中文名稱與來源規則
- `app/bundle-presets.ts`：常用套組設定
- `app/use-account-draft.ts`：本機草稿保存與還原
- `scripts/build-evidence-blended-model.mjs`：由核對後台灣行情建立候選模型

## 本機開發

```powershell
npm install
npm run dev
```

必要檢查：

```powershell
npm run typecheck
npm run lint
npm test
```

## 估價模型

網站只使用 `valuation-fresh-core.js` 與 `valuation-fresh-data.json`。目前模型是 `evidence-blended-v2`，狀態固定為 `unvalidated`：

- 台灣、新台幣、國際服行情優先。
- 單季資料權重高於跨季資料；跨季資料依明確季節進度分攤並降權。
- 禮包可使用少／中／多／百禮級距代表值，不要求精確件數；代表值會標記為 `tier_proxy`。
- 季節價格帶是加權經驗四分位數，不是成交保證或正式 prediction interval。
- 沒有證據的季節顯示「資料不足」，不回退舊價格、人工固定答案或外幣換算。

候選模型產生方式：

```powershell
node --import tsx scripts/build-evidence-blended-model.mjs `
  work/market-research-2026-09-10/tw-reviewed-calibration.jsonl `
  app/valuation-fresh-data.json 2026-10-04
```

只有完成獨立 holdout、來源多樣性、逐季與完整流程驗證後，才可將模型提升為正式驗證版本。

## 資料與隱私

- 私人 Facebook、Google Drive、帳號備份與行情原文只放在 Git 忽略的 `work/`。
- 正式提交只包含匿名模型參數、季節價格帶與可重建模型的腳本。
- 官方物品以 GUID、ID、分類與排序為主要識別；中文名與玩家別名不可取代官方身分。

## 發佈

唯一正式來源為 GitHub `main`。推送後由 Vercel 自動建置與部署，不使用手動正式部署。

## 開發規範

所有 Agent 修改都必須遵守 [AGENTS.md](./AGENTS.md)，並在完成前執行 Documentation Impact Check。
