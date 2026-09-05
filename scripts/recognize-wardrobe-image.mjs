import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import {
  classifyCandidateScores,
  gridRegions,
  normalizeIconMask,
  shiftedIoU,
} from "./lib/wardrobe-icon-match.mjs";

const positional = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const option = (name) => process.argv.slice(2).find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const imagePath = positional[0];
const gridValue = option("grid");
if (!imagePath || !gridValue) {
  throw new Error(
    "Usage: node scripts/recognize-wardrobe-image.mjs <image> --grid=left,top,cellWidth,cellHeight,columns,rows[,gapX,gapY] [--types=Instrument,HeldProp] [--limit=5] [--out=work/result.json]",
  );
}

const gridNumbers = gridValue.split(",").map(Number);
if (![6, 8].includes(gridNumbers.length)) throw new Error("--grid requires 6 or 8 comma-separated numbers");
const [left, top, cellWidth, cellHeight, columns, rows, gapX = 0, gapY = 0] = gridNumbers;
const regions = gridRegions({ left, top, cellWidth, cellHeight, columns, rows, gapX, gapY });
const acceptedTypes = new Set((option("types") ?? "Instrument,HeldProp").split(",").filter(Boolean));
const requestedLimit = Number(option("limit") ?? 5);
if (!Number.isInteger(requestedLimit) || requestedLimit < 2 || requestedLimit > 20) {
  throw new Error("--limit must be an integer from 2 to 20");
}
const limit = requestedLimit;
const outPath = option("out");
const workDirectory = resolve("work");
const cacheDirectory = resolve(workDirectory, "wardrobe-icon-cache");
await mkdir(cacheDirectory, { recursive: true });

const resolvedOutput = outPath ? resolve(outPath) : null;
if (resolvedOutput) {
  const pathFromWork = relative(workDirectory, resolvedOutput);
  if (!pathFromWork || pathFromWork.startsWith("..") || isAbsolute(pathFromWork)) {
    throw new Error("--out must point to a file inside work/");
  }
  await mkdir(dirname(resolvedOutput), { recursive: true });
}

const catalog = await loadRuntimeCatalog();
const candidates = catalog.wikiItems.filter((item) => acceptedTypes.has(item.type) && item.icon);

const cachedIcon = async (item) => {
  const iconRevision = createHash("sha256").update(item.icon).digest("hex").slice(0, 12);
  const path = join(cacheDirectory, `${encodeURIComponent(item.guid)}-${iconRevision}.image`);
  try {
    return await readFile(path);
  } catch {
    const response = await fetch(item.icon, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Icon request returned ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(path, buffer);
    return buffer;
  }
};

const references = [];
for (let index = 0; index < candidates.length; index += 12) {
  const batch = await Promise.all(candidates.slice(index, index + 12).map(async (item) => {
    try {
      return { item, mask: await normalizeIconMask(await cachedIcon(item), "catalog") };
    } catch {
      return null;
    }
  }));
  references.push(...batch.filter(Boolean));
}

const image = sharp(imagePath);
const cells = [];
for (const region of regions) {
  try {
    const crop = await image.clone().extract(region).png().toBuffer();
    const target = await normalizeIconMask(crop, "screenshot");
    const ranked = references.map(({ item, mask }) => ({
      guid: item.guid,
      name: item.name,
      displayName: catalog.zhItemName(item),
      type: item.type,
      score: shiftedIoU(target, mask),
    }));
    const decision = classifyCandidateScores(ranked);
    cells.push({
      row: region.row,
      column: region.column,
      region,
      status: decision.status,
      score: Number(decision.score.toFixed(4)),
      margin: Number(decision.margin.toFixed(4)),
      candidates: decision.candidates.slice(0, limit).map((candidate) => ({
        ...candidate,
        score: Number(candidate.score.toFixed(4)),
      })),
    });
  } catch (error) {
    cells.push({
      row: region.row,
      column: region.column,
      region,
      status: "unreadable",
      error: error instanceof Error ? error.message : String(error),
      candidates: [],
    });
  }
}

const result = {
  schemaVersion: 1,
  inputName: basename(imagePath),
  grid: { left, top, cellWidth, cellHeight, columns, rows, gapX, gapY },
  candidateTypes: [...acceptedTypes],
  catalogCandidateCount: candidates.length,
  loadedReferenceCount: references.length,
  policy: {
    accepted: "score >= 0.93 and first-to-second margin >= 0.03",
    review: "all other matches require visual confirmation before a GUID can be used",
  },
  cells,
};
const output = `${JSON.stringify(result, null, 2)}\n`;
if (resolvedOutput) await writeFile(resolvedOutput, output, "utf8");
else process.stdout.write(output);
