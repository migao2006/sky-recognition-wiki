import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildMarketHeadlineReport } from "../scripts/analyze-market-headlines.mjs";

const exec = promisify(execFile);

const listing = (overrides = {}) => ({ title: "緬懷起 無斷 禮包0 簡號", price_original: 1000, currency_original: "TWD", market_scope: "tw", listing_id: crypto.randomUUID(), price_kind: "ask", account_candidate: true, price_outlier: false, source: "market", ...overrides });

test("public headline prices accept decimal text without admitting coercions or merging currencies", () => {
  const first = listing({ price_original: 4000 });
  const report = buildMarketHeadlineReport([first, { ...first, price_original: "4000" },
    listing({ price_original: " 4000.50 " }),
    listing({ price_original: "9000", currency_original: "CNY", market_scope: "cn" })]);
  assert.equal(report.eligible_rows, 3);
  assert.equal(report.markets.length, 2);
  const twd = report.season_overviews.find(g => g.currency === "TWD");
  assert.equal(twd.sample_count, 2);
  assert.equal(twd.median, 4000.25);
  assert.equal(report.season_overviews.find(g => g.currency === "CNY").median, 9000);
  for (const price_original of [true, false, [], [4000], {}, null, "", " ", "4k", "4,000", "0x100", "4e3", "4000元", "-1", "0", Infinity, NaN]) {
    const rejected = buildMarketHeadlineReport([listing({ price_original })]);
    assert.equal(rejected.eligible_rows, 0, String(price_original));
    assert.equal(rejected.diagnostics.price_or_market_unknown, 1);
  }
});

test("season overview pools deduplicated raw prices while preserving condition coverage", () => {
  const first = listing({ price_original: 1000, binding_class: "transferable", wingless: false });
  const report = buildMarketHeadlineReport([
    first, { ...first },
    listing({ title: "緬懷起微斷20禮普號", price_original: 4000, wingless: true }),
    listing({ title: "緬懷起", price_original: 9000 }),
    listing({ title: "緬懷起30禮普號", price_original: 6000 }),
  ]);
  assert.equal(report.schema_version, 3);
  assert.equal(report.eligible_rows, 4);
  assert.equal(report.season_overviews.length, 1);
  const group = report.season_overviews[0];
  assert.deepEqual([group.sample_count, group.p25, group.median, group.p75], [4, 3250, 5000, 6750]);
  assert.equal(group.sufficient_samples, true);
  assert.equal(group.scope, "mixed-condition-total-account-price");
  assert.deepEqual(group.condition_counts, {
    break_class: { none: 1, slight: 1, unknown: 2 },
    package_tier: { "0": 1, "20-29": 1, "30-39": 1, unknown: 1 },
    account_style: { simple: 1, regular: 2, unknown: 1 },
    wingless: { no: 1, yes: 1, unknown: 2 },
    binding: { known: 1, unknown: 3 },
  });
  assert.ok(report.markets.every(m => m.sample_count < 3));
  assert.equal(report.status, "headline-unvalidated");
  assert.equal(Object.hasOwn(group, "no_package_baseline"), false);
  assert.equal(Object.hasOwn(group, "package_differences"), false);
});

test("overview percentiles use every raw price rather than medians of detailed cells", () => {
  const rows = [1000, 2000, 3000].map(price => listing({ price_original: price }));
  rows.push(listing({ title: "緬懷起大斷百禮號", price_original: 10000 }));
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.season_overviews[0].median, 2500);
  assert.equal(report.season_overviews[0].sample_count, 4);
  assert.equal(buildMarketHeadlineReport(rows, { minimumSamples: 5 }).season_overviews[0].sufficient_samples, false);
});

