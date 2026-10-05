# 光遇帳號整理

Sky 光遇帳號整理工具，支援綁定與資源記錄、衣櫃選取、估價、備份及圖片／文案匯出。

正式網站：[sky-recognition-wiki.vercel.app](https://sky-recognition-wiki.vercel.app)

## 專案結構

- `app/page.tsx`：三步驟流程協調與按需載入
- `app/account-step.tsx`：帳號資料與綁定設定
- `app/catalog-step.tsx`：衣櫃搜尋、分類與快速選取
- `app/valuation-step.tsx`：估價、預覽與匯出
- `app/valuation-analysis.ts`：估價輸入整理與前端結果組裝
- `app/api/valuation/route.ts`：網站到本機估價服務的授權轉接
- `scripts/local-valuation/`：嚴格標題混合模型、Windows 啟停與本機 API
- `app/valuation-fresh-core.js`：僅供離線實驗比較的整號基準，不供網站估價
- `app/valuation-display.ts`：畫面、分享摘要與圖片共用價格文字
- `app/valuation-tabpfn-manifest.json`：公開特徵白名單、版本、摘要與筆數，無訓練列
- `app/valuation-season-bands.ts`：遠端回應前的無價格季節結構
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

2026-10-05 使用者指定目前目標為帳號「刊登價」，不是確認成交價。刊登中及已售貼文的原標價可以共同建模，但保留 `ask`／`sold_proxy` 標籤並分開報告誤差；不得改稱成交驗證。既有成交價工具只作獨立研究，不作本次刊登價發布門檻。

網站估價程式只呼叫本機嚴格標題與綁定混合模型（`strict-title-binding-hybrid-2026-10-05`），不回退舊公式。部署必須先完成以下後端設定與驗證；本段描述程式設計，不代表目前公開站已完成發布。只顯示點估價與 `unvalidated`，不提供未校準價格區間。

### 本機後端公開試運行

- 路徑：瀏覽器 → 同站 `POST /api/valuation` → Cloudflare Quick Tunnel → Windows loopback Python 服務。臨時隧道僅適合試運行，無 SLA，重啟可能換網址；網站主機仍有自身用量限制。
- 使用私人 benchmark 中 44 筆「起季、斷季、禮包級距都明示」的台灣國際服整號刊登價，涵蓋 37 個來源分組與 16 個有樣本季節；不把季節、斷季或禮包未知的列混入。載入 Git 忽略的 `work/strict-title-binding-hybrid-2026-10-05-r5/model.private.json`；來源與產物 SHA-256 固定於程式並核對公開 manifest。模型將 ridge=1 整號基準與內層分組驗證選出 ridge=.3 的同標題條件、已明示不可轉移綁定數平滑殘差，以固定 50/50 幾何混合；最終混合價格表強制維持舊季不低於新季、斷季不可加價及禮包級距不可減價。未見過的條件不補造價格樣本；未知起季使用訓練群體基準。這是刊登價、分組開發比較，不是成交保證或獨立盲測。
- 衣櫃未確認完整時，起季、斷季、禮包總量及季節比例維持未知；已選物品可表示持有，未選不代表沒有。已确认衣櫃才可表示不持有。未填資源、未確認綁定、UI 無法區分的遺失／異常與文字式帳號類型維持未知。
- 公開 manifest 僅含特徵白名單與摘要。私人資料、權重、憑證與日誌都不提交 Git；回應含點價格、版本、各季整號參考與禮包級距倍率。各季參考採無斷、中禮、綁定未知，不是單季售價。白名單包含起季、斷季、禮包級距、確認過的 packageCount、四種平台綁定及白蠟／愛心；嚴格模型目前只以起季、斷季、禮包級距與明示綁定數調整，資源不另加值，也不按單件付費物品重複加價。
- 沒有選物品不請求；改選會取消舊請求，過期回應不能覆蓋新資料。預覽、分享與匯出共用當次結果。離線時不使用舊價格，衣櫃／備份／不含價格的圖片仍可使用。

安裝（Python 3.13，固定短路徑，勿使用暫存 venv）：

```powershell
python -m venv "$env:USERPROFILE/.sky-valuation/venv"
& "$env:USERPROFILE/.sky-valuation/venv/Scripts/python.exe" -m pip install -r scripts/local-valuation/requirements.txt
& "$env:USERPROFILE/.sky-valuation/venv/Scripts/python.exe" scripts/local-valuation/model.py
# 此命令只輸出摘要供核對；來源與凍結的私人模型必須先存在。
& "$env:USERPROFILE/.sky-valuation/venv/Scripts/python.exe" scripts/local-valuation/manage.py init
```

雙擊根目錄「啟動估價.cmd」「估價狀態.cmd」「停止估價.cmd」。服務在背景預熱，狀態 ready 後才可估價；不改開機、休眠或路由器設定。測試可執行 `manage.py start --local-only`，不建立公開隧道。啟停只管理自身程序，正式啟动需要 PATH 中已有 `cloudflared`。

Vercel 伺服器端環境變數（禁止 `NEXT_PUBLIC_`）：

- `VALUATION_BACKEND_URL`：狀態顯示的 `https://…trycloudflare.com`，不接受訪客指定網址或轉址。
- `VALUATION_BACKEND_TOKEN`：私人 `work/local-valuation/config.json` 的 token，透過安全輸入設定為敏感變數，不印出或放在命令列參數。
- 本機 dev 可由程序環境傳入相同 token 和 `http://127.0.0.1:8765`；正式模式不接受 HTTP。

網址改變後，人工更新 Vercel Production 設定，透過 GitHub main 發布流程產生新部署；啟動器不保管部署憑證、不自動推送。電腦休眠／關機／隧道中斷時顯示離線與手動重試。

安全與容量：請求上限 32KB；本機每來源每分鐘 6 次、推論 1 件＋等待最多 3 件；IP 由 Vercel 可信代理欄位取得後 HMAC，不保存原始 IP。Python deadline 43 秒、轉接 45 秒、瀏覽器 47 秒；逾時推論回收並重新預熱 worker。結果只在記憶體快取 10 分鐘、最多 128 筆，不記錄訪客輸入。這不是完整反機器人防護；公开試運行須留意匿名濫用與 Vercel 用量。

驗證：`python -m unittest discover -s tests -p test_local_valuation.py`、相關 Node 測試與 `npm run test:e2e`。模型資料不在 CI，CI 使用明示合成 API fixture 測 UI，不能當準確度驗證；本機另測真實 API、速度、離線與模型一致性。參考點價不是成交保證。

### 舊六季基準受限實驗（不供網站推論）

2026-10-05 使用者核准的舊「基準優先」候選：感恩 300,000、追光 150,000、音韻 85,000、魔法 35,000、聖島 15,000、預言 10,000 元。它已被目前網站的嚴格模型取代，保留本節只供離線重播與比較；不能與現行 44 筆嚴格 cohort 的結果混稱。

`fit(..., bounded_baselines=True)` 與固定／自由可調起價模式分離，禁止與 `adjust_baselines=True` 同用。`python scripts/tune-bounded-percentage-model.py work/current-information-round3.private.json work/new-bounded-directory` 只產生私人資料，不自動發布。固定相同外層五折，訓練內三折 GroupKFold 搜尋效果正則化 3／10／30 × 平滑 .1／.5／1 共九組，以內折中位百分比誤差、P90 排序；特徵選取也只看訓練折。每折及最終模型檢查六季範圍、幾何中點、季序／斷季／禮包／資源方向、未知欄位與有限正價格；保存後重載須一致。數值失敗不放寬範圍、不發布。

同組 477 筆比較，原單調／受限百分比模型整體中位誤差 36.47%／50.07%，已知起季 24.13%／31.25%，未知起季 61.03%／81.38%；±10% 命中率 18.45%／10.90%，P90 誤差 207.52%／331.75%。本次使用者明確核准即使誤差退步仍優先遵守基準，並非精度提升或達到 10% 誤差。全部仍為分組開發測試，不是獨立盲測；原分層門檻照常記錄，只有本次發布准許精度例外，方向與安全門檻不可例外。測試：`python -m unittest discover -s tests -p 'test_*.py'`。

### 舊禮包數量漸進百分比（不供網站推論）

在已學得的少／中／多／百禮對數倍率上，以 30／75／95／150 禮為 PCHIP 控制位置。控制位置只是政策設定，不冒充來源件數；曲線不重新移動六季基準，75 與 95 禮倍率的幾何中點仍為 1。每個已知起季按其基準價調整禮包彈性：高基準舊季的百分比增幅較低，低基準新季較高；同時限制所有 0–350 禮探針仍維持季節價格順序。基準剛好相同的季節必須共用倍率，否則少禮或百禮會反轉季節順序。小於 30 沿起端對數斜率延伸；大於 150 使用 `L(150) + L'(150) × 55 × log1p((n−150)/55)`，斜率非負且逐漸遞減，沒有固定金額封頂。可局部持平；百分比增幅遞減不代表每件的台幣差額必然遞減。

有效精確數量優先於級距，兩者不相乘。未確認衣櫃不傳總數；數量未知但級距已知沿用原級距，皆未知採中性倍率。數量須為 0–99999 整數，前後端及模型都檢查，零與未知分開。API schema 1 保留，新增可選 `packageAdjustment: {count, multiplier, basis: count|tier|unknown}`；新後端固定回傳，畫面只顯示當次回應倍率，不自行重算。備份不變。

「目錄全禮」須確認衣櫃，並逐包核對目前國際服可計價目錄的全部成員；免費／國服排除，不可轉移平台物品不算持有完整可出套組。多件同包去重，不能以總數相等或 200 禮推定全禮。目錄更新只改完整標示，不改同一數量的曲線，也不另加全禮獎勵。

私人比較指令：`python scripts/compare-progressive-packages.py work/bounded-percentage-2026-10-05/frozen.private.json work/bounded-percentage-2026-10-05/report.private.json work/new-progressive-directory`。沿用上一輪五折與訓練內選參，每折僅用訓練資料建曲線，全部 477 筆及 3 筆確切數量案例分開報告。季節別版本整體中位誤差仍為 50.07%、P90 為 331.75%；只有 3 筆確切數量案例，中位誤差 101.32%→76.41%，不足以宣稱精度改善。42,120 組季節／斷季／數量方向探針通過，保存後重載一致。191 禮倍率例：感恩 241.5%、追光 252.9%、音韻 266.1%、魔法 285.0%、預言 311.4%；感恩 191 禮約 65.2 萬而非共用曲線的 85.2 萬。高數量端缺乏實際樣本支持，仍為 unvalidated，不把合成探針計作行情。

### 歷史離線整號基準（不供網站推論）

`valuation-fresh-core.js` 與 `valuation-fresh-data.json` 保留供既有研究／稽核重播。以下 schema 3、`whole-account-v3.1` 規則與 build 指令只適用於離線基準，不會更新 TabPFN 服務：

- 使用 2026-10-04 蒐集的台幣整號刊登紀錄，不沿用舊季節價格、不換算外幣、不把刊登價當成交價。原始紀錄可能沒有明確刊登日期，不以抓取日期代替。
- 每個去重帳號只算一次；跨季持有不拆分售價，也不增加樣本數。買方、競標起價、價格上限、未拆分實體商品、國服、刷物品及特殊無翼帳號排除；這版只估一般國際服帳號。
- 禮包採少／中／多／百禮標籤，不將來源級距改成假精確件數。「中少禮」等不明標籤保持未知。網站已選物品仍依唯一真實禮包去重，0–59／60–89／90–99／100+ 對應估價級距；同級內不另加固定單件價格。分享標題仍保留少／中／多禮三類。
- 對數整號價共同擬合季節、禮包與斷季效果；季節係數向資料學到的年代趨勢收縮，預設 ridge=1 僅為正則化。私人 benchmark 另以外折訓練資料的內層分組驗證，從 `.03/.1/.3/.5/1/2` 選 ridge；不得用外折答案挑參數，亦不會自行更新網站模型。另一私人候選可將同一「季節／斷季／禮包」帳型在訓練折內的對數殘差，以固定 alpha=3 平滑後修正；未見過的帳型一律不修正，不能讀外折價格。禮包級距效果非負、斷季效果非正，不將整號行情當裸價重複加禮包。
- 缺季在對數價格上插值，首尾以學到的年代斜率延伸；不判定起季時使用起季未知帳號的整號估算（若無此類樣本才使用全體）。未知特徵採觀測特徵均值，並非假設無斷、零禮或無綁。
- 已明示不出／異常的平台禮包不納入可出數；未知綁定不阻擋估價。綁定、資源與限定沒有獨立證據時不另加減固定金額。進行中季的畢業禮可識別起季，但不補造斷季。
- 所有季節皆有參考數字；沒選物品提示先選取，模型損壞提示重新載入。估價頁、預覽、下載與分享使用同一個預測。季節表統一以「無斷、少禮、綁定未知」比較整號，並非單季物品售價。
- 參考區間使用擬合後對數殘差的第 25／75 百分位，取距離零較遠的一側作對稱寬度；同季寬度以 5 筆全體殘差先驗平滑，只有 0／1 筆時使用全體殘差。不能把跨年代帳號的原始價差當估價誤差，也不另加距離倍率或固定百分比上限。起季未知仍依該群體調整後整號價的離散程度計算，可能較寬。這是常見刊登偏差的參考，不是完整行情範圍、信賴區間或具 50% 覆蓋率保證的預測；不改動中心估價。方法、直接起季樣本數及版本放在「估價依據」。

先只讀檢查；確認排除／去重與全部季節輸出後，以相同指令加上 `--write` 才更新 manifest：

```powershell
node --import tsx scripts/build-evidence-blended-model.mjs `
  work/facebook-season-listings-2026-10-04.private.jsonl `
  app/valuation-fresh-data.json 2026-10-04 `
  work/facebook-whole-account-review-2026-10-04.private.json
```

私人 review 檔以 post key 保存校正、排除、重複關係與原因，並綁定原始檔 SHA-256。公開 manifest 只保存模型參數、排除統計及來源／review／資料集摘要。搜尋摘要的匿名鍵不等於已驗證的帳號身分，不能宣稱已完成真正帳號級盲測。來源檔與 review 缺少時不可從公開模型逆造。

單元測試包含整號價不分攤、未知欄位、去重、30 季輸出與級距單調性；`npm run test:e2e` 驗證手機估價、季節表、分享、Canvas 輸出及空選取。`npm test` 會先驗證髮型名稱快照並建置。技術測試通過不代表價格準確；只有完成獨立私密 holdout、來源多樣性、逐季與完整流程驗證後，才可提升為已驗證版本。

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

`scripts/listing-price-model.py` 是離線刊登價候選：以官方季序、斷季、禮包級距作有方向限制的對數價格回歸，其餘特徵由訓練折選取。相同其他輸入下，較早起季不能更低、更多斷季不能更高、更多禮包不能更低；不使用逐季比例作第二組無約束起季輸入。它不會自動更新正式服務。測試：`python -m unittest discover -s tests -p test_listing_price_model.py`。

可用 `python scripts/listing-price-model.py work/candidate.private.json work/new-candidate-directory` 擬合並保存私人狀態與來源／狀態 SHA-256。目錄必須全新，資料須為台灣市場台幣；輸出含訓練列，不提交 Git。保存後重載比對季節探針，僅驗證可重播，不等於行情驗收。`state.joblib` 僅載入自己產生且摘要相符的可信檔案，不接受訪客上傳。

`scripts/percentage-price-model.py` 提供另一個離線候選 `PercentagePriceModel.fit(rows, seasons)`：唯一金額項為季節起價，其餘以斷季 × 禮包 × 綁定 × 資源係數相乘，`explain(rows)` 可核對起價、四項係數與乘積。使用者於 2026-10-05 指定無斷「約中禮到多禮」為基準；實作以中禮與多禮的幾何中點為 100%。少／中／多／百禮使用級距，不補造件數，也不再逐物品累加金額。未知特徵不調整，未知起季另擬合基準，不冒充最新季；缺少證據可能學得相同級距係數。

第二輪可用 `python scripts/compare-percentage-models.py work/current-information-2026-10-05.private.json work/new-percentage-review` 產生私人凍結資料、逐列處置、五折比較、30 季起價及比例對照與候選權重；輸出目錄必須全新且位於 `work/`。只按既有身分、貼文、文字鍵與別名聯結分組，不以同價同特徵認定同帳號；原文及估價欄位全同的同身分紀錄才去重。已知人工答案／硬排除傳播至整個聯結分組，外幣、國服及非法價格分流，未知伺服器保持未知、不冒充國際服。原文沒有明示的起季、斷季與級距不補造；分組仍只是來源識別，不代表已核實獨立帳號。

`fit(..., adjust_baselines=True)` 僅供候選：每一訓練折先擬合固定起價基準，某季至少五個來源分組、兩種已知斷季／禮包組合才開放調整起價，以強度 2 的對數基準約束保留參考；不足者固定於該訓練折的基準或季序推估。不讀測試價格選特徵或判定門檻。兩模型在相同分組五折上比較，整體與已知起季中位誤差均不得退步且至少一項相對改善 5%；至少 10 筆的分層不得退步超過 5 個百分點，整體 P90 不得退步。通過仍需使用者确认發布，工具不更改服務或 manifest。測試：`python -m unittest discover -s tests -p 'test_percentage*.py'`。

2026-10-05 第二輪重核保留全部 480 筆、443 個來源分組；249 筆缺起季、378 筆缺斷季、374 筆缺禮包級距。重新凍結分組後，固定／可調起價版本的整體中位誤差為 50.9%／48.5%，已知起季均約 30.5%。候選未達相對改善門檻，且部分季節與級距退步，未替換正式模型。這是同輪開發比較，不與之前不同切分直接比較。

衣櫃未確認時仍保留金額，但估價結果及預覽標示「初步推估」，明示未採用起季、斷季與禮包，提供返回衣櫃確認入口。不自動核取確認，也不改估價請求；確認後由原有流程重新請求，離線與過期回應保護保持不變。

歷史模型重比使用 `python scripts/compare-historical-price-models.py work/source.private.json work/new-historical-review`：相同來源聯結五折比較百分比模型、原單調梯度提升及訓練折內三折選取平方／絕對損失的實驗版。損失選取不讀外層測試結果；最終全資料重訓仍使用相同內折選取流程。私人輸出含逐筆預測、分層門檻、來源與權重摘要，以及 30 季 × 4 斷季 × 4 禮包級距順序檢查。實驗模型即使指定 monotonic constraints 也必須實測；違反時標記不可用，不以較低誤差掩蓋問題。測試為 `test_listing_price_model.py`、`test_historical_price_comparison.py`；工具不修改正式服務。

2026-10-05 歷史重比使用同一批 477 筆、440 分組：百分比／原單調／實驗版的整體中位誤差為 50.4%／36.5%／34.2%，已知起季為 30.2%／24.1%／21.6%。實驗版最終重訓出現 3 組斷季順序違反，禁止採用；原單調通過全部 480 組順序檢查，但夢想季 17 筆中位誤差從 12.2% 升至 22.3%。使用者知悉後曾核准分層例外，當時服務改為原單調版本，仍標記 unvalidated；現行版本以上方六季受限規格為準。以上仍為開發比較，不宣稱盲測或全域最低誤差。

後續調參參考 [scikit-learn 1.9 HistGradientBoostingRegressor](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html) 與 [nested CV](https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html)：优先小範圍比較葉數、每葉最少樣本、L2、學習率及迭代數，保留原設定為基準；參數選擇只在分組訓練內折完成，外折評分不得用來直接挑參數。小資料不盲目增加樹深；若啟用 early stopping，驗證集仍須隔離同來源分組，不能直接使用會混入同帳號的隨機切分。這些是下一輪實驗方向，尚未套用至正式權重。

`python scripts/tune-listing-price-model.py work/source.private.json work/new-tuning-directory` 執行小範圍離線搜尋。固定十組：原設定、葉數 3／15、每葉樣本 5／20／30、L2 1／30，以及學習率 .03 配 250 次、.08 配 100 次；未列出的設定沿用原值。外層五折、訓練內層三折皆按來源分組；內折以中位百分比誤差選參，P90 作同分排序，不看外折答案。全部使用平方損失，不開隨機 early stopping；參數白名單不能覆蓋方向限制與亂數種子。每次擬合檢查中性與最多三個訓練特徵情境下的季序／斷季／禮包方向，內折違反者不參選，外折或最終重訓違反者禁止採用。這是有限探針檢查，不宣稱所有輸入的形式化證明。產物含逐折試驗、原始預測、最終內折選參、重載一致性與 SHA-256，全部只存私人 work/；不改服務或公開 manifest。測試：`python -m unittest discover -s tests -p 'test_listing*.py'`。

2026-10-05 第一輪十組調參沿用 477 筆、440 分組：基準／調參程序整體中位誤差 36.47%／36.41%，已知起季 24.13%／23.96%；±10% 命中率反而由 18.45% 降至 16.56%，P90 由 207.52% 升至 211.69%。最終內折選 L2=1，1,920 組探針未違反方向，但整體改善未達門檻、多禮分層退步且尾端變差，因此不採用、不發布。此為巢狀分組開發比較，不是獨立盲測；不得挑出表現好的外折或改用訓練內分數宣稱新精度。

原文人工補核可用 `python scripts/apply-market-feature-review.py work/source.private.json work/review.private.json work/new-source.private.json`，預設唯讀檢查，加 `--write` 才建立新的私人檔案。核對表須含原始檔 SHA-256 `sourceDigest` 及 `patches`；每項必須提供唯一 `postKey`、`field`、`value`、逐字原文 `quote` 與判斷 `reason`。僅可填未知且未經覆核的 `season`／`breakClass`／`packageTier`，或新增 `exclude_from_model: true`；不能改售價、覆蓋已知值或解除排除。引句存在只證明可追溯，語意仍需人工核對，不把中少禮硬分級，也不把復刻數當禮包數。來源與核對表保留私人，輸出附逐欄差異；測試為 `python -m unittest discover -s tests -p test_market_feature_review.py`。

2026-10-05 第三輪在私人副本補回 12 個明示欄位，另標記 3 筆外幣換算／港幣／帳號與實體徽章混合價格排除，未刪除原始列。使用相同 477 筆、440 個來源分組及同折，固定起價模型補核前後整體中位誤差為 51.0%／50.4%，以補核後相同已知起季分層計算為 30.7%／30.2%，未達 5% 相對改善。補核後固定／可調起價另比較為 50.4%／48.3%，仍有分層退步，不採用、不發布。兩種比較目的不同，不與不同納入列的舊輪結果直接比較。

此候選的六個使用者行情錨點是感恩 300,000、追光 150,000、音韻 85,000、魔法 35,000、聖島 15,000、預言 10,000 元。它們是社群意見的指定基準，不是新增刊登樣本；感恩採「30 萬以上」的下緣，音韻與魔法採報價區間中點。其他季節起價由刊登資料及季序單調／平滑約束推估。比例在對數空間聯合擬合、正則化，斷季不可加價、禮包與資源不可反向減價；綁定僅使用訓練資料至少五筆的狀態，未知不預設扣分。資源未知與已知零都不加值，但不寫回原始欄位。可用 `python -m unittest discover -s tests -p test_percentage_price_model.py` 驗證。

2026-10-05 的舊 480 筆分組開發比較中，百分比候選整體中位絕對百分比誤差為 49.0%，已知起季 231 筆為 29.4%。它是被保留的離線候選，未再作為網站服務模型。現行服務改採同日嚴格標題 cohort 的 44 筆刊登價；該 cohort 的分組開發中，固定混合候選中位絕對百分比誤差為 18.86%、±20% 命中率 54.55%、P90 64.95%。這些不是獨立盲測，也不是成交價保證。回復版本須同時還原 `scripts/local-valuation/model.py`、公開 manifest 與對應前端契約，再重啟服務／同步隧道網址並走 GitHub 發布。

Excel 中的舊模型預測與條件格中位數不能再當獨立行情訓練。逐筆來源按穩定貼文識別與既有資料合併，保留工作表、列號、原價與檔案摘要；未連回原文的季節／物品「提及」不當起季／持有證據。外幣、商品種類待查與未拆分混合售價保留私人紀錄，不直接混入台幣整號目標。新檔明確選定的一般刊登價保持原值，與既有秒價選擇分開記錄，不能宣稱全資料使用同一種報價。

本機比較工具以刊登價為主要目標，已售標價另列，未取得确认成交價時不報成交準確度。工具不自動發布；TabPFN v2 與 CatBoost 仍只供離線比較，沒有在嚴格 cohort 證明優於目前服務混合模型前不得替換正式路徑。

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

2026-10-05 的 5,000 列「光遇交易」CSV 核對中，17 個整號通過私人匯入，16 筆為刊登價；按既有貼文 ID 去重後新增 14 筆，嚴格標題 cohort 由 44 增至 58。相同舊 fold 的混合模型比較：中位相對誤差由 18.86% 升至 23.34%、Hit@20 由 54.55% 降至 41.38%，P90 由 64.95% 改善至 55.91%；原 44 筆凍結 cohort 中位誤差升至 23.57%。因此只保留新的私人資料與匯入工具，正式 `strict-title-binding-hybrid-2026-10-05` 模型、manifest 與線上 API 均未替換。這仍是分組開發比較，不是獨立盲測。

- 輸出檔／目錄必須全新且位於 `work/`；內含原文、逐欄證據、校正、未辨識詞、逐筆預測、五折切分承諾、來源摘要、套件版本及本機權重雜湊。原始檔不覆寫。首個中止的 run 不應當作完整比較。
- Facebook 匯入器可保留多個社團的完整匯出，逐筆記錄來源社團並一律先當私有待核對資料。只有已明確核准的台灣社團可對未標幣別報價標記「推定 TWD」；其他來源仍為幣別未知，不能因為同批資料或語言相近而套用。與目前 serving manifest 的來源雜湊不一致只會記錄狀態，不能因此阻擋蒐集或暗示已進入模型。
- `work/` 同時由 Git 與 ESLint 排除，避免私人實驗套件被當網站程式檢查；Python bytecode 亦不提交。
- 分組鍵不含來源檔雜湊／價格；同帳號及可識別的同貼文內多個帳號不可跨折。一般重新匯出 benchmark 仍可能改變折分，不得直接相減；`merge-facebook-market-benchmark.mjs` 的發布比較例外地凍結既有 fold，只替新賣家分組配置 fold，使舊 cohort 可作同保留組前後比較。替代身分仍不是已核實獨立帳號。
- 只補原文明確且未被人工核對覆寫的季節／級距；中少禮、中多禮、半無斷及含糊說法保持未知。季節進度只解析明示清單，不把未列的季節補零。禮包數量不從多禮或百禮反推；限定只作唯一精確別名對應的 GUID 特徵，未提到和明示不持有分開。
- 特徵解析會略過純「#售／#多社／#代掛」等刊登標籤行，以分號前的實際標題判讀帳型，並讀取明示「畢業：」「畢業季節：」「季節進度：」的單行清單。完整名稱與實際比例才能填入進度；未列季節不補零，普通「季節：」與季卡／物品名稱不當畢業證據。起季未知時，只有清單全部可辨識且無比例衝突才由最早正進度補值，避免略過未知的早季縮寫而錯認晚季；不覆蓋人工審核，也不從此推算斷季程度。
- 明示「資源簡號／蠟燭簡號」可辨識帳型，但不補造資源數量；季節進度別名共用既有季節詞表。明示只售數據且無帳號本體者標記 `data_without_account`，保留來源但不納入整號價格訓練；普通提到「數據」不排除。
- 比較原特徵基準、補值後基準、內折調 ridge 的補值基準、訓練折內同帳型殘差平滑候選、綁定鎖定數殘差候選，以及將普通基準和綁定候選做固定 50/50 幾何混合的候選、CatBoost、ExtraTrees、Histogram Gradient Boosting、LightGBM 與 TabPFN v2 的共通／延伸特徵。每個價格類型會分成三個互不混淆的驗證 cohort：嚴格整號、起季明示、以及起季／斷季／禮包級距都明示。未知伺服器列仍保留在私人資料池，但三種 cohort 都只納入明示台灣、國際服、TWD、未換匯且為單一整號的列；沒有季節標題的資源或價格貼不會被拿來衡量「由帳型標題估價」的準確度。調 ridge 僅在每個外折的訓練資料內，透過 GroupKFold 比較 `.03/.1/.3/.5/1/2`，不得讀外折答案。同帳型殘差候選固定 alpha=3，只用該外折訓練帳號的同季／斷季／禮包中位殘差，未見過的組合不調整；綁定候選再以同一訓練折中明示「不可出」的平台數做 alpha=1 的平滑殘差校正，沒有綁定資料不假定可出或不可出。幾何混合固定採 50/50，不由外折或內折價格選權重。它們都只供私人比較，不能自動接入正式服務。CatBoost 對數價模型在每個訓練折內做三折選參（深度 3／5、L2 3／10、300 次、learning rate .04），分別比較平方損失與 MAE，以避免極端刊登價主導相對誤差；延伸欄位也只依訓練折選取（至少 5 筆非空、最多 40 個）。ExtraTrees 使用相同訓練折的序位類別編碼與中位數缺值補值，固定 400 棵、leaf 2，僅作本機對照。Histogram Gradient Boosting 以訓練折建立類別字典，未知類別保留為缺值，固定 7 個葉節點、leaf 10、L2 10 與 250 次迭代，檢查對小資料及缺漏值的穩健性。LightGBM 同樣僅在訓練折建立類別字典，未知類別留為缺值，固定 300 棵、15 個葉節點、leaf 10 與 learning rate .03。CatBoost 與 LightGBM 是可選本機依賴，未安裝時報告標記相應候選為 unavailable，仍會完成其他模型比較。TabPFN 固定 v2、CPU、seed 42，分別測試 4 與 8 estimators；不使用套件預設的新權重。
- 調參、類別編碼與延伸欄位篩選不得讀測試標籤；來源、價格原文、帳號 ID 不作估價特徵。日期未知不冒充時間外測試，所有現有資料皆標 `development_only`。另列 Facebook／Drive 留一來源測試，以及逐季、禮包、斷季、費用範圍與来源成績。
- CatBoost 固定 `one_hot_max_size=64` 處理低類別數欄位，避免小資料反覆計算目標統計的成本；所有折及候選用相同設定，不能混用試跑分數。
- 延伸特徵包含原文明示的簡號／純資源帳號類型，避免將低資源新號和收藏號只靠未知季節混合；這是文字特徵，不以售價閾值分類或刪除低價案例。所有欄位採白名單，原文價格不能混入特徵。
- 指標包含 ±10／20／30% 命中率、中位相對誤差、P90；預測失敗仍在分母，完整誤差無法計算則為 null。報告會分列「中位誤差最佳」與「±20% 命中最佳」，避免 P90 門檻掩蓋使用者指定的主要目標。相對補值後基準，中位誤差至少改善 10%、±10% 命中率和 P90 不退步才建議私人候選；要列為可升級候選，還必須達中位誤差 ≤20%。兩者都不代表已達成交價誤差，沒有升級候選就保留目前服務模型。
- 模型首次使用可下載官方 v2 權重，但私人行情不傳至外部推論 API。TabPFN v2 為 Prior Labs 的 Apache 2.0 加署名權重授權；來源：[官方專案及授權說明](https://github.com/PriorLabs/TabPFN#license)、[Hollmann et al., Nature 2025](https://doi.org/10.1038/s41586-024-08328-6)。下載／執行失敗需報錯，不得偷偷改用新版本；`--skip-tabpfn` 必須明示未執行。

## 資料與隱私

- 私人 Facebook、Google Drive、帳號備份與行情原文只放在 Git 忽略的 `work/`。
- 正式提交只包含程式碼、公開特徵規格／來源摘要與離線匿名模型參數；不包含訓練列、權重、憑證或訪客輸入。
- 官方物品以 GUID、ID、分類與排序為主要識別；中文名與玩家別名不可取代官方身分。

## 發佈

唯一正式來源為 GitHub `main`。推送後由 Vercel 自動建置與部署，不使用手動正式部署。

## 開發規範

所有 Agent 修改都必須遵守 [AGENTS.md](./AGENTS.md)，並在完成前執行 Documentation Impact Check。
