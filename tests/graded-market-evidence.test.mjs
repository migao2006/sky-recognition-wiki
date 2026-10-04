import test from "node:test";
import assert from "node:assert/strict";
import { adaptLegacyListing, adaptDriveListing, prepareGradedEvidence, compareGradedModels } from "../scripts/lib/graded-market-evidence.mjs";
import { fitWholeAccountModel } from "../app/valuation-fresh-core.js";

const seasons = ["rhythm", "enchantment", "assembly", "flight"], asOf = "2026-10-04";
const old = (id, extra = {}) => ({ post_id: `p${id}`, account_id: `a${id}`, group_id: "legacy",
  price_twd: 1000, price_kind: "sold", region: "international", currency: "twd",
  start_season_slug: "rhythm", start_season_confidence: "explicit",
  listing_text: `音韻微斷多禮 ${id}：1000 NTD 已售`, ...extra });
const batch = rows => ({ format: "legacy", sourceDigest: "digest", rows });
const prepare = batches => prepareGradedEvidence(batches, { seasons, asOf });

test("legacy sold is a proxy, derived tier/count and observation dates are not evidence", () => {
  const result = adaptLegacyListing(old(1, { listing_text: "音韻 1000NTD 已售", observed_at: asOf,
    computed_package_tier: "hundred", computed_break_class: "none" }), "digest");
  assert.equal(result.priceKind, "sold_proxy");
  assert.equal(result.packageRaw, null);
  assert.equal(result.breakRaw, null);
  assert.equal(result.publishedAt, null);
  assert.equal(result.sourceUrl, null);
  assert.equal(result.sourceRecordRef, "digest:p1");
});

test("relaxed mode accepts unknown dates but still excludes foreign, mixed, modified and buyer rows", () => {
  const rows = [old(0), old(1, { region: "china" }), old(2, { listing_text: "無翼1000NTD" }),
    old(3, { listing_text: "徽章實體1000NTD" }), old(4, { listing_text: "預算1000NTD收音韻" }),
    old(5, { price_kind: "professional_estimate" })];
  assert.equal(prepare([batch(rows)]).accepted.length, 1);
  assert.equal(prepare([batch(rows)]).accepted[0].priceKind, "sold_proxy");
});

test("cross-batch exact text joins identities and stronger evidence wins without duplicating", () => {
  const legacy = old(1);
  const fb = { ...adaptLegacyListing(legacy, "digest"), postKey: "new", accountKey: "new",
    sourceUrl: "https://www.facebook.com/groups/1/posts/123", priceKind: "ask" };
  const result = prepare([batch([legacy]), { format: "facebook", sourceDigest: "second", rows: [fb] }]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].priceKind, "sold_proxy");
  assert.equal(result.rejectionCounts.cross_batch_duplicate, 1);
});

test("quarantined identity propagates through a rejected duplicate across batches", () => {
  const result = prepare([batch([old(1, { knownAnswer: true, price_kind: "professional_estimate" })]),
    { ...batch([old(2, { account_id: "a1" })]), sourceDigest: "second" }]);
  assert.equal(result.accepted.length, 0);
});

test("unknown dated conflicting prices do not resolve by file order", () => {
  const a = batch([old(1)]), b = { ...batch([old(2, { account_id: "a1", price_twd: 2000 })]), sourceDigest: "second" };
  assert.equal(prepare([a, b]).accepted.length, 0);
  assert.equal(prepare([b, a]).accepted.length, 0);
});

const drive = (content, extra = {}) => ({ metadata: { id: "doc1", title: "音韻無斷", modified_time: asOf,
  url: "https://docs.google.com/document/d/doc1/edit" }, result: { content }, ...extra });
const driveOptions = { seasons, seasonNames: { rhythm: ["音韻", "音"], enchantment: ["魔法"], assembly: ["重組"], flight: ["飛行"] } };

test("Drive parses explicit TWD rather than FX; modified time is never a transaction date", () => {
  const result = adaptDriveListing(drive("▍音韻無斷\n♤ › 音韻┊魔法\n♡ › GG出\n♧ › 7000RMB┊3.3w NTD包仲介\n◇ ›"), "digest", driveOptions);
  assert.equal(result.priceTwd, 33000);
  assert.equal(result.priceKind, "ask");
  assert.equal(result.publishedAt, null);
  assert.equal(result.priceBasis, "including_fees");
  assert.equal(result.seasonSlug, "rhythm");
});

test("Drive ambiguous options and floors excluded; season pass cannot supply origin", () => {
  for (const price of ["9700NTD秒┊10000NTD包仲介", "9400NTD底", "8500NTD包仲介,9000直出"])
    assert.equal(adaptDriveListing(drive(`▍禮包號\n♤ › 魔法有卡┊重組\n♡ ›\n♧ › ${price}\n◇ ›`), "digest", driveOptions).excludeFromModel, true);
  const result = adaptDriveListing(drive("▍重組斷季\n♤ › 音1⁄2┊重組\n♡ ›\n♧ › 1000NTD\n◇ ›"), "digest", driveOptions);
  assert.equal(result.seasonSlug, "rhythm");
  assert.equal(result.breakRaw, null);
});

test("proxy core target requires explicit selection and cannot mix with asks", () => {
  const r = prepare([batch([old(0), old(1)])]).accepted;
  assert.throws(() => fitWholeAccountModel(r, { seasons }), /selected kind/);
  assert.equal(fitWholeAccountModel(r, { seasons, priceKind: "sold_proxy" }).targetPriceKind, "sold_proxy");
});

test("graded comparison separates kinds, unknown-date development is not temporal or blind", () => {
  const report = prepare([batch(Array.from({ length: 30 }, (_, i) => old(i, { price_kind: i < 15 ? "ask" : "sold",
    listing_text: `音韻微斷多禮 ${i}：1000 NTD ${i < 15 ? "出售" : "已售"}` })))]);
  const result = compareGradedModels(report.accepted, { seasons });
  assert.equal(result.sold.count, 0);
  for (const kind of ["ask", "sold_proxy"]) {
    assert.equal(result[kind].count, 15);
    assert.equal(result[kind].unknownDates.method, "public_deterministic_group_split_not_blind");
    assert.equal(result[kind].unknownDates.testCount, 3);
    assert.equal(result[kind].knownDates.available, 0);
    assert.equal(result[kind].validation, "unvalidated");
    assert.equal(result[kind].blindTest, false);
  }
});
