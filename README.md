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
- 聖島畢業手碟顯示為「聖島手碟」，避免只有籠統的「聖島季畢業禮」；付費「凱旋手碟」另支援「霞谷手盤」搜尋，兩者保持不同官方 GUID 與付費身分。
- 預言與重組畢業樂器使用「預言鼓」「重組小號」，依[台灣玩家樂器討論](https://www.dcard.tw/f/sky/p/238946230)保留辨識度；舊畢業禮名稱仍可搜尋，不因文案提到測試服換色款而新增物品或付費身分。
- 追光傘與拾光相機分別顯示「大傘」「拾光畢業相機」，依[季節物品整理](https://forum.gamer.com.tw/Co.php?bsn=33024&sn=2316)區分具體物品；一般相機仍是另一個 GUID，不共用畢業名稱。
- 付費身分以已核對的 IAP 快照為準，人工顯示／文案分類不得將已確認付費的物品覆蓋成免費；沒有 IAP 的兌換物仍保留原分類。同一物品已列入禮包加值後，不再重複計入限定加值。
- 女巫髮型與枯萎斗篷保留活動收藏文案，但不計付費禮包；[官方 0.19.0 公告](https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/952-patch-notes---october-13-2022---0-19-0-202986-android-huawei-ios-202613-switch/)列為 66／99 蠟燭兌換，與另售的巫師帽不同。SkyGame-Data 1.3.10 對應 GUID 為 `si_8YhNtmr`／`-HtIAPjYsa`。
- `Fortune Orange Hat`（`aRgiKoKavp`）採台灣社群的「橘子頭飾」，不是橘色帽子；用語參考[巴哈姆特春之日更新文](https://forum.gamer.com.tw/C.php?bsn=33024&snA=1142)，身分核對 SkyGame-Data 1.3.10 的 `HairAccessory`／ID 1725。舊稱保留搜尋，IAP 關聯不變。
- `Rhythm Guitar`（`bOQzUAzYfV`）採「白吉他」，保留音韻吉他、節奏吉他及白色吉他別名；依[台灣玩家音樂商店介紹](https://www.dcard.tw/f/sky/p/238946230)與 SkyGame-Data 1.3.10 核對，與紅吉他及電吉他的 GUID／付費身分分開。
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

目前匯出格式為 v4，物品保存 SkyGame-Data 官方 GUID；上游尚未收錄的新品則保存上述明確追蹤的 overlay GUID。v1–v3 與無版本的舊備份會在匯入時遷移；未知物品會被略過並顯示數量，較新的未知版本則拒絕匯入。本機草稿保存 30 天，舊 v2 草稿會自動搬移至 v3。

## AI 開發規範

所有 Agent 修改與合併都必須遵守 [AGENTS.md](./AGENTS.md)，並把 Documentation Impact Check 納入完成條件。

## 發佈流程

唯一正式來源為 GitHub `main`。合併或推送到 `main` 後，由 Vercel 自動建置及發佈；不使用手動 Sites 或 Vercel 部署。

## 私人 Facebook 行情資料

Facebook 原始貼文只能保存在被 Git 忽略的 `work/` 目錄。匿名化時設定未提交的 `VALUATION_HASH_SALT`，再將輸出資料送入估價稽核：

實體徽章、實體周邊、多帳號合售或其他無法拆分帳號價格的刊登，必須在私人來源標記 `exclude_from_model: true`。匿名化只保留布林標記與受控的排除原因，不保留賣家備註；稽核與 validator 都會硬排除這些資料，不能拿來校準任何季節價格。

`$env:VALUATION_HASH_SALT = "至少 32 字元的本機專用隨機字串"; node scripts/prepare-facebook-valuation-source.mjs work/facebook-private.jsonl > work/facebook-anonymous.jsonl`

輸出不含貼文原文、網址、作者或留言，只保留價格、季節、禮包與匿名雜湊等結構欄位。

私人 Google Drive 文案同樣只可放在被 Git 忽略的 `work/`。逐筆 GUID 還原使用 `node scripts/reconstruct-drive-valuations.mjs`；腳本只接受唯一名稱與已明確定義的玩家套組，同名物品不會猜測，缺少逐件名稱的禮包也不會依數量杜撰。還原結果會分別列出物品完整性、綁定與四項資源缺口；只有來源列提供與解析結果完全相同的 `confirmed_owned_guids`、唯一付費禮包數完全對上、文案明確寫出完整且沒有矛盾的綁定，以及白蠟、愛心、昇華蠟、副卡四項資源時，才會產生模型特徵快照。此快照本身不是正式 validator 樣本，仍需具備匿名帳號識別、來源分組、季節進度與標準化分類。產生的逐筆結果與摘要仍留在 `work/`，部分資料只能用來比較刊登價是否落在估價區間，不能視為成交價驗證或直接發布成正式模型。

已由網站匯出的完整帳號備份可用 `npm run prepare:valuation-sample -- --backup <備份.json> --price-twd <人工或成交價> --evidence-kind professional_estimate --out work/sample.jsonl` 產生可重播的匿名樣本。執行前必須在本機設定至少 32 字元、且同一資料集持續沿用的 `VALUATION_HASH_SALT`。工具只接受 `sold` 或 `professional_estimate`，且只接受目前 v4 備份：使用者必須在衣櫃頁逐項確認完整衣櫃；備份會保存該確認、首次建立時的私密隨機 UUID v4 身分、七個平台的有效綁定狀態與白蠟、愛心、昇華蠟、副卡四項明確整數。v1–v3 備份仍可一般匯入，但不能直接建立正式估價樣本。可選 `--account-id <UUID v4>` 僅用於交叉核對備份身分，不能覆蓋它。輸出強制留在 `work/`；穩定帳號指紋、salt 命名空間與個別快照雜湊分開以 HMAC 產生，七平台、四資源、價格、來源分組、日期、季節進度、分類及 predictor 也會一併簽章。audit 與 validator 只接受能由相同本機 salt 驗證的完整證據，任何事後改價、改社團、改權重來源或排除狀態都會失敗；帳號名稱、私密 UUID、備註與原始檔案路徑不會寫入樣本。

大量備份可建立放在 `work/` 的 JSONL manifest，每列提供 `backup`、`price_twd`、`group_id`、`observed_at`，並可選填 `evidence_kind`、`evidence_quality`、`account_id`。執行 `npm run prepare:valuation-samples -- --manifest work/manifest.jsonl --out work/samples.private.jsonl` 會逐筆套用相同 v4、完整性與簽章門檻，任一列失敗時不會留下部分輸出；同一衣櫃快照重複出現也會拒絕，避免批次資料灌水。

衣櫃截圖可用 `npm run recognize:wardrobe -- <圖片> --grid=左,上,格寬,格高,欄數,列數,水平間距,垂直間距 --out=work/wardrobe-candidates.json` 產生官方 GUID 候選。工具只在圖示相似度至少 0.93、且第一名比第二名至少高 0.03 時標記 `accepted`；其餘一律標記 `review` 或 `unreadable`，必須對照原圖人工確認，輸出也不會自動改寫 catalog、帳號備份或估價樣本。

正式樣本的來源文字同樣屬於簽章內容，不能在簽章後追加國服或外幣描述來改變納入資格；完全相同的衣櫃快照即使使用不同帳號代號，也只計為一個有效帳號。正式 validator 會固定核對目前 production baseline 的模型摘要，逐季範圍則取自程式內的官方季節序列，不接受呼叫者用截短 baseline 排除困難季；未簽名列若碰撞已驗證列的貼文、帳號或快照身分，整次驗證直接失敗。

正式 holdout 另需設定至少 32 字元的 `VALUATION_HOLDOUT_SECRET`，且不得與 `VALUATION_HASH_SALT` 相同。先凍結來源檔，再由不參與樣本整理的人產生並保管此 secret；audit 會把完整資料集摘要與不可逆切分承諾寫入候選，validator 會用相同來源重新核對。缺少 private secret、資料集被改動、切分承諾不一致，或仍使用公開 seed 直接分組時，都不能通過正式驗證。

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定保留組比較現行模型。正式驗證固定使用預先承諾的 `sky-valuation-v3` 切分種子，保留組必須占所有可比較帳號的 15%～25%；最低 200 個帳號時至少要有 30 個未參與校準的帳號，不能改 seed 或挑帳號縮成單筆驗證。validator 會使用相同來源重新執行 calibration-only audit，候選的季節區間、modifier、provenance 與 split 必須逐欄等同重建結果，不能只自行宣告沒有看過 holdout。每個已完成季與斷季、禮包、帳號型態分類至少要有 5 個可比較帳號及 2 個 holdout，候選也必須包含全部 modifier 類別；正式結果會逐季、逐類別檢查 prediction coverage、中位對數誤差及相對 baseline 的退化，不讓整體中位數掩蓋局部失準。來源列的 `effective_weight`／`sample_weight` 不受信任；audit 與 validator 都只依證據類型、價格類型、品質及時效重新計算。驗證多批來源時可重複傳入 `--source <anonymous-source.jsonl>`，工具會合併後再統一去重與切分，不必先手動串接檔案；同一貼文或帳號在證據等級與刊登時間相同時，會優先保留 predictor 與季節重播範圍較完整的版本，讓後續補件不會被舊的不完整列覆蓋。稽核結果的 `predictorCoverage` 只計算具帳號識別與結構化起季的候選列，並列出完整 predictor 比例、逐欄缺口與各來源覆蓋率，供下一輪優先補齊可重播樣本；正式 validator 還會排除基準彙總中沒有可比較起季中位數的列。網站與 validator 共用相同的 seed 混合、先驗強度、跨季單調校正及完整數值核心；驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總。未滿 200 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，缺少完整 predictor、網站／validator parity 不一致，或誤差／區間覆蓋未達門檻時不得發布。樣本數門檻計算所有通過來源規則的唯一帳號；誤差只在具有可比較起季資料的帳號上計算。

目前參考彙總以 2026-09-10 為基準，先由 448 筆私人來源隔離已知人工答案帳號及其副本共 2 列，剩餘 446 列；排除外幣、國服、合售等不合格資料並去重後為 399 筆，其中 269 個具有帳號識別、130 筆為無法連結帳號的舊資料。以既有公開種子分組後，356 筆參與校準、43 筆保留；這是探索性切分，完整且經確認的 predictor 為 0，狀態維持 `unvalidated`，不能宣稱通過正式 holdout 或成交價驗證。網站提供低信心參考估價。禮包校準分組會優先使用唯一真實禮包數；缺少數量時只接受既有的有效級距，兩者皆無則只略過禮包級距校準，仍可採用已知季節或斷季證據，不會再把未知數量當成少禮。標題行情不要求 GUID；只有申請正式完整模型驗證的樣本才必須保存完整 `valuation_model` predictor（包含信心與所有乘數），以及由 `start_season_slug` 到模型指定之最新已完成季 `season_progress_end_slug` 的逐季完整結構化進度；model schema v3 的 validator 會核對官方 slug、畢業禮總數與固定結束季，拒絕缺季、未知季、零進度起季或自訂縮短範圍的列，再以候選的共用季節價格帶重新計算起季基準、部分畢業扣分、信心與市場乘數，重播同一數值核心。通過 holdout 後才可改為 `validated`。

本輪季節基準只採用稽核產生的 `segments.startSeason`，已移除核心中無可重建來源的舊樣本數與分位數；`seasonBandSeeds` 只保存先驗價格，不增加樣本數或信心。感恩目前沒有直接起季樣本，保留先驗估值。空白／null 的斷季、完成比例及禮包數量保持未知；`original_currency`／`currency_original` 顯示外幣時，即使已有台幣換算金額也排除於台灣絕對價格校準，原幣欄位存在時一併納入證據簽章。既有未包含原幣欄位的簽章仍相容；舊證據若曾帶有未簽章的原幣欄位，必須重新核對並簽章，不能沿用未保護市場資格的簽章。

初始隔離參考來源時，先用 `node scripts/partition-valuation-evaluation.mjs --evaluation=work/valuation-sample-cai-3500.private.jsonl --out=work/valuation-headline-calibration-2026-09-06 work/valuation-season-expanded-source-r3-2026-09-05.jsonl work/facebook-season-targeted-2026-09-05.anonymous.jsonl work/facebook-market-confounded-2026-09-05.anonymous.jsonl work/valuation-sample-cai-3500.private.jsonl work/valuation-drive-incremental-2026-09-06.jsonl` 隔離測試帳號，再將產生的 `calibration.jsonl` 傳給 `node scripts/audit-valuation-source.mjs --as-of=2026-09-06`。分割工具拒絕覆蓋既有產出，重跑請換空的私人目錄；audit 與 validator 必須使用同一份分割後來源。這些私人來源不提交 Git。已看過人工答案的帳號隔離後仍只能作回歸檢查，不是全新盲測；拾光目前不再含該帳號作直接起季樣本。正式 validator 的比較基準仍固定為 commit `8f979264709d0c4ce8b0441c555bc39f9263d264` 中的 `app/valuation-market-aggregate.json`，使用 `git show` 取回該版本後傳給 `--baseline`，不得以新的未驗證彙總替換固定 baseline 或其摘要。

估價中的禮包、限定與資源只計入二手帳號市場可保留的部分價值。同一真實禮包即使包含多件物品，禮包級距、帳號類型與加值上限都只計一次；原始付費物品數只保留作診斷，不參與跨級。拾光季起始或更晚、目前進行中季節，以及無法確認早期季節證據的帳號使用較低的附加價值上限，避免禮包數量把簡號推到早期稀有帳號的價格帶；起始畢業季在拾光以前的帳號保留原本的稀有度校正，完全沒有畢業禮時才以最早季卡項鍊判斷年代。此分段目前同樣屬 `unvalidated` 參考規則，需待足量同型成交樣本與 holdout 驗證後才能視為正式市場模型。

## 公開市場刊登價

`npm run collect:market-listings` 會將淘手游國服帳號與 FunPay 國際市場的公開刊登資料寫入被 Git 忽略的 `work/market-listings/snapshots/`。每次執行建立獨立快照，並同步產生依「來源＋刊登 ID」去重的 `work/market-listings/combined/` 累積資料；累積列保留首次／最後觀察時間、觀察次數與實際改價歷程，不會讓重複刊登膨脹樣本數。既有快照可用 `npm run consolidate:market-listings` 重新整理。蒐集器預設讀取淘手游 40 頁、補抓前 120 筆商品詳情，並保留來源市場、原幣價格、刊登時間、已移除聯絡方式的公開帳號描述及平台識別碼；不保存賣家姓名、聯絡資料、個人頁面或完整網頁。資料列會另外保存文案中明確出現的 `season_mentions`，也會依官方時間順序解析 FunPay 的 `Seasons: 6, 8, 11` 等編號格式；只有淘手游「畢業季節」欄位或 FunPay `Full Seasons` 清單才會形成 `season_graduation_mentions`，淘手游資料並可在完整季數一致時形成保守的 `start_season_candidate`。半季、普通季節提及、單純季卡和 `on schedule` 季節都不會被推定為完整畢業。摘要提供 30 季的 `season_coverage`，一般季節提及不能直接當作起季或畢業。最小化 JSON 解析快取預設保留六小時，失敗後可續跑；需要刷新時加入 `--refresh`。若分頁中間出現空白、請求失敗或頁面異常，蒐集器會略過快取自動補抓一次；真正位於分頁結尾之後的空頁不會重試。可用 `-- --taoshouyou-pages=10 --taoshouyou-details=100 --concurrency=2 --delay-ms=3000 --cache-hours=6` 調整範圍與全域請求速率。摘要的 `source_health` 會分別檢查匯率、FunPay 與淘手游；重試後仍有請求失敗、站點空殼、內部分頁缺口或必要來源空資料都會令快照不完整。只有至少讀取 40 頁、確認分頁結尾且所有來源健康時，才會以 `latest_eligible: true` 更新 `latest.json`。

台幣換算使用臺灣期貨交易所 `DailyForeignExchangeRates` 對應刊登日期以前最近一個匯率日，輸出欄位為 `price_twd_fx`。這只代表匯率換算值：所有資料仍標記為 `ask` 刊登價，不能當成交價，也不能把國服或國際市場的絕對金額直接併入台灣估價。蒐集器會以各來源原幣價格的對數中位數與 MAD 標記極端 `price_outlier`，保留原始列但不將其列為候選。`relative_price_candidate` 只供同一來源、同一幣別內比較季節相對差異；`ratio_candidate` 另要求刊登日期有官方匯率，才可進行跨幣別比例研究。後續市場校準應在起季、斷季、禮包級距與綁定條件相近的帳號間，估計 `台灣刊登／成交台幣 ÷ 外站匯率換算台幣` 的穩健中位比例；樣本不足的分組不得單獨發布。

`npm run analyze:market-season-ratios` 會依「來源＋原幣＋明確渠道」分組，僅使用可確認最早完整畢業季且非離群的帳號刊登，輸出季節中位數、四分位與市場內相對倍率。輸出 schema v2 的 `market` 鍵格式為 `source:currency:channel`，另提供 `channel` 欄位；缺少渠道的列仍保留於 `unknown`，不排除或猜測為官服。每季預設至少 3 筆才標記可比較；可能的年代倒掛只在同渠道內診斷，不會自動改寫網站估價。輸入仍應使用已去重的累積刊登資料；未知渠道、禮包、斷季與綁定差異仍會影響比例，不能視為純季節溢價。

### 不需完整 GUID 的標題行情

第三至六批核對 13 份原文，移除把禮包或飛行三級動作誤當畢業的進度，修回零進度、1/3、1/2 與 2/3，補回原文明確列出的漏季；沒有唯一禮包依據的物品清單數量保持未知。三筆明寫無翼的帳號不再標為一般帳號，不另行推定無翼溢價；一筆有刷退紀錄的來源降為低品質參考。「3,300 台幣左右」仍保留為原文約價，不假造成交價或上下界。兩筆原文無斷帳號移除舊微斷計算，保留賣家標籤，不冒充獨立計算的完整進度。總數仍為 399 筆，無斷／微斷／中斷／大斷分組 42／63／80／114 筆、few／medium／many 禮包分組 115／67／80 筆、一般帳號分組 256 筆；30 季價格數值不變，內部 many 禮包乘數由 1.037 微調為 1.038，其餘乘數不變。第六批另修回青鳥 1/2、表演與極光 1/3，確認王子兩件套不代表畢業；未定義的織光³保留未知，價格與乘數維持第五批結果。這仍是未經完整驗證的參考校準。

第二批再核對 4 份原文：零進度與季卡不算畢業，修回極光 1/3、暮星 1/2，移除沒有唯一禮包依據的 18／34 包；明寫刷退或修改物品的 2 筆保留為低品質參考。399 筆帳號仍全部保留，只有缺證據的維度退出分組。重算後中斷分組 87 筆、內部 medium 禮包分組 73 筆，各分類乘數不變；群組權重重新平衡使預言季基準中位數由 8,200 微調為 8,100，音韻季貢獻上下限各增 100，其餘季節價格欄位不變。此為探索性來源校正，並非準確度已通過驗證。

起季一致性回查發現，舊文案的「音韻吉他」「王子星球斗／小狐狸」曾被誤記為更早季節畢業。2026-09-10 先核正 3 份原文：移除這些錯誤進度，將感恩有卡改為零畢業、小王子改為 2/3，未完成的狂歡進度保持未知；移除相關舊完成率與衍生斷季欄位，保留原價與可用起季／賣家描述。相同私人來源重新稽核後仍為 399 筆，季節價格與分類乘數不變。這是來源修正，不是新增帳號或完整模型驗證。

2026-09-10 再核對旋轉拍賣兩筆既有刊登：一筆附實體徽章且含修改取得物品的混合總價改為排除；另一筆保留預言部分畢業與 NT$7,000 刊登價，移除原文未確認的 25 包、大斷與一般帳號分類。這不是新增樣本；同一私人來源重新稽核後為 399 筆有效資料、356 筆探索校準、43 筆舊式保留組，狀態仍為 `unvalidated`。NT$7,000 原頁只顯示「4 年前」，先前研究也沒有確切日期，因此移除沒有依據的 2022-08-30 時戳，`published_at` 保持 `null`，相對日期留在私人來源備註。現有未知日期係數為 0.45，不使用 `observed_at` 冒充刊登時間；這比原先假定超過四年的 0.25 高，但不是近期行情的 1。重新稽核僅改變有效權重與來源摘要，30 季價格數值及各分類乘數不變。

禮包數支援「80 個禮包」「禮包：80」及繁簡／全形格式；「約 80 禮」「80 禮左右」「不到 80 禮」不作精確數量，只將禮包數保留未知，仍保留帳號的價格與季節證據。「禮包：60+」「60+ 個禮包」「60～80 個禮包」保留上下界，不轉成精確數量。`60+` 跨內部級距時不猜分類，`100+ 個禮包` 可支持百禮級距；多種數量同時出現時保持未知，不只抓最後一個精確數字。

標題亦接受「音韻綁全出簡」這類季名與簡號之間插入綁定摘要的寫法，繁簡字均可。只提取明確起季與帳號型態，不推定無斷、禮包數或逐平台綁定；季卡、單件物品、多季矛盾仍保持未知。

行情標題支援「飛翔季」對應飛行、「時光季」對應拾光、「雲巢季」對應歸巢等台灣季名別稱；後兩者要求帶「季」，避免將一般文字或雲巢地圖家具誤當起季。別稱仍須有帳號起季語境，季卡與單件斗篷不代表畢業進度，也不改變網站標準季名。

當未提供明確起季而須從 `season_progress` 推斷時，audit 與標題行情報告共用第一個有效非零進度季的判斷，支援文字比例與 `{ selected, expected }`；零取得、無效比例或空物件不會只因存在季節鍵而成為起季。既有 `start` 標記與正整數取得數仍相容，其他已知行情欄位也不因單一進度無效而整筆丟棄。標題未說明起季但有部分結構化進度時，可直接加入探索比較，不要求完整 GUID 或逐季補齊；不因此推定無斷，也不取代正式完整重播驗證。

標題季節晚於已核對的最早部分畢業季時，若來源標記 `start_season_confidence: structured`、季節進度有效且同時支持兩個季節，報告採正文起點並記錄 `title_start_resolved`，不再整筆排除。此時不沿用標題或賣家對較晚起點的斷季標籤；只保留已有 `computed_break_class`，否則斷季未知。缺少進度支持、起點方向相反或比例無效仍記錄衝突，不猜補；無需完整 GUID 或逐季完整資料。

標題報告另外保留 `range:60+`、`range:60-80`、`range:100+` 等禮包範圍群組，讓缺少精確數量的來源仍可呈現同類整號價格；結構化範圍優先於標題猜測。這些群組不混入精確數量的差價比較，也不當作零禮基準。數量與範圍矛盾時只將禮包維度標為未知，保留其他可用行情；此診斷不會自動改寫正式估價倍率。

標題與稽核共用 `marketHeadlineFor`，略過空白、N/A 與文件「分頁」標記，再採第一個有效標題。「預言八季禮包號」「狂歡禮包號」「姆明綁全出無翼」可提供起季參考，但單件／套組名稱後接「禮包號／禮包簡」不因此成為起季證據；不會從季數推造逐季完成進度。標題中的國服或外幣資訊也參與來源排除。

2026-09-10 逐份核對既有文案的季節區，修正 14 列起季與明確完成比例，移除與新起點不一致的舊斷季計算欄位。部分畢業可作起點，只有季卡不能當畢業；來源未說清楚的比例保持未知。一列含實體徽章贈品的混合總價排除，兩列含修改物品的來源降為低品質參考。以 `node scripts/audit-valuation-source.mjs --as-of=2026-09-10 work/valuation-headline-calibration-2026-09-10/calibration.jsonl` 重建彙總，並非新增帳號或已通過完整模型驗證。

`npm run analyze:market-headlines -- <source.jsonl> [more.jsonl ...] --out=work/headline-report.json` 接受標題或已核對的起季、斷季、禮包數。`market-title-evidence.mjs` 只提取明確文字；「偽無斷／小斷」屬微斷，「斷季」未說程度時保持未知，季卡／單件物品、多季衝突不猜起季。既有少／中／多禮標籤與精確禮包數分開，不能互相補值，也不補造 GUID、畢業進度、綁定或資源。

同日再核對一筆台灣刊登的文字與商品圖片，修正把「3 季畢業」記成「3 包」的來源資料，並移除沒有依據的簡號／大斷分類；保留售價、明確畢業季與賣家少禮描述，不排除帳號或補造精確禮包數。最新私人校準來源為 `work/market-research-2026-09-10/tw-reviewed-calibration.jsonl`，以相同 `audit-valuation-source.mjs --as-of=2026-09-10` 指令重建；有效樣本仍為 400 筆，狀態仍為 `unvalidated`。這是既有來源修正，不是新增樣本或成交價驗證。

標題報告亦採用已整理的 `seller_package_label`（`few`／`medium`／`many`），即使沒有標題或精確數量仍可呈現賣家描述群組；不把標籤換算成禮包數。標籤與標題矛盾時只將該維度保留未知，不排除季節與價格；有效精確數量及範圍仍優先於主觀標籤。

標題起季也接受二重奏（協奏）、彩染（染色）、破曉（破碎）、追憶（緬懷）與歐若拉／AURORA（極光）的繁簡別稱。這只正規化季節身分，不更改網站標準季名，也不改變來源伺服器或原幣；季卡、單件物品與多季矛盾仍不推定起季。

行情稽核與標題報告共用斷季描述的起點核對：若結構化進度已提供起季，但標題指向不同季節，或多季標題無法判定起點且提到其他季節，標題的斷季描述不可直接套用到該起季；保留其他已知證據，只將該斷季程度設為未知。已獨立計算的 `computed_break_class` 仍優先使用。

2026-09-10 以同一份 `tw-reviewed-calibration.jsonl` 重算此規則後，兩筆舊文案移出微斷分組，但仍保留帳號與起季證據；有效帳號總數仍為 400，微斷校準樣本為 64 筆，乘數維持 0.97，季節價格帶不變。

每筆仍須有來源、市場／原幣、明確價格類型及貼文／刊登識別，以便去重；這是刊登 ID 或網址，不是物品 GUID。缺少識別的重複列不計入樣本門檻。`--out` 不覆蓋既有檔案；重跑請使用新檔名。

標題報告與季節倍率報告共用明確的 `channel` 正規化：`ios-official`、`android-official`、`huawei`、`vivo`、`oppo`、`xiaomi`、`bilibili`；支援對應的常見中文標記。缺值、未支援標記及只有「iOS」而未說明官服的資料保留在 `unknown`，不因此排除，也不從標題或登入綁定猜渠道。報告只輸出正規化渠道，不帶出原始自由文字；標題報告的同一刊登仍先去重，不會因改填渠道而多算一筆。這些診斷不改寫正式估價。

報告分開來源、伺服器、原幣、刊登／成交等價格類型及已知帳號條件，再比較同起季、同斷季的禮包級距；每格至少 3 筆才標記樣本足夠，這不是信心或正式驗證通過。缺少綁定等資訊仍有混雜風險。列出的四分位價格是**整號售價**，禮包級距間的差額只是觀察值，不可拿整號價當季節裸價，再重複加入完整禮包價值。只有明確零禮且樣本足夠才標記無禮參考組，少禮不是零禮。

此報告輸出 `headline-unvalidated` 診斷，不自動覆寫網站估價／正式 baseline。參考校準另由 `audit-valuation-source.mjs` 讀取有貼文識別的 `title`、`listing_title`，或 `listing_text` 第一個有效文字行；缺少結構化起季時，明確標題可補起季並使用 0.45 起季證據係數。缺少完整 GUID、綁定或資源不會阻止這條參考路徑，缺值仍保留未知；完整模型驗證規則維持不變。

禮包範圍保存為 `paid_package_min`／`paid_package_max`（上界未知為 `null`）。`60+禮` 不再寫成精確 60；只有上下界落在相同內部校準級距時才採用級距，例如百禮可支持 hundred，60～80 可支持 many，60+ 跨級則不猜。否定、近似或矛盾數量不轉成確定級距。這些內部分組不替代出售摘要的少／中／多禮門檻。

2026-09-09 在已隔離人工答案的 446 列來源中補入 115 列原文標題，核正 9 列禮包下界及 1 列更早的部分畢業進度，再以 `node scripts/audit-valuation-source.mjs --as-of=2026-09-09 work/valuation-headline-calibration-2026-09-09/calibration.jsonl` 重建參考彙總；不是新增 115 個帳號，也不是新盲測。含新增標題／禮包範圍欄位的正式證據改用 `model-evidence-v2` 簽章域，舊簽章須核對原始來源後重新簽章，不會接受未保護新增欄位的舊簽章；沒有這些欄位的 v1 簽章保持相容。目前參考來源沒有已簽章完整 predictor。私人來源及診斷產出放在忽略的 `work/` 或 `dist/tmp/`，不提交原文或帳號識別。
