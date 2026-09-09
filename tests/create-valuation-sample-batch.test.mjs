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
  new URL("../scripts/create-valuation-sample-batch.mjs", import.meta.url),
);
const commandOptions = {
  cwd: root,
  env: {
    ...process.env,
    VALUATION_HASH_SALT: "batch-test-valuation-salt-32-characters-minimum",
  },
};
const completeBackup = () => ({
  format: "sky-recognition-wiki",
  version: 4,
  account: {
    name: "private",
    accountType: "有翼",
    bindingsConfirmed: true,
    wardrobeConfirmed: true,
    identityId: "123e4567-e89b-42d3-a456-426614174000",
    candles: "900",
    hearts: "100",
    ascended: "90",
    passes: "0",
    bindingNote: "",
    notes: "",
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

test("converts a private manifest into complete signed samples", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`batch-${id}-backup.json`, work);
  const manifestPath = new URL(`batch-${id}-manifest.jsonl`, work);
  const outputPath = new URL(`batch-${id}-samples.jsonl`, work);
  try {
    await writeFile(backupPath, JSON.stringify(completeBackup()), "utf8");
    await writeFile(manifestPath, `${JSON.stringify({
      backup: fileURLToPath(backupPath),
      price_twd: 3500,
      group_id: "professional-a",
      observed_at: "2026-09-06T00:00:00.000Z",
    })}\n`, "utf8");
    const { stdout } = await execFileAsync(process.execPath, [
      script,
      "--manifest", fileURLToPath(manifestPath),
      "--out", fileURLToPath(outputPath),
    ], commandOptions);
    const summary = JSON.parse(stdout);
    const sample = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(summary.samples, 1);
    assert.equal(summary.completePredictors, 1);
    assert.deepEqual(summary.countsByStartSeason, { moments: 1 });
    assert.equal(sample.inventory_complete, true);
    assert.equal(sample.bindings_complete, true);
    assert.equal(sample.valuation_model_schema_version, 5);
    assert.equal(sample.evidence_signature.length, 64);
  } finally {
    await Promise.all(
      [backupPath, manifestPath, outputPath].map((path) => rm(path, { force: true })),
    );
  }
});

test("rejects an incomplete manifest without leaving partial output", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const manifestPath = new URL(`batch-${id}-bad-manifest.jsonl`, work);
  const outputPath = new URL(`batch-${id}-bad-samples.jsonl`, work);
  try {
    await writeFile(manifestPath, `${JSON.stringify({
      backup: "missing.json",
      price_twd: 3500,
      observed_at: "2026-09-06T00:00:00.000Z",
    })}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--manifest", fileURLToPath(manifestPath),
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /requires group_id/u,
    );
    await assert.rejects(readFile(outputPath, "utf8"), { code: "ENOENT" });
  } finally {
    await Promise.all(
      [manifestPath, outputPath].map((path) => rm(path, { force: true })),
    );
  }
});

test("rejects duplicate inventory snapshots in one batch", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`batch-${id}-duplicate-backup.json`, work);
  const manifestPath = new URL(`batch-${id}-duplicate-manifest.jsonl`, work);
  const outputPath = new URL(`batch-${id}-duplicate-samples.jsonl`, work);
  const entry = {
    backup: fileURLToPath(backupPath),
    price_twd: 3500,
    group_id: "professional-a",
    observed_at: "2026-09-06T00:00:00.000Z",
  };
  try {
    await writeFile(backupPath, JSON.stringify(completeBackup()), "utf8");
    await writeFile(
      manifestPath,
      `${JSON.stringify(entry)}\n${JSON.stringify({
        ...entry,
        price_twd: 3600,
        observed_at: "2026-09-06T01:00:00.000Z",
      })}\n`,
      "utf8",
    );
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--manifest", fileURLToPath(manifestPath),
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /duplicate inventory snapshots/u,
    );
    await assert.rejects(readFile(outputPath, "utf8"), { code: "ENOENT" });
  } finally {
    await Promise.all(
      [backupPath, manifestPath, outputPath].map((path) => rm(path, { force: true })),
    );
  }
});

test("never overwrites the input manifest", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const manifestPath = new URL(`batch-${id}-same-path.jsonl`, work);
  const original = `${JSON.stringify({
    backup: "missing.json",
    price_twd: 3500,
    group_id: "professional-a",
    observed_at: "2026-09-06T00:00:00.000Z",
  })}\n`;
  try {
    await writeFile(manifestPath, original, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--manifest", fileURLToPath(manifestPath),
        "--out", fileURLToPath(manifestPath),
      ], commandOptions),
      /must not overwrite the input manifest/u,
    );
    assert.equal(await readFile(manifestPath, "utf8"), original);
  } finally {
    await rm(manifestPath, { force: true });
  }
});
