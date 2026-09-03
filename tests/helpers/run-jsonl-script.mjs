import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const runJsonlScript = async ({
  script,
  lines,
  args = [],
  env,
  temporaryPrefix = "sky-jsonl-test-",
}) => {
  const directory = await mkdtemp(join(tmpdir(), temporaryPrefix));
  const source = join(directory, "source.jsonl");
  try {
    await writeFile(source, `${lines.join("\n")}\n`);
    return await exec(process.execPath, [fileURLToPath(script), ...args, source], {
      env,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