test("overviews never pool distinct market identities, currencies, channels, price kinds or seasons", () => {
  const variations = [{}, { source: "other" }, { market_scope: "international" },
    { currency_original: "CNY" }, { channel: "vivo" }, { price_kind: "sold" }, { title: "協奏起" }];
  const report = buildMarketHeadlineReport(variations.flatMap((fields, index) =>
    [1, 2, 3].map(n => listing({ ...fields, price_original: (index + 1) * 1000 + n }))));
  assert.equal(report.season_overviews.length, variations.length);
  assert.deepEqual(report.season_overviews.map(g => g.median).sort((a, b) => a - b), variations.map((_, i) => (i + 1) * 1000 + 2));
  assert.equal(report.season_overviews.reduce((sum, g) => sum + g.sample_count, 0), report.eligible_rows);
  const excluded = buildMarketHeadlineReport([listing({ exclude_from_model: true }), listing({ price_original: 0 })]);
  assert.deepEqual(excluded.season_overviews, []);
});

test("market tuple separators cannot merge different sources or regions", () => {
  const report = buildMarketHeadlineReport([
    listing({ source: "a|b", market_scope: "c", price_original: 1000 }),
    listing({ source: "a", market_scope: "b|c", price_original: 9000 }),
  ]);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.markets.length, 2);
  assert.equal(report.season_overviews.length, 2);
  assert.deepEqual(report.season_overviews.map(g => g.median).sort((a, b) => a - b), [1000, 9000]);
  assert.ok(report.season_overviews.every(g => g.sample_count === 1));
});

test("reviewed quotation bases separate equal-currency account prices without conversion", () => {
  const report = buildMarketHeadlineReport([
    listing({ price_original: 1000, price_quote_basis: "single_currency" }),
    listing({ price_original: 9000, price_quote_basis: "seller_multi_currency" }),
    listing({ price_original: 5000 }),
  ]);
  assert.equal(report.eligible_rows, 3);
  assert.equal(report.markets.length, 3);
  assert.equal(report.season_overviews.length, 3);
  assert.deepEqual(Object.fromEntries(report.season_overviews.map(g => [g.price_quote_basis, g.median])),
    { single_currency: 1000, seller_multi_currency: 9000, unknown: 5000 });
  assert.ok(report.markets.every(g => g.currency === "TWD" && g.sample_count === 1));
});

test("quotation context is optional and never adds account identities or bypasses price gates", () => {
  const original = listing();
  const report = buildMarketHeadlineReport([original, { ...original, price_quote_basis: "seller_multi_currency" },
    listing({ price_quote_basis: "unreviewed private seller text" })]);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.season_overviews.reduce((n, g) => n + g.sample_count, 0), 2);
  assert.doesNotMatch(JSON.stringify(report), /unreviewed private seller text/);
  assert.ok(report.season_overviews.some(g => g.price_quote_basis === "unknown"));
  const rejected = buildMarketHeadlineReport([
    { source: "facebook", post_hash: "converted", region: "international", currency: "TWD", original_currency: "MYR", price_twd: 9000, price_kind: "ask", start_season_slug: "lightseekers", price_quote_basis: "seller_multi_currency" },
    listing({ price_quote_basis: "seller_multi_currency", exclude_from_model: true }),
    listing({ price_quote_basis: "single_currency", price_original: 0 }),
  ]);
  assert.equal(rejected.eligible_rows, 0);
  assert.equal(rejected.diagnostics.converted_currency_only, 1);
});

test("exact duplicate quote reviews are order-independent and cannot leak to repriced snapshots", () => {
  const original = listing({ observed_at: "2026-09-01" });
  const reviewed = { ...original, price_quote_basis: "seller_multi_currency" };
  for (const rows of [[original, reviewed], [reviewed, original]]) {
    const report = buildMarketHeadlineReport(rows);
    assert.equal(report.eligible_rows, 1);
    assert.equal(report.markets[0].price_quote_basis, "seller_multi_currency");
  }
  const conflict = buildMarketHeadlineReport([reviewed, { ...original, price_quote_basis: "single_currency" }]);
  assert.equal(conflict.markets[0].price_quote_basis, "unknown");
  const later = { ...original, observed_at: "2026-09-02", price_original: 2500 };
  const repriced = buildMarketHeadlineReport([reviewed, later]);
  assert.equal(repriced.markets[0].price_quote_basis, "unknown");
  assert.equal(repriced.season_overviews[0].median, 2500);
});

