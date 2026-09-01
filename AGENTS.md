# 專案 Agent 規範

本文件適用於整個 repository。AI Agent 修改程式、資料、設定、依賴、測試或分支時，必須遵守下列規則。

## 專案基準

- 技術棧：Next.js 16、React 19、TypeScript。
- 正式來源：GitHub `main`；推送後由 Vercel 自動部署。不得另行手動部署正式站。
- 開發指令：`npm run dev`。
- 必要驗證：依修改範圍執行測試，並至少執行 `npm run typecheck`、`npm run lint`、`npm run build` 中相關項目。
- 資料同步必須先使用 check 指令；確認來源與縮減風險後才能使用 write 指令。
- 未合併的上游資料只能以可追溯的 PR／commit 為依據，保留原始 GUID、名稱與圖片；上游合併後應移除臨時 overlay，避免重複。

## 資料檔案處理規則

處理 SkyGame-Data、SkyGame-Planner、備份 JSON、估價樣本或其他資料來源時，必須先完整理解來源結構，禁止只看畫面、檔名、少數搜尋結果或既有程式輸出後自行推測。

1. 先讀取來源的版本資訊、README、型別定義／Schema 與本次相關的實際資料檔；壓縮檔不得只列目錄，必須開啟內容確認。
2. JSONC、JSON、CSV 等格式必須使用能正確處理該格式的解析方式，不得用正規表示式代替正式解析並據此寫入資料。
3. 以 GUID 或來源定義的穩定識別碼為主要比對鍵，逐欄核對 `name`、`type`、`subtype`、`group`、`order`、來源關聯與隱藏標記；不得只靠中文名、英文名或圖片判定同一物品。
4. 尊重來源欄位的作用域。例如 SkyGame-Data 的 `order` 是同一分類內的排序，不是全站唯一序號；跨類型的相同值不得直接視為重複錯誤。
5. 比對時至少統計來源總數、共同項目、新增、缺少、欄位差異、重複識別碼與無效值；專案內的正規化、人工 seed、overlay 或例外排序必須與原始資料分開說明。
6. 分類、衣櫃位置、排序、絕版狀態與價格權重沒有明確資料依據時，不得自行補值。來源互相矛盾或仍不完整時，應保留現況並向使用者指出不確定處。
7. 寫入前先執行唯讀 check 或產生 diff，確認不會大量縮減、改名、換 GUID 或移除資料；確認後才可 write，並加入能防止同類錯誤再次發生的測試。
8. 完成後需記錄實際使用的來源版本、PR／commit 或檔案，並驗證執行時資料，而不只驗證原始快照。

### 中文顯示名與玩家別名

- 一般玩家顯示名與搜尋別名必須以官方 GUID 寫入 `player-zh-names.json`；不可用英文同名、圖片相似或文案相鄰位置猜配。出售／估價用的高價收藏可在 `market-collectibles.ts` 維護，但合併後必須能解析成唯一官方 GUID，並以同名 GUID 回歸測試防止錯配。
- `displayName` 可採社群中清楚且唯一的常用名稱；被替換的舊顯示名、Wiki 名與其他明確俗稱應保留為 `aliases`，避免既有搜尋失效。
- `saleName` 只能保存已有社群文案、玩家別名或其他可追溯依據的 2～6 字出售短名，且必須以官方 GUID 綁定；它只供出售文案使用，不得取代衣櫃 `displayName`、搜尋名、備份或圖片輸出。短名撞名時須保留最短可辨識系列前綴，不能靜默去重或任意截字。
- 出售文案的帳號標題必須直接復用估價結果的最早畢業進度季 `startSeasonSlug`、`breakClass` 與 `salePackageTier`，不得從文案字串猜測。`salePackageTier` 以去除同包多件後的唯一付費禮包數判定：0–59 少禮、60–89 中禮、90 以上多禮；免費限定、週年收藏與季節畢業禮不計入。此門檻依指定交易文案庫中 60、70、90 與百禮的實際用法維護。估價內部的 `packageTier` 只負責既有價格校準，不得拿來生成出售標題。部分畢業可作年代起點但不算斷季；完全沒有畢業進度時不得杜撰斷季。資源數量只列帳號已填寫且大於零的白蠟、愛心、昇華蠟與副卡。
- 套組詞只能作為每個已確認成員的共用搜尋別名，不得建立虛假套組物品，也不得輸出成單件出售文案。
- 季節縮寫、錯別字與交易簡稱只能放入 `seasonSearchAliases` 供搜尋使用，不得取代 `seasonZh` 的標準名稱。
- 「全圖、熱門復刻、斷季、微斷」等帳號狀態不是物品名稱；無法唯一對應 GUID 的詞必須保留現況並標記未採用。

