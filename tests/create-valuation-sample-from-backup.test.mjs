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

test("creates a private replayable predictor from a complete backup", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-sample-${id}.json`, work);
  const outputPath = new URL(`valuation-sample-${id}.jsonl`, work);
  const backup = {
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
  };
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await execFileAsync(process.execPath, [
      script,
      "--backup", fileURLToPath(backupPath),
      "--price-twd", "3500",
      "--evidence-kind", "professional_estimate",
      "--observed-at", "2026-09-05T00:00:00.000Z",
      "--out", fileURLToPath(outputPath),
    ], commandOptions);
    const row = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(row.source, "manual_backup");
    assert.equal(row.price_twd, 3500);
    assert.equal(row.evidence_kind, "professional_estimate");
    assert.equal(row.start_season_slug, "moments");
    assert.equal(row.post_hash.length, 64);
    assert.equal(row.account_fingerprint.length, 64);
    assert.ok(valuationModelInputKeys.every((key) => Number.isFinite(row.valuation_model[key])));
    assert.ok(!JSON.stringify(row).includes("must not leak"));
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
  const backup = {
    format: "sky-recognition-wiki",
    version: 3,
    exportedAt: "2026-09-05T00:00:00.000Z",
    account: { bindingsConfirmed: false },
    bindings: {},
    owned: ["W-3Nh_yWGv"],
    items: [],
  };
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        script,
        "--backup", fileURLToPath(backupPath),
        "--price-twd", "3500",
        "--out", fileURLToPath(outputPath),
      ], commandOptions),
      /must be explicitly confirmed/u,
    );
  } finally {
    await Promise.all([backupPath, outputPath].map((file) => rm(file, { force: true })));
  }
});
