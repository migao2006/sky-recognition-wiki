import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  classifyCandidateScores,
  gridRegions,
  shiftedIoU,
} from "../scripts/lib/wardrobe-icon-match.mjs";

const square = (size, left, top, width, height) => {
  const mask = new Uint8Array(size * size);
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) mask[y * size + x] = 1;
  }
  return mask;
};

test("matches identical and slightly shifted icon masks", () => {
  const first = square(8, 2, 2, 3, 4);
  const shifted = square(8, 3, 1, 3, 4);
  assert.equal(shiftedIoU(first, first, { size: 8, maximumShift: 2 }), 1);
  assert.equal(shiftedIoU(first, shifted, { size: 8, maximumShift: 2 }), 1);
});

test("accepts only a high score with a distinct runner-up", () => {
  assert.equal(classifyCandidateScores([
    { guid: "best", score: 0.97 },
    { guid: "second", score: 0.91 },
  ]).status, "accepted");
  assert.equal(classifyCandidateScores([
    { guid: "best", score: 0.96 },
    { guid: "second", score: 0.94 },
  ]).status, "review");
  assert.equal(classifyCandidateScores([
    { guid: "best", score: 0.82 },
    { guid: "second", score: 0.5 },
  ]).status, "review");
});

test("builds deterministic row-major crop regions", () => {
  assert.deepEqual(gridRegions({
    left: 10,
    top: 20,
    cellWidth: 30,
    cellHeight: 40,
    columns: 2,
    rows: 2,
    gapX: 5,
    gapY: 6,
  }), [
    { row: 0, column: 0, left: 10, top: 20, width: 30, height: 40 },
    { row: 0, column: 1, left: 45, top: 20, width: 30, height: 40 },
    { row: 1, column: 0, left: 10, top: 66, width: 30, height: 40 },
    { row: 1, column: 1, left: 45, top: 66, width: 30, height: 40 },
  ]);
  assert.throws(() => gridRegions({ left: 0, top: 0, cellWidth: 0, cellHeight: 10, columns: 1, rows: 1 }));
  assert.throws(() => gridRegions({ left: 0, top: 0, cellWidth: 10, cellHeight: 10, columns: 1.5, rows: 1 }));
});

test("refuses to write private recognition output outside work", () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../scripts/recognize-wardrobe-image.mjs", import.meta.url)),
    "missing-image.png",
    "--grid=0,0,10,10,1,1",
    "--out=wardrobe-candidates.json",
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--out must point to a file inside work/);
});
