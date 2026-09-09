import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { firstSeasonWithProgress, seasonProgressParts } from "../scripts/lib/valuation-source-core.mjs";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const work = new URL("../work/", import.meta.url);
const script = fileURLToPath(
  new URL("../scripts/reconstruct-drive-valuations.mjs", import.meta.url),
);

test("partial platform evidence changes scenarios without fabricating complete bindings", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const paths = ["documents", "market", "output", "summary"].map((label) => new URL(`bindings-${id}-${label}.jsonl`, work));
  const [documents, market, output, summary] = paths;
  const statements = ["", "GG可出｜NS不出", "GG無綁", "GG可出｜GG不出", "無綁", "綁全出嗎？", "GG、NS不出", "GG不出｜NS不出", "GG、NS不出｜GG可出", "GG NS不出"];
  try {
    await writeFile(documents, statements.map((statement, index) => JSON.stringify({ post_hash: String(index), content: `星夜之傘｜${statement}｜白蠟0｜愛心0｜昇華蠟0｜副卡0` })).join("\n"));
    await writeFile(market, statements.map((_, index) => JSON.stringify({ post_hash: String(index), price_twd: 3000, price_kind: "ask", season_progress: { enchantment: "3/3" } })).join("\n"));
    await execFileAsync(process.execPath, [script, "--documents", fileURLToPath(documents), "--market", fileURLToPath(market), "--out", fileURLToPath(output), "--summary", fileURLToPath(summary)], { cwd: root });
    const rows = (await readFile(output, "utf8")).trim().split(/\r?\n/u).map(JSON.parse);
    assert.deepEqual(rows[1].binding_values, { google: "transfer", nintendo: "keep" });
    assert.ok(rows[1].estimate_envelope.high < rows[0].estimate_envelope.high);
    assert.deepEqual(rows[2].binding_values, { google: "none" });
    assert.deepEqual(rows[3].binding_values, {});
    assert.deepEqual(rows[3].binding_conflicts, ["google"]);
    assert.deepEqual(rows[3].estimate_envelope, rows[0].estimate_envelope);
    for (const row of rows.slice(1, 4)) {
      assert.equal(row.binding_evidence, null);
      assert.equal(row.model_features_ready, false);
      assert.ok(row.missing_fields.includes("bindings"));
    }
    assert.equal(rows[4].binding_evidence, "none");
    assert.equal(rows[5].binding_evidence, null);
    assert.deepEqual(rows[5].estimate_envelope, rows[0].estimate_envelope);
    assert.deepEqual(rows[6].binding_values, { google: "keep", nintendo: "keep" });
    assert.deepEqual(rows[6].estimate_envelope, rows[7].estimate_envelope);
    assert.deepEqual(rows[9].estimate_envelope, rows[7].estimate_envelope);
    assert.deepEqual(rows[9].binding_values, rows[7].binding_values);
    assert.ok(rows[6].estimate_envelope.high < rows[0].estimate_envelope.high);
    assert.equal(rows[6].binding_evidence, null);
    assert.equal(rows[6].model_features_ready, false);
    assert.ok(rows[6].missing_fields.includes("bindings"));
    assert.deepEqual(rows[8].binding_values, { nintendo: "keep" });
    assert.deepEqual(rows[8].binding_conflicts, ["google"]);
  } finally {
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
});

test("closed resource intervals replay both endpoints without becoming exact evidence", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const paths = ["documents", "market", "output", "summary"].map((label) => new URL(`resources-${id}-${label}.jsonl`, work));
  const [documents, market, output, summary] = paths;
  const amounts = ["200～2000", "200", "2000", "200+", "約200", "2000～200", "0"];
  try {
    await writeFile(documents, amounts.map((amount, index) => JSON.stringify({ post_hash: String(index), content: `星夜之傘｜無綁｜白蠟${amount}｜愛心0｜昇華蠟0｜副卡0` })).join("\n"));
    await writeFile(market, amounts.map((_, index) => JSON.stringify({ post_hash: String(index), price_twd: 3000, price_kind: "ask", season_progress: { enchantment: "3/3" } })).join("\n"));
    await execFileAsync(process.execPath, [script, "--documents", fileURLToPath(documents), "--market", fileURLToPath(market), "--out", fileURLToPath(output), "--summary", fileURLToPath(summary)], { cwd: root });
    const rows = (await readFile(output, "utf8")).trim().split(/\r?\n/u).map(JSON.parse);
    const [ranged, low, high] = rows;
    assert.equal(ranged.estimate_envelope.low, low.estimate_envelope.low);
    assert.equal(ranged.estimate_envelope.high, high.estimate_envelope.high);
    assert.equal(ranged.estimate_envelope.midpoint_low, low.estimate_envelope.midpoint_low);
    assert.equal(ranged.estimate_envelope.midpoint_high, high.estimate_envelope.midpoint_high);
    assert.ok(high.estimate_envelope.high > low.estimate_envelope.high);
    assert.equal(ranged.resource_values.candles, undefined);
    assert.equal(ranged.model_features_ready, false);
    assert.ok(ranged.missing_fields.includes("resources"));
    for (const row of rows.slice(3, 6)) {
      assert.equal(row.resource_estimate_inputs.low.candles, undefined);
      assert.deepEqual(row.estimate_envelope, rows[6].estimate_envelope);
    }
  } finally {
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
});