test("headline price quantiles interpolate without rounding or inflating sparse samples", () => {
  for (const [prices, expected] of [
    [[3500], [3500, 3500, 3500]],
    [[5000, 3000], [3500, 4000, 4500]],
    [[5000, 1000, 3000], [2000, 3000, 4000]],
    [[9000, 1000, 5000, 3000], [2500, 4000, 6000]],
    [[1001, 1000], [1000.25, 1000.5, 1000.75]],
    [[3000, 3000, 3000, 3000], [3000, 3000, 3000]],
  ]) {
    const rows = prices.map(price => listing({ price_original: price }));
    const report = buildMarketHeadlineReport(rows);
    const item = report.markets[0].season_breaks[0].packages[0];
    assert.deepEqual([item.p25, item.median, item.p75], expected);
    assert.equal(item.sample_count, prices.length);
    assert.equal(item.sufficient_samples, prices.length >= 3);
    assert.deepEqual(rows.map(row => row.price_original), prices);
  }
  assert.deepEqual(buildMarketHeadlineReport([]).markets, []);
});

test("package differences use interpolated medians after deduplicating listings", () => {
  const rows = [1000, 3000, 5000, 9000].map(price => listing({ price_original: price }));
  rows.push({ ...rows[0] });
  rows.push(...[2000, 6000, 8000, 10000].map(price => listing({ title: "緬懷起 無斷 禮包10 簡號", price_original: price })));
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.eligible_rows, 8);
  const group = report.markets[0].season_breaks[0];
  assert.deepEqual(group.packages.map(item => item.median), [4000, 7000]);
  assert.equal(group.package_differences[0].median_total_difference, 3000);
  assert.equal(report.status, "headline-unvalidated");
});

test("reviewed relisting IDs join transitively within one source without inflating sample thresholds", () => {
  const report = buildMarketHeadlineReport([
    listing({ listing_id: "first", duplicate_listing_ids: ["second"] }),
    listing({ listing_id: "second", duplicate_listing_ids: ["third"] }),
    listing({ listing_id: "third" }),
    listing({ listing_id: "first", source: "another-market" }),
  ]);
  assert.equal(report.eligible_rows_before_dedupe, 4);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.markets.length, 2);
  for (const market of report.markets) {
    assert.equal(market.sample_count, 1);
    assert.equal(market.season_breaks[0].packages[0].sufficient_samples, false);
  }
  assert.doesNotMatch(JSON.stringify(report), /first|second|third|duplicate_listing_ids/);
});

test("relisting metadata ignores malformed IDs and cannot replace primary identity", () => {
  const invalid = [null, true, {}, [], "unknown", "none", "", Number.MAX_SAFE_INTEGER + 1];
  const report = buildMarketHeadlineReport([
    listing({ duplicate_listing_ids: invalid }),
    listing({ duplicate_listing_ids: invalid }),
    listing({ duplicate_listing_ids: "not-an-array" }),
    listing({ listing_id: null, duplicate_listing_ids: ["someone-else"] }),
    listing({ listing_id: "numeric", duplicate_listing_ids: [12345] }),
    listing({ listing_id: "12345" }),
  ]);
  assert.equal(report.diagnostics.identity_unknown, 1);
  assert.equal(report.eligible_rows, 4);
});

test("season aliases retain incomplete listings in separate native-currency markets", () => {
  const report = buildMarketHeadlineReport([
    listing({ title: "二重奏起少禮號" }),
    listing({ title: "二重奏起少礼号", currency_original: "CNY", market_scope: "cn" }),
  ]);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.markets.length, 2);
  assert.deepEqual(new Set(report.markets.map(market => market.currency)), new Set(["TWD", "CNY"]));
  for (const market of report.markets) {
    assert.equal(market.binding_class, "unknown");
    assert.equal(market.season_breaks[0].season, "duets");
    assert.equal(market.season_breaks[0].break_class, "unknown");
    assert.equal(market.season_breaks[0].packages[0].package_tier, "seller:few");
  }
});

