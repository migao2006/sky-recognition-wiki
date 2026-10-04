import test from "node:test";
import assert from "node:assert/strict";
import { prepareWholeAccountEvidence } from "../scripts/lib/whole-account-evidence.mjs";
const seasons = ["gratitude", "rhythm"];
const row = (id, overrides = {}) => ({
  postKey: "post-" + id, sourceUrl: "https://www.facebook.com/search/posts/?q=sky",
  seasonSlug: "rhythm", priceTwd: 38000, priceRaw: "3.8？萬台", priceKind: "ask",
  intent: "sell", summary: id + " 音韻斷季多禮，3.8？萬台", packageRaw: "多禮",
  breakRaw: "有斷", publishedAt: null, ...overrides,
});
test("preserves whole account asks and unknown dates; does not invent precise package counts", () => {
  const result = prepareWholeAccountEvidence([row(1, { packageCount: 120, packageRaw: "百禮／120+", breakRaw: "偽無斷" })], { seasons });
  assert.equal(result.accepted.length, 1);
  const accepted = result.accepted[0];
  assert.equal(accepted.price, 38000);
  assert.equal(accepted.publishedAt, null);
  assert.equal(accepted.packageCount, undefined);
  assert.equal(accepted.packageTier, "hundred");
  assert.equal(accepted.breakClass, "slight");
  assert.equal(prepareWholeAccountEvidence([row(2, { packageRaw: "中少禮" })], { seasons }).accepted[0].packageTier, null);
});
test("mixed goods, foreign conversions, bids and buyers remain out of production", () => {
  const changes = [{ intent: "buy" }, { priceKind: "sold" }, { converted: true }, { priceTwd: 0 },
    { currency: "CNY" }, { server: "china" }, { market: "china" },
    { summary: "國服 台幣" }, { summary: "禮包，附實體徽章 台幣" }, { summary: "競標起標 台幣" },
    { summary: "刷號 台幣" }, { excludeFromModel: true }];
  const report = prepareWholeAccountEvidence(changes.map((c, i) => row(i, c)), { seasons });
  assert.equal(report.accepted.length, 0);
});
test("reviewed duplicates join transitively; prices alone never define account identity", () => {
  const data = [row(1), row(2), row(3)];
  const review = { sourceDigest: "abc", decisions: {
    "post-1": { duplicateOf: "post-2", reason: "same expanded post" },
    "post-2": { duplicateOf: "post-3", reason: "same account listing" },
  } };
  const report = prepareWholeAccountEvidence(data, { seasons, review, sourceDigest: "abc" });
  assert.equal(report.accepted.length, 1);
  assert.equal(report.accepted[0].postKey, "post-3");
  assert.equal(report.datasetDigest, prepareWholeAccountEvidence([...data].reverse(), { seasons, review, sourceDigest: "abc" }).datasetDigest);
  assert.equal(prepareWholeAccountEvidence(data, { seasons }).accepted.length, 3);
  assert.throws(() => prepareWholeAccountEvidence(data, { seasons, review, sourceDigest: "changed" }), /digest/);
});
test("unknown season is pooled; reviewed field correction cannot divide account price", () => {
  const data = [row(1, { seasonSlug: "unassigned", packageRaw: "限定9件" })];
  const report = prepareWholeAccountEvidence(data, { seasons });
  assert.equal(report.accepted[0].season, null);
  assert.equal(report.accepted[0].packageTier, null);
  const updated = prepareWholeAccountEvidence(data, { seasons, review: { decisions: {
    "post-1": { season: "gratitude", reason: "explicit start in body" },
  } } });
  assert.equal(updated.accepted[0].season, "gratitude");
  assert.equal(updated.accepted[0].price, 38000);
});
