# 光遇帳號估價與整理

Sky 光遇帳號整理工具，支援綁定與資源記錄、衣櫃選取、台灣刊登參考估價、備份及圖片／摘要匯出。公開網站完全在瀏覽器內整理與估價，不連接私人電腦或估價主機。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/export-step.tsx`：參考估價、帳號摘要、圖片預覽與匯出
- `app/account-summary.ts`：季節進度、禮包級距與收藏統計
- `app/account-valuation.ts`：帳號摘要與公開估價模型的轉接層
- `app/showcase-preview.tsx`：三種整理圖片版型預覽
- `app/use-export-actions.ts`：分享摘要與圖片下載動作
- `app/valuation-fresh-core.js`：版本化瀏覽器端刊登參考估價核心
- `app/valuation-fresh-data.json`：公開匿名模型參數、版本與資料日期
- `app/catalog-*.ts`：物品資料、分類、中文名稱與來源規則
- `app/bundle-presets.ts`：常用套組設定
- `app/use-account-draft.ts`：本機草稿保存與還原
- `scripts/build-evidence-blended-model.mjs`：由核對後台灣行情建立候選模型

## 本機開發

目前鎖定 Next.js 與 `eslint-config-next` 16.4.3，包含本次安全修補；升級時須同步更新 lockfile，並執行正式依賴稽核與手機 E2E。

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

## 公開網站與離線行情研究

公開網站沒有估價 API、Cloudflare Tunnel、本機 Python 服務或價格 fallback。帳號資料、衣櫃選取、草稿、備份、刊登參考估價、摘要與圖片均在瀏覽器內處理；GitHub `main` 仍由 Vercel 自動部署。

公開估價使用 `whole-account-v3.1`，輸入只有最早畢業進度季、斷季程度與可交易唯一禮包數；綁定、資源及逐件物品目前不調整價格。輸出是台灣國際服整號刊登參考中位價與中央殘差參考區間，不是成交價或統計信賴區間。沒有起季時使用全市場基準；衣櫃未確認時標記為初步推算。模型尚未通過獨立私密 holdout，畫面固定標示 `unvalidated`，不得宣稱達到 ±10% 成交準確度。

下列內容記錄歷史行情研究、模型比較與資料稽核方式。除上述明確發布的版本化核心與匿名參數外，私人資料、Python 候選、TabPFN 與其他實驗模型都不會被公開頁面載入。

2026-10-05 使用者指定目前目標為帳號「刊登價」，不是確認成交價。刊登中及已售貼文的原標價可以共同建模，但保留 `ask`／`sold_proxy` 標籤並分開報告誤差；不得改稱成交驗證。既有成交價工具只作獨立研究，不作本次刊登價發布門檻。

### 舊六季基準受限實驗（不供網站推論）

2026-10-05 使用者核准的舊「基準優先」候選：感恩 300,000、追光 150,000、音韻 85,000、魔法 35,000、聖島 15,000、預言 10,000 元。它後來曾被嚴格模型取代；目前兩者都只保留供離線重播與比較。

`fit(..., bounded_baselines=True)` 與固定／自由可調起價模式分離，禁止與 `adjust_baselines=True` 同用。`python scripts/tune-bounded-percentage-model.py work/current-information-round3.private.json work/new-bounded-directory` 只產生私人資料，不自動發布。固定相同外層五折，訓練內三折 GroupKFold 搜尋效果正則化 3／10／30 × 平滑 .1／.5／1 共九組，以內折中位百分比誤差、P90 排序；特徵選取也只看訓練折。每折及最終模型檢查六季範圍、幾何中點、季序／斷季／禮包／資源方向、未知欄位與有限正價格；保存後重載須一致。數值失敗不放寬範圍、不發布。

同組 477 筆比較，原單調／受限百分比模型整體中位誤差 36.47%／50.07%，已知起季 24.13%／31.25%，未知起季 61.03%／81.38%；±10% 命中率 18.45%／10.90%，P90 誤差 207.52%／331.75%。本次使用者明確核准即使誤差退步仍優先遵守基準，並非精度提升或達到 10% 誤差。全部仍為分組開發測試，不是獨立盲測；原分層門檻照常記錄，只有本次發布准許精度例外，方向與安全門檻不可例外。測試：`python -m unittest discover -s tests -p 'test_*.py'`。

### 舊禮包數量漸進百分比（不供網站推論）

在已學得的少／中／多／百禮對數倍率上，以 30／75／95／150 禮為 PCHIP 控制位置。控制位置只是政策設定，不冒充來源件數；曲線不重新移動六季基準，75 與 95 禮倍率的幾何中點仍為 1。每個已知起季按其基準價調整禮包彈性：高基準舊季的百分比增幅較低，低基準新季較高；同時限制所有 0–350 禮探針仍維持季節價格順序。基準剛好相同的季節必須共用倍率，否則少禮或百禮會反轉季節順序。小於 30 沿起端對數斜率延伸；大於 150 使用 `L(150) + L'(150) × 55 × log1p((n−150)/55)`，斜率非負且逐漸遞減，沒有固定金額封頂。可局部持平；百分比增幅遞減不代表每件的台幣差額必然遞減。

