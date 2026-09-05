import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCollectionHealth,
  internalRetryPageNumbers,
  convertToTwd,
  extractNumberedSeasonEvidence,
  extractSeasonMentions,
  extractSeasonGraduation,
  inspectTaoshouyouList,
  localizedPriceValue,
  markPriceOutliers,
  parseFunpay,
  parseTaifexRates,
  parseTaoshouyouDetail,
  parseTaoshouyouList,
  taoshouyouPageUrl,
} from "../scripts/collect-public-market-listings.mjs";

test("parses public Taoshouyou listing rows without seller identity", () => {
  const markdown = `[![Image](https://img.example/item.jpg)](https://www.taoshouyou.com/taoid_12345.html)\n\n安卓官方 | 全部区服 | 可购终身包赔\n\n￥1,280\n\n1天前来过`;
  assert.deepEqual(parseTaoshouyouList(markdown, 3), [{
    schema_version: 1,
    source: "taoshouyou",
    market_scope: "cn_netease",
    listing_id: "12345",
    listing_url: "https://www.taoshouyou.com/taoid_12345.html",
    source_page: 3,
    client: "安卓官方",
    source_summary: "安卓官方 | 全部区服 | 可购终身包赔",
    price_original: 1280,
    currency_original: "CNY",
    price_kind: "ask",
    account_candidate: true,
  }]);
  assert.match(taoshouyouPageUrl(3), /-3\?/);
  assert.equal(inspectTaoshouyouList(`光遇 淘手游\n${markdown}`, 3).healthy, true);
});

test("flags extreme prices without deleting the raw listing", () => {
  const withFx = (row) => ({ ...row, price_twd_fx: row.price_original * 4.5, fx_twd_per_unit: 4.5 });
  const normal = Array.from({ length: 20 }, (_, index) => withFx({ source: "market", currency_original: "CNY", price_original: 450 + index * 5, account_candidate: true }));
  const rows = markPriceOutliers([...normal, withFx({ source: "market", currency_original: "CNY", price_original: 999999, account_candidate: true })]);
  assert.equal(rows.length, 21);
  assert.equal(rows[0].ratio_candidate, true);
  assert.equal(rows.at(-1).price_outlier, true);
  assert.equal(rows.at(-1).ratio_candidate, false);
});

test("flags a zero-MAD extreme and never accepts an unsupported currency", () => {
  const repeated = Array.from({ length: 5 }, () => ({ source: "market", currency_original: "CNY", price_original: 100, price_twd_fx: 450, fx_twd_per_unit: 4.5, account_candidate: true }));
  const rows = markPriceOutliers([
    ...repeated,
    { source: "market", currency_original: "CNY", price_original: 100000, price_twd_fx: 450000, fx_twd_per_unit: 4.5, account_candidate: true },
    { source: "market", currency_original: "RUB", price_original: 1000, account_candidate: true },
  ]);
  assert.equal(rows[0].ratio_candidate, true);
  assert.equal(rows[5].price_outlier, true);
  assert.equal(rows[5].ratio_candidate, false);
  assert.deepEqual(rows[6].quality_flags, ["missing_fx", "insufficient_currency_group"]);
  assert.equal(rows[6].ratio_candidate, false);
});

test("keeps same-currency relative evidence when historical FX is unavailable", () => {
  const rows = markPriceOutliers(Array.from({ length: 5 }, (_, index) => ({
    source: "market",
    currency_original: "CNY",
    price_original: 100 + index,
    account_candidate: true,
  })));
  assert.equal(rows[0].relative_price_candidate, true);
  assert.equal(rows[0].ratio_candidate, false);
  assert.ok(rows[0].quality_flags.includes("missing_fx"));
});

test("only account rows contribute to same-currency comparable-price statistics", () => {
  const account = Array.from({ length: 4 }, (_, index) => ({
    source: "market", currency_original: "CNY", price_original: 100 + index,
    price_twd_fx: 450 + index, fx_twd_per_unit: 4.5, account_candidate: true,
  }));
  const noise = Array.from({ length: 20 }, () => ({
    source: "market", currency_original: "CNY", price_original: 999999,
    account_candidate: false,
  }));
  const rows = markPriceOutliers([...account, ...noise]);
  assert.equal(rows[0].ratio_candidate, false);
  assert.ok(rows[0].quality_flags.includes("insufficient_currency_group"));
});

