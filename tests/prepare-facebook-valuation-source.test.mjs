import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { prepareRow } from "../scripts/prepare-facebook-valuation-source.mjs";

const exec = promisify(execFile);
const script = new URL("../scripts/prepare-facebook-valuation-source.mjs", import.meta.url);
const testSalt = "test-salt-for-facebook-anonymization-32";

const prepare = async (lines, salt = testSalt) => {
  const directory = await mkdtemp(join(tmpdir(), "sky-facebook-private-"));
  const source = join(directory, "private.jsonl");
  try {
    await writeFile(source, `${lines.join("\n")}\n`);
    const { stdout } = await exec(process.execPath, [fileURLToPath(script), source], {
      env: { ...process.env, VALUATION_HASH_SALT: salt },
    });
    return stdout.trim().split("\n").filter(Boolean).map(JSON.parse);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("anonymizes private Facebook fields while retaining only valuation structure", async () => {
  const privateText = "王小明出售追光畢，大傘，私訊我";
  const privateUrl = "https://www.facebook.com/groups/private/posts/123";
  const [row] = await prepare([JSON.stringify({
    post_url: privateUrl,
    account_id: "account-visible-only-locally",
    group_name: "光遇秘密交易社",
    author_name: "王小明",
    listing_text: privateText,
    comments: [{ author: "李小華", text: "我要" }],
    published_at: "2026-08-30T12:00:00+08:00",
    price_twd: 4500,
    price_kind: "quick_sale",
    evidence_kind: "ask",
    evidence_quality: "high",
    start_season_slug: "lightseekers",
    season_progress: { rhythm: "畢", lightseekers: "2 / 2" },
    computed_break_class: "slight",
    missing_season_count: 2,
    completion_ratio: 0.8,
    paid_package_count: 18,
    computed_package_tier: "medium",
    account_style: "regular",
  })]);
  assert.deepEqual(Object.keys(row), [
    "schema_version", "source", "post_hash", "group_hash", "account_fingerprint",
    "published_at", "price_twd", "price_kind", "evidence_kind", "evidence_quality",
    "start_season_slug", "season_progress", "computed_break_class", "missing_season_count",
    "completion_ratio", "paid_package_count", "computed_package_tier", "account_style",
  ]);
  assert.match(row.post_hash, /^[a-f0-9]{64}$/);
  assert.match(row.group_hash, /^[a-f0-9]{64}$/);
  assert.match(row.account_fingerprint, /^[a-f0-9]{64}$/);
  const output = JSON.stringify(row);
  for (const secret of [privateText, privateUrl, "王小明", "李小華", "光遇秘密交易社", "我要"])
    assert.equal(output.includes(secret), false);
  assert.equal(row.published_at, "2026-08-30T04:00:00.000Z");
  assert.deepEqual(row.season_progress, { lightseekers: "2/2", rhythm: "畢" });
});

test("does not invent an account identity when a relist cannot be linked", async () => {
  const [row] = await prepare([
    JSON.stringify({ post_id: "unlinked", group_id: "group", price_twd: 3000 }),
  ]);
  assert.equal(Object.hasOwn(row, "account_fingerprint"), false);
});

test("hashes are stable for the same salt and rotate with a new salt", async () => {
  const input = JSON.stringify({ post_id: "post-1", group_id: "group-1", account_id: "account-1", price_twd: 3000 });
  const [first] = await prepare([input], "first-salt-for-facebook-anonymization-32");
  const [second] = await prepare([input], "first-salt-for-facebook-anonymization-32");
  const [rotated] = await prepare([input], "second-salt-for-facebook-anonymization-32");
  assert.deepEqual(first, second);
  assert.notEqual(first.post_hash, rotated.post_hash);
  assert.notEqual(first.group_hash, rotated.group_hash);
  assert.notEqual(first.account_fingerprint, rotated.account_fingerprint);
});

test("keeps only standardized exclusion reasons for China, foreign currency, and missing price", async () => {
  const rows = await prepare([
    JSON.stringify({ post_id: "cn", group_id: "g", account_id: "a", region: "國服", price_twd: 4000, exclusion_reason: "作者寫了私人備註" }),
    JSON.stringify({ post_id: "china", group_id: "g", account_id: "a2", region: "china", price_twd: 4000 }),
    JSON.stringify({ post_id: "usd", group_id: "g", account_id: "b", currency: "USD", price_twd: 100, exclusion_reason: "USD price" }),
    JSON.stringify({ post_id: "none", group_id: "g", account_id: "c", exclusion_reason: "請私訊王小明" }),
  ]);
  assert.deepEqual(rows.map((row) => row.exclusion_reason), ["china", "china", "foreign_currency", "missing_price"]);
  assert.equal(JSON.stringify(rows).includes("王小明"), false);
});

test("fails with a source line number for malformed JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sky-facebook-private-error-"));
  const source = join(directory, "private.jsonl");
  try {
    await writeFile(source, '{"post_id":"one"}\nnot-json\n');
    await assert.rejects(
      exec(process.execPath, [fileURLToPath(script), source], { env: { ...process.env, VALUATION_HASH_SALT: testSalt } }),
      (error) => /private\.jsonl:2: invalid JSON/.test(`${error.stderr}\n${error.message}`),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires a sufficiently long salt instead of writing reversible identifiers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sky-facebook-private-salt-"));
  const source = join(directory, "private.jsonl");
  try {
    await writeFile(source, '{"post_id":"one"}\n');
    const environment = { ...process.env };
    delete environment.VALUATION_HASH_SALT;
    await assert.rejects(
      exec(process.execPath, [fileURLToPath(script), source], { env: environment }),
      (error) => /VALUATION_HASH_SALT must be at least 32 characters/.test(`${error.stderr}\n${error.message}`),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects salts shorter than 32 characters", () => {
  assert.throws(
    () => prepareRow({ post_id: "short-salt" }, "too-short"),
    /at least 32 characters/,
  );
});

test("normalizes a reversed price range before anonymized output", () => {
  const output = prepareRow({
    post_id: "reversed-range",
    group_id: "group-a",
    price_twd_low: 5000,
    price_twd_high: 3000,
  }, "fixture-salt-for-facebook-anonymization-32");
  assert.equal(output.price_twd_low, 3000);
  assert.equal(output.price_twd_high, 5000);
});