歷史候選以有效精確數量優先於級距，兩者不相乘；零與未知分開。這些歷史欄位只供離線重播，不會取代公開 `whole-account-v3.1`。備份格式不變。

「目錄全禮」須確認衣櫃，並逐包核對目前國際服可計價目錄的全部成員；免費／國服排除，不可轉移平台物品不算持有完整可出套組。多件同包去重，不能以總數相等或 200 禮推定全禮。目錄更新只改完整標示，不改同一數量的曲線，也不另加全禮獎勵。

私人比較指令：`python scripts/compare-progressive-packages.py work/bounded-percentage-2026-10-05/frozen.private.json work/bounded-percentage-2026-10-05/report.private.json work/new-progressive-directory`。沿用上一輪五折與訓練內選參，每折僅用訓練資料建曲線，全部 477 筆及 3 筆確切數量案例分開報告。季節別版本整體中位誤差仍為 50.07%、P90 為 331.75%；只有 3 筆確切數量案例，中位誤差 101.32%→76.41%，不足以宣稱精度改善。42,120 組季節／斷季／數量方向探針通過，保存後重載一致。191 禮倍率例：感恩 241.5%、追光 252.9%、音韻 266.1%、魔法 285.0%、預言 311.4%；感恩 191 禮約 65.2 萬而非共用曲線的 85.2 萬。高數量端缺乏實際樣本支持，仍為 unvalidated，不把合成探針計作行情。

### 公開整號參考基準與歷史重播

`valuation-fresh-core.js` 與 `valuation-fresh-data.json` 同時供公開瀏覽器推論及既有研究／稽核重播。公開網站只讀取已提交的 schema 3、`whole-account-v3.1` 匿名參數；build 指令仍只產生候選，不會自行發布或覆寫正式 artifact：

- 使用 2026-10-04 蒐集的台幣整號刊登紀錄，不沿用舊季節價格、不換算外幣、不把刊登價當成交價。原始紀錄可能沒有明確刊登日期，不以抓取日期代替。
- 每個去重帳號只算一次；跨季持有不拆分售價，也不增加樣本數。買方、競標起價、價格上限、未拆分實體商品、國服、刷物品及特殊無翼帳號排除；這版只估一般國際服帳號。
- 禮包採少／中／多／百禮標籤，不將來源級距改成假精確件數。「中少禮」等不明標籤保持未知。離線樣本依唯一真實禮包去重，0–59／60–89／90–99／100+ 對應研究級距；同級內不另加固定單件價格。公開摘要標題仍只保留少／中／多禮三類。
- 對數整號價共同擬合季節、禮包與斷季效果；季節係數向資料學到的年代趨勢收縮，預設 ridge=1 僅為正則化。私人 benchmark 另以外折訓練資料的內層分組驗證，從 `.03/.1/.3/.5/1/2` 選 ridge；不得用外折答案挑參數，亦不會自行更新網站模型。另一私人候選可將同一「季節／斷季／禮包」帳型在訓練折內的對數殘差，以固定 alpha=3 平滑後修正；未見過的帳型一律不修正，不能讀外折價格。禮包級距效果非負、斷季效果非正，不將整號行情當裸價重複加禮包。
- 缺季在對數價格上插值，首尾以學到的年代斜率延伸；不判定起季時使用起季未知帳號的整號估算（若無此類樣本才使用全體）。未知特徵採觀測特徵均值，並非假設無斷、零禮或無綁。
- 已明示不出／異常的平台禮包不納入可出數；未知綁定不阻擋估價。綁定、資源與限定沒有獨立證據時不另加減固定金額。進行中季的畢業禮可識別起季，但不補造斷季。
- 離線季節表統一以「無斷、少禮、綁定未知」比較整號，並非單季物品售價；這些參考數字不會出現在公開頁面。
- 參考區間使用擬合後對數殘差的第 25／75 百分位，取距離零較遠的一側作對稱寬度；同季寬度以 5 筆全體殘差先驗平滑，只有 0／1 筆時使用全體殘差。不能把跨年代帳號的原始價差當估價誤差，也不另加距離倍率或固定百分比上限。起季未知仍依該群體調整後整號價的離散程度計算，可能較寬。這是常見刊登偏差的參考，不是完整行情範圍、信賴區間或具 50% 覆蓋率保證的預測；不改動中心估價。方法、直接起季樣本數及版本放在「估價依據」。

先只讀檢查；確認排除／去重與全部季節輸出後，以相同指令加上 `--write` 才更新 manifest：

```powershell
node --import tsx scripts/build-evidence-blended-model.mjs `
  work/facebook-season-listings-2026-10-04.private.jsonl `
  app/valuation-fresh-data.json 2026-10-04 `
  work/facebook-whole-account-review-2026-10-04.private.json