test("gifted-account inventory stays diagnostic instead of raising the main starting season", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const paths = ["documents", "market", "output", "summary"].map((label) =>
    new URL(`gift-context-${id}-${label}.jsonl`, work));
  const [documents, market, output, summary] = paths;
  try {
    await writeFile(documents, JSON.stringify({ post_hash: "gift-fixture", content: "星夜之傘\n贈號上數據\n追光大傘\n\n無綁｜白蠟0｜愛心0｜昇華蠟0｜副卡0" }));
    await writeFile(market, JSON.stringify({ post_hash: "gift-fixture", price_twd: 3000, price_kind: "ask", paid_package_count: 1, confirmed_owned_guids: ["OAGgi-B-xa"] }));
    await execFileAsync(process.execPath, [script, "--documents", fileURLToPath(documents), "--market", fileURLToPath(market), "--out", fileURLToPath(output), "--summary", fileURLToPath(summary)], { cwd: root });
    const row = JSON.parse((await readFile(output, "utf8")).trim());
    assert.deepEqual(row.owned_guids, ["OAGgi-B-xa"]);
    assert.deepEqual(row.separate_account_guids, ["2o3CEU9QhM"]);
    assert.notEqual(row.reconstructed_start_season_slug, "lightseekers");
    assert.equal(row.model_features_ready, false);
    assert.ok(row.estimate_envelope);
    assert.equal(row.exclude_from_model, false);
  } finally {
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
});

