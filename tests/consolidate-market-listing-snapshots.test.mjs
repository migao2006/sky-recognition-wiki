import assert from "node:assert/strict";
import test from "node:test";
import { mergeListingObservations } from "../scripts/consolidate-market-listing-snapshots.mjs";

test("deduplicates repeated listings while preserving richer evidence and price changes", () => {
  const merged = mergeListingObservations([
    {
      snapshotId: "first",
      snapshotComplete: true,
      collectedAt: "2026-09-01T00:00:00.000Z",
      row: {
        source: "market",
        listing_id: "42",
        price_original: 500,
        currency_original: "CNY",
        description: "完整資料",
        season_mentions: ["sanctuary"],
      },
    },
    {
      snapshotId: "second",
      snapshotComplete: false,
      collectedAt: "2026-09-03T00:00:00.000Z",
      row: {
        source: "market",
        listing_id: "42",
        price_original: 450,
        currency_original: "CNY",
      },
    },
  ]);
  assert.equal(merged.description, "完整資料");
  assert.deepEqual(merged.season_mentions, ["sanctuary"]);
  assert.equal(merged.price_original, 450);
  assert.equal(merged.observation_count, 2);
  assert.equal(merged.seen_in_complete_snapshot, true);
  assert.equal(merged.latest_snapshot_complete, false);
  assert.deepEqual(merged.price_history, [
    { observed_at: "2026-09-01T00:00:00.000Z", price_original: 500, currency_original: "CNY" },
    { observed_at: "2026-09-03T00:00:00.000Z", price_original: 450, currency_original: "CNY" },
  ]);
});

test("does not manufacture price history from an unchanged repeated listing", () => {
  const merged = mergeListingObservations([
    {
      snapshotId: "one",
      snapshotComplete: false,
      collectedAt: "2026-09-01T00:00:00.000Z",
      row: { source: "market", listing_id: "7", price_original: 100, currency_original: "USD" },
    },
    {
      snapshotId: "two",
      snapshotComplete: false,
      collectedAt: "2026-09-02T00:00:00.000Z",
      row: { source: "market", listing_id: "7", price_original: 100, currency_original: "USD" },
    },
  ]);
  assert.equal(merged.observation_count, 2);
  assert.equal(merged.price_history, undefined);
});

test("lets the latest detailed observation clear a stale derived season", () => {
  const merged = mergeListingObservations([
    {
      snapshotId: "old-parser",
      snapshotComplete: false,
      collectedAt: "2026-09-01T00:00:00.000Z",
      row: {
        source: "market",
        listing_id: "9",
        description: "畢業季節：半魔法季",
        start_season_candidate: "enchantment",
      },
    },
    {
      snapshotId: "fixed-parser",
      snapshotComplete: false,
      collectedAt: "2026-09-03T00:00:00.000Z",
      row: {
        source: "market",
        listing_id: "9",
        description: "畢業季節：半魔法季",
        season_graduation_mentions: [{ slug: "enchantment", status: "partial" }],
      },
    },
  ]);
  assert.equal(merged.start_season_candidate, undefined);
  assert.deepEqual(merged.season_graduation_mentions, [{ slug: "enchantment", status: "partial" }]);
});
