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