test("replays private listings without inventing partial-season GUIDs", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const documents = new URL(`reconstruct-${id}-documents.jsonl`, work);
  const market = new URL(`reconstruct-${id}-market.jsonl`, work);
  const output = new URL(`reconstruct-${id}-output.jsonl`, work);
  const summary = new URL(`reconstruct-${id}-summary.json`, work);
  const rows = [
    {
      post_hash: "private-partial-season-id",
      content_base64: Buffer.from("星夜之傘｜無綁｜白蠟 0｜愛心 0｜昇華蠟 0｜副卡 0", "utf8").toString("base64"),
    },
    {
      post_hash: "private-complete-season-id",
      content_base64: Buffer.from("", "utf8").toString("base64"),
    },
  ];
  const prices = [
    {
      post_hash: "private-partial-season-id",
      price_kind: "ask",
      price_twd_low: 3000,
      price_twd_high: 3500,
      paid_package_count: 1,
      confirmed_owned_guids: ["OAGgi-B-xa"],
      season_progress: { prophecy: "1/3" },
    },
    {
      post_hash: "private-complete-season-id",
      price_kind: "quick_sale",
      price_twd: 4000,
      paid_package_count: null,
      season_progress: { prophecy: "3/3" },
    },
  ];
  rows.push({ ...rows[0], post_hash: "private-excluded-bundle-id" });
  prices.push({
    ...prices[0],
    post_hash: "private-excluded-bundle-id",
    exclude_from_model: true,
    price_twd_low: 115000,
    price_twd_high: 115000,
  });
  rows.push({
    post_hash: "private-partial-resource-id",
    content: "星夜之傘｜無綁｜白蠟 1000",
  });
  prices.push({ ...prices[0], post_hash: "private-partial-resource-id" });
  rows.push({
    post_hash: "private-range-resource-id",
    content: "星夜之傘｜無綁｜白蠟 1000+｜愛心 約100｜昇華蠟20～30｜副卡0",
  });
  prices.push({ ...prices[0], post_hash: "private-range-resource-id", paid_package_count: null, paid_package_min: 2, paid_package_max: 4 });
  const progressCases = [
    [{ selected: 3, expected: 3 }, true],
    [{ selected: "3", expected: "3" }, true],
    ["full", true],
    [{ selected: 1, expected: 3 }, false],
    [{ selected: 0, expected: 3 }, false],
    [{ selected: 0, expected: 0 }, false],
    [{ selected: 4, expected: 3 }, false],
    [{ selected: true, expected: true }, false],
    ["start", false],
  ];
  const invalidPrices = [
    { price_twd: 0 }, { price_twd: -1 }, { price_twd: true },
    { price_twd: "4000元" }, { price_twd_low: 4000 },
    { price_twd_high: 4000 }, { price_twd_low: 5000, price_twd_high: 4000 },
    { price_twd_low: [3000], price_twd_high: true }, {},
  ];
  for (const [index, [progress]] of progressCases.entries()) {
    const post_hash = `progress-format-${index}`;
    rows.push({ post_hash, content: "" });
    prices.push({ post_hash, season_progress: { prophecy: progress },
      ...invalidPrices[index],
      ...(index === 0 ? { paid_package_min: 100 } : index === 1 ? { paid_package_min: 80, paid_package_max: 60 } : index === 2 ? { paid_package_min: "60" } : {}),
    });
  }
  for (const price of [{ price_twd: " 4000 " }, { price_twd_low: "3000", price_twd_high: "3500" }]) {
    const post_hash = `numeric-text-${rows.length}`;
    rows.push({ ...rows[0], post_hash });
    prices.push({ ...prices[0], ...price, post_hash });
  }
  rows.push({ ...rows[0], post_hash: "start-conflict", content: "星夜之傘｜追光大傘｜無綁｜白蠟0｜愛心0｜昇華蠟0｜副卡0" });
  prices.push({ ...prices[0], post_hash: "start-conflict", start_season_slug: "rhythm", season_progress: {}, confirmed_owned_guids: ["OAGgi-B-xa", "2o3CEU9QhM"] });
  try {
    await Promise.all([
      writeFile(
        documents,
        `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      ),
      writeFile(
        market,
        `${prices.map((row) => JSON.stringify(row)).join("\n")}\n`,
      ),
    ]);
    await execFileAsync(
      process.execPath,
      [
        script,
        "--documents",
        fileURLToPath(documents),
        "--market",
        fileURLToPath(market),
        "--out",
        fileURLToPath(output),
        "--summary",
        fileURLToPath(summary),
      ],
      { cwd: root },
    );
    const reconstructed = (await readFile(output, "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map(JSON.parse);
    assert.equal(reconstructed[0].season_guid_count, 0);
    assert.equal(reconstructed[0].exact_text_guid_count, 1);
    assert.equal(reconstructed[0].binding_evidence, "none");
    assert.deepEqual(reconstructed[0].resource_fields.sort(), [
      "ascended",
      "candles",
      "hearts",
      "passes",
    ]);
    assert.equal(reconstructed[0].inventory_complete, true);
    assert.equal(reconstructed[0].model_features_ready, true);
    assert.ok(reconstructed[0].valuation_model);
    assert.ok(reconstructed[1].season_guid_count > 0);
    assert.equal(reconstructed[1].price_twd_low, 4000);
    assert.equal(reconstructed[1].price_twd_high, 4000);
    assert.deepEqual(reconstructed.slice(-3, -1).map(row => [row.price_twd_low, row.price_twd_high]), [[4000, 4000], [3000, 3500]]);
    const conflict = reconstructed.at(-1);
    assert.equal(conflict.reconstructed_start_season_slug, "lightseekers");
    assert.equal(conflict.start_season_conflict, true);
    assert.equal(conflict.inventory_complete, true);
    assert.equal(conflict.model_features_ready, false);
    assert.equal(conflict.valuation_model, undefined);
    assert.ok(conflict.estimate_envelope);
    assert.equal(reconstructed[0].start_season_conflict, null);
    assert.equal(typeof reconstructed[1].listing_overlaps_estimate, "boolean");
    assert.ok(Number.isFinite(reconstructed[1].listing_interval_gap));
    for (const [index, [, complete]] of progressCases.entries()) {
      const actual = reconstructed[5 + index];
      assert.deepEqual(actual.owned_guids, complete ? reconstructed[1].owned_guids : []);
      assert.deepEqual(actual.estimate_envelope, complete ? reconstructed[1].estimate_envelope : null);
      assert.equal(actual.model_features_ready, false);
      assert.equal(actual.comparison_class, "no-price");
      assert.equal(actual.listing_overlaps_estimate, null);
      assert.equal(actual.listing_interval_gap, null);
      assert.deepEqual(actual.declared_paid_range, index === 0 ? { min: 100, max: null } : null);
      assert.deepEqual(actual.unresolved_declared_paid_range, index === 0 ? { min: 100, max: null } : null);
    }
    const excluded = reconstructed[2];
    assert.equal(excluded.exclude_from_model, true);
    assert.equal(excluded.inventory_complete, true);
    assert.equal(excluded.model_features_ready, false);
    assert.equal(excluded.valuation_model, undefined);
    assert.equal(excluded.comparison_class, "excluded");
    assert.equal(excluded.listing_overlaps_estimate, null);
    assert.equal(excluded.listing_interval_gap, null);
    assert.deepEqual(excluded.owned_guids, reconstructed[0].owned_guids);
    assert.equal(excluded.price_twd_low, 115000);
    const partialResources = reconstructed[3];
    assert.deepEqual(partialResources.resource_fields, ["candles"]);
    assert.deepEqual(partialResources.resource_values, { candles: 1000 });
    assert.equal(partialResources.model_features_ready, false);
    assert.ok(partialResources.missing_fields.includes("resources"));
    assert.ok(partialResources.estimate_envelope.midpoint_high > reconstructed[0].estimate_envelope.midpoint_high);
    const rangedResources = reconstructed[4];
    assert.deepEqual(rangedResources.resource_values, { passes: 0 });
    assert.deepEqual(rangedResources.resource_ranges, { candles: { min: 1000, max: null }, ascended: { min: 20, max: 30 } });
    assert.deepEqual(rangedResources.resource_approximations, { hearts: 100 });
    assert.equal(rangedResources.model_features_ready, false);
    assert.deepEqual(rangedResources.declared_paid_range, { min: 2, max: 4 });
    assert.deepEqual(rangedResources.unresolved_declared_paid_range, { min: 1, max: 3 });
    assert.equal(rangedResources.declared_paid_count, null);
    assert.equal(rangedResources.paid_coverage, null);
    assert.equal(rangedResources.inventory_complete, false);
    assert.equal(reconstructed[0].declared_paid_range, null);
    assert.deepEqual(rangedResources.resource_estimate_inputs, { low: { ascended: 20, passes: 0 }, high: { ascended: 30, passes: 0 } });
    assert.ok(rangedResources.estimate_envelope.low >= reconstructed[0].estimate_envelope.low);
    assert.ok(rangedResources.missing_fields.includes("resources"));
    assert.deepEqual(reconstructed[1].missing_fields.sort(), [
      "bindings",
      "inventory",
      "resources",
    ]);
    assert.ok(reconstructed.every((row) => !Reflect.has(row, "post_hash")));
    assert.ok(
      reconstructed.every((row) => row.document_hash.length === 16),
    );
    const report = JSON.parse(await readFile(summary, "utf8"));
    assert.deepEqual(report.input_sources, {
      documents_sha256: createHash("sha256").update(await readFile(documents, "utf8")).digest("hex"),
      market_sha256: createHash("sha256").update(await readFile(market, "utf8")).digest("hex"),
      market_row_count: prices.length,
    });
    assert.equal(report.document_count, 8 + progressCases.length);
    assert.equal(report.priced_document_count, 8);
    assert.equal(report.comparable_document_count, 7);
    assert.deepEqual(report.start_season_consistency, { matching: 0, conflicting: 1, unknown: 6 });
    assert.equal(report.excluded_document_count, 1);
    assert.equal(report.all_partial_reconstructions.count, 7);
    assert.equal(report.evidence_completeness.priced_documents.count, 8);
    assert.equal(report.evidence_completeness.comparable_documents.count, 7);
    assert.equal(
      report.evidence_completeness.priced_documents.model_features_ready,
      3,
    );
    assert.equal(report.by_price_kind_all_partial.ask.count, 6);
    assert.equal(report.by_price_kind_all_partial.quick_sale.count, 1);
  } finally {
    await Promise.all(
      [documents, market, output, summary].map((file) =>
        rm(file, { force: true }),
      ),
    );
  }
});

test("structured progress does not coerce missing fields or booleans into graduation", () => {
  for (const value of [
    { selected: true, expected: true },
    { selected: null, expected: 3 },
    { selected: "", expected: 3 },
    { selected: 3 },
    { selected: Number.MAX_SAFE_INTEGER + 1, expected: Number.MAX_SAFE_INTEGER + 1 },
    [],
  ]) {
    assert.equal(seasonProgressParts(value), null);
    assert.equal(firstSeasonWithProgress({ prophecy: value }), null);
  }
  assert.deepEqual(seasonProgressParts({ selected: "1", expected: "3" }), { selected: 1, expected: 3 });
  assert.equal(firstSeasonWithProgress({ prophecy: { selected: 1, expected: 3 } }), "prophecy");
});

test("refuses to write reconstructed private data outside work", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [script, "--market", "work/test-market.jsonl", "--out", "tests/private-leak.jsonl"],
      { cwd: root },
    ),
    /private work directory/u,
  );
});

test("requires an explicit market source instead of silently replaying old prices", async () => {
  for (const args of [[], ["--market"], ["--market", ""], ["--market", "--out", "work/unused.jsonl"]]) {
    await assert.rejects(
      execFileAsync(process.execPath, [script, ...args], { cwd: root }),
      /--market requires an explicit file path/u,
    );
  }
});