test("binding shorthand plus simple-account title is usable without GUIDs or binding details", () => {
  const report = buildMarketHeadlineReport([listing({ title: "音韻綁全出簡" })]);
  assert.equal(report.eligible_rows, 1);
  assert.equal(report.markets[0].binding_class, "unknown");
  const group = report.markets[0].season_breaks[0];
  assert.equal(group.season, "rhythm");
  assert.equal(group.break_class, "unknown");
  assert.equal(group.packages[0].package_tier, "unknown");
});

test("Two Embers chapter-one aliases retain separate markets without inventing wardrobe details", () => {
  const report = buildMarketHeadlineReport([
    listing({ title: "雙星季：暮星篇起少禮號" }),
    listing({ title: "双星季:暮星篇起少礼号", currency_original: "CNY", market_scope: "cn" }),
  ]);
  assert.equal(report.eligible_rows, 2);
  assert.equal(report.markets.length, 2);
  assert.deepEqual(new Set(report.markets.map(m => m.currency)), new Set(["TWD", "CNY"]));
  for (const market of report.markets) {
    assert.equal(market.binding_class, "unknown");
    assert.equal(market.season_breaks[0].season, "two-embers-part-1");
    assert.equal(market.season_breaks[0].break_class, "unknown");
    assert.equal(market.season_breaks[0].packages[0].package_tier, "seller:few");
  }
});

test("reviewed earlier partial graduation can resolve a later headline season", () => {
  const base = { title: "魔法無斷綁全出", start_season_slug: "rhythm", start_season_confidence: "structured", season_progress: { rhythm: "1/2", enchantment: "complete" } };
  const report = buildMarketHeadlineReport([listing(base)]);
  assert.equal(report.eligible_rows, 1);
  assert.equal(report.diagnostics.title_start_resolved, 1);
  assert.equal(report.diagnostics.title_start_conflict, 0);
  assert.equal(report.markets[0].season_breaks[0].season, "rhythm");
  assert.equal(report.markets[0].season_breaks[0].break_class, "unknown");
  const computed = buildMarketHeadlineReport([listing({ ...base, computed_break_class: "slight" })]);
  assert.equal(computed.markets[0].season_breaks[0].break_class, "slight");
  for (const fields of [
    { start_season_confidence: "inferred" },
    { season_progress: { rhythm: "0", enchantment: "complete" } },
    { season_progress: { rhythm: "3/0", enchantment: "complete" } },
    { season_progress: { rhythm: "3/2", enchantment: "complete" } },
    { season_progress: { rhythm: "1/2" } },
    { season_progress: { belonging: "complete", rhythm: "1/2", enchantment: "complete" } },
  ]) {
    const rejected = buildMarketHeadlineReport([listing({ ...base, ...fields })]);
    assert.equal(rejected.eligible_rows, 0);
    assert.equal(rejected.diagnostics.title_start_conflict, 1);
  }
});

test("a multi-season title cannot lend its break degree to a different structured start", () => {
  // Real source pattern: 8591 HK 53878130; price is deliberately synthetic.
  const fields = { title: "姆明大斷少禮簡號｜九色鹿、姆明全禮", start_season_slug: "duets", season_progress: { duets: "2/3", radiance: "1/2" } };
  for (const extra of [{}, { seller_break_label: "big" }]) {
    const report = buildMarketHeadlineReport([listing({ ...fields, ...extra })]);
    assert.equal(report.eligible_rows, 1);
    const group = report.markets[0].season_breaks[0];
    assert.equal(group.season, "duets");
    assert.equal(group.break_class, "unknown");
    assert.equal(group.packages[0].package_tier, "seller:few");
  }
  for (const extra of [{ computed_break_class: "big" }, { title: "大斷少禮簡號" }, { title: "協奏大斷少禮簡號" }]) {
    const report = buildMarketHeadlineReport([listing({ ...fields, ...extra })]);
    assert.equal(report.markets[0].season_breaks[0].break_class, "big");
  }
});

