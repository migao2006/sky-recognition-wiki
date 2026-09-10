# 光遇帳號整理

單頁式 Sky 光遇帳號整理工具，用於記錄帳號綁定、資源、季節畢業禮與衣櫃物品，並提供估價、備份及匯出功能。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

Fortune Dragon Bangles（`xsTxIqIX8E`）保留「幸運節龍耳飾」顯示名，支援「龍鱗耳墜／金鱗耳墜」搜尋。依[交易用語](https://www.8591.com.hk/mall/detail/51274180)、[2024 春節物品介紹](https://www.9game.cn/skygy/9762443.html)與[國際服 2024 福瑞節物品頁](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune/2024)核對：這是金紅色垂晶耳飾，不是手環；官方 ID 2055、order 1400、HeadAccessory 分類、圖示及付費禮包 `iap:1f6Qmtj6ky` 不變。舊直譯仍可搜尋，不採外幣行情校準台幣，也不將泛稱「龍鱗」綁定單件。

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
- 自然日付費眼鏡採「藍色墨鏡」，保留自然日眼鏡、自然墨鏡、海洋日墨鏡作搜尋別名；依據[台灣玩家介紹](https://www.youtube.com/watch?v=gYsDdAliO0s)與 [App Store 台灣介紹](https://apps.apple.com/tw/iphone/story/id1682105205)，不更改官方 GUID、分類或付費身分。
- 情人節髮型依[台灣玩家活動整理](https://www.dcard.tw/f/sky/p/257944195)區分免費「挑染短辮」與付費「挑染雙馬尾」；修正原先把雙馬尾別名套到免費短辮的錯配，不保留已證實錯誤的別名。自然日付費髮型採[玩家用語「海浪髮型」](https://www.dcard.tw/f/sky/p/255652135)，原直譯與自然水漾髮型仍可搜尋。三件物品的官方 GUID、ID、order 與付費身分不變。
- 聖島畢業手碟顯示為「聖島手碟」，避免只有籠統的「聖島季畢業禮」；付費「凱旋手碟」另支援「霞谷手盤」搜尋，兩者保持不同官方 GUID 與付費身分。
- 預言與重組畢業樂器使用「預言鼓」「重組小號」，依[台灣玩家樂器討論](https://www.dcard.tw/f/sky/p/238946230)保留辨識度；舊畢業禮名稱仍可搜尋，不因文案提到測試服換色款而新增物品或付費身分。
- 追光傘與拾光相機分別顯示「大傘」「拾光畢業相機」，依[季節物品整理](https://forum.gamer.com.tw/Co.php?bsn=33024&sn=2316)區分具體物品；一般相機仍是另一個 GUID，不共用畢業名稱。
- 飛行畢業服以「飛行畢業褲」標示具體物品，保留風行／飛翔舊稱搜尋；參考[玩家褲裝介紹](https://game.xiaomi.com/viewpoint/1312958803_1631021803629_13)的物品類型，不採用文中測試服數值。官方 GUID `SxX0bNDJaR`、ID、order 及非付費畢業身分不變。
- 姆明畢業傘以「姆明紅傘」顯示，依[台灣玩家的紅色大傘描述](https://www.dcard.tw/f/sky/p/256907106)保留系列辨識；「姆明傘／姆明雨傘／姆明大傘」與舊泛稱仍可搜尋。GUID `dkfdFCaemY`、ID 2341、order 4100 與畢業身分不變，「大傘」仍對應追光畢業傘。
- 彩虹面具保留兩件官方身分：`bQIy02O8pa` 為 [2026 付費款](https://www.dcard.tw/f/sky/p/261580685)，`NdTO2GQkMc` 為黑彩虹兌換款。新增年份、付費／兌換限定搜尋詞；泛稱「彩虹面具」仍保留歧義，不自動當作付費物品。顯示名、GUID、ID、order 與 IAP 判定不變。
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

一般樂器的「貝斯／屁琴、鋼琴、高音鋼琴」依[台灣玩家國際服用語整理](https://www.dcard.tw/f/sky/p/234859690)及[高音鋼琴使用討論](https://www.dcard.tw/f/sky/p/235297354)核對，分別綁定 Contrabass、Piano、Winter Piano 官方 GUID；「屁琴」只作搜尋別名，原低音提琴、鋼琴鍵盤、冬季／冬日鋼琴仍可搜尋。名稱變更不改動付費、畢業禮、衣櫃位置與排序。

歸屬季 Guitar 採「紅吉他」、夢想季 Lute 採「琵琶」，參考既有交易文案、[歸屬復刻影片用語](https://daydaynews.cc/video/959594.html)及[巴哈姆特樂器對照](https://forum.gamer.com.tw/Co.php?bsn=33024&sn=4630)。原「吉他」「魯特琴」保留搜尋；紅吉他、白吉他、電吉他與藍色電吉他分別解析，不混同免費復刻與付費款。

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

私人 Google Drive 文案同樣只可放在被 Git 忽略的 `work/`。逐筆 GUID 還原使用 `node scripts/reconstruct-drive-valuations.mjs --market <已核對行情.jsonl>`；腳本只接受唯一名稱與已明確定義的玩家套組，同名物品不會猜測，缺少逐件名稱的禮包也不會依數量杜撰。還原結果會分別列出物品完整性、綁定與四項資源缺口；只有來源列提供與解析結果完全相同的 `confirmed_owned_guids`、唯一付費禮包數完全對上、文案明確寫出完整且沒有矛盾的綁定，以及白蠟、愛心、昇華蠟、副卡四項資源時，才會產生模型特徵快照。此快照本身不是正式 validator 樣本，仍需具備匿名帳號識別、來源分組、季節進度與標準化分類。產生的逐筆結果與摘要仍留在 `work/`，部分資料只能用來比較刊登價是否落在估價區間，不能視為成交價驗證或直接發布成正式模型。 來源列標記 exclude_from_model: true 時仍保留 GUID 診斷及原始報價，但不輸出模型特徵、價格重疊或價差，也不納入吻合率摘要。摘要分開提供 priced_document_count（全部有價文案）、comparable_document_count（可比較文案）及 excluded_document_count（所有明確排除文案）；一般缺少綁定或完整 GUID 的文案仍保留探索性重播。 探索性重播按欄位採用明寫且無矛盾的資源數量，缺少副卡不會使已知白蠟或愛心失效；未知欄位不補零為已確認資料，完整模型特徵仍須四欄齊全。逐筆 resource_values 保留實際採用值。 資源標籤可在數字前後，支援全形數字、千分位及精確千／萬縮寫（如「白蠟 1,000」「１０００白蠟」「1.5萬白蠟」「愛心 2千」）；約數、加號下界及明確區間另存 resource_approximations／resource_ranges（如「約 1000白蠟」「白蠟1000+」「愛心100～200」），不再丟失可用線索，也不把下界或約數冒充精確數值加入估價；衝突、否定與無效數值不猜補。上下限皆明確的資源區間會以兩端分別執行網站估價，形成探索性價格包絡；`resource_estimate_inputs.low/high` 保存情境輸入，`resource_values` 仍只保存精確值。區間不補成精確值、不令完整模型特徵通過；只有下界的 `1000+` 與約數仍只作診斷，不杜撰上限。未有可靠對照的作者裝飾符號不作全域資源單位。 必須明確指定 --market，不再自動讀取舊日期的行情檔；未指定或缺少路徑會在讀取資料前停止。私人摘要的 input_sources 保存兩份輸入原文的 SHA-256 與行情列數，以核對重測來源，不包含本機路徑，也不代表來源已通過正式驗證。

已由網站匯出的完整帳號備份可用 `npm run prepare:valuation-sample -- --backup <備份.json> --price-twd <人工或成交價> --evidence-kind professional_estimate --out work/sample.jsonl` 產生可重播的匿名樣本。執行前必須在本機設定至少 32 字元、且同一資料集持續沿用的 `VALUATION_HASH_SALT`。工具只接受 `sold` 或 `professional_estimate`，且只接受目前 v4 備份：使用者必須在衣櫃頁逐項確認完整衣櫃；備份會保存該確認、首次建立時的私密隨機 UUID v4 身分、七個平台的有效綁定狀態與白蠟、愛心、昇華蠟、副卡四項明確整數。v1–v3 備份仍可一般匯入，但不能直接建立正式估價樣本。可選 `--account-id <UUID v4>` 僅用於交叉核對備份身分，不能覆蓋它。輸出強制留在 `work/`；穩定帳號指紋、salt 命名空間與個別快照雜湊分開以 HMAC 產生，七平台、四資源、價格、來源分組、日期、季節進度、分類及 predictor 也會一併簽章。audit 與 validator 只接受能由相同本機 salt 驗證的完整證據，任何事後改價、改社團、改權重來源或排除狀態都會失敗；帳號名稱、私密 UUID、備註與原始檔案路徑不會寫入樣本。

大量備份可建立放在 `work/` 的 JSONL manifest，每列提供 `backup`、`price_twd`、`group_id`、`observed_at`，並可選填 `evidence_kind`、`evidence_quality`、`account_id`。執行 `npm run prepare:valuation-samples -- --manifest work/manifest.jsonl --out work/samples.private.jsonl` 會逐筆套用相同 v4、完整性與簽章門檻，任一列失敗時不會留下部分輸出；同一衣櫃快照重複出現也會拒絕，避免批次資料灌水。

衣櫃截圖可用 `npm run recognize:wardrobe -- <圖片> --grid=左,上,格寬,格高,欄數,列數,水平間距,垂直間距 --out=work/wardrobe-candidates.json` 產生官方 GUID 候選。工具只在圖示相似度至少 0.93、且第一名比第二名至少高 0.03 時標記 `accepted`；其餘一律標記 `review` 或 `unreadable`，必須對照原圖人工確認，輸出也不會自動改寫 catalog、帳號備份或估價樣本。

正式樣本的來源文字同樣屬於簽章內容，不能在簽章後追加國服或外幣描述來改變納入資格；完全相同的衣櫃快照即使使用不同帳號代號，也只計為一個有效帳號。正式 validator 會固定核對目前 production baseline 的模型摘要，逐季範圍則取自程式內的官方季節序列，不接受呼叫者用截短 baseline 排除困難季；未簽名列若碰撞已驗證列的貼文、帳號或快照身分，整次驗證直接失敗。

正式 holdout 另需設定至少 32 字元的 `VALUATION_HOLDOUT_SECRET`，且不得與 `VALUATION_HASH_SALT` 相同。先凍結來源檔，再由不參與樣本整理的人產生並保管此 secret；audit 會把完整資料集摘要與不可逆切分承諾寫入候選，validator 會用相同來源重新核對。缺少 private secret、資料集被改動、切分承諾不一致，或仍使用公開 seed 直接分組時，都不能通過正式驗證。

先用 `audit-valuation-source.mjs` 產生只含 80% 帳號群組的候選彙總，再用 `validate-valuation-model.mjs` 對固定保留組比較現行模型。正式驗證固定使用預先承諾的 `sky-valuation-v3` 切分種子，保留組必須占所有可比較帳號的 15%～25%；最低 200 個帳號時至少要有 30 個未參與校準的帳號，不能改 seed 或挑帳號縮成單筆驗證。validator 會使用相同來源重新執行 calibration-only audit，候選的季節區間、modifier、provenance 與 split 必須逐欄等同重建結果，不能只自行宣告沒有看過 holdout。每個已完成季與斷季、禮包、帳號型態分類至少要有 5 個可比較帳號及 2 個 holdout，候選也必須包含全部 modifier 類別；正式結果會逐季、逐類別檢查 prediction coverage、中位對數誤差及相對 baseline 的退化，不讓整體中位數掩蓋局部失準。來源列的 `effective_weight`／`sample_weight` 不受信任；audit 與 validator 都只依證據類型、價格類型、品質及時效重新計算。驗證多批來源時可重複傳入 `--source <anonymous-source.jsonl>`，工具會合併後再統一去重與切分，不必先手動串接檔案；同一貼文或帳號在證據等級與刊登時間相同時，會優先保留 predictor 與季節重播範圍較完整的版本，讓後續補件不會被舊的不完整列覆蓋。稽核結果的 `predictorCoverage` 只計算具帳號識別與結構化起季的候選列，並列出完整 predictor 比例、逐欄缺口與各來源覆蓋率，供下一輪優先補齊可重播樣本；正式 validator 還會排除基準彙總中沒有可比較起季中位數的列。網站與 validator 共用相同的 seed 混合、先驗強度、跨季單調校正及完整數值核心；驗證通過後，改加 `--include-holdout` 重算全樣本正式彙總。未滿 200 個唯一有效帳號、少於 3 個社團、單一社團權重超過 60%，缺少完整 predictor、網站／validator parity 不一致，或誤差／區間覆蓋未達門檻時不得發布。樣本數門檻計算所有通過來源規則的唯一帳號；誤差只在具有可比較起季資料的帳號上計算。

目前參考彙總以 2026-09-10 為基準，先由 448 筆私人來源隔離已知人工答案帳號及其副本共 2 列，剩餘 446 列；排除外幣、國服、合售等不合格資料並去重後為 394 筆，其中 269 個具有帳號識別、125 筆為無法連結帳號的舊資料。以既有公開種子分組後，351 筆參與校準、43 筆保留；這是探索性切分，完整且經確認的 predictor 為 0，狀態維持 `unvalidated`，不能宣稱通過正式 holdout 或成交價驗證。網站提供低信心參考估價。禮包校準分組會優先使用唯一真實禮包數；缺少數量時只接受既有的有效級距，兩者皆無則只略過禮包級距校準，仍可採用已知季節或斷季證據，不會再把未知數量當成少禮。標題行情不要求 GUID；只有申請正式完整模型驗證的樣本才必須保存完整 `valuation_model` predictor（包含信心與所有乘數），以及由 `start_season_slug` 到模型指定之最新已完成季 `season_progress_end_slug` 的逐季完整結構化進度；model schema v5 的 validator 會核對官方 slug、畢業禮總數與固定結束季，拒絕缺季、未知季、零進度起季或自訂縮短範圍的列，再以候選的共用季節價格帶重新計算起季基準、部分畢業扣分、信心、市場乘數及七平台綁定證據的風險係數，重播同一數值核心。通過 holdout 後才可改為 `validated`。

本輪季節基準只採用稽核產生的 `segments.startSeason`，已移除核心中無可重建來源的舊樣本數與分位數；`seasonBandSeeds` 只保存先驗價格，不增加樣本數或信心。感恩目前沒有直接起季樣本，保留先驗估值。空白／null 的斷季、完成比例及禮包數量保持未知；`original_currency`／`currency_original` 顯示外幣時，即使已有台幣換算金額也排除於台灣絕對價格校準，原幣欄位存在時一併納入證據簽章。既有未包含原幣欄位的簽章仍相容；舊證據若曾帶有未簽章的原幣欄位，必須重新核對並簽章，不能沿用未保護市場資格的簽章。

初始隔離參考來源時，先用 `node scripts/partition-valuation-evaluation.mjs --evaluation=work/valuation-sample-cai-3500.private.jsonl --out=work/valuation-headline-calibration-2026-09-06 work/valuation-season-expanded-source-r3-2026-09-05.jsonl work/facebook-season-targeted-2026-09-05.anonymous.jsonl work/facebook-market-confounded-2026-09-05.anonymous.jsonl work/valuation-sample-cai-3500.private.jsonl work/valuation-drive-incremental-2026-09-06.jsonl` 隔離測試帳號，再將產生的 `calibration.jsonl` 傳給 `node scripts/audit-valuation-source.mjs --as-of=2026-09-06`。分割工具拒絕覆蓋既有產出，重跑請換空的私人目錄；audit 與 validator 必須使用同一份分割後來源。這些私人來源不提交 Git。已看過人工答案的帳號隔離後仍只能作回歸檢查，不是全新盲測；拾光目前不再含該帳號作直接起季樣本。正式 validator 的比較基準仍固定為 commit `8f979264709d0c4ce8b0441c555bc39f9263d264` 中的 `app/valuation-market-aggregate.json`，使用 `git show` 取回該版本後傳給 `--baseline`，不得以新的未驗證彙總替換固定 baseline 或其摘要。

估價中的禮包、限定與資源只計入二手帳號市場可保留的部分價值。同一真實禮包即使包含多件物品，禮包級距、帳號類型與加值上限都只計一次；原始付費物品數只保留作診斷，不參與跨級。拾光季起始或更晚、目前進行中季節，以及無法確認早期季節證據的帳號使用較低的附加價值上限，避免禮包數量把簡號推到早期稀有帳號的價格帶；起始畢業季在拾光以前的帳號保留原本的稀有度校正，完全沒有畢業禮時才以最早季卡項鍊判斷年代。此分段目前同樣屬 `unvalidated` 參考規則，需待足量同型成交樣本與 holdout 驗證後才能視為正式市場模型。

部分畢業扣分只作用於起始季的完整畢業價格基準；後續季節進度由斷季分類處理，不再因從零件補選第一件畢業禮而追加扣款。相同斷季級距內，後續部分畢業與全畢可能同價，尚未以成交資料校準單件溢價。Predictor schema v5 沿用此語意，並將綁定扣分合併計算：每個異常扣 10%、不出扣 4%，合計最多扣 30%，避免限制減少卻反向降價；舊 v3／v4 必須由原帳號重新計算與簽章，不能只改版本號，仍可作不完整行情參考。這不是備份格式升版，固定 holdout 種子不變。固定 v2 baseline 僅開放比較路徑，依其價格帶及完整進度重算舊版全季部分畢業扣分；不能作新版候選，並依原始綁定證據重算舊版雙乘數風險，不沿用新版扣分值冒充舊算法。

## 公開市場刊登價

`npm run collect:market-listings` 會將淘手游國服帳號與 FunPay 國際市場的公開刊登資料寫入被 Git 忽略的 `work/market-listings/snapshots/`。每次執行建立獨立快照，並同步產生依「來源＋刊登 ID」去重的 `work/market-listings/combined/` 累積資料；累積列保留首次／最後觀察時間、觀察次數與實際改價歷程，不會讓重複刊登膨脹樣本數。既有快照可用 `npm run consolidate:market-listings` 重新整理。蒐集器預設讀取淘手游 40 頁、補抓前 120 筆商品詳情，並保留來源市場、原幣價格、刊登時間、已移除聯絡方式的公開帳號描述及平台識別碼；不保存賣家姓名、聯絡資料、個人頁面或完整網頁。資料列會另外保存文案中明確出現的 `season_mentions`，也會依官方時間順序解析 FunPay 的 `Seasons: 6, 8, 11` 等編號格式；只有淘手游「畢業季節」欄位或 FunPay `Full Seasons` 清單才會形成 `season_graduation_mentions`，淘手游資料並可在完整季數一致時形成保守的 `start_season_candidate`。半季、普通季節提及、單純季卡和 `on schedule` 季節都不會被推定為完整畢業。摘要提供 30 季的 `season_coverage`，一般季節提及不能直接當作起季或畢業。最小化 JSON 解析快取預設保留六小時，失敗後可續跑；需要刷新時加入 `--refresh`。若分頁中間出現空白、請求失敗或頁面異常，蒐集器會略過快取自動補抓一次；真正位於分頁結尾之後的空頁不會重試。可用 `-- --taoshouyou-pages=10 --taoshouyou-details=100 --concurrency=2 --delay-ms=3000 --cache-hours=6` 調整範圍與全域請求速率。摘要的 `source_health` 會分別檢查匯率、FunPay 與淘手游；重試後仍有請求失敗、站點空殼、內部分頁缺口或必要來源空資料都會令快照不完整。只有至少讀取 40 頁、確認分頁結尾且所有來源健康時，才會以 `latest_eligible: true` 更新 `latest.json`。

台幣換算使用臺灣期貨交易所 `DailyForeignExchangeRates` 對應刊登日期以前最近一個匯率日，輸出欄位為 `price_twd_fx`。這只代表匯率換算值：所有資料仍標記為 `ask` 刊登價，不能當成交價，也不能把國服或國際市場的絕對金額直接併入台灣估價。蒐集器會以各來源原幣價格的對數中位數與 MAD 標記極端 `price_outlier`，保留原始列但不將其列為候選。`relative_price_candidate` 只供同一來源、同一幣別內比較季節相對差異；`ratio_candidate` 另要求刊登日期有官方匯率，才可進行跨幣別比例研究。後續市場校準應在起季、斷季、禮包級距與綁定條件相近的帳號間，估計 `台灣刊登／成交台幣 ÷ 外站匯率換算台幣` 的穩健中位比例；樣本不足的分組不得單獨發布。

`npm run analyze:market-season-ratios` 會依「來源＋原幣＋明確渠道」分組，僅使用可確認最早完整畢業季且非離群的帳號刊登，輸出季節中位數、四分位與市場內相對倍率。輸出 schema v2 的 `market` 鍵格式為 `source:currency:channel`，另提供 `channel` 欄位；缺少渠道的列仍保留於 `unknown`，不排除或猜測為官服。每季預設至少 3 筆才標記可比較；可能的年代倒掛只在同渠道內診斷，不會自動改寫網站估價。輸入仍應使用已去重的累積刊登資料；未知渠道、禮包、斷季與綁定差異仍會影響比例，不能視為純季節溢價。

### 不需完整 GUID 的標題行情

英文刊登標題如 `Completed 4 seasons from Duets to Blue Bird` 可提供起始季節證據，不要求完整 GUID；僅解析明確的完成季節範圍句型與已知季名，不由季數補成無斷、逐季畢業或禮包數。拼錯季名、反向範圍及帶額外限定／矛盾句子的標題保留待查；沒有章節的 `Two Embers` 僅可作範圍終點，不推定暮星起季。此路徑仍按原幣與市場分組，不直接換算成台幣或改寫正式估價。

Winter Feast Snowglobe（`4i2CdmSgmX`）使用「雪花水晶球」，保留「宴會雪景球／冬日宴會雪景球」與「聖誕水晶球／水晶球」搜尋。用語參考[國際服交易文案](https://m.8591.com.tw/v3/mall/detail/2399557756?style=detail)及[繁體收藏文案](https://www.carousell.com.hk/p/sky%E5%85%89%E9%81%87%E5%A4%9A%E7%A6%AE%E5%8C%85%E8%99%9F-%E5%B0%8F%E7%8E%8B%E5%AD%90%E9%83%BD%E5%85%A8%E7%A6%AE%E5%8C%85-%E7%99%BD%E6%A2%9F-%E6%9E%97%E5%85%8B-%E5%A4%A7%E7%BE%BD%E6%AF%9B-1458877656/)，核對 SkyGame-Data 1.3.10 的 ID 1893、Prop、order 5800、精確圖示及首次／返場單件 IAP；runtime 維持 SmallProp。未確認的「水晶燈球」不直接當作同義詞，不與紫水晶擺飾或雪花頭飾合併，亦不引用外站售價修改估價係數。

明寫「禮包共計80／禮包總共80」可作精確總數；「60多禮／60餘禮包／禮包60多」僅保留整數下界 61、上界未知，不再誤填精確 60。否定、約數或互相矛盾的數量仍不確定，但不排除文案其他可用欄位；數量文字不會自動補物品 GUID，也不直接當成完整衣櫃驗證。

花憩兩款付費茶具使用「櫻花茶桌」「紫藤花茶桌」，保留粉紅色／紫色花憩茶具舊名，並支援帶系列的「櫻花雙人茶桌／紫藤花三人茶桌」。名稱依既有玩家別名、[2021 櫻花茶桌介紹](https://www.9game.cn/skygy/5057027.html)及[台灣玩家紫藤花茶桌介紹](https://www.youtube.com/watch?v=hNR1z9_iIrc)，身分以 SkyGame-Data 1.3.10 的 `sTIyha_lg1`／`l6GE013zrh`、ID 1766／1771、原始 Furniture、order 3600／3800、精確圖示與首次／返場單件 IAP 核對；runtime 衣櫃分類維持 LargeProp。不引入中國服價格。裸稱「雙人茶几／三人茶桌」不自動配到花憩禮包，避免混入其他季節茶桌；禮包附帶的 35 蠟燭也不代表帳號目前資源，不能加入估價資源欄。

九色鹿畢業斗（`gLB3Tnn8mb`）與付費聯動斗（`BTogmcHcr5`）不再共用顯示／分享短名。「九色鹿斗」保留兩者候選，不再單憑泛稱加入畢業禮；明寫「九色鹿畢業斗／九色鹿終極斗篷」或「異彩蓮花斗」仍唯一辨識。依 SkyGame-Data 1.3.10 的 ID 2034／2047、Ultimate／Limited、order 9100／9500、不同圖示與聯動單件禮包 `lISB28039d` 核對；[繁體交易用語](https://www.8591.com.hk/mall/detail/51274180)亦把「九色鹿斗」放在禮包收藏中。這只修名稱與還原身分，不以該刊登價格校準模型。

「線框斗／線框斗篷」保留為 SkyFest（`meld4SQL8l`）與 TGC（`8l3QuiKC_8`）兩款的歧義搜尋詞，不作套組或自動加入任一件；「天空線框斗／五週年斗篷」與「TGC線框斗」仍各自唯一辨識。帶年份的「五週線條斗／五週年線框斗篷／5週年線框斗篷」可唯一辨識 SkyFest，不要求作者使用完整原名；縮寫只補搜尋，不取代顯示名。依既有交易文案與[台灣玩家五週年介紹](https://www.youtube.com/watch?v=4t0qGya3-90)核對。身分核對 SkyGame-Data 1.3.10 的 ID 2229／2658、Cape、order 14800／14900、不同圖示與獨立單件禮包；[官方更新說明](https://thatgamecompany.helpshift.com/hc/zh-hant/17-sky-children-of-the-light/faq/1398-patch-notes---may-29-2025---0-29-5-325756-android-huawei-ios-playstation-steam-switch/)亦分列兩款，[台灣玩家六週年介紹](https://www.dcard.tw/f/sky/p/259260519)明確指出與五週年款不同。只補名稱辨識，不變更物品身分或估價係數。

已登記的 `player-zh-names.json` 顯示名一律保留於該 GUID 的搜尋名稱，即使畫面顯示由較高優先權的收藏／人工審核名稱覆蓋。例如顯示「萌新斗篷」仍接受「飛蛾斗」，不需要另抄一份別名。這只保留既有玩家名稱，不更動顯示優先順序，也不將依賴系列語境的出售短名（如 Nintendo 下的「紅斗／藍斗」）自動加入全域搜尋；名稱撞名仍由原有歧義規則處理。

Feline Familiar（`nz4W7amLch`）使用「炸毛貓」顯示與分享短名，支援「炸毛貓貓／炸毛貓玩偶」並保留舊名「貓咪使魔」。用語取自既有繁體交易文案與[玩家對炸毛貓的描述](https://www.taptap.cn/moment/342974278062313150)，身分核對 SkyGame-Data 1.3.10 的 ID 1869、Prop、order 5600、精確圖示及 `Feline Familiar Prop` 首次／返場單件禮包；[國際服活動資料](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Mischief/2022#Feline_Familiar_Prop)確認它是可放置的黑貓道具。保留既有 SmallProp 分類，與貓咪服裝、貓咪耳尾各算獨立禮包，未改估價係數。

「貓貓套裝／貓貓禮包／貓咪套組」辨識為 2022 Cat Costume Pack 的貓咪面具（`QeNQhxg3mv`）與貓咪斗篷（`pG1_D61KMT`）。依[台灣玩家活動影片](https://www.youtube.com/watch?v=KfZvLnMvnT0)、既有交易文案及 SkyGame-Data 1.3.10 的 `OWK46yMzBT` 與返場禮包完整成員核對。套組僅作搜尋群組，單件顯示名不變；兩件共計一包，不含另售炸毛貓道具、免費貓耳髮型或 2025 貓咪耳尾組。重複出現套組名與單件名不得重複計包。

Mischief Withered Broom（`8rYQfi8VP3`）統一顯示與分享短名為「飛天掃帚」，移除舊收藏顯示名「枯萎樹枝」的覆蓋，舊名與「飛行掃帚／枯萎掃帚」仍可搜尋。依[台灣玩家 2024 惡作劇活動介紹](https://www.dcard.tw/f/sky/p/257008654)及 SkyGame-Data 1.3.10 的 ID 2394、Held、order 5800、精確圖示與首次／返場單件禮包核對；保留官方 GUID 與既有 HeldProp 衣櫃映射，不改價格係數。

Days Of Love Amethyst Accessory（`-ZIWymGtlX`）補「紫晶髮箍／紫水晶髮箍」搜尋，保留「紫水晶頭飾」顯示名。依既有交易文案、公開繁體交易搜尋中的「紫水晶髮箍」用法、[國際服活動資料](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Love/2025#Days_of_Love_Amethyst_Accessory)及 SkyGame-Data 1.3.10 的 ID 2517、HairAccessory、order 7100、精確圖示與首次／返場單件付費禮包核對。不把同活動免費紫水晶擺飾或另售挑染雙馬尾併入，也不以外幣售價修改台幣估價。

綁定宣告前的「可能／應該／大概／據說」與緊接同一宣告、獨立成詞的「不確定／待確認／待核實」不當作已確認綁定。例如「GG GC可出 待確認｜NS不出」只採 NS 不出，其他欄位與整份行情仍保留；「待確認價格／不確定售價」或下一行的價格待確認不反向否定明確綁定。這不代表已確認可拆綁或售後。

Dark Rainbow Tunic（`9ETwx3n-UZ`）補「暗彩褲／暗彩武士褲／彩虹武士褲」搜尋，保留「黑彩虹服裝」顯示名。依[玩家兩種武士褲對照](https://www.bilibili.com/video/BV1Fk4y1W7Mc/)、[暗彩稱呼](https://www.douyin.com/video/7636084206359927163)及 SkyGame-Data 1.3.10 的 ID 1813、OutfitShoes、order 3900、精確圖示與單件付費禮包核對。中國社群僅作別名參考；不引入中國服售價，亦不將長名稱中的「武士褲」另配到 Prophet of Fire Outfit（`V9HhQcek_9`），或補成預言季畢業。

Style Wide-Leg Jeans（`E7RAu04_xI`）保留「闊腿牛仔褲」顯示名，補「牛仔褲／牛仔長褲／牛仔垮褲／闊腿牛仔」搜尋。參考[台灣玩家時尚日影片](https://www.youtube.com/watch?v=jysLiC769io)、[活動整理](https://www.dcard.tw/f/sky/p/256819080)與既有交易文案，並核對 SkyGame-Data 1.3.10 的 Outfit、ID 1841、order 5800、圖示及首次／返場單件禮包；不與牛仔帽或其他褲裝合併，不改付費身分或估價係數。

愛麗絲聯動的兩件付費服飾顯示為「愛麗絲裙」「愛麗絲蝴蝶結」，保留報春花舊名搜尋；用語與成員依[台灣玩家活動介紹](https://www.dcard.tw/f/sky/p/257565037)及 SkyGame-Data 1.3.10 的 `Wonderland Primose Pinafore Set` 核對，首次／返場禮包皆為 `tSAl1nV-qo`（Outfit）與 `fLbULqwumS`（HairAccessory）兩件。「愛麗絲套裝」才作整組辨識；「愛麗絲裙裝／愛麗絲裙子」只指裙子，不自動補髮飾。兩件共計一包，不包含另售咖啡廳傳送門，保留 GUID、ID、order 及原始圖示。

「嫦娥套裝／月華套裝」對應 Moonlight Frock（`2e97D5cOuG`）與 Moonlight Updo（`oDLczC36GR`）兩件；「嫦娥髮型」只對應後者。依[台灣玩家月華節介紹](https://www.youtube.com/watch?v=WSsc3JkBz5Y)、[台灣更新日誌整理](https://forum.gamer.com.tw/C.php?bsn=33024&snA=2308)與 SkyGame-Data 1.3.10 的 `Moonlight Frock and Updo` 禮包 `0PaBo6qDUQ` 完整成員核對。套裝詞僅作群組搜尋別名，不改單件顯示名；兩件只計一個付費禮包，不包含另售月光耳環，也不以外站售價改寫台幣估價。

明確已知平台間的同行空白也可作清單分隔：「GG GC不出」按兩平台不出重播；Game Center 的名稱內空白不拆成多平台。這只採用明寫的平台，不延伸至下一行或未知縮寫。

GUID 重播會同時輸出來源的 `start_season_slug`、實算的 `reconstructed_start_season_slug` 與 `start_season_conflict`。兩者皆可確認時才比較；缺少任一方標為 `null`，不能當作一致。摘要分開統計一致、衝突與未知，另列起季一致的比較結果。衝突文案仍保留物品、價格與探索區間，但不輸出完整模型 features，也不自動以來源起季覆寫已辨識衣櫃；應先核對是否誤讀贈送數據、魔法、徽章或其他區塊，而非直接調整季節行情。

文案只明寫部分平台綁定時，逐平台保存 `binding_values` 並固定用於兩端情境；只有未知平台在無綁／不出之間變動。例如「GG可出｜NS不出」不再全部視為未知，也不假定其他平台無綁。已知平台可用頓號或逗號共用明確狀態，例如「GG、NS不出」等同「GG不出｜NS不出」；不延伸到斜線選項、不明 ID／ST 或跨行清單。同平台矛盾另列 `binding_conflicts` 並保持未知；「GG無綁」不能當作整個帳號無綁。疑問、否定與不確定語句不能確認單平台或全局綁定，例如「請問：綁全出」「GG可出嗎」「GG無綁/已綁」；正常交易標題黏連的「表演無斷綁全出」仍可辨識。部分資訊只參與探索性重播，`binding_evidence` 與完整模型 features 的完整綁定要求不變，不以「其餘無綁」或不明平台縮寫補齊七平台。

明確獨立的「贈號上數據／赠号上数据」標題後至下一個空白行，不能直接證明主要帳號持有物品；這段的唯一 GUID 另存 `separate_account_guids`，不加入主要衣櫃、綁定與資源解析。同一物品若在主要段落明確出現仍可採用。該文案保留探索性行情，但有此未釐清段落時不輸出完整模型 features；需另確認報價是否包含贈號。一般「數據」「贈送禮包」不觸發此規則，不推測是否為修改物品或魔法。

文案 GUID 重播的價格欄接受正數及純十進位數字文字（如 `"4000"`、`"4000.50"`），不再因 JSON 儲存型別不同漏掉明確金額；仍要求區間兩端有效且順序正確。共用金額轉換拒絕布林值、陣列、物件、空白、科學／十六進位記法及含單位文字，避免 JavaScript 隱式轉換製造假價格。正式稽核原有的單價型別限制不變；刊登、秒價、成交等來源性質仍分開。

Sunlight Helios Hoops（`lv_MnKorJN`）顯示與分享短名使用「太陽耳環」，保留「陽光太陽神圓環／太陽耳墜」搜尋，並支援「夏日耳環／夏日耳墜／日光耳環／陽光耳墜」及對應簡體。依[台灣玩家活動介紹](https://www.youtube.com/watch?v=w2B12NP9Bnk)、[夏日耳環圖文](https://www.dcard.tw/f/sky/p/256468904)、[BWiki 日光耳環禮包名稱](https://wiki.biligame.com/sky/礼包图鉴)與[陽光耳墜展示](https://www.bilibili.com/video/BV1Mb421J7Hp/)核對太陽造型、年份及用語；付費身分使用 SkyGame-Data 1.3.10 精確 GUID、ID 2290、HeadAccessory、order 1900 與首次／返場單件禮包，不與月華耳環、向日葵耳飾混用。跨地區文案只補名稱證據，不引入其售價或其他國服物品。

「棉花糖架／烤棉花糖架／烤棉花糖禮包」對應 Campfire Snack Kit（`TXYOTW9Qyn`），保留原顯示名與一件道具身分，不因英文 Kit 或中文套組而拆成多個物品。依[台灣玩家陽光日用語](https://www.dcard.tw/f/sky/p/256468904)、[2022 活動棉花糖架稱呼](https://www.9game.cn/skygy/7015104.html)及[國際服物品描述](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Sunlight/2022)交叉核對木架、棉花糖互動及活動來源；付費關係使用 `iap-catalog.json` 1.3.10，不使用中國服價格。

禮包數量接受前置標籤區間（如「禮包：60～80」），與「60～80禮包」同樣保存上下界，不再誤讀為精確 60 包。「60禮以上／至少60禮包／禮包最少60」保留為下界 60、上界未知，跨級距時不猜級距；「100禮以上」仍可提供 hundred 級距參考。倒序、超出有效數量、否定、近似及互相矛盾的範圍仍保持未知，但不因此丟棄整筆帳號的其他已知資訊；行情稽核與標題報告使用同一解析規則。

「月光耳墜」補作 Moonlight Earrings（`XURacs6BHP`）的搜尋別名，保留原顯示名及獨立付費禮包。名稱依[中文商店頁](https://sky-children-of-the-light.fandom.com/zh/wiki/Premium_Candle_Shop?variant=zh-tw)與[公開交易用語](https://www.8591.com.hk/mall/detail/51274180)核對，身分依 [Wiki 圖示模組](https://sky-children-of-the-light.fandom.com/wiki/Module:Days_Item/data)的 `Moonlight-Earrings-icon.png`、官方 catalog GUID 及 `iap-catalog.json` 1.3.10 交叉確認。不同別名重複出現只計一次，不與幸運節龍耳飾合併，也不採用外站售價調整台幣權重。

「錦鯉套裝」只展開為 Fortune Fish Hood（`A26TJj3cSl`）與 Fortune Fish Cape（`mzF6ZaHa1s`），兩件計一包；Fortune Fish Accessory（`OjSfpOgFoR`）依 IAP 來源保留獨立禮包，不再被舊顯示套組覆寫合併。成員及分售依[2022 活動物品頁](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune/2022)與本地 `iap-catalog.json` 交叉核對；玩家用詞參考下列同一份販售文案。保留原顯示名、GUID 與價格權重。

「福娃套裝／新春福娃套裝」只展開為 Fortune Bun Hair、Blushing Mask、Cape 三個官方 GUID，仍計一個真實禮包，不更改單件顯示名。成員依[2021 活動物品頁](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune/2021)、[台灣玩家禮包整理](https://forum.gamer.com.tw/G2.php?bsn=33024&sn=467)及[販售文案的三件成員描述](https://www.carousell.com.hk/p/sky%E5%85%89%E9%81%87%E5%A4%9A%E7%A6%AE%E5%8C%85%E8%99%9F-%E5%B0%8F%E7%8E%8B%E5%AD%90%E9%83%BD%E5%85%A8%E7%A6%AE%E5%8C%85-%E7%99%BD%E6%A2%9F-%E6%9E%97%E5%85%8B-%E5%A4%A7%E7%BE%BD%E6%AF%9B-1458877656/)交叉核對。「辦公室斗／辦公室斗篷／辦公室藍斗篷」補作付費 Founder's Cape 的搜尋別名，保留原顯示名；依[台灣玩家辦公室討論](https://www.dcard.tw/f/sky/p/235097205)與[官方 Beta／Founder 區分](https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/725-how-do-i-get-the-beta-cape/)核對，不把 Beta 白底斗或普通藍斗合併，也不採用外站價格作台幣估價。

估價數值核心先將 500 元刻度的參考中位價限制於原始價格上下限內，再計算顯示區間，避免低價／窄區間出現上下限倒置或中位價越界。一般價格權重不變；瀏覽器與驗證器共用同一修正。

Fortune Muralist's Smock（`ADJiva5H2Z`）使用玩家短名「祥雲褲」顯示與分享，保留「壁畫家褲子／福瑞壁畫家工作服」搜尋，另支援「兔尾褲／兔子棉褲」。依[2023 禮包介紹](https://www.dailiantong.com/news/content_160106.html)、[玩家交易用語](https://www.sina.cn/news/detail/5320693957789435.html)、[兔尾褲穿搭](https://game.xiaomi.com/viewpoint/1102761951_1673873215584_13)與[2023 福瑞節物品頁](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune/2023)核對兔尾、雲紋、活動年份及付費身分；同一官方圖示 `Muralist-Smock-icon-Morybel-0146.png` 與禮包 `iap:AZNU4TiFyl` 不變，不與免費白棉褲合併。「新年棉褲」目前只有販售文案用例，尚未直接綁定，不據此補 GUID。

「白色領結」作為優雅領巾（`PuFWddickP`）的搜尋別名，依[玩家同心節介紹](https://www.bilibili.com/read/mobile?id=21606745)與[2023 愛之日物品頁](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Love/2023)交叉核對：Days of Love Classy Cravat 為付費白色頸部蝴蝶結。保留原顯示名、GUID 及 IAP 身分，不與聖島季領結、大耳狗領結合併，不採預測或中國服價格。

渠道分析共用 `market-channel.mjs`：淘手遊採集列未提供 `channel` 時，讀取來源明確的 `client`（安卓官方、蘋果官方、華為、B服、OPPO、小米、vivo），同時用於季節比例與標題行情報告。既有 `channel` 優先，不從標題或其他來源的 `client` 猜配；未識別渠道仍保留 unknown，不排除整列。

私人 GUID 重播同時接受正數 `price_twd` 單一售價及完整 `price_twd_low/high` 價格區間；單價優先，統一輸出比較上下限。缺價、單邊區間或無效區間仍保留物品與帳號證據，但標為 `no-price`，不計入有價比較，也不把未知價格算成零。

GUID 重播保留已核對的 `paid_package_min/max`，輸出 `declared_paid_range` 與扣除已辨識唯一禮包後的 `unresolved_declared_paid_range`。未知上界仍為 null，僅供漏讀診斷；不補 GUID、不轉成精確包數、不據此宣告衣櫃完整或調高估價。

性格測試的 Green Folded Ears 支援「綠絨卷耳／綠絨絨卷耳髮飾」，用語參考[活動整理](https://game.xiaomi.com/viewpoint/1543958016_1769498317632_149)；2023 宴會節 Cozy Hermit Boots 支援「隱士雪人靴／雪人靴」，依[物品介紹](https://www.biubiu001.com/skygyand/83007.html)核對。保留目前顯示名、GUID、原始分類與 IAP 身分，只補搜尋別名，不採中國服價格。「綠野犬耳／雪絨圍巾」仍缺唯一身分證據，不直接補入。

「大耳狗頭飾」依[台灣玩家活動介紹](https://www.dcard.tw/f/sky/p/255375235)及[PTT 四款禮包整理](https://www.ptt.cc/bbs/Steam/M.1714730404.A.127.html)，對應獨立販售的迷你夥伴（`eWqTtgnrmt`），不是與雲朵斗篷同包的領結。移除領結上的錯誤別名，不作相容保留；領結、耳朵與迷你夥伴保持不同 GUID 與正確禮包去重。

「小狗頭飾」與「小狗拖鞋」僅作週年奧利奧頭帶／拖鞋的搜尋別名，不歸入大耳狗聯動。分別依[五週年物品介紹](https://www.9game.cn/skygy/10163405.html)及[七週年拖鞋資料](https://wiki.biligame.com/sky/小狗拖鞋礼包)核對名稱，再以 SkyGame-Data 的 `Skyfest Oreo Headband`／`Oreo Slippers`、年份、GUID 與原始分類確認身分；不引入中國服售價或新物品。模糊的「小狗娃娃」未直接對應任一玩偶。

禮包數量證據衝突只略過禮包級距，不排除整筆帳號的季節行情。精確包數必須落在已提供區間內；有效區間優先於舊的衍生級距，跨級區間保持未知。無效區間或只有上界時，不回頭以標題包數掩蓋問題；沒有區間的舊資料仍相容。

「白金絨斗／白金絨斗篷」對應 Winter Ancestor Cape（`B3YJxxJKJX`），保留「冬日先祖斗篷」顯示名。名稱參考[玩家宴會節整理](https://www.taptap.cn/moment/352804618322838086)，並以官方 catalog 的 2021 宴會節關聯及[玩家描述的白色外觀、金邊、紅內襯](https://www.reddit.com/r/SkyChildrenOfLight/comments/1cp2bqh)交叉核對；不採預測價格，不加入會與感恩季兌換斗篷混淆的泛稱「白絨斗」。雪花、雪怪與白金絨斗保持三件不同物品。

「雪怪斗篷／暖洋洋雪怪斗篷」作為付費 Cozy Hermit Cape 的搜尋別名，保留顯示名「暖心隱士斗篷」及官方 GUID `Nep9ocMylo`。身分交叉核對[多語物品對照](https://skym.iina117.com/sky-terminology-3/)與[雪怪斗篷介紹](https://news.4399.com/skygy/xzdh/dp/m/974472.html)，僅採名稱證據，不把中國服價格帶入台幣估價，也不將泛稱「雪怪」綁到單件物品。

新年道具別名：「新年紙傘／新年紅傘」對應 Fortune Enchanted Umbrella，「新年手扇／新春摺扇」對應 Fortune Hand Fan；身分與用語參考[2023 福瑞傘](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune/2023)及[台灣玩家 2025 新年活動整理](https://www.dcard.tw/f/sky/p/257849027)。保留原顯示名與官方身分，不把泛稱「紙傘／紅傘／扇子」直接綁定。123 份既有文案中，46 份共補辨識 68 次物品出現，12 份部分衣櫃估價區間改變；別名去重後每件仍只算一次，不視為完整估價驗證。

Oreo Plush（`dEWiCE1-6D`）顯示與分享改用「奧利奧玩偶」，保留「Oreo 玩偶」搜尋，補上「奧利奧娃娃／奧利奧小狗玩偶」。依[台灣商品交易用語](https://www.8591.com.hk/mall/detail/51274180)、[四週年小狗玩偶介紹](https://news.4399.com/skygy/xzdh/bs/m/982239.html)與 SkyGame-Data 1.3.10 原始 GUID、ID 1836、order 6400、圖示及單件 IAP `HYun7FYMGn` 交叉核對。上游 Prop 與網站 SmallProp 分類不變；不與大耳狗娃娃、奧利奧頭带或拖鞋合併，也不將泛稱「小狗娃娃」或實體周邊視為已持有此道具。

「彩虹耳墜」依[台灣玩家彩虹日整理](https://www.dcard.tw/f/sky/p/239253148)對應 20 愛心兌換的 Rainbow Braid（彩虹辮子），只補搜尋別名；與付費「彩虹耳釘」、暗彩虹耳環分開。既有 123 份文案中補回 38 份的此物品辨識，付費禮包計數及重播估價均不變，不能因它出現在文案禮包區就改算付費。

文案辨識支援「水漾髮型」與「貝殼頭飾」，分別對應自然日付費海浪髮型、夏日付費貝殼髮飾，不更改顯示名。身分核對參考[自然節髮型](https://sky-children-of-the-light.fandom.com/zh/wiki/自然節?variant=zh-tw)及[夏日貝殼髮飾](https://sky-children-of-the-light.fandom.com/wiki/Days_of_Summer)。以既有 123 份私人文案重播，64 份補辨識共 83 次物品出現、19 份部分衣櫃估價區間改變；不是新增帳號，也不表示通過完整估價驗證。

香港站轉售台灣商品的換算價仍不可視為原生台幣行情。2026-09-10 重查一筆早期季節刊登，依明確畢業清單將音韻起點更正為追光並移除無依據的微斷分類；該列維持外幣排除，僅更新來源摘要及各季排除統計，不改變估價係數。缺少價格但可確認季節的刊登另保留為私人待查線索，不計入價格樣本。

文案 GUID 重播與行情分析共用季節進度解析。完整比例可使用文字 `3/3` 或結構化 `{ selected: 3, expected: 3 }`，也支援 `full`，取得相同的畢業禮與重播估價；部分進度只保留證據，不依比例猜補具體物品。結構化欄位的空白、null、布林及不安全整數不轉成有效進度。

目前校準資料：2026-09-10 完成 18 筆季卡／畢業進度核對後，再完整核對 8 筆含秒價的文案。刊登價與秒價分開，不增加同帳號重複列；只有秒價的資料照樣保留。補回部分畢業與漏季，取消清單件數冒充唯一禮包數。兩批共 5 筆徽章／白卡／手機混合總價無法拆出帳號價格，保留原始紀錄但不參與校準，不因一般欄位不完整而排除。現為 446 筆來源、394 筆有效資料、351 筆探索校準、43 筆舊式保留組，Drive 有效列 109 筆。本輪音韻基準中位數 57,300 → 56,200，其餘 29 季基準中位數不變；音韻與歸屬的部分上下限／貢獻界線亦隨共享推導調整，內部 hundred 禮包乘數 1.181 → 1.189，其餘乘數不變。狀態仍為 unvalidated，測試不代替完整衣櫃估價驗證。以下為先前各批核對時的歷史統計。

2026-09-10 已逐份核對這組 31 筆起季／進度衝突原文。主要修正包含：禮包、套組與三級動作不代表季節畢業；季卡不算畢業；零進度及部分比例按原文保存；沒有唯一禮包依據的物品清單數不作精確包數。歷史重組 2/4、3/4 保留來源分母，未定義的織光³／重組¹²不猜比例。明寫無翼的三筆取消一般帳號分類，有刷退或修改物品紀錄的來源降低證據品質，但不因欄位不完整整筆刪除。原文約價與賣家斷季標籤保留其性質，不冒充成交價或獨立計算。

兩筆王子標題的正文可確認更早的重組畢業進度：一筆為 3/4，另一筆明寫重組鍋蓋頭（官方 GUID _qNmWZx0rp、ID 437、Assembly Ultimate Hair）。起點改為重組並標記 structured，後者只保留有進度，不猜比例；不沿用較晚王子起點的微斷標籤。明寫 60+／百禮的來源保留下界 60／100，不改成精確數量。

以相同私人來源重建後仍為 399 筆有效帳號、356 筆探索校準及 43 筆舊式保留組，狀態仍為 unvalidated。無斷／微斷／中斷／大斷分組為 43／62／76／112，內部 few／medium／many／hundred 禮包分組為 114／62／78／19，一般帳號分組 256。這組核對期間，預言季基準中位數由 8,200 微調為 8,100，音韻季貢獻上下限各增 100，內部 many 禮包乘數由 1.037 微調為 1.038；最後七筆重算未再改變 30 季價格數值或乘數。測試通過不代表估價準確度已通過完整驗證。

2026-09-10 再核對旋轉拍賣兩筆既有刊登：一筆附實體徽章且含修改取得物品的混合總價改為排除；另一筆保留預言部分畢業與 NT$7,000 刊登價，移除原文未確認的 25 包、大斷與一般帳號分類。這不是新增樣本；同一私人來源重新稽核後為 399 筆有效資料、356 筆探索校準、43 筆舊式保留組，狀態仍為 `unvalidated`。NT$7,000 原頁只顯示「4 年前」，先前研究也沒有確切日期，因此移除沒有依據的 2022-08-30 時戳，`published_at` 保持 `null`，相對日期留在私人來源備註。現有未知日期係數為 0.45，不使用 `observed_at` 冒充刊登時間；這比原先假定超過四年的 0.25 高，但不是近期行情的 1。重新稽核僅改變有效權重與來源摘要，30 季價格數值及各分類乘數不變。

禮包數支援「80 個禮包」「禮包：80」及繁簡／全形格式；「約 80 禮」「80 禮左右」不作精確數量，仍保留帳號的價格與季節證據。明確數字上限亦可保留：「不到 80 禮／不滿 80 禮」為 0～79，「最多 50 禮」為 0～50，「80 禮以下／以內」為 0～80。下界 0 是非負數量的可能界線，不代表已確認零禮；報告保留 range 分組，不作無禮基準或精確包數差價。「禮包：60+」「60+ 個禮包」「60～80 個禮包」保留上下界，不轉成精確數量。只有範圍完全位於同一內部級距時才參與該級距校準，例如少於 15 禮支持 few；跨級、否定、近似及多個矛盾數量只略過禮包維度，不排除整筆。

標題亦接受「音韻綁全出簡」這類季名與簡號之間插入綁定摘要的寫法，繁簡字均可。只提取明確起季與帳號型態，不推定無斷、禮包數或逐平台綁定；季卡、單件物品、多季矛盾仍保持未知。

行情標題支援「飛翔季」對應飛行、「時光季」對應拾光、「雲巢季」對應歸巢等台灣季名別稱；後兩者要求帶「季」，避免將一般文字或雲巢地圖家具誤當起季。別稱仍須有帳號起季語境，季卡與單件斗篷不代表畢業進度，也不改變網站標準季名。

「雙星季：暮星篇／双星季：暮星篇／暮星篇」的明確起季標題對應 `two-embers-part-1`；依[雙星季全名](https://sky-children-of-the-light.fandom.com/zh/wiki/雙星季：暮星篇?variant=zh-hant)及 SkyGame-Data 1.3.10 季節 `WARyR3Qtb1`（Season of The Two Embers - Part 1）核對。完整名稱後接季卡、斗篷或面具仍不推定起季，第二篇與動畫名稱不映射為此季。衣櫃搜尋另外接受「雙星季／双星季」，標準顯示仍為「暮星季」；搜尋季節不會自動選取全季物品。行情來源伺服器與 TWD／CNY 原幣保持分開。

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

標題行情的 p25／中位數／p75 採排序後 `(n - 1) × p` 位置的線性插值（type 7），偶數筆中位數為中間兩筆的平均，不再取中間偏低的一筆。單筆保留原價，少量樣本仍顯示但不提升樣本充足標記；禮包差價使用相同中位數。這是未加權的探索報告統計，與正式參考 aggregate 的證據加權分位數分開，不直接改寫網站估價。

每筆仍須有來源、市場／原幣、明確價格類型及貼文／刊登識別，以便去重；這是刊登 ID 或網址，不是物品 GUID。缺少識別的重複列不計入樣本門檻。`--out` 不覆蓋既有檔案；重跑請使用新檔名。

合格標題行情可用 `duplicate_listing_ids` 陣列保存人工核對為同帳號的其他刊登 ID；報告會在同一來源內連鎖去重，不因換刊登編號而增加樣本。此欄不能代替該列本身的識別，也不會由相似標題自動推定；無效欄位忽略，原始識別不輸出到公開報告。已排除或不合格的列仍不參與行情計算。

標題報告與季節倍率報告共用明確的 `channel` 正規化：`ios-official`、`android-official`、`huawei`、`vivo`、`oppo`、`xiaomi`、`bilibili`；支援對應的常見中文標記。缺值、未支援標記及只有「iOS」而未說明官服的資料保留在 `unknown`，不因此排除，也不從標題或登入綁定猜渠道。報告只輸出正規化渠道，不帶出原始自由文字；標題報告的同一刊登仍先去重，不會因改填渠道而多算一筆。這些診斷不改寫正式估價。

報告 schema v3 保留 `markets` 細分比較與 `season_overviews`：以同一批去重後來源，按來源、伺服器、原幣、渠道、價格類型、報價背景與起季彙總整號 p25／中位數／p75，不要求斷季、綁定與禮包欄位齊全。分位數直接使用各帳號價格，不平均細分格的中位數；`condition_counts` 顯示斷季、禮包級距、帳號型態、無翼狀態與綁定已知／未知筆數，提醒條件混合。概覽不產生零禮基準或禮包溢價，不能取代條件相近的帳號比較。

公開刊登的 `price_original` 與文案重播共用正數解析，接受 JSON 數字或純十進位數字文字（例如 `4000`、`"4000.50"`），避免因匯出型別差異漏掉明確金額。布林值、陣列、空白、科學／十六進位記法、千分位字串或含單位文字仍拒絕；不自動猜地區數字格式。此調整只影響標題行情輸入，不改正式稽核門檻、幣別分組或原價。

行情報告可接收人工核對的 `price_quote_basis`：`single_currency`（原文單一幣別報價）、`seller_multi_currency`（賣家同時列多種幣別報價）；缺值或其他值保留 `unknown`，不排除資料或由金額猜測。細分與概覽皆分開這三組，仍依帳號／刊登去重，不把同帖多幣報價當多個帳號。除了此欄外完全相同的副本可補入唯一有效標註，標註衝突保留未知，不依輸入先後決定，也不跨改價、幣別或觀察日期繼承背景。此欄只標記報告背景，不選原始幣別、不換匯、不繞過外幣換算與排除檢查，也不改正式模型資格。單一台幣報價並不證明賣家位於台灣或交易已成交。2026-09-10 透過原始 Facebook 貼文核實兩筆追光高價：其中一筆單列台幣全款及另列分期價，另一筆同時提供四種幣別；私人核對紀錄與報告輸入保存在 `work/`，不因價格高而刪除或修改報價。

細分比較仍分開來源、伺服器、原幣、刊登／成交等價格類型及已知帳號條件，再比較同起季、同斷季的禮包級距；概覽與細分每格預設至少 3 筆才標記樣本足夠，這不是信心或正式驗證通過。缺少綁定等資訊仍有混雜風險。列出的四分位價格是**整號售價**，禮包級距間的差額只是觀察值，不可拿整號價當季節裸價，再重複加入完整禮包價值。只有細分格明確零禮且樣本足夠才標記無禮參考組，少禮不是零禮。

此報告輸出 `headline-unvalidated` 診斷，不自動覆寫網站估價／正式 baseline。參考校準另由 `audit-valuation-source.mjs` 讀取有貼文識別的 `title`、`listing_title`，或 `listing_text` 第一個有效文字行；缺少結構化起季時，明確標題可補起季並使用 0.45 起季證據係數。缺少完整 GUID、綁定或資源不會阻止這條參考路徑，缺值仍保留未知；完整模型驗證規則維持不變。

禮包範圍保存為 `paid_package_min`／`paid_package_max`（上界未知為 `null`）。`60+禮` 不再寫成精確 60；只有上下界落在相同內部校準級距時才採用級距，例如百禮可支持 hundred，60～80 可支持 many，60+ 跨級則不猜。否定、近似或矛盾數量不轉成確定級距。這些內部分組不替代出售摘要的少／中／多禮門檻。

2026-09-09 在已隔離人工答案的 446 列來源中補入 115 列原文標題，核正 9 列禮包下界及 1 列更早的部分畢業進度，再以 `node scripts/audit-valuation-source.mjs --as-of=2026-09-09 work/valuation-headline-calibration-2026-09-09/calibration.jsonl` 重建參考彙總；不是新增 115 個帳號，也不是新盲測。含新增標題／禮包範圍欄位的正式證據改用 `model-evidence-v2` 簽章域，舊簽章須核對原始來源後重新簽章，不會接受未保護新增欄位的舊簽章；沒有這些欄位的 v1 簽章保持相容。目前參考來源沒有已簽章完整 predictor。私人來源及診斷產出放在忽略的 `work/` 或 `dist/tmp/`，不提交原文或帳號識別。
