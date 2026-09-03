import assert from "node:assert/strict";
import test from "node:test";
import { prepareRow } from "../scripts/prepare-facebook-valuation-source.mjs";
import { runJsonlScript } from "./helpers/run-jsonl-script.mjs";

const script = new URL("../scripts/prepare-facebook-valuation-source.mjs", import.meta.url);
const testSalt = "test-salt-for-facebook-anonymization-32";
const valuationModel = {
  baseLow: 8000,
  baseHigh: 12000,
  breakMultiplier: 1,
  partialDiscountLow: 0,
  partialDiscountHigh: 0,
  packageLow: 250,
  packageHigh: 500,
  packageMarketMultiplier: 1,
  limitedLow: 100,
  limitedHigh: 200,
  resourceLow: 0,
  resourceHigh: 0,
  accountStyleMultiplier: 1,
  bindingRisk: 1,
  transferHighMultiplier: 1,
  confidence: "medium",
};

const prepare = async (lines, salt = testSalt) => {
  const { stdout } = await runJsonlScript({
    script,
    lines,
    env: { ...process.env, VALUATION_HASH_SALT: salt },
    temporaryPrefix: "sky-facebook-private-",
  });
  return stdout.trim().split("\n").filter(Boolean).map(JSON.parse);
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
  await assert.rejects(
    runJsonlScript({
      script,
      lines: ['{"post_id":"one"}', "not-json"],
      env: { ...process.env, VALUATION_HASH_SALT: testSalt },
      temporaryPrefix: "sky-facebook-private-error-",
    }),
    (error) => /source\.jsonl:2: invalid JSON/.test(`${error.stderr}\n${error.message}`),
  );
});

test("requires a sufficiently long salt instead of writing reversible identifiers", async () => {
  const environment = { ...process.env };
  delete environment.VALUATION_HASH_SALT;
  await assert.rejects(
    runJsonlScript({
      script,
      lines: ['{"post_id":"one"}'],
      env: environment,
      temporaryPrefix: "sky-facebook-private-salt-",
    }),
    (error) => /VALUATION_HASH_SALT must be at least 32 characters/.test(`${error.stderr}\n${error.message}`),
  );
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

test("retains a complete numeric valuation predictor using the validator schema", () => {
  const output = prepareRow({
    post_id: "complete-predictor",
    group_id: "group-a",
    valuation_model: { ...valuationModel, untrusted_note: "do not export" },
  }, "fixture-salt-for-facebook-anonymization-32");
  assert.deepEqual(output.valuation_model, valuationModel);
});

test("omits the full predictor when any required value is missing, non-numeric, or out of bounds", () => {
  const invalidPredictors = [
    Object.fromEntries(Object.entries(valuationModel).filter(([key]) => key !== "packageHigh")),
    { ...valuationModel, packageLow: "250" },
    { ...valuationModel, bindingRisk: 1.01 },
    { ...valuationModel, transferHighMultiplier: 1.04 },
    { ...valuationModel, limitedLow: -1 },
  ];
  for (const predictor of invalidPredictors) {
    const output = prepareRow({ post_id: JSON.stringify(predictor), valuation_model: predictor }, "fixture-salt-for-facebook-anonymization-32");
    assert.equal(Object.hasOwn(output, "valuation_model"), false);
  }
});

test("never leaks private fields nested beside a valuation predictor", () => {
  const secret = "王小明的完整出售文案";
  const output = prepareRow({
    post_id: "private-predictor",
    group_id: "group-a",
    post_url: "https://facebook.example/private-post",
    author_name: "王小明",
    account_name: "私人帳號名",
    listing_text: secret,
    valuation_model: {
      ...valuationModel,
      listing_text: secret,
      author_name: "王小明",
      post_url: "https://facebook.example/private-post",
    },
  }, "fixture-salt-for-facebook-anonymization-32");
  assert.equal(JSON.stringify(output).includes(secret), false);
  assert.equal(JSON.stringify(output).includes("王小明"), false);
  assert.equal(JSON.stringify(output).includes("private-post"), false);
  assert.deepEqual(Object.keys(output.valuation_model), [...Object.keys(valuationModel)]);
});
