import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const work = new URL("../work/", import.meta.url);
const script = fileURLToPath(
  new URL("../scripts/reconstruct-drive-valuations.mjs", import.meta.url),
);

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
      price_twd_low: 4000,
      price_twd_high: 4000,
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
    assert.equal(report.document_count, 4);
    assert.equal(report.priced_document_count, 4);
    assert.equal(report.comparable_document_count, 3);
    assert.equal(report.excluded_document_count, 1);
    assert.equal(report.all_partial_reconstructions.count, 3);
    assert.equal(report.evidence_completeness.priced_documents.count, 4);
    assert.equal(report.evidence_completeness.comparable_documents.count, 3);
    assert.equal(
      report.evidence_completeness.priced_documents.model_features_ready,
      1,
    );
    assert.equal(report.by_price_kind_all_partial.ask.count, 2);
    assert.equal(report.by_price_kind_all_partial.quick_sale.count, 1);
  } finally {
    await Promise.all(
      [documents, market, output, summary].map((file) =>
        rm(file, { force: true }),
      ),
    );
  }
});

test("refuses to write reconstructed private data outside work", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [script, "--out", "tests/private-leak.jsonl"],
      { cwd: root },
    ),
    /private work directory/u,
  );
});