test("collection health rejects tail failures and empty required sources", () => {
  const rates = [{ date: "2026-09-04", CNY: 4.5, USD: 31, EUR: 36 }];
  const accountRow = { source_page: 1 };
  const failedTail = assessCollectionHealth({
    rates,
    funpayHtml: `<a class="tc-item"></a>`,
    funpayRows: [{}],
    taoshouyouPageResults: [
      { page: 1, rows: [accountRow], status: "ok" },
      { page: 2, rows: [], status: "request_failed" },
    ],
    requestedPages: 40,
    collectedAt: "2026-09-05T00:00:00Z",
  });
  assert.equal(failedTail.snapshotComplete, false);
  assert.deepEqual(failedTail.sourceHealth.taoshouyou.request_failed_pages, [2]);

  const emptyFunpay = assessCollectionHealth({
    rates: [],
    funpayHtml: "",
    funpayRows: [],
    taoshouyouPageResults: [{ page: 1, rows: [accountRow], status: "ok" }],
    requestedPages: 1,
    collectedAt: "2026-09-05T00:00:00Z",
  });
  assert.equal(emptyFunpay.snapshotComplete, false);
  assert.equal(emptyFunpay.sourceHealth.funpay.healthy, false);
  assert.equal(emptyFunpay.sourceHealth.taifex.healthy, false);
});

test("retries only failed or empty pages inside the discovered page range", () => {
  assert.deepEqual(internalRetryPageNumbers([
    { page: 1, status: "ok" },
    { page: 2, status: "empty" },
    { page: 3, status: "request_failed" },
    { page: 4, status: "unhealthy" },
    { page: 5, status: "ok" },
    { page: 6, status: "empty" },
    { page: 7, status: "request_failed" },
  ]), [2, 3, 4]);
});

test("parses Taoshouyou detail fields and account description", () => {
  const detail = parseTaoshouyouDetail(`Title: 九季白枭_光遇_淘手游\n\n ￥520.00\n\n发布时间：\n\n2026-09-04 18:37:54\n\n蜡烛数量：\n\n1287\n\n毕业季节数量：\n\n8\n\n账号亮点：\n\n九季白枭巫师多礼包`);
  assert.deepEqual(detail, {
    title: "九季白枭",
    price_original: 520,
    published_at: "2026-09-04 18:37:54",
    white_candles: 1287,
    completed_seasons: 8,
    description: "九季白枭巫师多礼包",
  });
});

test("extracts explicit season mentions without treating signature items as seasons", () => {
  assert.deepEqual(
    extractSeasonMentions("魔法季毕业，圣岛毕，预言季 2/3", "致梵高季卡"),
    ["enchantment", "sanctuary", "prophecy", "dear-van-gogh"],
  );
  assert.deepEqual(extractSeasonMentions("阿努比斯白枭多礼包"), []);
  assert.deepEqual(extractSeasonMentions("Full Rhythm Season account"), ["rhythm"]);
  assert.deepEqual(
    extractSeasonMentions("Completed from Rhymth to Carnival. Season of Revival - Nine-Colored Deer"),
    ["rhythm", "revival", "nine-colored-deer", "carnival"],
  );
  assert.deepEqual(
    extractSeasonMentions("012 - Prophecy - Dreams - Assembly - Little Prince - Flight"),
    ["prophecy", "dreams", "assembly", "the-little-prince", "flight"],
  );
});

