import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { valuationModelInputKeys } from "../app/valuation-model-core.js";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const work = new URL("../work/", import.meta.url);
const script = fileURLToPath(
  new URL("../scripts/create-valuation-sample-from-backup.mjs", import.meta.url),
);
const commandOptions = {
  cwd: root,
  env: {
    ...process.env,
    VALUATION_HASH_SALT: "test-only-valuation-salt-32-characters-minimum",
  },
};
const requiredEvidenceArgs = [
  "--account-id", "123e4567-e89b-42d3-a456-426614174000",
  "--inventory-complete", "yes",
];
const completeBackup = () => ({
  format: "sky-recognition-wiki",
  version: 3,
  exportedAt: "2026-09-05T00:00:00.000Z",
  account: {
    name: "must not leak",
    accountType: "有翼",
    bindingsConfirmed: true,
    candles: "900",
    hearts: "100",
    ascended: "90",
    passes: "0",
    bindingNote: "must not leak",
    notes: "must not leak",
  },
  bindings: {
    google: "none",
    nintendo: "none",
    gameCenter: "none",
    facebook: "none",
    steam: "none",
    twitch: "none",
    playstation: "none",
  },
  owned: ["W-3Nh_yWGv"],
  items: [],
});

test("creates a private replayable predictor from a complete backup", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-sample-${id}.json`, work);
  const outputPath = new URL(`valuation-sample-${id}.jsonl`, work);
  const backup = completeBackup();
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await execFileAsync(process.execPath, [
      script,
      "--backup", fileURLToPath(backupPath),
      "--price-twd", "3500",
      ...requiredEvidenceArgs,
      "--evidence-kind", "professional_estimate",
      "--observed-at", "2026-09-05T00:00:00.000Z",
      "--out", fileURLToPath(outputPath),
    ], commandOptions);
    const row = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(row.source, "manual_backup");
    assert.equal(row.price_twd, 3500);
    assert.equal(row.evidence_kind, "professional_estimate");
    assert.equal(row.start_season_slug, "moments");
    assert.equal(
      row.season_progress_end_slug,
      Object.keys(row.season_progress).at(-1),
    );
    assert.equal(row.post_hash.length, 64);
    assert.equal(row.account_fingerprint.length, 64);
    assert.equal(row.account_identity_scheme, "stable-hmac-v1");
    assert.equal(row.identity_namespace.length, 64);
    assert.equal(row.snapshot_hash.length, 64);
    assert.equal(row.inventory_complete, true);
    assert.equal(row.bindings_complete, true);
    assert.equal(row.valuation_model_schema_version, 3);
    assert.deepEqual(row.model_evidence.bindings, backup.bindings);
    assert.deepEqual(row.model_evidence.resources, {
      candles: 900,
      hearts: 100,
      ascended: 90,
      passes: 0,
    });
    assert.match(row.evidence_signature, /^[a-f0-9]{64}$/u);
    assert.ok(valuationModelInputKeys.every((key) => Number.isFinite(row.valuation_model[key])));
    assert.ok(!JSON.stringify(row).includes("must not leak"));
    assert.ok(!JSON.stringify(row).includes("123e4567-e89b-42d3-a456-426614174000"));
  } finally {
    await Promise.all([backupPath, outputPath].map((file) => rm(file, { force: true })));
  }
});

test("rejects a backup with any unconfirmed resource field", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-missing-resource-${id}.json`, work);
  const outputPath = new URL(`valuation-missing-resource-${id}.jsonl`, work);
  const backup = completeBackup();
  backup.account.passes = "";
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--backup", fileURLToPath(backupPath),
        "--price-twd", "3500",
        ...requiredEvidenceArgs,
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /resources must be explicitly confirmed: passes/u,
    );
  } finally {
    await Promise.all([backupPath, outputPath].map((file) => rm(file, { force: true })));
  }
});

