import assert from "node:assert/strict";
import test from "node:test";
import { adaptFacebookCsvRow, dedupeFacebookMarketRows, parseTaiwanListingPrice, splitFacebookAccountOffers } from "../scripts/lib/facebook-market-csv.mjs";

test("Taiwan price parser prefers quick price and understands trade shorthand", () => {
  assert.equal(parseTaiwanListingPrice("4300直、4100秒").chosen.value, 4100);
  assert.equal(parseTaiwanListingPrice("售 3.8萬台").chosen.value, 38_000);
  assert.equal(parseTaiwanListingPrice("價格 6.8台緩出").chosen.value, 68_000);
  assert.equal(parseTaiwanListingPrice("價格 5100ntd").chosen.value, 5100);
  assert.equal(parseTaiwanListingPrice("價格:7000 底7400秒 7600直").chosen.value, 7400);
});

test("ambiguous unlabeled prices are not selected", () => {
  assert.equal(parseTaiwanListingPrice("售魔法號 4300 或 4100").chosen, null);
});

test("numbered broker post is split into account sections", () => {
  const parts = splitFacebookAccountOffers("#代出\n1️⃣\n魔法無斷中禮\n價格43200台\n2️⃣\n魔法微斷中禮\n價格2.8w台");
  assert.equal(parts.length, 2);
  assert.match(parts[0], /43200/u);
  assert.match(parts[1], /2\.8w/u);
});

test("strict sale row is privacy-safe and keeps inferred currency", () => {
  const result = adaptFacebookCsvRow({
    post_id: "123", profile_id: "private-user-id", group_id: "260026322725801", date_posted: "2026-09-01T00:00:00Z",
    content: "#售\n小王子無斷多禮號\nGG 不出\n8000",
  });
  assert.equal(result.accepted.length, 1);
  const row = result.accepted[0];
  assert.equal(row.season, "the-little-prince");
  assert.equal(row.breakClass, "none");
  assert.equal(row.packageTier, "many");
  assert.equal(row.price, 8000);
  assert.equal(row.currencyInferred, true);
  assert.ok(!JSON.stringify(row).includes("private-user-id"));
});

test("buy, China-server and modified accounts are rejected", () => {
  for (const content of [
    "#收\n魔法無斷中禮\n預算43000",
    "#售\n國服魔法無斷中禮號\n價格43000人幣",
    "#代出\n刷篝火猛0魔法無斷中禮\n價格5100台",
  ]) assert.equal(adaptFacebookCsvRow({ post_id: content, content }).accepted.length, 0);
});

test("exact repost text is deduplicated", () => {
  const base = { stablePost: "a", textKey: "same", evidence: { title: "x" }, price: 5000, publishedAt: "2026-01-01" };
  const result = dedupeFacebookMarketRows([base, { ...base, stablePost: "b", publishedAt: "2026-01-02" }]);
  assert.equal(result.kept.length, 1);
  assert.equal(result.rejected[0].reason, "duplicate_repost_text");
});