### Catalog、備份與估價發布限制

- SkyGame-Data 已存在的手持與樂器必須保留官方 GUID、ID、order 與英文身分；中文名、玩家俗稱及衣櫃頁籤只能放在獨立顯示／taxonomy 規則。
- IAP 同步只能以官方 GUID 精確配對，不得退回英文名、中文名或圖片模糊配對；未解析項目必須使 check 失敗。
- 備份 v3 優先寫官方 GUID；上游尚未收錄的物品只能使用有來源註記的 overlay GUID。舊人工 GUID 相容性集中於輕量 `catalog-legacy-guids.ts`，不得讓草稿載入完整 catalog。
- 估價 aggregate 未滿 200 個唯一帳號、3 個社團、原始最大社團占比超過 60%，缺完整 predictor、網站與 validator 的季節價格帶／完整數值輸出 parity 未通過，或 holdout 未通過時，只能標記 `legacy-unvalidated`／`unvalidated`，不得顯示高信心或修改文件降低門檻。

## 文件維護是 Definition of Done

每次程式修改、功能新增、Bug 修復、重構、資料格式調整、依賴更新或合併，都必須執行 Documentation Impact Check。不得因使用者未要求而跳過，也不得預設文件不需要更新。

開始修改前：

1. 用 `rg --files -g '*.md' -g '*.MD'` 找出現有 Markdown。
2. 只讀取與任務範圍相關的 README、AGENTS、架構、資料格式、API、部署或測試文件；極小型修改不必讀完所有文件。
3. 記錄本次可能受影響的功能、路徑、指令、Schema、依賴、環境變數與外部服務。

完成修改後：

1. 以實際程式、設定、可執行指令與測試結果為準，檢查文件是否過時、矛盾、重複或失效。
2. 搜尋舊檔名、舊路徑、舊指令、舊 API／Schema、已刪功能與已移除依賴。
3. 執行 `git diff --check`、`git diff --stat` 與 `git diff`，確認文件變更只描述已實作內容。
4. 若有 merge／release，合併前與合併後都要各檢查一次最終分支；必要時使用 `git diff HEAD~1 HEAD`。

合併前必須明確判斷：

```text
Documentation Impact Check
本次修改是否影響文件：YES / NO
需要更新：
- ...
需要新增：
- ...
原因：
- ...
```

## 文件判斷原則

- 文件與程式衝突時，先判斷正確設計。程式是最新正確設計才更新文件；若程式偏離既定規格，必須指出問題，不得修改文件替錯誤實作背書。
- 優先更新既有 README、AGENTS 或模組文件。只有獨立、長期存在且能明顯降低維護風險的主題，才新增 Markdown。
- 架構、正式資料 Schema、多端 API、複雜部署／測試流程或破壞性 migration，才評估建立獨立文件；幾行即可說明的內容放回既有文件。
- 不得為小功能、單一 Bug、UI 微調、一次性 TODO 或 AI 工作紀錄新增文件。
- 禁止建立 `NOTES_FROM_AI.md`、`AI_WORKLOG.md`、`TEMP.md`、`TODO_AI.md` 等無長期專案價值的文件。
- 發現兩份文件大量重複時，保留 canonical document，其他文件改成簡短引用，避免 documentation drift。
- 文件失效時先確認引用、CI／script、歷史 migration 與規格價值；能局部更新就不要整份刪除。
- 保留既有語言與標題風格，不進行無關的大型改寫，不描述未完成的功能，不捏造指令、設定、API 或測試結果。
- 若已有 CHANGELOG，只記錄使用者或開發者可感知的功能、Bug、breaking change、API／Schema 或 migration；不記純格式、拼字或無行為影響的小重構。

## 最終文件驗收

交付前確認：

- README 的功能、結構、安裝、使用、測試與發佈指令仍正確。
- AGENTS 的規則、模組、指令與修改限制仍適用。
- 架構、資料流、Schema、API、環境變數、依賴與外部服務文件和程式一致。
- 沒有重複文件，也沒有為短期工作建立 Markdown。
- 下一個不了解本次修改的 Agent 能依現有文件安全接手。

所有涉及程式碼的最終回覆都必須包含：

```text
Documentation Check
Updated:
- ...
Created:
- ...
No change required:
- ...
Reason:
簡短說明文件判斷。
```

若不需修改文件，改用：

```text
Documentation Check
No documentation changes required.
Checked:
- README.md
- AGENTS.md
- 與本次修改相關的其他 Markdown
Reason:
說明為何沒有影響功能、架構、指令、Schema 或使用方式。
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
