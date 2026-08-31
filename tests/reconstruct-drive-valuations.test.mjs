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
      content_base64: Buffer.from("星夜之傘", "utf8").toString("base64"),
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
    assert.ok(reconstructed[1].season_guid_count > 0);
    assert.ok(reconstructed.every((row) => !Reflect.has(row, "post_hash")));
    assert.ok(
      reconstructed.every((row) => row.document_hash.length === 16),
    );
    const report = JSON.parse(await readFile(summary, "utf8"));
    assert.equal(report.document_count, 2);
    assert.equal(report.by_price_kind_all_partial.ask.count, 1);
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
