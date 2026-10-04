import test from "node:test";
import assert from "node:assert/strict";
import { extractBenchmarkFeatures, fixedFolds } from "../scripts/lib/benchmark-features.mjs";
import { prepareGradedEvidence } from "../scripts/lib/graded-market-evidence.mjs";
import { isDataOnlyListing, prepareWholeAccountEvidence } from "../scripts/lib/whole-account-evidence.mjs";

const options = { seasons: ["rhythm", "enchantment"], seasonNames: { rhythm: ["音韻"], enchantment: ["魔法"] },
  resolveItem: term => term === "王子圍巾" ? { method: "exact", candidates: [{ guid: "official-1" }] } : null };
const row = summary => ({ summary, season: null, breakClass: null, packageTier: null });

test("data-only offers do not become whole-account price samples", () => {
  for(const text of ["僅國際服數據，無本體", "只有数据没有账号本体"]) assert.equal(isDataOnlyListing(text),true);
  for(const text of ["完整帳號，數據見影片", "不是無本體數據"]) assert.equal(isDataOnlyListing(text),false);
  const result=prepareWholeAccountEvidence([{postKey:"data",summary:"僅國際服數據，無本體，250台",intent:"sell",priceKind:"ask",priceTwd:250,sourceUrl:"https://www.facebook.com/groups/1/posts/2"}],{seasons:[]});
  assert.equal(result.accepted.length,0);
  assert.equal(result.rejected[0].reason,"data_without_account");
});

test("decorated candle-account labels are resource evidence independent of price", () => {
  for (const price of [200,20000]) {
    const r = extractBenchmarkFeatures(row(`#代掛 #售號\n﴾ 73 ﴿ 蠟燭簡號\n售價${price}台幣`),options);
    assert.equal(r.features.accountStyle,"resource");
    assert.equal(r.features.candles,undefined);
    assert.equal(r.season,null);
  }
  assert.notEqual(extractBenchmarkFeatures(row("不是蠟燭簡號"),options).features.accountStyle,"resource");
  assert.notEqual(extractBenchmarkFeatures(row("普通號\n其他人售蠟燭簡號"),options).features.accountStyle,"resource");
});

test("explicit graduation aliases agree with the market title vocabulary", () => {
  const r=extractBenchmarkFeatures(row("#售\n畢業：梵高2/3"),{seasons:["dear-van-gogh"],seasonNames:{"dear-van-gogh":["致梵谷"]}});
  assert.equal(r.season,"dear-van-gogh");
  assert.equal(r.features["progress:dear-van-gogh"],2/3);
});

test("posting labels do not hide the account headline", () => {
  const r = extractBenchmarkFeatures(row("#售 #代掛\n\n音韻無斷百禮號\n禮包：王子圍巾"), options);
  assert.equal(r.season, "rhythm");
  assert.equal(r.breakClass, "none");
  assert.equal(r.packageTier, "hundred");
  assert.equal(extractBenchmarkFeatures(row("#售\n便宜帳號\n音韻多禮號"), options).season, null);
  assert.equal(extractBenchmarkFeatures(row("多禮帳；含小王子三件套與斗篷"), options).season, null);
});

test("explicit graduation lines supply partial progress without inventing missing seasons", () => {
  const r = extractBenchmarkFeatures(row("#售\n畢業：音韻0｜魔法2/3"), options);
  assert.equal(r.season, "enchantment");
  assert.equal(r.features["progress:rhythm"], 0);
  assert.equal(r.features["progress:enchantment"], 2/3);
  assert.equal(r.breakClass, null);
  for (const text of ["季節：音韻、魔法", "季卡：音韻", "畢業：音韻斗篷", "畢業：音韻未畢", "畢業：音韻2/3｜音韻1/3"]) {
    assert.equal(extractBenchmarkFeatures(row(text), options).season, null);
  }
  const reviewed = extractBenchmarkFeatures({...row("畢業：音韻"),reviewedFields:["season"]},options);
  assert.equal(extractBenchmarkFeatures(row("畢業：音⅔｜魔法畢"),options).season,null);
  assert.equal(extractBenchmarkFeatures(row("畢業：音韻2/3｜音韻1/3｜魔法畢"),options).season,null);
  assert.equal(reviewed.season,null);
  assert.equal(extractBenchmarkFeatures(row("畢業：音韻"),{...options,seasonNames:{...options.seasonNames,rhythm:["音韻","音韻"]}}).season,"rhythm");
});

test("explicit account claims fill missing features without overriding reviewed values", () => {
  const r = extractBenchmarkFeatures(row("音韻無斷百禮號 10萬台幣"), options);
  assert.equal(r.season, "rhythm");
  assert.equal(r.packageTier, "hundred");
  assert.equal(r.breakClass, "none");
  assert.equal(extractBenchmarkFeatures({ ...row("音韻無斷百禮號"), season: "enchantment", breakClass: "large" }, options).breakClass, "large");
  assert.equal(extractBenchmarkFeatures(row("不是音韻起，缺王子圍巾"), options).season, null);
});

