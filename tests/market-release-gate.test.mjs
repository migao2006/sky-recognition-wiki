import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const pair = (accountKey, actual, predicted) => ({ accountKey, actual, predicted });

test("release gate can compare a named candidate with the serving model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sky-market-gate-"));
  const oldPath = join(directory, "old.json");
  const nextPath = join(directory, "next.json");
  const serving = {
    summary: { overall: { count: 2, failed: 0, hit20: .5, medianApe: .2, p90Ape: .8 } },
    folds: [{ pairs: [pair("old-a", 100, 120), pair("old-b", 100, 180)] }],
  };
  const candidate = {
    summary: { overall: { count: 3, failed: 0, hit20: 1, medianApe: .1, p90Ape: .15 } },
    folds: [{ pairs: [pair("old-a", 100, 110), pair("old-b", 100, 115), pair("new", 100, 105)] }],
  };
  await writeFile(oldPath, JSON.stringify({ cohorts: { ask_title_evidenced: {
    models: { baseline_enriched_title_binding_blend: serving },
  } } }));
  await writeFile(nextPath, JSON.stringify({ cohorts: { ask_title_evidenced: {
    models: { hierarchical_lookup: candidate },
  } } }));

  const result = spawnSync(process.execPath,
    ["scripts/check-market-release-gate.mjs", oldPath, nextPath, "hierarchical_lookup"],
    { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.servingModel, "baseline_enriched_title_binding_blend");
  assert.equal(report.candidateModel, "hierarchical_lookup");
  assert.equal(report.frozenOld.count, 2);
  assert.equal(report.release, "publish");
});