test("keeps private output inside work", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      script,
      "--backup", "missing.json",
      "--price-twd", "3500",
      ...requiredEvidenceArgs,
      "--out", "tests/private-sample.jsonl",
    ], commandOptions),
    /inside work/u,
  );
});

test("requires explicitly confirmed binding states", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-unconfirmed-${id}.json`, work);
  const outputPath = new URL(`valuation-unconfirmed-${id}.jsonl`, work);
  const backup = completeBackup();
  backup.account.bindingsConfirmed = false;
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--backup", fileURLToPath(backupPath),
        "--price-twd", "3500",
        ...requiredEvidenceArgs,
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /must be explicitly confirmed/u,
    );
  } finally {
    await Promise.all([backupPath, outputPath].map((file) => rm(file, { force: true })));
  }
});

test("requires explicit full-wardrobe confirmation and a stable private account id", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      script,
      "--backup", "missing.json",
      "--price-twd", "3500",
      "--inventory-complete", "yes",
    ], commandOptions),
    /--account-id/u,
  );
  await assert.rejects(
    execFileAsync(process.execPath, [
      script,
      "--backup", "missing.json",
      "--price-twd", "3500",
      "--account-id", "123e4567-e89b-42d3-a456-426614174000",
    ], commandOptions),
    /--inventory-complete yes/u,
  );
});

test("rejects a confirmed backup when any current binding key is absent or invalid", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-missing-binding-${id}.json`, work);
  const outputPath = new URL(`valuation-missing-binding-${id}.jsonl`, work);
  const backup = completeBackup();
  delete backup.bindings.playstation;
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--backup", fileURLToPath(backupPath),
        "--price-twd", "3500",
        ...requiredEvidenceArgs,
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /every binding state: playstation/u,
    );
    backup.bindings.playstation = "unknown";
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--backup", fileURLToPath(backupPath),
        "--price-twd", "3500",
        ...requiredEvidenceArgs,
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /every binding state: playstation/u,
    );
  } finally {
    await Promise.all([backupPath, outputPath].map((file) => rm(file, { force: true })));
  }
});

test("keeps one anonymous account identity across changing snapshots", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const firstBackupPath = new URL(`valuation-stable-first-${id}.json`, work);
  const secondBackupPath = new URL(`valuation-stable-second-${id}.json`, work);
  const firstOutputPath = new URL(`valuation-stable-first-${id}.jsonl`, work);
  const secondOutputPath = new URL(`valuation-stable-second-${id}.jsonl`, work);
  const firstBackup = completeBackup();
  const secondBackup = completeBackup();
  secondBackup.account.candles = "901";
  const run = (backupPath, outputPath, accountId) => execFileAsync(process.execPath, [
    script,
    "--backup", fileURLToPath(backupPath),
    "--price-twd", "3500",
    "--account-id", accountId,
    "--inventory-complete", "yes",
    "--observed-at", "2026-09-05T00:00:00.000Z",
    "--out", fileURLToPath(outputPath),
  ], commandOptions);
  try {
    await Promise.all([
      writeFile(firstBackupPath, `${JSON.stringify(firstBackup)}\n`, "utf8"),
      writeFile(secondBackupPath, `${JSON.stringify(secondBackup)}\n`, "utf8"),
    ]);
    await run(
      firstBackupPath,
      firstOutputPath,
      "123e4567-e89b-42d3-a456-426614174000",
    );
    await run(
      secondBackupPath,
      secondOutputPath,
      "123E4567-E89B-42D3-A456-426614174000",
    );
    const [first, second] = await Promise.all(
      [firstOutputPath, secondOutputPath].map(async (file) =>
        JSON.parse(await readFile(file, "utf8"))),
    );
    assert.equal(first.account_fingerprint, second.account_fingerprint);
    assert.notEqual(first.snapshot_hash, second.snapshot_hash);
  } finally {
    await Promise.all(
      [firstBackupPath, secondBackupPath, firstOutputPath, secondOutputPath]
        .map((file) => rm(file, { force: true })),
    );
  }
});
