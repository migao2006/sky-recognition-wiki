import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const script = new URL("../scripts/audit-valuation-source.mjs", import.meta.url);
const recent = new Date().toISOString();
const audit = async (rows) => {
  const directory = await mkdtemp(join(tmpdir(), "sky-valuation-audit-"));
  const source = join(directory, "source.jsonl");
  try {
    await writeFile(source, `${rows.map(JSON.stringify).join("\n")}\n`);
    const { stdout } = await exec(process.execPath, [fileURLToPath(script), source]);
    return JSON.parse(stdout);
  } finally { await rm(directory, { recursive: true, force: true }); }
};

test("weights structured seasonal samples by evidence and quality", async () => {
  const result = await audit([
    { post_hash: "a", published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { rhythm: "畢" } },
    { post_hash: "b", published_at: recent, price_twd: 20000, evidence_kind: "professional_estimate", evidence_quality: "high", seasons: [{ slug: "rhythm" }] },
    { post_hash: "c", published_at: recent, price_twd: 30000, evidence_kind: "comment", evidence_quality: "medium", season_progress: { rhythm: "1/2" } },
  ]);
  const rhythm = result.seasons.rhythm;
  assert.equal(rhythm.sampleCount, 3);
  assert.equal(rhythm.effectiveWeight, 1.813);
  assert.deepEqual(rhythm.evidenceBreakdown, {
    ask: 1,
    quick_sale: 0,
    sold: 0,
    professional_estimate: 1,
    comment: 1,
  });
  assert.deepEqual([rhythm.p25, rhythm.median, rhythm.p75], [10000, 10000, 20000]);
});

test("deduplicates hashes and excludes foreign, China, and invalid records", async () => {
  const result = await audit([
    { post_hash: "same", published_at: recent, price_twd: 10000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_hash: "same", published_at: recent, price_twd: 90000, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
    { post_hash: "cn", price_twd: 12000, evidence_kind: "ask", evidence_quality: "high", region: "國服", season_progress: { aurora: "畢" } },
    { post_hash: "usd", price_twd: 12000, evidence_kind: "ask", evidence_quality: "high", currency: "USD", season_progress: { aurora: "畢" } },
    { post_hash: "bad", price_twd: null, evidence_kind: "ask", evidence_quality: "high", season_progress: { aurora: "畢" } },
  ]);
  assert.deepEqual([result.eligibleRows, result.excludedRows, result.duplicateRows], [1, 3, 1]);
  assert.equal(result.seasons.aurora.sampleCount, 1);
  assert.deepEqual([result.seasons.aurora.excludedCount, result.seasons.aurora.duplicateCount], [3, 1]);
});

test("keeps old listing text and account features compatible without leaking them", async () => {
  const result = await audit([{ price_twd: 18500, evidence_kind: "ask", evidence_quality: "high", published_at: recent, listing_text: "追光畢出售", account_features: "大傘" }]);
  assert.equal(result.seasons.lightseekers.median, 18500);
  assert.equal(/追光畢|大傘/.test(JSON.stringify(result)), false);
});

test("does not mistake collection time for publication recency", async () => {
  const result = await audit([{
    post_hash: "unknown-date",
    observed_at: recent,
    price_twd: 4500,
    evidence_kind: "ask",
    evidence_quality: "high",
    season_progress: { moomin: "start" },
  }]);
  assert.equal(result.seasons.moomin.effectiveWeight, 0.45);
});

test("aggregates price ranges and objective market classifications", async () => {
  const result = await audit([
    {
      post_hash: "structured",
      published_at: recent,
      price_twd_low: 4800,
      price_twd_high: 5200,
      price_kind: "ask",
      evidence_kind: "ask",
      evidence_quality: "high",
      start_season_slug: "assembly",
      missing_season_count: 2,
      completion_ratio: 0.9,
      paid_package_count: 42,
      account_style: "regular",
    },
  ]);
  assert.equal(result.eligibleRows, 1);
  assert.equal(result.segments.startSeason.assembly.median, 5032);
  assert.equal(result.segments.breakClass.slight.sampleCount, 1);
  assert.equal(result.segments.packageTier.many.sampleCount, 1);
  assert.equal(result.segments.accountStyle.regular.sampleCount, 1);
});

test("reduces inferred and structured start-season evidence weight", async () => {
  const base = {
    published_at: recent,
    price_twd: 5000,
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "assembly",
  };
  const result = await audit([
    { ...base, post_hash: "explicit", start_season_confidence: "explicit" },
    { ...base, post_hash: "structured", start_season_confidence: "structured" },
    { ...base, post_hash: "inferred", start_season_confidence: "inferred" },
    { ...base, post_hash: "unknown", start_season_confidence: "unknown" },
  ]);
  assert.equal(result.segments.startSeason.assembly.sampleCount, 3);
  assert.equal(result.segments.startSeason.assembly.effectiveWeight, 2.25);
});