test("uses partial structured progress when titles do not identify a starting season", () => {
  for (const value of ["complete", "1/2", { selected: 1, expected: 2 }, 1, "start"]) {
    const report = buildMarketHeadlineReport([listing({ title: "耳墜阿努禮包號", season_progress: { prophecy: "complete", rhythm: value, gratitude: "0" } })]);
    assert.equal(report.eligible_rows, 1);
    assert.equal(report.markets[0].season_breaks[0].season, "rhythm");
    assert.equal(report.markets[0].season_breaks[0].break_class, "unknown");
  }
  for (const value of [null, false, 0, -1, 0.5, {}, [], "3/2", "1/0", { selected: 0, expected: 2 }]) {
    const report = buildMarketHeadlineReport([listing({ title: "帳號出售", season_progress: { gratitude: value, invented: "complete" } })]);
    assert.equal(report.eligible_rows, 0);
    assert.equal(report.diagnostics.start_unknown, 1);
  }
  const conflict = buildMarketHeadlineReport([listing({ title: "緬懷起無斷", season_progress: { rhythm: "1/2" } })]);
  assert.equal(conflict.diagnostics.title_start_conflict, 1);
});

test("upper-bound packages stay ranged without a zero-package baseline or exact-tier differences", () => {
  const rows = ["不到80禮", "最多50禮", "少於15禮"].flatMap(label =>
    [1000, 2000, 3000].map(price => listing({ title: `魔法起${label}`, price_original: price })));
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.eligible_rows, 9);
  const group = report.markets[0].season_breaks[0];
  assert.deepEqual(new Set(group.packages.map(item => item.package_tier)), new Set(["range:0-79", "range:0-50", "range:0-14"]));
  assert.ok(group.packages.every(item => item.sufficient_samples));
  assert.equal(group.no_package_baseline, false);
  assert.deepEqual(group.package_differences, []);
});

test("formatted exact counts are usable but approximate counts do not discard the listing", () => {
  for (const [label, tier] of [["80個禮包", "80-89"], ["禮包：80", "80-89"], ["約80禮", "unknown"], ["80禮左右", "unknown"], ["禮包：60+", "range:60+"]]) {
    const report = buildMarketHeadlineReport([listing({ title: `魔法起${label}` })]);
    assert.equal(report.eligible_rows, 1, label);
    const group = report.markets[0].season_breaks[0];
    assert.equal(group.season, "enchantment");
    assert.equal(group.packages[0].package_tier, tier, label);
  }
});

test("prefix package intervals reach the report as ranges", () => {
  const rows = [1000, 1200, 1400].map(price => listing({ title: "緬懷起無斷禮包：60～80", price_original: price }));
  const group = buildMarketHeadlineReport(rows).markets[0].season_breaks[0];
  assert.deepEqual(group.packages.map(x => x.package_tier), ["range:60-80"]);
  assert.equal(group.packages[0].sample_count, 3);
  assert.deepEqual(group.package_differences, []);
});

test("over-count package evidence stays in a lower-bound report cohort", () => {
  const rows = [1000, 1200, 1400].map(price => listing({ title: "緬懷起無斷禮包60多", price_original: price }));
  const group = buildMarketHeadlineReport(rows).markets[0].season_breaks[0];
  assert.deepEqual(group.packages.map(x => x.package_tier), ["range:61+"]);
  assert.equal(group.packages[0].sample_count, 3);
  assert.deepEqual(group.package_differences, []);
});

