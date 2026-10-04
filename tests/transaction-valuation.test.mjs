import assert from "node:assert/strict";
import test from "node:test";
import { reviewTransactions, accuracyMetrics, evaluateTransactionDevelopment } from "../scripts/lib/transaction-valuation.mjs";
import { fitWholeAccountModel, predictFreshModel } from "../app/valuation-fresh-core.js";

const seasons = ["gratitude", "rhythm", "moments"], asOf = "2026-10-04";
// Synthetic only; these rows are never market observations.
const row = (i, extra = {}) => ({ schemaVersion: 1, id: `s${i}`, accountKey: `a${i}`, postKey: `p${i}`,
  sourceGroup: `group${i % 3}`, sourceUrl: `https://example.invalid/post/${i}`,
  accountIdentityVerified: true, knownAnswer: false, reviewed: true, reviewedAt: asOf,
  soldAt: `2026-09-${String(i + 1).padStart(2, "0")}`, transactionConfirmed: true,
  evidence: { sha256: i.toString(16).padStart(64, "0"), priceQuote: "synthetic final price", dateQuote: "synthetic date" },
  market: "taiwan", server: "international", currency: "TWD", converted: false,
  intent: "sell", accountOnly: true, accountStyle: "normal", priceBasis: "account_excluding_fees",
  priceKind: "sold", price: 1000, season: "moments", packageTier: null, breakClass: null, ...extra });
const review = rows => reviewTransactions(rows, { seasons, asOf });

test("only reviewed actual account transaction prices qualify, unknown features remain null", () => {
  assert.equal(review([row(0)]).accepted.length, 1);
  const invalid = [{ schemaVersion: 0 }, { priceKind: "ask" }, { priceKind: "manual" },
    { transactionConfirmed: false }, { evidence: {} }, { reviewed: false },
    { accountIdentityVerified: false }, { knownAnswer: undefined }, { soldAt: "2026-02-30" },
    { soldAt: "2026-10-05" }, { soldAt: "2024-01-01" }, { price: "1000" }, { price: Infinity },
    { currency: "CNY" }, { converted: true }, { accountOnly: false }, { accountStyle: "wingless" },
    { priceBasis: "including_fees" }, { season: "fake" }, { packageTier: "60+" }, { breakClass: "guess" }];
  for (const extra of invalid) assert.equal(review([row(0, extra)]).accepted.length, 0, JSON.stringify(extra));
  assert.equal(review([row(0, { season: null })]).accepted[0].season, null);
});

test("legacy sold label cannot bypass evidence review", () => {
  const result = review([{ price_kind: "sold", price_twd: 1000, observed_at: asOf }]);
  assert.deepEqual(result.rejectionCounts, { legacy_requires_evidence_review: 1 });
});

test("quarantine follows transitive account/post links before filtering", () => {
  const rows = [row(0, { knownAnswer: true }), row(1, { accountKey: "a0" }), row(2, { postKey: "p1" })];
  assert.equal(review(rows).accepted.length, 0);
  assert.deepEqual(review(rows).rejectionCounts, { quarantined_identity: 3 });
});

test("receipt duplicates, price conflicts and latest transactions do not multiply identities", () => {
  const first = row(0), second = row(1, { evidence: first.evidence });
  assert.equal(review([first, second]).accepted[0].id, second.id);
  assert.equal(review([first, row(1, { accountKey: first.accountKey, soldAt: first.soldAt, price: 2000 })]).accepted.length, 0);
  assert.equal(review([first, row(1, { accountKey: first.accountKey, soldAt: first.soldAt, season: "rhythm" })]).accepted.length, 0);
});

test("evidence digest is order independent and includes reviewed content", () => {
  const rows = [row(0), row(1)];
  assert.equal(review(rows).datasetDigest, review(rows.toReversed()).datasetDigest);
  assert.notEqual(review(rows).datasetDigest, review([row(0, { evidence: { ...row(0).evidence, priceQuote: "changed" } }), row(1)]).datasetDigest);
});

test("ten-percent metric uses actual price as denominator, boundaries inclusive", () => {
  const result = accuracyMetrics([{ actual: 1000, predicted: 1100 }, { actual: 1000, predicted: 900 }, { actual: 1000, predicted: 1200 }]);
  assert.equal(result.hit10, 2 / 3);
  assert.equal(result.medianApe, .1);
  assert.ok(result.wilson95[0] < result.hit10 && result.wilson95[1] > result.hit10);
  assert.equal(accuracyMetrics([]).hit10, null);
  assert.throws(() => accuracyMetrics([{ actual: 0, predicted: 1 }]), /actual/);
});

test("failed predictions count as misses and do not silently disappear from error averages", () => {
  const result = accuracyMetrics([{ actual: 1000, predicted: 1000 }, { actual: 1000, predicted: null }]);
  assert.equal(result.hit10, .5);
  assert.equal(result.failed, 1);
  assert.equal(result.mape, null);
});

test("production defaults to asks; sold fit requires explicit kind and cannot mix kinds", () => {
  const sold = [row(0), row(1)], asks = sold.map(r => ({ ...r, priceKind: "ask" }));
  assert.throws(() => fitWholeAccountModel(sold, { seasons }), /selected kind/);
  assert.throws(() => fitWholeAccountModel([sold[0], asks[1]], { seasons, priceKind: "sold" }), /selected kind/);
  assert.throws(() => fitWholeAccountModel(sold, { seasons, priceKind: "manual" }), /Unsupported/);
  const askModel = fitWholeAccountModel(asks, { seasons });
  const soldModel = fitWholeAccountModel(sold, { seasons, priceKind: "sold" });
  assert.equal(soldModel.targetPriceKind, "sold");
  assert.deepEqual(predictFreshModel(askModel, row(2)), predictFreshModel(soldModel, row(2)));
});

test("development evaluation is chronological, includes empty seasons and never claims blind validation", () => {
  const rows = review(Array.from({ length: 20 }, (_, i) => row(i))).accepted;
  const result = evaluateTransactionDevelopment(rows, { seasons });
  assert.equal(result.trainingCount, 16);
  assert.equal(result.testingCount, 4);
  assert.equal(result.metrics.hit10, 1);
  assert.equal(result.bySeason.gratitude.count, 0);
  assert.equal(result.validation, "unvalidated");
  assert.equal(result.blindTest, false);
  assert.equal(result.fullFrontendVerified, false);
  assert.equal(result.productionChanged, false);
});

test("evaluation has explicit no-data and same-day cases, rejects identity overlap", () => {
  assert.equal(evaluateTransactionDevelopment([], { seasons }).status, "pending_data");
  const rows = Array.from({ length: 20 }, (_, i) => row(i));
  assert.equal(evaluateTransactionDevelopment(rows.map(r => ({ ...r, soldAt: asOf })), { seasons }).status, "pending_date_diversity");
  rows[19].accountKey = rows[0].accountKey;
  assert.throws(() => evaluateTransactionDevelopment(rows, { seasons }), /overlap/);
});

test("excluded legacy identity and numeric package proxies cannot bypass reviewed fields", () => {
  assert.equal(review([row(0, { exclude_from_model: true }), row(1, { accountKey: "a0" })]).accepted.length, 0);
  const rows = Array.from({ length: 20 }, (_, i) => row(i, { price: 1000 + i * 100 }));
  assert.deepEqual(evaluateTransactionDevelopment(rows, { seasons }),
    evaluateTransactionDevelopment(rows.map((r, i) => ({ ...r, packageCount: i < 10 ? 200 : 0 })), { seasons }));
});
