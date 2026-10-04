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
- `scripts/local-valuation/`：百分比模型、Windows 啟停與本機 API
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

網站估價程式只呼叫本機百分比模型（`percentage-listing-2026-10-05`），不回退舊公式。部署必須先完成以下後端設定與驗證；本段描述程式設計，不代表目前公開站已完成發布。第一版只顯示點估價與 `unvalidated`，不提供未校準價格區間。

### 本機後端公開試運行

- 路徑：瀏覽器 → 同站 `POST /api/valuation` → Cloudflare Quick Tunnel → Windows loopback Python 服務。臨時隧道僅適合試運行，無 SLA，重啟可能換網址；網站主機仍有自身用量限制。
- 使用私人 `work/current-information-2026-10-05.private.json` 中 480 筆刊登行情（415 ask、65 sold_proxy），排除已知人工答案。載入已凍結的 `work/percentage-candidate-2026-10-05/state.joblib`，核對來源與狀態 SHA-256 及公開 manifest；不再啟動 TabPFN。`smoke.py` 重新擬合相同配方核對推論。未知維度採中性倍率，未知起季有獨立基準，不補造原始欄位。
- 衣櫃未確認完整時，起季、斷季、禮包總量及季節比例維持未知；已選物品可表示持有，未選不代表沒有。已确认衣櫃才可表示不持有。未填資源、未確認綁定、UI 無法區分的遺失／異常與文字式帳號類型維持未知。
- 公開 manifest 僅含 9 個特徵欄位與摘要。私人資料、權重、憑證與日誌都不提交 Git；回應只含點價格、版本與各季整號參考。各季統一比較無斷、中禮至多禮的幾何中點、其餘未知，不是單季售價。
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

### 離線基準比較（不供網站推論）

`valuation-fresh-core.js` 與 `valuation-fresh-data.json` 保留供既有研究／稽核重播。以下 schema 3、`whole-account-v3.1` 規則與 build 指令只適用於離線基準，不會更新 TabPFN 服務：

- 使用 2026-10-04 蒐集的台幣整號刊登紀錄，不沿用舊季節價格、不換算外幣、不把刊登價當成交價。原始紀錄可能沒有明確刊登日期，不以抓取日期代替。
- 每個去重帳號只算一次；跨季持有不拆分售價，也不增加樣本數。買方、競標起價、價格上限、未拆分實體商品、國服、刷物品及特殊無翼帳號排除；這版只估一般國際服帳號。
- 禮包採少／中／多／百禮標籤，不將來源級距改成假精確件數。「中少禮」等不明標籤保持未知。網站已選物品仍依唯一真實禮包去重，0–59／60–89／90–99／100+ 對應估價級距；同級內不另加固定單件價格。分享標題仍保留少／中／多禮三類。
- 對數整號價共同擬合季節、禮包與斷季效果；季節係數向資料學到的年代趨勢收縮，ridge=1 僅為正則化。禮包級距效果非負、斷季效果非正，不將整號行情當裸價重複加禮包。
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
- 三個價格種類各自擬合共用核心，不合併價格、不使用任意證據權重。已知日期作時間切分，未知日期以公開確定性身分雜湊作 80/20 開發切分，兩種結果分開報告，至少 10 筆才測試；不是盲測。每類均保存缺失欄位、30 季覆蓋、分層誤差與私人候選；只能說接近該類參考價格，不能將開價測試稱成交準確度。

### 跨來源開價模型實驗

大量資料擴充須先建立私人來源清單與逐筆處置紀錄，再凍結候選資料。缺少帳號特徵保留未知，不因缺欄退件；求購、服務、季卡、未拆分合售、幣別或金額單位未明者仍只留資料池。國服即使以台幣報價也須與台灣國際服行情分開。原文相同或高度相似的疑似重貼先連結分組，再切訓練／測試；同貼文多帳不能跨折。新舊資料比較必須使用相同舊案例測試集，另列新案例結果，不能用不同資料集的分數宣稱改善。候選整批測完且符合既有比較標準前，不覆寫正式來源或 manifest；中途停止的試跑不算完成結果。

起季約束亦須先離線比較：在其餘輸入相同時檢查季節順序，並分開報告已知／未知起季的誤差。季節基準及其他條件調整只能在訓練折學習；不得用全資料先算季節價格再切測試。順序合理不代表價格準確，未改善的候選不得宣稱提升精度；本次使用者明確核准百分比模型試用。未知起季不得假填成最新季節。