test("maps numbered FunPay seasons without treating counts or scheduled seasons as evidence", () => {
  assert.deepEqual(
    extractNumberedSeasonEvidence("SCOTL261 | Seasons: 6, 8, 11, 13, 14, 29, and 30. - Season of Sanctuary"),
    {
      mentions: ["sanctuary", "dreams", "flight", "performance", "shattering", "carnival", "dear-van-gogh"],
      full: [],
    },
  );
  assert.deepEqual(
    extractNumberedSeasonEvidence("END GAME - Seasons: Full Seasons 6 7 8 10 18 19 20 to 29 (30 on schedule)"),
    {
      mentions: [
        "sanctuary", "prophecy", "dreams", "the-little-prince", "moments", "revival", "nine-colored-deer",
        "nesting", "duets", "moomin", "radiance", "blue-bird", "two-embers-part-1", "migration",
        "lightmending", "carnival",
      ],
      full: [
        "sanctuary", "prophecy", "dreams", "the-little-prince", "moments", "revival", "nine-colored-deer",
        "nesting", "duets", "moomin", "radiance", "blue-bird", "two-embers-part-1", "migration",
        "lightmending", "carnival",
      ],
    },
  );
  assert.deepEqual(
    extractNumberedSeasonEvidence("Completed 23 seasons from Rhythm to Carnival. Rhythm 50%"),
    { mentions: [], full: [] },
  );
});

test("extracts only explicit graduation-list evidence and keeps partial seasons", () => {
  assert.deepEqual(
    extractSeasonGraduation("资源 100 毕业季节：集结季 半预言季 迁徙季季卡 毕业季节物品：队长面具"),
    [
      { slug: "prophecy", status: "partial" },
      { slug: "assembly", status: "full" },
    ],
  );
  assert.deepEqual(
    extractSeasonGraduation("毕业季节：魔法季半毕业 王子季 欧若拉 九色鹿 二重奏 表演季卡 毕业物品：表演季毕业礼"),
    [
      { slug: "enchantment", status: "partial" },
      { slug: "the-little-prince", status: "full" },
      { slug: "aurora", status: "full" },
      { slug: "nine-colored-deer", status: "full" },
      { slug: "duets", status: "full" },
    ],
  );
  assert.deepEqual(extractSeasonGraduation("阿努比斯，预言季物品很多"), []);
  assert.deepEqual(
    extractSeasonGraduation("毕业季节：魔法季3/3 圣岛季1/3 预言季0/3 未毕业梦想季"),
    [
      { slug: "enchantment", status: "full" },
      { slug: "sanctuary", status: "partial" },
    ],
  );
  assert.deepEqual(extractSeasonGraduation("毕业季节：魔法季3/0 圣岛季4/3"), []);
});

test("parses FunPay accounts and marks obvious services for exclusion", () => {
  const html = `<a href="/en/lots/offer?id=99" class="tc-item"><div class="tc-desc-text">Full Rhythm account</div><div class="tc-price" data-s="120"><div>120.00 <span class="unit">€</span></div></div></a><a href="/en/lots/offer?id=100" class="tc-item"><div class="tc-desc-text">Daily quest service</div><div class="tc-price"><div>5.00 <span class="unit">€</span></div></div></a>`;
  const rows = parseFunpay(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].currency_original, "EUR");
  assert.equal(rows[0].account_candidate, true);
  assert.equal(rows[1].account_candidate, false);
});

test("parses localized prices without treating decimal commas as thousands", () => {
  assert.equal(localizedPriceValue("€1,23"), 1.23);
  assert.equal(localizedPriceValue("€1 234,56"), 1234.56);
  assert.equal(localizedPriceValue("$1,234.56"), 1234.56);
});

test("keeps original price and adds date-aligned official FX conversion", () => {
  const rates = parseTaifexRates(JSON.stringify([
    { Date: "20260903", "USD/NTD": "32", "RMB/NTD": "4.5", "EUR/USD": "1.1", "USD/HKD": "7.8" },
    { Date: "20260904", "USD/NTD": "31", "RMB/NTD": "4.4", "EUR/USD": "1.2", "USD/HKD": "7.8" },
  ]));
  const converted = convertToTwd({ price_original: 100, currency_original: "CNY", published_at: "2026-09-03" }, rates, "2026-09-05");
  assert.equal(converted.price_original, 100);
  assert.equal(converted.price_twd_fx, 450);
  assert.equal(converted.fx_date, "2026-09-03");
  const tooOld = convertToTwd({ price_original: 100, currency_original: "CNY", published_at: "2018-01-01" }, rates, "2026-09-05");
  assert.equal(tooOld.price_twd_fx, undefined);
});
