import { createReadStream } from "node:fs";
import { access, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { accountKeyFor, postKeyFor } from "./lib/valuation-source-core.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const privateOutputRoots = [
  resolve(projectRoot, "work"),
  resolve(projectRoot, "dist", "tmp"),
];
const snapshotHashPattern = /^[a-f0-9]{64}$/u;
const placeholderIdentityPattern = /^(?:unknown|n\/?a|null|undefined|none|-)$/iu;

const identityValueFor = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized && !placeholderIdentityPattern.test(normalized) ? normalized : null;
};

const snapshotKeyFor = (row) => {
  const value = String(row?.snapshot_hash ?? "").trim().toLowerCase();
  return snapshotHashPattern.test(value) ? value : null;
};

const identityKeysFor = (row) => {
  const accounts = new Set([
    accountKeyFor(row),
    row?.account_group_hash,
    row?.account_hash,
    row?.account_fingerprint,
  ].map(identityValueFor).filter(Boolean));
  const posts = new Set([
    postKeyFor(row),
    row?.post_hash,
    row?.post_fingerprint,
  ].map(identityValueFor).filter(Boolean));
  const snapshot = snapshotKeyFor(row);
  return [
    ...[...accounts].map((account) => `account:${account}`),
    ...[...posts].map((post) => `post:${post}`),
    ...(snapshot ? [`snapshot:${snapshot}`] : []),
  ];
};

// Rows are linked only by a shared normalized identity in the same namespace.
// Closing over identities and rows makes a copied post unable to bridge an
// evaluation account back into calibration through an intermediate duplicate.
export const partitionEvaluationRows = (rows, evaluationRows) => {
  if (!Array.isArray(rows) || !Array.isArray(evaluationRows)) {
    throw new TypeError("rows and evaluationRows must both be arrays");
  }

  const referenceKeys = evaluationRows.map(identityKeysFor);
  const missingReference = referenceKeys.findIndex((keys) => !keys.length);
  if (missingReference >= 0) {
    throw new Error(
      `Evaluation reference row ${missingReference + 1} requires an account, post, or valid snapshot identity`,
    );
  }

  const rowKeys = rows.map(identityKeysFor);
  const rowsByIdentity = new Map();
  rowKeys.forEach((keys, rowIndex) => {
    keys.forEach((key) => {
      const linkedRows = rowsByIdentity.get(key) ?? [];
      linkedRows.push(rowIndex);
      rowsByIdentity.set(key, linkedRows);
    });
  });
  const unmatchedReference = referenceKeys.findIndex((keys) =>
    !keys.some((key) => rowsByIdentity.has(key)),
  );
  if (unmatchedReference >= 0) {
    throw new Error(
      `Evaluation reference row ${unmatchedReference + 1} does not match a source row by identity`,
    );
  }

  const evaluationIndexes = new Set();
  const pendingKeys = referenceKeys.flat();
  const seenKeys = new Set();
  while (pendingKeys.length) {
    const key = pendingKeys.pop();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    for (const rowIndex of rowsByIdentity.get(key) ?? []) {
      if (evaluationIndexes.has(rowIndex)) continue;
      evaluationIndexes.add(rowIndex);
      rowKeys[rowIndex].forEach((linkedKey) => pendingKeys.push(linkedKey));
    }
  }

  return {
    calibration: rows.filter((_, index) => !evaluationIndexes.has(index)),
    evaluation: rows.filter((_, index) => evaluationIndexes.has(index)),
  };
};

const readJsonl = async (path) => {
  const rows = [];
  let lineNumber = 0;
  for await (const line of createInterface({ input: createReadStream(path) })) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("expected a JSON object");
      }
      rows.push(row);
    } catch (error) {
      throw new Error(`${path}:${lineNumber} is not a valid JSONL object: ${error.message}`);
    }
  }
  return rows;
};

const isPrivateOutputPath = (path) => privateOutputRoots.some((root) => {
  const fromRoot = relative(root, path);
  return !fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
});

const isInside = (root, path) => {
  const fromRoot = relative(root, path);
  return !fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
};

const existingAncestorFor = async (path) => {
  let candidate = path;
  while (!(await pathExists(candidate))) {
    const parent = dirname(candidate);
    if (parent === candidate) throw new Error("Unable to locate output path ancestor");
    candidate = parent;
  }
  return candidate;
};