test("retains package bounds as distinct cohorts without exact-count premiums", () => {
  const rows = ["60+禮", "百禮", "60～80禮", "60禮"].flatMap(label =>
    [1000, 1200, 1400].map(price => listing({ title: `緬懷起無斷${label}`, price_original: price })));
  const group = buildMarketHeadlineReport(rows).markets[0].season_breaks[0];
  assert.deepEqual(group.packages.map(x => x.package_tier).sort(), ["60-69", "range:100+", "range:60+", "range:60-80"].sort());
  assert.ok(group.packages.every(x => x.sample_count === 3 && x.sufficient_samples));
  assert.deepEqual(group.package_differences, []);
  assert.equal(group.no_package_baseline, false);
});

test("structured bounds override title guesses; invalid or conflicting values stay unknown", () => {
  const cases = [
    [{ paid_package_min: 60 }, "range:60+"],
    [{ paid_package_min: 60, paid_package_max: 80 }, "range:60-80"],
    [{ paid_package_max: 80 }, "unknown"],
    [{ paid_package_min: 80, paid_package_max: 60 }, "unknown"],
    [{ paid_package_min: "60" }, "unknown"],
    [{ paid_package_min: 60, paid_package_count: 20 }, "unknown"],
    [{ paid_package_min: 60, paid_package_count: 70 }, "70-79"],
    [{ paid_package_count: "bad" }, "unknown"],
  ];
  for (const [fields, expected] of cases) {
    const report = buildMarketHeadlineReport([listing(fields)]);
    assert.equal(report.markets[0].season_breaks[0].packages[0].package_tier, expected);
  }
});

test("retains explicit seller package labels without inventing counts or rejecting conflicts", () => {
  const cases = [
    [{ seller_package_label: "few" }, "seller:few"],
    [{ seller_package_label: "medium" }, "seller:medium"],
    [{ seller_package_label: "many" }, "seller:many"],
    [{ seller_package_label: "unknown" }, "unknown"],
    [{ seller_package_label: "few", title: "緬懷少禮號" }, "seller:few"],
    [{ seller_package_label: "few", title: "緬懷多禮號" }, "unknown"],
    [{ seller_package_label: "few", paid_package_count: 65 }, "60-69"],
    [{ seller_package_label: "few", paid_package_min: 60 }, "range:60+"],
    [{ seller_package_label: "many", paid_package_count: "bad" }, "unknown"],
  ];
  for (const [fields, tier] of cases) {
    const report = buildMarketHeadlineReport([listing({ title: "", start_season_slug: "remembrance", ...fields })]);
    assert.equal(report.eligible_rows, 1);
    const group = report.markets[0].season_breaks[0];
    assert.equal(group.packages[0].package_tier, tier);
    assert.equal(group.no_package_baseline, false);
    assert.deepEqual(group.package_differences, []);
  }
});

test("report reads the same blank-metadata and page-marker fallback as calibration", () => {
  const report = buildMarketHeadlineReport([listing({ title: " ", listing_title: "N/A", listing_text: "分頁 1\n預言八季禮包號" })]);
  assert.equal(report.eligible_rows, 1);
  assert.equal(report.markets[0].season_breaks[0].season, "prophecy");
});

test("keeps public listing markets separate and reports exact package-tier differences", () => {
  const rows = [900, 1000, 1100].map((price) => listing({ price_original: price })).concat([700, 800, 900].map((price) => listing({ title: "緬懷起 無斷 禮包10 簡號", price_original: price })));
  const report = buildMarketHeadlineReport(rows);
  const group = report.markets[0].season_breaks[0];
  assert.equal(report.status, "headline-unvalidated");
  assert.deepEqual(group.packages.map((item) => item.package_tier), ["0", "10-19"]);
  assert.equal(group.no_package_baseline, true);
  assert.equal(group.package_differences[0].median_total_difference, -200);
});

test("keeps known channels separate without discarding unknown-channel evidence", () => {
  const rows = ["ios-official", "android-official", "vivo", undefined].flatMap((channel, index) =>
    [1, 2, 3].map(n => listing({ channel, price_original: (index + 1) * 1000 + n })));
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.eligible_rows, 12);
  assert.equal(report.markets.length, 4);
  for (const [channel, median] of [["ios-official", 1002], ["android-official", 2002], ["vivo", 3002], ["unknown", 4002]]) {
    const market = report.markets.find(market => market.channel === channel);
    assert.equal(market.sample_count, 3);
    assert.equal(market.season_breaks[0].packages[0].median, median);
  }
});