`scripts/listing-price-model.py` 是離線刊登價候選：以官方季序、斷季、禮包級距作有方向限制的對數價格回歸，其餘特徵由訓練折選取。相同其他輸入下，較早起季不能更低、更多斷季不能更高、更多禮包不能更低；不使用逐季比例作第二組無約束起季輸入。它不會自動更新正式服務。測試：`python -m unittest discover -s tests -p test_listing_price_model.py`。

可用 `python scripts/listing-price-model.py work/candidate.private.json work/new-candidate-directory` 擬合並保存私人狀態與來源／狀態 SHA-256。目錄必須全新，資料須為台灣市場台幣；輸出含訓練列，不提交 Git。保存後重載比對季節探針，僅驗證可重播，不等於行情驗收。`state.joblib` 僅載入自己產生且摘要相符的可信檔案，不接受訪客上傳。

`scripts/percentage-price-model.py` 提供另一個離線候選 `PercentagePriceModel.fit(rows, seasons)`：唯一金額項為季節起價，其餘以斷季 × 禮包 × 綁定 × 資源係數相乘，`explain(rows)` 可核對起價、四項係數與乘積。使用者於 2026-10-05 指定無斷「約中禮到多禮」為基準；實作以中禮與多禮的幾何中點為 100%。少／中／多／百禮使用級距，不補造件數，也不再逐物品累加金額。未知特徵不調整，未知起季另擬合基準，不冒充最新季；缺少證據可能學得相同級距係數。

此候選的六個使用者行情錨點是感恩 300,000、追光 150,000、音韻 85,000、魔法 35,000、聖島 15,000、預言 10,000 元。它們是社群意見的指定基準，不是新增刊登樣本；感恩採「30 萬以上」的下緣，音韻與魔法採報價區間中點。其他季節起價由刊登資料及季序單調／平滑約束推估。比例在對數空間聯合擬合、正則化，斷季不可加價、禮包與資源不可反向減價；綁定僅使用訓練資料至少五筆的狀態，未知不預設扣分。資源未知與已知零都不加值，但不寫回原始欄位。可用 `python -m unittest discover -s tests -p test_percentage_price_model.py` 驗證。

2026-10-05 的 480 筆分組開發比較中，百分比候選整體中位絕對百分比誤差為 49.0%，已知起季 231 筆為 29.4%，比上一個單調候選的 35.6%／25.3% 差。此結果不是獨立盲測，不表示固定社群起價已通過刊登價驗證。使用者知悉比較結果後於 2026-10-05 核准接入網站試用，仍標記 unvalidated。回復上一版須同時還原 `scripts/local-valuation/model.py`、公開 manifest 與對應前端契約，再重啟服務／同步隧道網址並走 GitHub 發布；原始 TabPFN 資料及權重仍保留於私人 work/。

Excel 中的舊模型預測與條件格中位數不能再當獨立行情訓練。逐筆來源按穩定貼文識別與既有資料合併，保留工作表、列號、原價與檔案摘要；未連回原文的季節／物品「提及」不當起季／持有證據。外幣、商品種類待查與未拆分混合售價保留私人紀錄，不直接混入台幣整號目標。新檔明確選定的一般刊登價保持原值，與既有秒價選擇分開記錄，不能宣稱全資料使用同一種報價。

本機比較工具以刊登價為主要目標，已售標價另列，未取得确认成交價時不報成交準確度。工具不自動發布；2026-10-04 使用者另核准將 TabPFN v2 延伸版接為本機後端，部署方式見上節。CatBoost 仍僅供實驗。

```powershell
# 先依上面的 compare-graded-market 指令產生包含原文的新版私人 report。
node --import tsx scripts/export-market-benchmark.mjs work/graded-report.json work/benchmark.json
# Windows 建議使用較短的私人 venv 路徑，避免 PyTorch 安裝超過路徑長度限制。
python -m venv "$env:TEMP/sky-model-env"
& "$env:TEMP/sky-model-env/Scripts/python.exe" -m pip install -r scripts/requirements-market-benchmark.txt
& "$env:TEMP/sky-model-env/Scripts/python.exe" scripts/benchmark-market-models.py work/benchmark.json work/benchmark-run
& "$env:TEMP/sky-model-env/Scripts/python.exe" -m unittest discover -s tests -p test_market_benchmark.py
```