test("extended evidence preserves partial progress, absent versus unmentioned and conflicts", () => {
  const r = extractBenchmarkFeatures(row("▍音韻微斷\n♤ › 音韻⅔┊魔法⁰\n♡ GG 出｜NS 不出\n白蠟 900｜愛心 100\n◇ 缺少王子圍巾"), options);
  assert.equal(r.features["progress:rhythm"], 2 / 3);
  assert.equal(r.features["progress:enchantment"], 0);
  assert.equal(r.features["item:official-1"], "absent");
  assert.equal(r.features.candles, 900);
  assert.equal(r.features.hearts, 100);
  assert.equal(r.features["binding:GG"], "transferable");
  assert.equal(r.features["binding:NS"], "不出");
  assert.equal(r.features["binding:PSN"], undefined);
  assert.ok(Object.values(r.evidence).every(Boolean));
  const conflict = extractBenchmarkFeatures(row("◇ 王子圍巾｜不含王子圍巾｜王子圍巾"), options);
  assert.equal(conflict.features["item:official-1"], null);
});

test("no resource/count fabrication from ranges or item/price mentions", () => {
  const r = extractBenchmarkFeatures(row("音韻多禮號 白蠟900+ 愛心1萬 60+禮 3800台幣 王子圍巾"), options);
  assert.equal(r.features.candles, undefined);
  assert.equal(r.features.hearts, undefined);
  assert.equal(r.features.packageCount, undefined);
  assert.equal(r.features["item:official-1"], undefined);
  assert.ok(!Object.keys(r.features).some(k => /price|source|account|title/i.test(k)));
});

test("ambiguous tiers, half seasons and reviewed unknowns stay unknown", () => {
  for (const label of ["中少禮", "中偏少禮", "中多禮"])
    assert.equal(extractBenchmarkFeatures(row(`音韻無斷${label}號`), options).packageTier, null);
  assert.equal(extractBenchmarkFeatures(row("音韻半無斷號"), options).breakClass, null);
  assert.equal(extractBenchmarkFeatures(row("音韻半後無斷號"), options).breakClass, null);
  assert.equal(extractBenchmarkFeatures(row("魔法音韻跨季，表演不斷、夜行斷"), options).breakClass, null);
  assert.equal(extractBenchmarkFeatures({ ...row("音韻無斷多禮號"), reviewedFields: ["season"] }, options).season, null);
});

test("resource-only accounts and explicit no-package claims are evidence, not price-based labels", () => {
  const low = extractBenchmarkFeatures(row("裸資源簡號；白蠟 30、愛心 7、無禮包；開價50台幣"), options);
  const high = extractBenchmarkFeatures(row("裸資源簡號；白蠟 30、愛心 7、無禮包；開價50000台幣"), options);
  assert.equal(low.features.accountStyle, "resource");
  assert.equal(low.features.candles, 30);
  assert.equal(low.features.hearts, 7);
  assert.deepEqual(low.features, high.features);
  assert.equal(extractBenchmarkFeatures(row("普通號，沒有禮包；100台"), options).features.packageCount, 0);
});

test("fixed folds are order invariant and keep duplicate identities together", () => {
  const rows = [{ accountKey: "a" }, { accountKey: "b" }, { accountKey: "a" }];
  const folds = fixedFolds(rows);
  assert.equal(folds[0], folds[2]);
  assert.deepEqual(fixedFolds([...rows].reverse()).reverse(), folds);
  assert.equal(...fixedFolds([{ accountKey: "one", splitGroup: "post" }, { accountKey: "two", splitGroup: "post" }]));
});

test("source digest and summary edits cannot change a stable post/account group", () => {
  const raw = { postKey: "p1", accountKey: "a1", summary: "音韻無斷多禮1000台幣", intent: "sell", priceKind: "ask", priceTwd: 1000,
    sourceUrl: "https://www.facebook.com/groups/1/posts/123", seasonSlug: "rhythm" };
  const prepare = (digest, summary) => prepareGradedEvidence([{ format: "facebook", sourceDigest: digest, rows: [{ ...raw, summary }] }],
    { seasons: options.seasons, asOf: "2026-10-04" });
  assert.equal(prepare("old", raw.summary).accepted[0].accountKey, prepare("new", raw.summary + "可議").accepted[0].accountKey);
});

test("within-batch duplicate proxy is retained over ask and review exclusions propagate", () => {
  const a = { postKey: "a", accountKey: "same", summary: "音韻1000台幣", intent: "sell", priceKind: "ask", priceTwd: 1000,
    sourceUrl: "https://www.facebook.com/groups/1/posts/123", seasonSlug: "rhythm" };
  const b = { ...a, postKey: "b", priceKind: "sold_proxy" };
  const prepare = batches => prepareGradedEvidence(batches, { seasons: options.seasons, asOf: "2026-10-04" });
  assert.equal(prepare([{ format: "facebook", rows: [a, b] }]).accepted[0].priceKind, "sold_proxy");
  assert.equal(prepare([{ format: "facebook", rows: [a], review: { decisions: { a: { exclude: "mixed_goods", reason: "reviewed" } } } },
    { format: "facebook", rows: [b] }]).accepted.length, 0);
});