```

私人 review 檔以 post key 保存校正、排除、重複關係與原因，並綁定原始檔 SHA-256。公開 manifest 只保存模型參數、排除統計及來源／review／資料集摘要。搜尋摘要的匿名鍵不等於已驗證的帳號身分，不能宣稱已完成真正帳號級盲測。來源檔與 review 缺少時不可從公開模型逆造。

離線單元測試包含整號價不分攤、未知欄位、去重、30 季輸出與級距單調性；`npm run test:e2e` 驗證手機三步驟、匯入匯出、分享摘要、Canvas 圖片及「不呼叫估價 API」。`npm test` 會先驗證髮型名稱快照並建置。離線技術測試通過不代表價格準確。

### 成交價準確度開發

目標為獨立測試中至少 90% 帳號的 `abs(估價 − 成交價) / 成交價 <= 10%`，不是縮窄顯示區間。蒐集目標為 500 個不同帳號、至少 100 個獨立保留案例；這些數量本身不保證達標。以下離線基準稽核不會發布模型，也不能驗證新的 TabPFN 正式路徑。

```powershell
node --import tsx scripts/audit-transaction-valuation.mjs work/transactions.private.jsonl 2026-10-04
```

預設只讀；可加 `--out work/transaction-audit.private.json` 保存私人彙總報告（不覆寫既有檔案）。JSONL 每行是經人工核對的 schema 1 紀錄，必填：

- 身分：`schemaVersion: 1`、`id`、`accountKey`、`postKey`、`sourceGroup`、HTTPS `sourceUrl`；`accountIdentityVerified: true`、`knownAnswer: false`。帳號鍵必須來自核對後的持續身分，不能用價格或會變動的衣櫃快照代替。
- 證據：`reviewed: true`、`reviewedAt`、`soldAt`（真實 YYYY-MM-DD）、`transactionConfirmed: true`、`evidence: { sha256, priceQuote, dateQuote }`。摘要對應私人保存的來源證據；原文必須明確支持最終金額與成交日期，旗標及摘要不是工具自動驗真。僅寫「已售」不合格。
- 價格：`priceKind: "sold"`、正數 `price`、`market: "taiwan"`、`server: "international"`、`currency: "TWD"`、`converted: false`、`intent: "sell"`、`accountOnly: true`、`accountStyle: "normal"`、`priceBasis: "account_excluding_fees"`；排除不能拆分的仲介費、實體商品、合售及特殊修改帳號。
- 特徵：`season` 為官方季節 slug 或 `null`；`packageTier` 為 `few/medium/many/hundred/null`；`breakClass` 為 `none/slight/medium/large/null`。不填假精確禮包件數，未查明欄位明確填 `null`。

工具拒絕超過 365 天的成交、未知日期及缺少核對的舊格式，回報排除原因，不將舊 `sold` 標籤直接轉成可信成交。同帳號／貼文／證據摘要先作傳遞關聯，再隔離 `knownAnswer` 或 `excludeFromModel`；同帳號只保留最新成交，同日金額或特徵矛盾要求重新核對。原始證據不刪除。

至少 10 筆合格資料才執行開發用時間切分：以排序後 80% 位置的日期為界，同日案例全部放後段，前段至少 5 筆且包含已知起季。只用前段成交價擬合共用整號核心，正式預設仍是 `ask`；`priceKind: "sold"` 必須明確指定，不能混合價格種類。報告包含 ±10% 命中率、中位／平均／P90 百分比誤差、20% 以上高低估、Wilson 95% 區間，以及逐季、斷季、禮包、来源分組。預測失敗算未命中，平均誤差回傳 null，不剔除困難案例美化成績。

這是 **development_only**，不是獨立盲測，也未替代完整前端驗證。工具永不自動提升 `validated` 或寫正式 manifest。目前尚未建立獨立私密驗收集，也未完成新特徵比較；需先取得合格成交證據，再依 AGENTS 的來源多樣性、身分隔離與前端重播要求驗收。已看過的資料不得重新標為未知答案，季節、限定、綁定與資源的新效果不能在缺資料時硬加。

### 分級行情比較（放寬探索納入）

使用者另核准台灣社團帳號報價「2.4直／2.2秒」這類省略單位的小數按萬元推定（24,000／22,000），必須保留原文及獨立的單位推定標記。私人批次只對明確帳號語境、台幣且帶直／秒／底等報價標記套用；外幣、服務／周邊等混合語境、明寫元及遮蔽數字不套用，保留待核對。這是候選報價解析規則，不代表成交價或自動納入正式模型。

2026-10-04 大量蒐集政策：私人價格資料池先保留所有可辨識價格，未知帳號特徵不阻擋收錄。台灣社團未標幣別可記為推定台幣；市場來源不明仍保留未知。直出與秒價都保存，優先參考秒價；外幣按原幣／市場分開，不直接換匯混入台幣模型。買方預算、季卡、服務、合售與非現金交換各自分類，疑似重貼不直接刪除。價格觀測數不是唯一帳號數，也不是正式訓練樣本數；舊資料只有選定價格欄位時需另核對原文中的多種報價，不能宣稱已完成秒價選擇。下列既有比較工具仍採自身納入規則，不會自動讀取廣泛收錄池。

`scripts/compare-graded-market.mjs` 接受私人來源設定 JSON：`{ "asOf": "YYYY-MM-DD", "sources": [{ "format": "legacy|facebook|transaction|drive", "path": "work/source.jsonl", "review": "work/review.json" }] }`。`review` 可省略，但最新 Facebook 批次須傳入原本綁定來源摘要的核對檔，不能繞過已知排除。每個 format 是單一字串值，不是整串選項。

```powershell
node --import tsx scripts/compare-graded-market.mjs work/graded-market-sources-2026-10-04.private.json
```

- 預設唯讀；確認報告後加 `--out work/graded-market-report.private.json` 才保存完整私人候選、來源摘要、排除明細及比較，不覆寫既有檔案、不更新正式 manifest。
- `transaction` 仍使用上述嚴格核對，合格者為 `sold`；`legacy` 將舊 `sold` 轉為 `sold_proxy`（已售標價），`ask`／`quick_sale` 為刊登價；人工估價不混入。只有派生的禮包件數／斷季欄位不作證據，改讀原文明確標籤；起季只有原紀錄明確標註時保留。
- 舊紀錄沒有網址可保留「原始檔 SHA-256＋post ID」作私人追溯，不捏造貼文網址。未知日期、綁定、資源及級距不阻擋探索；觀察日期或文件修改時間不填入刊登／成交日期。
- `drive` 讀取私人快照 `{ metadata, result: { content }, error }`；依文案價格區的明確 NTD 讀值，保留含仲介費標記，不做匯率換算、費用扣除或禮包數補值。多種台幣價、底價、合售與贈號保留原文但不進點價格模型；無翼、髒號、未拆分實體徽章仍排除。季節進度區有明確更早起點時優先於標題；「有卡」不當畢業起點。資料夾「交易中」不等於已售。
- 全批以帳號／貼文／核對轉貼關係及完全相同摘要交叉去重，價格不是身分。相同身分優先確認成交、其次已售標價、最後開價；同級選已知最新日期，日期相同或皆未知且金額／特徵衝突則暫不使用。已知答案與硬排除身分跨批隔離。這些替代識別不能宣稱已核實每個獨立帳號。
- 同一代掛貼文只有在人工逐行核對「一個帳號描述緊接一個明確價格」時，才可標記為多個獨立帳號；每個帳號保留不同帳號鍵，但共享原貼文鍵，交叉驗證必須將整貼文放在同一折。僅有總價、未拆分編號或圖片標價仍排除，不能藉此拆分。
- 三個價格種類各自擬合共用核心，不合併價格、不使用任意證據權重。已知日期作時間切分，未知日期以公開確定性身分雜湊作 80/20 開發切分，兩種結果分開報告，至少 10 筆才測試；不是盲測。每類均保存缺失欄位、30 季覆蓋、分層誤差與私人候選；只能說接近該類參考價格，不能將開價測試稱成交準確度。

### 跨來源開價模型實驗

大量資料擴充須先建立私人來源清單與逐筆處置紀錄，再凍結候選資料。缺少帳號特徵保留未知，不因缺欄退件；求購、服務、季卡、未拆分合售、幣別或金額單位未明者仍只留資料池。國服即使以台幣報價也須與台灣國際服行情分開。原文相同或高度相似的疑似重貼先連結分組，再切訓練／測試；同貼文多帳不能跨折。新舊資料比較必須使用相同舊案例測試集，另列新案例結果，不能用不同資料集的分數宣稱改善。候選整批測完且符合既有比較標準前，不覆寫正式來源或 manifest；中途停止的試跑不算完成結果。

起季約束亦須先離線比較：在其餘輸入相同時檢查季節順序，並分開報告已知／未知起季的誤差。季節基準及其他條件調整只能在訓練折學習；不得用全資料先算季節價格再切測試。順序合理不代表價格準確，未改善的候選不得宣稱提升精度；本次使用者明確核准百分比模型試用。未知起季不得假填成最新季節。

`scripts/listing-price-model.py` 是離線刊登價候選：以官方季序、斷季、禮包級距作有方向限制的對數價格回歸，其餘特徵由訓練折選取。相同其他輸入下，較早起季不能更低、更多斷季不能更高、更多禮包不能更低；不使用逐季比例作第二組無約束起季輸入。它不會接入公開網站。測試：`python -m unittest discover -s tests -p test_listing_price_model.py`。

可用 `python scripts/listing-price-model.py work/candidate.private.json work/new-candidate-directory` 擬合並保存私人狀態與來源／狀態 SHA-256。目錄必須全新，資料須為台灣市場台幣；輸出含訓練列，不提交 Git。保存後重載比對季節探針，僅驗證可重播，不等於行情驗收。`state.joblib` 僅載入自己產生且摘要相符的可信檔案，不接受訪客上傳。

`scripts/percentage-price-model.py` 提供另一個離線候選 `PercentagePriceModel.fit(rows, seasons)`：唯一金額項為季節起價，其餘以斷季 × 禮包 × 綁定 × 資源係數相乘，`explain(rows)` 可核對起價、四項係數與乘積。使用者於 2026-10-05 指定無斷「約中禮到多禮」為基準；實作以中禮與多禮的幾何中點為 100%。少／中／多／百禮使用級距，不補造件數，也不再逐物品累加金額。未知特徵不調整，未知起季另擬合基準，不冒充最新季；缺少證據可能學得相同級距係數。

第二輪可用 `python scripts/compare-percentage-models.py work/current-information-2026-10-05.private.json work/new-percentage-review` 產生私人凍結資料、逐列處置、五折比較、30 季起價及比例對照與候選權重；輸出目錄必須全新且位於 `work/`。只按既有身分、貼文、文字鍵與別名聯結分組，不以同價同特徵認定同帳號；原文及估價欄位全同的同身分紀錄才去重。已知人工答案／硬排除傳播至整個聯結分組，外幣、國服及非法價格分流，未知伺服器保持未知、不冒充國際服。原文沒有明示的起季、斷季與級距不補造；分組仍只是來源識別，不代表已核實獨立帳號。

`fit(..., adjust_baselines=True)` 僅供候選：每一訓練折先擬合固定起價基準，某季至少五個來源分組、兩種已知斷季／禮包組合才開放調整起價，以強度 2 的對數基準約束保留參考；不足者固定於該訓練折的基準或季序推估。不讀測試價格選特徵或判定門檻。兩模型在相同分組五折上比較，整體與已知起季中位誤差均不得退步且至少一項相對改善 5%；至少 10 筆的分層不得退步超過 5 個百分點，整體 P90 不得退步。通過仍需使用者确认發布，工具不更改服務或 manifest。測試：`python -m unittest discover -s tests -p 'test_percentage*.py'`。

2026-10-05 第二輪重核保留全部 480 筆、443 個來源分組；249 筆缺起季、378 筆缺斷季、374 筆缺禮包級距。重新凍結分組後，固定／可調起價版本的整體中位誤差為 50.9%／48.5%，已知起季均約 30.5%。候選未達相對改善門檻，且部分季節與級距退步，未替換正式模型。這是同輪開發比較，不與之前不同切分直接比較。

歷史模型重比使用 `python scripts/compare-historical-price-models.py work/source.private.json work/new-historical-review`：相同來源聯結五折比較百分比模型、原單調梯度提升及訓練折內三折選取平方／絕對損失的實驗版。損失選取不讀外層測試結果；最終全資料重訓仍使用相同內折選取流程。私人輸出含逐筆預測、分層門檻、來源與權重摘要，以及 30 季 × 4 斷季 × 4 禮包級距順序檢查。實驗模型即使指定 monotonic constraints 也必須實測；違反時標記不可用，不以較低誤差掩蓋問題。測試為 `test_listing_price_model.py`、`test_historical_price_comparison.py`；工具不修改公開網站。

2026-10-05 歷史重比使用同一批 477 筆、440 分組：百分比／原單調／實驗版的整體中位誤差為 50.4%／36.5%／34.2%，已知起季為 30.2%／24.1%／21.6%。實驗版最終重訓出現 3 組斷季順序違反，禁止採用；原單調通過全部 480 組順序檢查，但夢想季 17 筆中位誤差從 12.2% 升至 22.3%。使用者知悉後曾核准分層例外，當時服務改為原單調版本，仍標記 unvalidated。以上只保留為歷史開發比較。

後續調參參考 [scikit-learn 1.9 HistGradientBoostingRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html) 與 [nested CV](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html)：优先小範圍比較葉數、每葉最少樣本、L2、學習率及迭代數，保留原設定為基準；參數選擇只在分組訓練內折完成，外折評分不得用來直接挑參數。小資料不盲目增加樹深；若啟用 early stopping，驗證集仍須隔離同來源分組，不能直接使用會混入同帳號的隨機切分。這些是下一輪實驗方向，尚未套用至正式權重。

`python scripts/tune-listing-price-model.py work/source.private.json work/new-tuning-directory` 執行小範圍離線搜尋。固定十組：原設定、葉數 3／15、每葉樣本 5／20／30、L2 1／30，以及學習率 .03 配 250 次、.08 配 100 次；未列出的設定沿用原值。外層五折、訓練內層三折皆按來源分組；內折以中位百分比誤差選參，P90 作同分排序，不看外折答案。全部使用平方損失，不開隨機 early stopping；參數白名單不能覆蓋方向限制與亂數種子。每次擬合檢查中性與最多三個訓練特徵情境下的季序／斷季／禮包方向，內折違反者不參選，外折或最終重訓違反者禁止採用。這是有限探針檢查，不宣稱所有輸入的形式化證明。產物含逐折試驗、原始預測、最終內折選參、重載一致性與 SHA-256，全部只存私人 work/；不改服務或公開 manifest。測試：`python -m unittest discover -s tests -p 'test_listing*.py'`。

2026-10-05 第一輪十組調參沿用 477 筆、440 分組：基準／調參程序整體中位誤差 36.47%／36.41%，已知起季 24.13%／23.96%；±10% 命中率反而由 18.45% 降至 16.56%，P90 由 207.52% 升至 211.69%。最終內折選 L2=1，1,920 組探針未違反方向，但整體改善未達門檻、多禮分層退步且尾端變差，因此不採用、不發布。此為巢狀分組開發比較，不是獨立盲測；不得挑出表現好的外折或改用訓練內分數宣稱新精度。

原文人工補核可用 `python scripts/apply-market-feature-review.py work/source.private.json work/review.private.json work/new-source.private.json`，預設唯讀檢查，加 `--write` 才建立新的私人檔案。核對表須含原始檔 SHA-256 `sourceDigest` 及 `patches`；每項必須提供唯一 `postKey`、`field`、`value`、逐字原文 `quote` 與判斷 `reason`。僅可填未知且未經覆核的 `season`／`breakClass`／`packageTier`，或新增 `exclude_from_model: true`；不能改售價、覆蓋已知值或解除排除。引句存在只證明可追溯，語意仍需人工核對，不把中少禮硬分級，也不把復刻數當禮包數。來源與核對表保留私人，輸出附逐欄差異；測試為 `python -m unittest discover -s tests -p test_market_feature_review.py`。

2026-10-05 第三輪在私人副本補回 12 個明示欄位，另標記 3 筆外幣換算／港幣／帳號與實體徽章混合價格排除，未刪除原始列。使用相同 477 筆、440 個來源分組及同折，固定起價模型補核前後整體中位誤差為 51.0%／50.4%，以補核後相同已知起季分層計算為 30.7%／30.2%，未達 5% 相對改善。補核後固定／可調起價另比較為 50.4%／48.3%，仍有分層退步，不採用、不發布。兩種比較目的不同，不與不同納入列的舊輪結果直接比較。

此候選的六個使用者行情錨點是感恩 300,000、追光 150,000、音韻 85,000、魔法 35,000、聖島 15,000、預言 10,000 元。它們是社群意見的指定基準，不是新增刊登樣本；感恩採「30 萬以上」的下緣，音韻與魔法採報價區間中點。其他季節起價由刊登資料及季序單調／平滑約束推估。比例在對數空間聯合擬合、正則化，斷季不可加價、禮包與資源不可反向減價；綁定僅使用訓練資料至少五筆的狀態，未知不預設扣分。資源未知與已知零都不加值，但不寫回原始欄位。可用 `python -m unittest discover -s tests -p test_percentage_price_model.py` 驗證。

2026-10-05 的舊 480 筆分組開發比較中，百分比候選整體中位絕對百分比誤差為 49.0%，已知起季 231 筆為 29.4%。後續嚴格標題 cohort 的 44 筆刊登價比較中，固定混合候選中位絕對百分比誤差為 18.86%、±20% 命中率 54.55%、P90 64.95%。這些不是獨立盲測或成交價保證；原本的本機服務、公開 manifest 與前端契約已移除。

Excel 中的舊模型預測與條件格中位數不能再當獨立行情訓練。逐筆來源按穩定貼文識別與既有資料合併，保留工作表、列號、原價與檔案摘要；未連回原文的季節／物品「提及」不當起季／持有證據。外幣、商品種類待查與未拆分混合售價保留私人紀錄，不直接混入台幣整號目標。新檔明確選定的一般刊登價保持原值，與既有秒價選擇分開記錄，不能宣稱全資料使用同一種報價。

本機比較工具以刊登價為主要目標，已售標價另列，未取得確認成交價時不報成交準確度。TabPFN v2 與 CatBoost 只供離線比較，不得自動接回公開網站。

`benchmark-market-models.py` 另包含 `hierarchical_lookup`：在對數價格空間建立 30 季 × 斷季 × 禮包級距的部分池化對照表。各季保留自己的禮包增幅與斷季折減，但以 ridge penalty 向全市場及相鄰季節收縮；非負參數直接保證舊季不低於新季、更多禮包不降價、更多斷季不加價。`hierarchical_lookup_student_t` 以 Student-t IRLS 對資料列降權，正則化列不降權；自由度 2／4／8 與收縮強度都只在各外折的分組訓練內三折選取。這是依 [PyMC robust regression](https://www.pymc.io/projects/examples/en/latest/statistical_rethinking_lectures/07-Fitting_Over_%26_Under.html) 的厚尾 likelihood 與 [scikit-learn robust regression](https://scikit-learn.org/stable/modules/linear_model.html#huber-regression) 的小樣本離群降權原則實作的私人候選，不引入 PyMC runtime。`--models` 可限制私人候選，`--cohorts` 可只執行指定 cohort；`baseline_enriched` 會固定加入作共同基準。

```powershell
& "$env:USERPROFILE/.sky-valuation/venv/Scripts/python.exe" scripts/benchmark-market-models.py `
  work/market-benchmark-facebook-2026-10-05-r2/benchmark.private.json `
  work/new-hierarchical-benchmark.private `
  --models baseline_enriched_title_binding_blend,hierarchical_lookup,hierarchical_lookup_student_t,catboost_common,catboost_mae_common,tabpfn_v2_common `
  --cohorts ask_title_evidenced

