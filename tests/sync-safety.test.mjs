import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertSnapshotNotShrunk,
  resolveRestrictedOutput,
  writeFileAtomically,
} from "../scripts/lib/sync-safety.mjs";

test("restricts reports to the configured temporary directories", () => {
  const root = join(tmpdir(), "sky-sync-root");
  assert.equal(
    resolveRestrictedOutput(root, "dist/tmp/report.json"),
    join(root, "dist", "tmp", "report.json"),
  );
  assert.equal(
    resolveRestrictedOutput(root, "tmp/report.json"),
    join(root, "tmp", "report.json"),
  );
  assert.throws(
    () => resolveRestrictedOutput(root, "dist/tmp/../../app/page.tsx"),
    /restricted/,
  );
  assert.throws(
    () => resolveRestrictedOutput(root, "app/page.tsx"),
    /restricted/,
  );
});

test("requires explicit approval before a snapshot shrinks", () => {
  assert.throws(
    () => assertSnapshotNotShrunk({
      label: "fixture",
      previousCount: 225,
      nextCount: 0,
      allowShrink: false,
    }),
    /Refusing to shrink fixture from 225 to 0/,
  );
  assert.doesNotThrow(() => assertSnapshotNotShrunk({
    label: "fixture",
    previousCount: 225,
    nextCount: 0,
    allowShrink: true,
  }));
});

test("replaces snapshots atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sky-sync-"));
  const destination = join(directory, "snapshot.json");
  try {
    await writeFileAtomically(destination, "updated\n");
    assert.equal(await readFile(destination, "utf8"), "updated\n");
    await assert.rejects(readFile(`${destination}.tmp`, "utf8"), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
