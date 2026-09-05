import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const work = new URL("../work/", import.meta.url);
const creator = fileURLToPath(
  new URL("../scripts/create-valuation-sample-from-backup.mjs", import.meta.url),
);
const auditor = fileURLToPath(
  new URL("../scripts/audit-valuation-source.mjs", import.meta.url),
);
const validator = fileURLToPath(
  new URL("../scripts/validate-valuation-model.mjs", import.meta.url),
);
const baselinePath = fileURLToPath(
  new URL("../app/valuation-market-aggregate.json", import.meta.url),
);
const commandOptions = {
  cwd: root,
  env: {
    ...process.env,
    VALUATION_HASH_SALT: "pipeline-test-valuation-salt-32-characters-minimum",
  },
};

test("keeps complete evidence consistent from backup through audit and validation", async () => {
  await mkdir(work, { recursive: true });
  const id = randomUUID();
  const backupPath = new URL(`valuation-pipeline-${id}.json`, work);
  const samplePath = new URL(`valuation-pipeline-${id}.jsonl`, work);
  const candidatePath = new URL(`valuation-pipeline-${id}-candidate.json`, work);
  const backup = {
    format: "sky-recognition-wiki",
    version: 3,
    exportedAt: "2026-09-05T00:00:00.000Z",
    account: {
      name: "private pipeline fixture",
      accountType: "有翼",
      bindingsConfirmed: true,
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
  };
  try {
    await writeFile(backupPath, `${JSON.stringify(backup)}\n`, "utf8");
    await execFileAsync(process.execPath, [
      creator,
      "--backup", fileURLToPath(backupPath),
      "--price-twd", "3500",
      "--account-id", "123e4567-e89b-42d3-a456-426614174000",
      "--inventory-complete", "yes",
      "--observed-at", "2026-09-05T00:00:00.000Z",
      "--out", fileURLToPath(samplePath),
    ], commandOptions);
    const { stdout } = await execFileAsync(
      process.execPath,
      [auditor, fileURLToPath(samplePath)],
      commandOptions,
    );
    const candidate = JSON.parse(stdout);
    await writeFile(candidatePath, stdout, "utf8");
    const validationFailure = await execFileAsync(process.execPath, [
      validator,
      "--candidate", fileURLToPath(candidatePath),
      "--baseline", baselinePath,
      "--source", fileURLToPath(samplePath),
    ], commandOptions).then(() => null, (error) => error);
    assert.ok(validationFailure);
    const report = JSON.parse(validationFailure.stdout);

    assert.equal(candidate.predictorCoverage.eligibleRows, 1);
    assert.equal(candidate.predictorCoverage.completeRows, 1);
    assert.equal(report.criteria.candidateRebuild.pass, true);
    assert.equal(report.eligibleRows, 1);
    assert.equal(report.criteria.completeModelPredictors.actual, 1);
    assert.equal(report.criteria.completeModelPredictors.missing, 0);
    assert.equal(report.criteria.minimumEligibleRows.pass, false);
    assert.equal(report.outcome, "fail");
  } finally {
    await Promise.all(
      [backupPath, samplePath, candidatePath]
        .map((file) => rm(file, { force: true })),
    );
  }
});
