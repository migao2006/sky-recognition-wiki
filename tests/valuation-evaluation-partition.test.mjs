import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  partitionEvaluationRows,
  runPartitionCli,
} from "../scripts/partition-valuation-evaluation.mjs";

const hash = (character) => character.repeat(64);

test("moves an evaluation account and all linked reposts out of calibration", () => {
  const account = hash("a");
  const rows = [
    { account_fingerprint: account, account_identity_scheme: "stable-hmac-v1", price_twd: 1000 },
    { post_hash: "repost-1", account_hash: account, price_twd: 1100 },
    { post_hash: "repost-1", snapshot_hash: hash("b"), price_twd: 1200 },
    { snapshot_hash: hash("b"), post_hash: "repost-2", price_twd: 1300 },
    { post_hash: "unrelated", price_twd: 1400 },
  ];
  const evaluationRows = [{ account_fingerprint: account, account_identity_scheme: "stable-hmac-v1" }];

  const result = partitionEvaluationRows(rows, evaluationRows);

  assert.deepEqual(result.evaluation, rows.slice(0, 4));
  assert.deepEqual(result.calibration, [rows[4]]);
});

test("keeps account, post, and snapshot identity namespaces separate", () => {
  const rows = [
    { account_hash: "same-value" },
    { post_hash: "same-value" },
    { snapshot_hash: hash("c") },
    { snapshot_hash: "not-a-snapshot" },
  ];

  const byAccount = partitionEvaluationRows(rows, [{ account_hash: "same-value" }]);
  assert.deepEqual(byAccount.evaluation, [rows[0]]);
  assert.deepEqual(byAccount.calibration, rows.slice(1));

  const bySnapshot = partitionEvaluationRows(rows, [{ snapshot_hash: hash("c").toUpperCase() }]);
  assert.deepEqual(bySnapshot.evaluation, [rows[2]]);
  assert.deepEqual(bySnapshot.calibration, [rows[0], rows[1], rows[3]]);
});

test("never uses prices or names as evaluation identities and does not mutate rows", () => {
  const rows = [
    { name: "same player", price_twd: 5000 },
    { name: "same player", price_twd: 5000, post_hash: "identified" },
  ];
  const originals = structuredClone(rows);

  const result = partitionEvaluationRows(rows, [{ name: "same player", price_twd: 5000, post_hash: "identified" }]);

  assert.deepEqual(result.evaluation, [rows[1]]);
  assert.deepEqual(result.calibration, [rows[0]]);
  assert.deepEqual(rows, originals);
});

test("rejects evaluation references with no usable identity", () => {
  assert.throws(
    () => partitionEvaluationRows([{ post_hash: "safe" }], [{ name: "only-name", price_twd: 5000, snapshot_hash: "bad" }]),
    /requires an account, post, or valid snapshot identity/u,
  );
});

test("rejects references that do not match any source row", () => {
  assert.throws(
    () => partitionEvaluationRows([{ post_hash: "source-post" }], [{ post_hash: "mistyped-post" }]),
    /does not match a source row by identity/u,
  );
});

test("does not treat placeholder values as identities", () => {
  assert.throws(
    () => partitionEvaluationRows([{ post_hash: "source-post" }], [{ account_hash: "N/A", post_hash: "unknown", snapshot_hash: "-" }]),
    /requires an account, post, or valid snapshot identity/u,
  );
});

test("includes every account and post alias in the transitive closure", () => {
  const rows = [
    { account_group_hash: "account-group", account_hash: "account-alias" },
    { account_fingerprint: "account-alias", post_hash: "post-primary" },
    { post_fingerprint: "post-primary", post_hash: "post-copy" },
    { post_hash: "unrelated" },
  ];
  const evaluationRows = [{ account_fingerprint: "account-group", account_identity_scheme: "stable-hmac-v1" }];

  const result = partitionEvaluationRows(rows, evaluationRows);

  assert.deepEqual(result.evaluation, rows.slice(0, 3));
  assert.deepEqual(result.calibration, [rows[3]]);
});

test("CLI writes only partition rows and count-only summary to a private output directory", async () => {
  const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "valuation-partition-"));
  const outputDirectory = resolve(process.cwd(), "work", `valuation-partition-test-${Date.now()}`);
  const sourcePath = resolve(fixtureDirectory, "source.jsonl");
  const evaluationPath = resolve(fixtureDirectory, "evaluation.jsonl");
  try {
    await writeFile(sourcePath, `${JSON.stringify({ post_hash: "evaluation-post" })}\n${JSON.stringify({ post_hash: "calibration-post" })}\n`, "utf8");
    await writeFile(evaluationPath, `${JSON.stringify({ post_hash: "evaluation-post" })}\n`, "utf8");

    const summary = await runPartitionCli([
      `--evaluation=${evaluationPath}`,
      `--out=${outputDirectory}`,
      sourcePath,
    ]);

    assert.deepEqual(summary, {
      sourceRows: 2,
      evaluationReferenceRows: 1,
      calibrationRows: 1,
      evaluationRows: 1,
    });
    assert.deepEqual(
      (await readFile(resolve(outputDirectory, "summary.json"), "utf8")).includes("evaluation-post"),
      false,
    );
    assert.deepEqual(
      JSON.parse(await readFile(resolve(outputDirectory, "evaluation.jsonl"), "utf8")),
      { post_hash: "evaluation-post" },
    );
  } finally {
    await Promise.all([
      rm(fixtureDirectory, { recursive: true, force: true }),
      rm(outputDirectory, { recursive: true, force: true }),
    ]);
  }
});