test("normalizes explicit channel aliases without leaking text or inflating relists", () => {
  const report = buildMarketHeadlineReport([
    ...["ios-official", " iOS 官服 ", "iOS官服 苹果官服"].map(channel => listing({ channel })),
    listing({ channel: "安卓官服", listing_id: "relisted" }),
    listing({ channel: "vivo", listing_id: "relisted" }),
    listing({ channel: "seller-private-contact" }), listing({ channel: { toString: "ios-official" } }),
    listing({ channel: "__proto__" }), listing({ channel: "iOS" }),
  ]);
  assert.equal(report.eligible_rows, 8);
  assert.equal(report.markets.find(m => m.channel === "ios-official").sample_count, 3);
  assert.equal(report.markets.find(m => m.channel === "unknown").sample_count, 4);
  assert.doesNotMatch(JSON.stringify(report), /seller-private-contact|__proto__|relisted/);
});

test("excludes conflicts and unsafe rows, dedupes without exposing titles or identifiers", () => {
  const rows = [
    listing({ listing_id: "same", price_original: 1000 }), listing({ listing_id: "same", price_original: 2000, evidence_kind: "sold" }),
    listing({ start_season_slug: "nesting" }), listing({ price_original: 0 }), listing({ currency_original: "" }), listing({ market_scope: "" }), listing({ exclude_from_model: true }),
  ];
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.eligible_rows, 1);
  assert.equal(report.diagnostics.title_start_conflict, 1);
  assert.equal(report.diagnostics.excluded_from_model, 1);
  assert.doesNotMatch(JSON.stringify(report), /緬懷起|same/);
  assert.equal(JSON.stringify(report).includes("same"), false);
});

test("uses normalized TWD rows only when their market fields are explicit", () => {
  const base = { source: "manual_backup", start_season_slug: "remembrance", computed_break_class: "none", paid_package_count: 0, price_twd: 1500, region: "tw", currency: "TWD", price_kind: "sold", account_fingerprint: "a".repeat(64) };
  const report = buildMarketHeadlineReport([base, { ...base, account_fingerprint: "b".repeat(64), price_twd: 1600 }, { ...base, account_fingerprint: "c".repeat(64), price_twd: 1700 }, { ...base, account_fingerprint: "d".repeat(64), region: "" }]);
  assert.equal(report.eligible_rows, 3);
  assert.equal(report.markets[0].currency, "TWD");
  assert.equal(report.markets[0].season_breaks[0].break_class, "none");
  assert.equal(report.markets[0].season_breaks[0].packages[0].sufficient_samples, true);
});

test("orders exact count tiers numerically and retains unknown wing state", () => {
  const rows = [100, 110, 120].map((price) => listing({ title: "緬懷起 無斷 禮包20", price_original: price })).concat([50, 60, 70].map((price) => listing({ title: "緬懷起 無斷 禮包100", price_original: price })));
  const group = buildMarketHeadlineReport(rows).markets[0];
  const season = group.season_breaks[0];
  assert.equal(group.wingless, "unknown");
  assert.deepEqual(season.packages.map((item) => item.package_tier), ["20-29", "100-109"]);
  assert.equal(season.package_differences[0].median_total_difference, -50);
});

test("rejects unknown season slugs and converted-only foreign normalized prices", () => {
  const foreign = { source: "manual", start_season_slug: "remembrance", price_twd: 100, original_currency: "USD", currency: "TWD", region: "tw" };
  const unknown = { ...foreign, original_currency: "TWD", start_season_slug: "invented-season", account_fingerprint: "d".repeat(64) };
  const report = buildMarketHeadlineReport([foreign, unknown]);
  assert.equal(report.eligible_rows, 0);
  assert.equal(report.diagnostics.converted_currency_only, 1);
  assert.equal(report.diagnostics.start_unknown, 1);
});