- 輸出檔／目錄必須全新且位於 `work/`；內含原文、逐欄證據、校正、未辨識詞、逐筆預測、五折切分承諾、來源摘要、套件版本及本機權重雜湊。原始檔不覆寫。首個中止的 run 不應當作完整比較。
- `work/` 同時由 Git 與 ESLint 排除，避免私人實驗套件被當網站程式檢查；Python bytecode 亦不提交。
- 分組鍵不含來源檔雜湊／價格；同帳號及可識別的同貼文內多個帳號不可跨折。固定輸入的五折可重現；新增帳號可能改變折分，應凍結整份 benchmark JSON 比較，不將舊新分數直接相減。替代身分仍不是已核實獨立帳號。
- 只補原文明確且未被人工核對覆寫的季節／級距；中少禮、中多禮、半無斷及含糊說法保持未知。季節進度只解析明示清單，不把未列的季節補零。禮包數量不從多禮或百禮反推；限定只作唯一精確別名對應的 GUID 特徵，未提到和明示不持有分開。
- 特徵解析會略過純「#售／#代掛」行，以分號前的標題判讀帳型，並讀取明示「畢業：」「畢業季節：」「季節進度：」的單行清單。完整名稱與實際比例才能填入進度；未列季節不補零，普通「季節：」與季卡／物品名稱不當畢業證據。起季未知時，只有清單全部可辨識且無比例衝突才由最早正進度補值，避免略過未知的早季縮寫而錯認晚季；不覆蓋人工審核，也不從此推算斷季程度。
- 明示「資源簡號／蠟燭簡號」可辨識帳型，但不補造資源數量；季節進度別名共用既有季節詞表。明示只售數據且無帳號本體者標記 `data_without_account`，保留來源但不納入整號價格訓練；普通提到「數據」不排除。
- 比較原特徵基準、補值後基準、CatBoost 共通／延伸特徵、TabPFN v2 共通／延伸特徵。CatBoost 對數價模型在每個訓練折內做三折選參（深度 3／5、L2 3／10、300 次、learning rate .04）；延伸欄位也只依訓練折選取（至少 5 筆非空、最多 40 個）。TabPFN 固定 v2、CPU、4 estimators、seed 42，不使用套件預設的新權重。
- 調參、類別編碼與延伸欄位篩選不得讀測試標籤；來源、價格原文、帳號 ID 不作估價特徵。日期未知不冒充時間外測試，所有現有資料皆標 `development_only`。另列 Facebook／Drive 留一來源測試，以及逐季、禮包、斷季、費用範圍與来源成績。
- CatBoost 固定 `one_hot_max_size=64` 處理低類別數欄位，避免小資料反覆計算目標統計的成本；所有折及候選用相同設定，不能混用試跑分數。
- 延伸特徵包含原文明示的簡號／純資源帳號類型，避免將低資源新號和收藏號只靠未知季節混合；這是文字特徵，不以售價閾值分類或刪除低價案例。所有欄位採白名單，原文價格不能混入特徵。
- 指標包含 ±10／20／30% 命中率、中位相對誤差、P90；預測失敗仍在分母，完整誤差無法計算則為 null。相對補值後基準，中位誤差至少改善 10%、±10% 命中率和 P90 不退步才建議私人候選，不代表已達成交誤差 10%。沒有合格候選就保留基準。
- 模型首次使用可下載官方 v2 權重，但私人行情不傳至外部推論 API。TabPFN v2 為 Prior Labs 的 Apache 2.0 加署名權重授權；來源：[官方專案及授權說明](https://github.com/PriorLabs/TabPFN#license)、[Hollmann et al., Nature 2025](https://doi.org/10.1038/s41586-024-08328-6)。下載／執行失敗需報錯，不得偷偷改用新版本；`--skip-tabpfn` 必須明示未執行。

## 資料與隱私

- 私人 Facebook、Google Drive、帳號備份與行情原文只放在 Git 忽略的 `work/`。
- 正式提交只包含程式碼、公開特徵規格／來源摘要與離線匿名模型參數；不包含訓練列、權重、憑證或訪客輸入。
- 官方物品以 GUID、ID、分類與排序為主要識別；中文名與玩家別名不可取代官方身分。

## 發佈

唯一正式來源為 GitHub `main`。推送後由 Vercel 自動建置與部署，不使用手動正式部署。

## 開發規範

所有 Agent 修改都必須遵守 [AGENTS.md](./AGENTS.md)，並在完成前執行 Documentation Impact Check。
