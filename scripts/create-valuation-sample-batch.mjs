import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const workRoot = resolve(projectRoot, "work");
const creatorPath = fileURLToPath(
  new URL("./create-valuation-sample-from-backup.mjs", import.meta.url),
);
const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : null;
  return value && !value.startsWith("--") ? value : null;
};
const manifestPath = resolve(argument("--manifest") ?? "");
const outputPath = resolve(argument("--out") ?? "");
const insideWork = (path) => {
  const pathFromWork = relative(workRoot, path);
  return Boolean(pathFromWork) && !pathFromWork.startsWith("..") && !isAbsolute(pathFromWork);
};

if (!argument("--manifest") || !argument("--out")) {
  throw new Error(
    "Usage: node scripts/create-valuation-sample-batch.mjs --manifest work/manifest.jsonl --out work/samples.private.jsonl",
  );
}
if (!insideWork(manifestPath) || !insideWork(outputPath)) {
  throw new Error("--manifest and --out must point to files inside work/");
}
if (manifestPath.toLowerCase() === outputPath.toLowerCase()) {
  throw new Error("--out must not overwrite the input manifest");
}

const manifestText = await readFile(manifestPath, "utf8");
const manifestLines = manifestText.split(/\r?\n/u);
const entries = manifestLines.flatMap((line, index) => {
  if (!line.trim()) return [];
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    throw new Error(`Invalid manifest JSON at line ${index + 1}`);
  }
  return [{ entry, lineNumber: index + 1 }];
});
if (!entries.length) throw new Error("Manifest contains no samples");
if (entries.length > 2_000) throw new Error("Manifest exceeds 2,000 samples");

const temporaryDirectory = resolve(workRoot, `.valuation-batch-${randomUUID()}`);
await mkdir(temporaryDirectory, { recursive: false });
const samples = [];
try {
  for (const { entry, lineNumber } of entries) {
    const backupValue = typeof entry?.backup === "string" ? entry.backup.trim() : "";
    const evidenceKind = entry?.evidence_kind ?? "professional_estimate";
    const evidenceQuality = entry?.evidence_quality ?? "medium";
    const groupId = typeof entry?.group_id === "string" ? entry.group_id.trim() : "";
    const accountId = typeof entry?.account_id === "string" ? entry.account_id.trim() : "";
    const observedAt = typeof entry?.observed_at === "string" ? entry.observed_at.trim() : "";
    const priceTwd = Number(entry?.price_twd);
    if (!backupValue) throw new Error(`Manifest line ${lineNumber} requires backup`);
    if (!Number.isFinite(priceTwd) || priceTwd <= 0) {
      throw new Error(`Manifest line ${lineNumber} requires a positive price_twd`);
    }
    if (!groupId) throw new Error(`Manifest line ${lineNumber} requires group_id`);
    if (groupId.startsWith("--") || accountId.startsWith("--")) {
      throw new Error(`Manifest line ${lineNumber} contains an invalid option-like value`);
    }
    if (!observedAt || !Number.isFinite(new Date(observedAt).getTime())) {
      throw new Error(`Manifest line ${lineNumber} requires a valid observed_at`);
    }
    if (!["sold", "professional_estimate"].includes(evidenceKind)) {
      throw new Error(`Manifest line ${lineNumber} has an invalid evidence_kind`);
    }
    if (!["high", "medium", "low"].includes(evidenceQuality)) {
      throw new Error(`Manifest line ${lineNumber} has an invalid evidence_quality`);
    }

    const backupPath = isAbsolute(backupValue)
      ? resolve(backupValue)
      : resolve(dirname(manifestPath), backupValue);
    const temporaryOutput = resolve(temporaryDirectory, `${lineNumber}.jsonl`);
    const creatorArgs = [
      creatorPath,
      "--backup", backupPath,
      "--price-twd", String(priceTwd),
      "--evidence-kind", evidenceKind,
      "--evidence-quality", evidenceQuality,
      "--group-id", groupId,
      "--observed-at", observedAt,
      "--out", temporaryOutput,
    ];
    if (accountId) creatorArgs.push("--account-id", accountId);
    try {
      await execFileAsync(process.execPath, creatorArgs, {
        cwd: projectRoot,
        env: process.env,
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch (error) {
      const detail = String(error?.stderr ?? error?.message ?? error).trim();
      throw new Error(`Manifest line ${lineNumber} failed: ${detail}`);
    }
    samples.push(JSON.parse(await readFile(temporaryOutput, "utf8")));
  }

  const duplicateSnapshots = samples
    .map((sample) => sample.snapshot_hash)
    .filter((hash, index, values) => values.indexOf(hash) !== index);
  if (duplicateSnapshots.length) {
    throw new Error(
      `Manifest contains ${new Set(duplicateSnapshots).size} duplicate inventory snapshots`,
    );
  }
  const combinedOutput = resolve(temporaryDirectory, "combined.jsonl");
  await writeFile(
    combinedOutput,
    `${samples.map((sample) => JSON.stringify(sample)).join("\n")}\n`,
    "utf8",
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await rename(combinedOutput, outputPath);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const countsByStartSeason = Object.fromEntries(
  [...new Set(samples.map((sample) => sample.start_season_slug ?? "unknown"))]
    .sort()
    .map((slug) => [
      slug,
      samples.filter((sample) => (sample.start_season_slug ?? "unknown") === slug).length,
    ]),
);
console.log(JSON.stringify({
  output: relative(projectRoot, outputPath),
  samples: samples.length,
  completePredictors: samples.filter((sample) => sample.valuation_model).length,
  countsByStartSeason,
}, null, 2));