node scripts/check-market-release-gate.mjs `
  work/formal-model-benchmark-2026-10-05-r31.private/report.json `
  work/new-hierarchical-benchmark.private/report.json hierarchical_lookup
```

2026-10-05 使用新增 Facebook 資料後的 58 筆嚴格標題 cohort 重跑相同 folds：正式公式重訓版／階層查表／CatBoost RMSE／CatBoost MAE／TabPFN v2 的中位百分比誤差分別為 23.34%／22.18%／36.81%／35.27%／21.95%；Hit@20 為 41.38%／43.10%／31.03%／36.21%／44.83%；P90 為 55.91%／52.02%／96.38%／146.71%／125.83%。這仍是分組開發比較，不是獨立盲測；相關服務發布路徑已移除。

2026-10-06 在相同 58 筆、相同 folds 測試 robust 候選：Student-t 版中位誤差 22.74%、Hit@20 46.55%、P90 50.40%，相較普通階層查表的 22.18%／43.10%／52.02% 只改善命中率與尾端；凍結舊 44 筆為 22.38%／47.73%／49.28%，未通過中位數及 Hit@20 發布門檻。另測的 L1 中位數版為 25.55%／37.93%／50.14%，普通／Student-t 幾何混合為 24.36%／43.10%／50.41%，均被淘汰且未保留程式碼。正式模型不變；下一輪應補 30 季 × 4 斷季 × 4 禮包級距的真實缺格，不能再以損失函數微調取代市場證據。

```powershell
# 先依上面的 compare-graded-market 指令產生包含原文的新版私人 report。
node --import tsx scripts/export-market-benchmark.mjs work/graded-report.json work/benchmark.json
# Windows 建議使用較短的私人 venv 路徑，避免 PyTorch 安裝超過路徑長度限制。
python -m venv "$env:TEMP/sky-model-env"
& "$env:TEMP/sky-model-env/Scripts/python.exe" -m pip install -r scripts/requirements-market-benchmark.txt
& "$env:TEMP/sky-model-env/Scripts/python.exe" scripts/benchmark-market-models.py work/benchmark.json work/benchmark-run
& "$env:TEMP/sky-model-env/Scripts/python.exe" -m unittest discover -s tests -p test_market_benchmark.py
```

Facebook CSV 完整匯出使用正式 RFC 4180 parser，不以換行或正規表示式拆 CSV。先執行唯讀檢查，再以全新 `work/` 目錄寫入私人資料；同一貼文的明確編號帳號可拆列，但無法確認邊界的多帳號貼文不硬拆。匯入器排除求購、交換、估價、服務、國服／外幣、特殊修改號、合售與競標；保留直出及秒價，建模優先秒價。台灣社團未寫幣別的獨立價格可標記推定 TWD，`3.8萬／3.8w／6.8台` 依台灣交易語境解析，遮蔽或多個無標籤價格保持不確定。派生資料不保存作者姓名、頭像或個人網址。

```powershell
npm run import:facebook-market:check -- work/source.private.csv work/facebook-import-r1
node scripts/import-facebook-market-csv.mjs work/source.private.csv work/facebook-import-r1 --write
npm run merge:facebook-market:check -- work/benchmark.private.json work/facebook-import-r1/market-rows.private.json work/benchmark-facebook-r1
node scripts/merge-facebook-market-benchmark.mjs work/benchmark.private.json work/facebook-import-r1/market-rows.private.json work/benchmark-facebook-r1 --write
npm run check:market-release-gate -- work/old-report/report.json work/new-report/report.json
```

合併時只用穩定貼文 ID 去重，不因同價同帳型刪除不同原文；既有 benchmark 的 fold 完全凍結，新賣家分組才以不可逆雜湊配置 fold。發布門檻同時要求：混合模型中位相對誤差至少改善 1 個百分點、Hit@20 不降低、P90 不惡化、原凍結 cohort 中位誤差退步不超過 3 個百分點，且不得有預測失敗。檢查指令以非零狀態表示保留目前模型，不能忽略後仍發布。

2026-10-05 的 5,000 列「光遇交易」CSV 核對中，17 個整號通過私人匯入，16 筆為刊登價；按既有貼文 ID 去重後新增 14 筆，嚴格標題 cohort 由 44 增至 58。相同舊 fold 的混合模型比較：中位相對誤差由 18.86% 升至 23.34%、Hit@20 由 54.55% 降至 41.38%，P90 由 64.95% 改善至 55.91%；原 44 筆凍結 cohort 中位誤差升至 23.57%。因此只保留私人資料與離線匯入工具。

- 輸出檔／目錄必須全新且位於 `work/`；內含原文、逐欄證據、校正、未辨識詞、逐筆預測、五折切分承諾、來源摘要、套件版本及本機權重雜湊。原始檔不覆寫。首個中止的 run 不應當作完整比較。
- Facebook 匯入器可保留多個社團的完整匯出，逐筆記錄來源社團並一律先當私有待核對資料。只有已明確核准的台灣社團可對未標幣別報價標記「推定 TWD」；其他來源仍為幣別未知，不能因為同批資料或語言相近而套用。與目前 serving manifest 的來源雜湊不一致只會記錄狀態，不能因此阻擋蒐集或暗示已進入模型。
- `work/` 同時由 Git 與 ESLint 排除，避免私人實驗套件被當網站程式檢查；Python bytecode 亦不提交。
- 分組鍵不含來源檔雜湊／價格；同帳號及可識別的同貼文內多個帳號不可跨折。一般重新匯出 benchmark 仍可能改變折分，不得直接相減；`merge-facebook-market-benchmark.mjs` 的發布比較例外地凍結既有 fold，只替新賣家分組配置 fold，使舊 cohort 可作同保留組前後比較。替代身分仍不是已核實獨立帳號。
- 只補原文明確且未被人工核對覆寫的季節／級距；中少禮、中多禮、半無斷及含糊說法保持未知。季節進度只解析明示清單，不把未列的季節補零。禮包數量不從多禮或百禮反推；限定只作唯一精確別名對應的 GUID 特徵，未提到和明示不持有分開。
- 特徵解析會略過純「#售／#多社／#代掛」等刊登標籤行，以分號前的實際標題判讀帳型，並讀取明示「畢業：」「畢業季節：」「季節進度：」的單行清單。完整名稱與實際比例才能填入進度；未列季節不補零，普通「季節：」與季卡／物品名稱不當畢業證據。起季未知時，只有清單全部可辨識且無比例衝突才由最早正進度補值，避免略過未知的早季縮寫而錯認晚季；不覆蓋人工審核，也不從此推算斷季程度。
- 明示「資源簡號／蠟燭簡號」可辨識帳型，但不補造資源數量；季節進度別名共用既有季節詞表。明示只售數據且無帳號本體者標記 `data_without_account`，保留來源但不納入整號價格訓練；普通提到「數據」不排除。
- 比較原特徵基準、補值後基準、內折調 ridge 的補值基準、訓練折內同帳型殘差平滑候選、綁定鎖定數殘差候選，以及將普通基準和綁定候選做固定 50/50 幾何混合的候選、CatBoost、ExtraTrees、Histogram Gradient Boosting、LightGBM 與 TabPFN v2 的共通／延伸特徵。每個價格類型會分成三個互不混淆的驗證 cohort：嚴格整號、起季明示、以及起季／斷季／禮包級距都明示。未知伺服器列仍保留在私人資料池，但三種 cohort 都只納入明示台灣、國際服、TWD、未換匯且為單一整號的列；沒有季節標題的資源或價格貼不會被拿來衡量「由帳型標題估價」的準確度。調 ridge 僅在每個外折的訓練資料內，透過 GroupKFold 比較 `.03/.1/.3/.5/1/2`，不得讀外折答案。同帳型殘差候選固定 alpha=3，只用該外折訓練帳號的同季／斷季／禮包中位殘差，未見過的組合不調整；綁定候選再以同一訓練折中明示「不可出」的平台數做 alpha=1 的平滑殘差校正，沒有綁定資料不假定可出或不可出。幾何混合固定採 50/50，不由外折或內折價格選權重。它們都只供私人比較，不能自動接入公開網站。CatBoost 對數價模型在每個訓練折內做三折選參（深度 3／5、L2 3／10、300 次、learning rate .04），分別比較平方損失與 MAE，以避免極端刊登價主導相對誤差；延伸欄位也只依訓練折選取（至少 5 筆非空、最多 40 個）。ExtraTrees 使用相同訓練折的序位類別編碼與中位數缺值補值，固定 400 棵、leaf 2，僅作本機對照。Histogram Gradient Boosting 以訓練折建立類別字典，未知類別保留為缺值，固定 7 個葉節點、leaf 10、L2 10 與 250 次迭代，檢查對小資料及缺漏值的穩健性。LightGBM 同樣僅在訓練折建立類別字典，未知類別留為缺值，固定 300 棵、15 個葉節點、leaf 10 與 learning rate .03。CatBoost 與 LightGBM 是可選本機依賴，未安裝時報告標記相應候選為 unavailable，仍會完成其他模型比較。TabPFN 固定 v2、CPU、seed 42，分別測試 4 與 8 estimators；不使用套件預設的新權重。
- 調參、類別編碼與延伸欄位篩選不得讀測試標籤；來源、價格原文、帳號 ID 不作估價特徵。日期未知不冒充時間外測試，所有現有資料皆標 `development_only`。另列 Facebook／Drive 留一來源測試，以及逐季、禮包、斷季、費用範圍與来源成績。
- CatBoost 固定 `one_hot_max_size=64` 處理低類別數欄位，避免小資料反覆計算目標統計的成本；所有折及候選用相同設定，不能混用試跑分數。
- 延伸特徵包含原文明示的簡號／純資源帳號類型，避免將低資源新號和收藏號只靠未知季節混合；這是文字特徵，不以售價閾值分類或刪除低價案例。所有欄位採白名單，原文價格不能混入特徵。
- 指標包含 ±10／20／30% 命中率、中位相對誤差、P90；預測失敗仍在分母，完整誤差無法計算則為 null。報告會分列「中位誤差最佳」與「±20% 命中最佳」。結果只用於離線候選比較，不會改變公開頁面。
- 模型首次使用可下載官方 v2 權重，但私人行情不傳至外部推論 API。TabPFN v2 為 Prior Labs 的 Apache 2.0 加署名權重授權；來源：[官方專案及授權說明](https://github.com/PriorLabs/TabPFN#license)、[Hollmann et al., Nature 2025](https://doi.org/10.1038/s41586-024-08328-6)。下載／執行失敗需報錯，不得偷偷改用新版本；`--skip-tabpfn` 必須明示未執行。

## 資料與隱私

- 私人 Facebook、Google Drive、帳號備份與行情原文只放在 Git 忽略的 `work/`。
- 正式提交只包含程式碼、公開特徵規格／來源摘要與離線匿名模型參數；不包含訓練列、權重、憑證或訪客輸入。
- 官方物品以 GUID、ID、分類與排序為主要識別；中文名與玩家別名不可取代官方身分。

## 發佈

唯一正式來源為 GitHub `main`。推送後由 Vercel 自動建置與部署，不使用手動正式部署。

## 開發規範

所有 Agent 修改都必須遵守 [AGENTS.md](./AGENTS.md)，並在完成前執行 Documentation Impact Check。
