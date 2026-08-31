# 專案 Agent 規範

本文件適用於整個 repository。AI Agent 修改程式、資料、設定、依賴、測試或分支時，必須遵守下列規則。

## 專案基準

- 技術棧：Next.js 16、React 19、TypeScript。
- 正式來源：GitHub `main`；推送後由 Vercel 自動部署。不得另行手動部署正式站。
- 開發指令：`npm run dev`。
- 必要驗證：依修改範圍執行測試，並至少執行 `npm run typecheck`、`npm run lint`、`npm run build` 中相關項目。
- 資料同步必須先使用 check 指令；確認來源與縮減風險後才能使用 write 指令。
- 未合併的上游資料只能以可追溯的 PR／commit 為依據，保留原始 GUID、名稱與圖片；上游合併後應移除臨時 overlay，避免重複。

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