test("CLI refuses tmp and application output paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sky-headline-cli-"));
  const input = join(directory, "source.jsonl");
  await writeFile(input, `${JSON.stringify(listing())}\n`);
  const script = fileURLToPath(new URL("../scripts/analyze-market-headlines.mjs", import.meta.url));
  try {
    for (const output of ["tmp/report.json", "app/report.json", "dist/report.json"]) {
      await assert.rejects(exec(process.execPath, [script, input, `--out=${output}`]), /--out must be under this project's ignored work\/ or dist\/tmp\//);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not mix price kinds or accept contradictory and source-less markets", () => {
  const rows = [
    listing({ price_kind: "sold", evidence_kind: "sold" }),
    listing({ price_kind: "sold", evidence_kind: "ask" }),
    listing({ market_scope: "tw", currency_original: "TWD", listing_text: "國服帳號", title: "緬懷起 無斷 禮包0" }),
    listing({ source: "" }),
    listing({ source: "market", listing_id: "one", account_fingerprint: "unknown" }),
    listing({ source: "market", listing_id: "two", account_fingerprint: "unknown" }),
  ];
  const report = buildMarketHeadlineReport(rows);
  assert.equal(report.diagnostics.price_kind_conflict, 1);
  assert.equal(report.diagnostics.contradictory_market, 1);
  assert.equal(report.diagnostics.source_unknown, 1);
  assert.deepEqual(report.markets.map((market) => market.price_kind).sort(), ["ask", "sold"]);
  assert.equal(report.eligible_rows, 3, "placeholder account identities must not collapse distinct listings");
});

test("accepts compatible quick-sale asking evidence and retains explicit price types", () => {
  const report = buildMarketHeadlineReport([
    listing({ price_kind: undefined, evidence_kind: "sold" }),
    listing({ price_kind: undefined, evidence_kind: "ask" }),
    listing({ price_kind: "quick_sale", evidence_kind: "ask" }),
    listing({ price_kind: "ask", evidence_kind: "comment" }),
  ]);
  assert.equal(report.eligible_rows, 4);
  assert.deepEqual(report.markets.map(m => m.price_kind).sort(), ["ask", "quick_sale", "sold"]);
});

test("rejects China claims in international titles and ignores all placeholder identities", () => {
  const report = buildMarketHeadlineReport([
    listing({ market_scope: "international", title: "國服緬懷起無斷" }),
    ...["unknown", "N/A", "none", "undefined", "-"].flatMap(identity => [
      listing({ account_hash: identity }), listing({ account_hash: identity }),
    ]),
    listing({ market_scope: "china", currency_original: "CNY", title: "國服緬懷起無斷" }),
  ]);
  assert.equal(report.diagnostics.contradictory_market, 1);
  assert.equal(report.eligible_rows, 11);
  assert.ok(report.markets.some(m => m.currency === "CNY"));
});

test("does not treat foreign-currency prose as TWD or combine unknown price kinds", () => {
  const base = { source: "market", start_season_slug: "moments", region: "international", currency: "TWD", price_twd: 3000, price_kind: "ask" };
  const report = buildMarketHeadlineReport([
    { ...base, listing_text: "USD 100 international account" },
    { ...base, title: "港幣 500 國際服" },
    { ...base, price_kind: undefined },
  ]);
  assert.equal(report.eligible_rows, 0);
  assert.equal(report.diagnostics.converted_currency_only, 2);
  assert.equal(report.diagnostics.price_kind_unknown, 1);
});

test("unidentified copies cannot create sufficient market samples", () => {
  const row = listing({ listing_id: undefined });
  const report = buildMarketHeadlineReport([row, { ...row }, { ...row }]);
  assert.equal(report.eligible_rows, 0);
  assert.equal(report.diagnostics.identity_unknown, 3);
});
