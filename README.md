# 光遇帳號整理

Sky 光遇帳號整理工具，支援綁定與資源記錄、衣櫃選取、估價、備份及圖片／文案匯出。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/valuation-step.tsx`：估價、預覽與匯出
- `app/valuation-analysis.ts`：估價輸入整理與前端結果組裝
- `app/valuation-fresh-core.js`：整號行情擬合與共用價格預測
- `app/valuation-display.ts`：畫面、分享摘要與圖片共用價格文字
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

網站只使用 `valuation-fresh-core.js` 與 `valuation-fresh-data.json`。目前 manifest schema 為 3，模型版本 `whole-account-v3`，狀態固定為 `unvalidated`：

- 使用 2026-10-04 蒐集的台幣整號刊登紀錄，不沿用舊季節價格、不換算外幣、不把刊登價當成交價。原始紀錄可能沒有明確刊登日期，不以抓取日期代替。
- 每個去重帳號只算一次；跨季持有不拆分售價，也不增加樣本數。買方、競標起價、價格上限、未拆分實體商品、國服、刷物品及特殊無翼帳號排除；這版只估一般國際服帳號。
- 禮包採少／中／多／百禮標籤，不將來源級距改成假精確件數。「中少禮」等不明標籤保持未知。網站已選物品仍依唯一真實禮包去重，0–59／60–89／90–99／100+ 對應估價級距；同級內不另加固定單件價格。分享標題仍保留少／中／多禮三類。
- 對數整號價共同擬合季節、禮包與斷季效果；季節係數向資料學到的年代趨勢收縮，ridge=1 僅為正則化。禮包級距效果非負、斷季效果非正，不將整號行情當裸價重複加禮包。
- 缺季在對數價格上插值，首尾以學到的年代斜率延伸；不判定起季時使用起季未知帳號的整號估算（若無此類樣本才使用全體）。未知特徵採觀測特徵均值，並非假設無斷、零禮或無綁。
- 已明示不出／異常的平台禮包不納入可出數；未知綁定不阻擋估價。綁定、資源與限定沒有獨立證據時不另加減固定金額。進行中季的畢業禮可識別起季，但不補造斷季。
- 所有季節皆有參考數字；沒選物品提示先選取，模型損壞提示重新載入。估價頁、預覽、下載與分享使用同一個預測。季節表統一以「無斷、少禮、綁定未知」比較整號，並非單季物品售價。
- 區間以擬合後對數殘差與觀測離散程度推算，稀疏／延伸推算會放寬；只是探索性參考區間，未驗證覆蓋率。方法、直接起季樣本數及版本放在「估價依據」。

先只讀檢查；確認排除／去重與全部季節輸出後，以相同指令加上 `--write` 才更新 manifest：

```powershell
node --import tsx scripts/build-evidence-blended-model.mjs `
  work/facebook-season-listings-2026-10-04.private.jsonl `
  app/valuation-fresh-data.json 2026-10-04 `
  work/facebook-whole-account-review-2026-10-04.private.json
```

私人 review 檔以 post key 保存校正、排除、重複關係與原因，並綁定原始檔 SHA-256。公開 manifest 只保存模型參數、排除統計及來源／review／資料集摘要。搜尋摘要的匿名鍵不等於已驗證的帳號身分，不能宣稱已完成真正帳號級盲測。來源檔與 review 缺少時不可從公開模型逆造。

單元測試包含整號價不分攤、未知欄位、去重、30 季輸出與級距單調性；`npm run test:e2e` 驗證手機估價、季節表、分享、Canvas 輸出及空選取。`npm test` 會先驗證髮型名稱快照並建置。技術測試通過不代表價格準確；只有完成獨立私密 holdout、來源多樣性、逐季與完整流程驗證後，才可提升為已驗證版本。

## 資料與隱私

- 私人 Facebook、Google Drive、帳號備份與行情原文只放在 Git 忽略的 `work/`。
- 正式提交只包含匿名模型參數、季節價格帶與可重建模型的腳本。
- 官方物品以 GUID、ID、分類與排序為主要識別；中文名與玩家別名不可取代官方身分。

## 發佈

唯一正式來源為 GitHub `main`。推送後由 Vercel 自動建置與部署，不使用手動正式部署。

## 開發規範

所有 Agent 修改都必須遵守 [AGENTS.md](./AGENTS.md)，並在完成前執行 Documentation Impact Check。
