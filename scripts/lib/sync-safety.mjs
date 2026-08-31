import { writeFile, rename } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const isWithin = (root, target) => {
  const path = relative(root, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

export const resolveRestrictedOutput = (
  root,
  output,
  allowedDirectories = ["dist/tmp", "tmp"],
) => {
  const target = resolve(root, output);
  const allowed = allowedDirectories.some((directory) =>
    isWithin(resolve(root, directory), target),
  );
  if (!allowed) throw new Error(`Output is restricted to ${allowedDirectories.join(" or ")}`);
  return target;
};

export const assertSnapshotNotShrunk = ({
  label,
  previousCount,
  nextCount,
  allowShrink,
}) => {
  if (!allowShrink && nextCount < previousCount) {
    throw new Error(
      `Refusing to shrink ${label} from ${previousCount} to ${nextCount}; review first or pass --allow-shrink.`,
    );
  }
};

export const writeFileAtomically = async (destination, content) => {
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, destination);
};
