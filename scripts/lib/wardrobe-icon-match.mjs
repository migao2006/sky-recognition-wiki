import sharp from "sharp";

export const normalizedMaskSize = 64;

const luminance = (red, green, blue) =>
  0.2126 * red + 0.7152 * green + 0.0722 * blue;

const rawPixels = async (input) => {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
};

const binaryForeground = (pixels, source) => {
  const { data, width, height, channels } = pixels;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = channels > 3 ? data[offset + 3] : 255;
    const light = luminance(red, green, blue);
    mask[index] = source === "catalog"
      ? Number(alpha > 32 && light > 24)
      : Number(light > 125 && Math.max(red, green, blue) - Math.min(red, green, blue) < 150);
  }
  return { mask, width, height };
};

export const normalizeIconMask = async (input, source) => {
  const { mask, width, height } = binaryForeground(await rawPixels(input), source);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) throw new Error("No icon foreground detected");
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const side = Math.max(contentWidth, contentHeight);
  const left = Math.max(0, Math.floor(minX - (side - contentWidth) / 2));
  const top = Math.max(0, Math.floor(minY - (side - contentHeight) / 2));
  const square = Math.min(side, width - left, height - top);
  const binary = Buffer.from(mask.map((value) => value * 255));
  const { data } = await sharp(binary, { raw: { width, height, channels: 1 } })
    .extract({ left, top, width: square, height: square })
    .resize(normalizedMaskSize, normalizedMaskSize, { fit: "fill", kernel: "nearest" })
    .threshold(127)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Uint8Array.from(data, (value) => Number(value > 0));
};

export const shiftedIoU = (
  left,
  right,
  { size = normalizedMaskSize, maximumShift = 4 } = {},
) => {
  if (left.length !== size * size || right.length !== size * size) {
    throw new Error(`Masks must both contain ${size * size} pixels`);
  }
  let best = 0;
  for (let deltaY = -maximumShift; deltaY <= maximumShift; deltaY += 1) {
    for (let deltaX = -maximumShift; deltaX <= maximumShift; deltaX += 1) {
      let intersection = 0;
      let union = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const first = left[y * size + x];
          const shiftedX = x - deltaX;
          const shiftedY = y - deltaY;
          const second = shiftedX >= 0 && shiftedX < size && shiftedY >= 0 && shiftedY < size
            ? right[shiftedY * size + shiftedX]
            : 0;
          intersection += first & second;
          union += first | second;
        }
      }
      best = Math.max(best, union ? intersection / union : 0);
    }
  }
  return best;
};

export const classifyCandidateScores = (
  candidates,
  { minimumScore = 0.93, minimumMargin = 0.03 } = {},
) => {
  const ranked = [...candidates].sort((left, right) => right.score - left.score);
  const score = ranked[0]?.score ?? 0;
  const runnerUp = ranked[1]?.score ?? 0;
  const margin = score - runnerUp;
  return {
    status: score >= minimumScore && margin >= minimumMargin ? "accepted" : "review",
    score,
    margin,
    candidates: ranked,
  };
};

export const gridRegions = ({
  left,
  top,
  cellWidth,
  cellHeight,
  columns,
  rows,
  gapX = 0,
  gapY = 0,
}) => {
  const values = [left, top, cellWidth, cellHeight, columns, rows, gapX, gapY];
  if (
    !values.every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    cellWidth <= 0 ||
    cellHeight <= 0 ||
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns <= 0 ||
    rows <= 0 ||
    gapX < 0 ||
    gapY < 0
  ) {
    throw new Error("Grid values must be finite positive dimensions and counts");
  }
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      row,
      column,
      left: Math.round(left + column * (cellWidth + gapX)),
      top: Math.round(top + row * (cellHeight + gapY)),
      width: Math.round(cellWidth),
      height: Math.round(cellHeight),
    };
  });
};