const assertPrivateOutputPath = async (outputPath) => {
  if (!isPrivateOutputPath(outputPath)) {
    throw new Error("--out must be inside the ignored work/ or dist/tmp/ directory");
  }
  const projectRealPath = await realpath(projectRoot);
  const lexicalRoot = privateOutputRoots.find((root) => isInside(root, outputPath));
  await mkdir(lexicalRoot, { recursive: true });
  const privateRootRealPath = await realpath(lexicalRoot);
  const expectedPrivateRoot = resolve(projectRealPath, relative(projectRoot, lexicalRoot));
  if (!isInside(expectedPrivateRoot, privateRootRealPath)) {
    throw new Error("--out private root resolves outside its ignored directory");
  }
  const existingAncestorRealPath = await realpath(await existingAncestorFor(outputPath));
  if (!isInside(privateRootRealPath, existingAncestorRealPath)) {
    throw new Error("--out existing ancestor resolves outside its private output root");
  }
  await mkdir(outputPath, { recursive: true });
  const outputRealPath = await realpath(outputPath);
  if (!isInside(privateRootRealPath, outputRealPath)) {
    throw new Error("--out resolves outside its private output root");
  }
};

const parseArgs = (args) => {
  let evaluationPath = null;
  let outputDirectory = null;
  const sourcePaths = [];
  for (const argument of args) {
    if (argument.startsWith("--evaluation=")) {
      evaluationPath = argument.slice("--evaluation=".length);
    } else if (argument.startsWith("--out=")) {
      outputDirectory = argument.slice("--out=".length);
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      sourcePaths.push(argument);
    }
  }
  if (!evaluationPath || !outputDirectory || !sourcePaths.length) {
    throw new Error(
      "Usage: node scripts/partition-valuation-evaluation.mjs --evaluation=<private-evaluation.jsonl> --out=<work-or-dist/tmp-directory> <source1.jsonl> [source2.jsonl ...]",
    );
  }
  return { evaluationPath, outputDirectory, sourcePaths };
};

const pathExists = async (path) => access(path).then(() => true, () => false);

export const runPartitionCli = async (args = process.argv.slice(2)) => {
  const { evaluationPath, outputDirectory, sourcePaths } = parseArgs(args);
  const outputPath = resolve(outputDirectory);
  await assertPrivateOutputPath(outputPath);

  const [evaluationRows, ...sourceRows] = await Promise.all([
    readJsonl(resolve(evaluationPath)),
    ...sourcePaths.map((path) => readJsonl(resolve(path))),
  ]);
  const rows = sourceRows.flat();
  const partition = partitionEvaluationRows(rows, evaluationRows);
  const summary = {
    sourceRows: rows.length,
    evaluationReferenceRows: evaluationRows.length,
    calibrationRows: partition.calibration.length,
    evaluationRows: partition.evaluation.length,
  };

  const outputs = ["calibration.jsonl", "evaluation.jsonl", "summary.json"];
  if (await Promise.all(outputs.map((name) => pathExists(resolve(outputPath, name)))).then((found) => found.some(Boolean))) {
    throw new Error("--out already contains partition output files; choose an empty private directory");
  }
  const temporaryDirectory = resolve(outputPath, `.partition-${process.pid}-${Date.now()}`);
  await mkdir(temporaryDirectory, { recursive: false });
  await Promise.all([
    writeFile(resolve(temporaryDirectory, "calibration.jsonl"), `${partition.calibration.map(JSON.stringify).join("\n")}${partition.calibration.length ? "\n" : ""}`, "utf8"),
    writeFile(resolve(temporaryDirectory, "evaluation.jsonl"), `${partition.evaluation.map(JSON.stringify).join("\n")}${partition.evaluation.length ? "\n" : ""}`, "utf8"),
    writeFile(resolve(temporaryDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
  ]);
  await Promise.all(outputs.map((name) =>
    rename(resolve(temporaryDirectory, name), resolve(outputPath, name)),
  ));
  await rm(temporaryDirectory, { recursive: true, force: true });

  return summary;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  runPartitionCli().then(
    (summary) => console.log(JSON.stringify(summary)),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
