import type { WikiItem } from "./wiki-data";

export type ExportShowcasePreset = "valuation" | "video" | "collection";

export type ExportValuationSummary = {
  midpoint: number | null;
  range: { low: number; high: number } | null;
  confidence: string;
  completeness: number;
  itemCount: number;
  highlights: string[];
};

export type ExportShowcaseOptions = {
  items: WikiItem[];
  preset?: ExportShowcasePreset;
  valuation?: ExportValuationSummary;
  isUltimate: (item: WikiItem) => boolean;
  isLimited: (item: WikiItem) => boolean;
  isPendant: (item: WikiItem) => boolean;
  getClusterName: (item: WikiItem) => string;
  getClusterOrder: (item: WikiItem) => number;
  getItemTypeName: (item: WikiItem) => string;
  getItemTypeOrder: (item: WikiItem) => number;
};

type ShowcaseGroupKey = "ultimate" | "limited" | "other";

export const buildShowcaseGroups = ({
  items,
  isUltimate,
  isLimited,
  isPendant,
  getClusterName,
  getClusterOrder,
  getItemTypeName,
  getItemTypeOrder,
}: ExportShowcaseOptions) => {
  const ultimates = items.filter(isUltimate);
  const limited = items.filter((item) => !isUltimate(item) && isLimited(item));
  const featured = new Set([...ultimates, ...limited].map((item) => item.guid));
  const groups = [
    { key: "ultimate" as const, name: "季節畢業", items: ultimates },
    { key: "limited" as const, name: "聯動／禮包／限定", items: limited },
    {
      key: "other" as const,
      name: "其他衣櫃",
      items: items.filter((item) => !featured.has(item.guid)),
    },
  ].filter((group) => group.items.length);

  const compareItems = (
    groupKey: ShowcaseGroupKey,
    a: WikiItem,
    b: WikiItem,
  ) =>
    (groupKey === "ultimate"
      ? Number(isPendant(b)) - Number(isPendant(a))
      : getItemTypeOrder(a) - getItemTypeOrder(b)) ||
    a.order - b.order ||
    a.id - b.id ||
    a.guid.localeCompare(b.guid);

  return groups.map((group) => {
    const clusters = new Map<
      string,
      { name: string; items: WikiItem[]; order: number }
    >();
    group.items.forEach((item) => {
      const key =
        group.key === "other"
          ? `type:${item.type}`
          : `${item.section}:${item.collection}`;
      const current = clusters.get(key);
      if (current) current.items.push(item);
      else
        clusters.set(key, {
          name:
            group.key === "other"
              ? getItemTypeName(item)
              : getClusterName(item),
          items: [item],
          order:
            group.key === "other"
              ? getItemTypeOrder(item)
              : getClusterOrder(item),
        });
    });
    const sortedClusters = [...clusters.values()].sort(
      (a, b) =>
        a.order - b.order || a.name.localeCompare(b.name, "zh-Hant"),
    );
    sortedClusters.forEach((cluster) =>
      cluster.items.sort((a, b) => compareItems(group.key, a, b)),
    );
    return { ...group, clusters: sortedClusters };
  });
};

const iconCache = new Map<string, Promise<HTMLImageElement | null>>();

const loadIcon = (src: string) => {
  const cached = iconCache.get(src);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    let finished = false;
    const timeout = setTimeout(() => finish(null), 8000);
    const finish = (value: HTMLImageElement | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(value);
    };

    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = src;
  });

  if (iconCache.size >= 200) {
    const oldest = iconCache.keys().next().value;
    if (oldest) iconCache.delete(oldest);
  }
  iconCache.set(src, request);
  request.then((image) => {
    if (!image && iconCache.get(src) === request) iconCache.delete(src);
  });
  return request;
};

const loadIcons = async (items: WikiItem[], concurrency = 8) => {
  const icons = new Map<string, HTMLImageElement | null>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      icons.set(item.guid, await loadIcon(item.icon));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return icons;
};

const showcaseMetrics = {
  width: 1600,
  pad: 24,
  panelPad: 18,
  titleHeight: 44,
  cellWidth: 64,
  cellHeight: 64,
  iconGap: 4,
  clusterGap: 6,
  clusterPad: 6,
  clusterTitle: 20,
  maxClusterColumns: 22,
  clusterMinWidth: 96,
  sectionGap: 12,
} as const;

export const EXPORT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const exportImageQualities = [
  0.94, 0.9, 0.86, 0.82, 0.76, 0.68, 0.58, 0.48, 0.4,
] as const;

export const encodeImageWithinLimit = async (
  encode: (quality: number) => Promise<Blob>,
  maxBytes = EXPORT_IMAGE_MAX_BYTES,
) => {
  for (const quality of exportImageQualities) {
    const blob = await encode(quality);
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error("image-too-large");
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("image-export-failed")),
      "image/jpeg",
      quality,
    );
  });

const buildShowcaseLayout = (
  groups: ReturnType<typeof buildShowcaseGroups>,
) => {
  const {
    width,
    pad,
    panelPad,
    titleHeight,
    cellWidth,
    cellHeight,
    iconGap,
    clusterGap,
    clusterPad,
    clusterTitle,
    maxClusterColumns,
    clusterMinWidth,
    sectionGap,
  } = showcaseMetrics;
  const contentWidth = width - pad * 2 - panelPad * 2;
  const layoutClusters = (
    clusters: ReturnType<typeof buildShowcaseGroups>[number]["clusters"],
  ) => {
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;
    const placements = clusters.map((cluster) => {
      const columns = Math.min(maxClusterColumns, cluster.items.length || 1);
      const rows = Math.ceil(cluster.items.length / columns);
      const naturalWidth =
        clusterPad * 2 +
        columns * cellWidth +
        (columns - 1) * iconGap;
      const w = Math.min(contentWidth, Math.max(clusterMinWidth, naturalWidth));
      const h =
        clusterPad * 2 +
        clusterTitle +
        rows * cellHeight +
        (rows - 1) * iconGap;
      if (cursorX && cursorX + w > contentWidth) {
        cursorX = 0;
        cursorY += rowHeight + clusterGap;
        rowHeight = 0;
      }
      const placement = {
        cluster,
        x: cursorX,
        y: cursorY,
        w,
        h,
        columns,
      };
      cursorX += w + clusterGap;
      rowHeight = Math.max(rowHeight, h);
      return placement;
    });
    return {
      placements,
      height: placements.length ? cursorY + rowHeight : 0,
    };
  };
  const renderGroups = groups.map((group) => ({
    ...group,
    layout: layoutClusters(group.clusters),
  }));
  const panelHeight = (layoutHeight: number) =>
    titleHeight + Math.max(cellHeight + 12, layoutHeight) + panelPad;
  const height =
    pad * 2 +
    renderGroups.reduce(
      (sum, group) => sum + panelHeight(group.layout.height),
      0,
    ) +
    sectionGap * Math.max(0, renderGroups.length - 1);
  return { height, panelHeight, renderGroups };
};

export const measureShowcaseCanvas = (options: ExportShowcaseOptions) => {
  const { height } = buildShowcaseLayout(buildShowcaseGroups(options));
  const summaryHeight =
    options.preset === "valuation" && options.valuation ? 236 : 0;
  return { width: showcaseMetrics.width, height: height + summaryHeight };
};

export const renderShowcaseImage = async (options: ExportShowcaseOptions) => {
  const { items, preset = "collection", valuation } = options;
  const groups = buildShowcaseGroups(options);
  const {
    width,
    pad,
    panelPad,
    titleHeight,
    cellWidth,
    cellHeight,
    iconGap,
    clusterPad,
    clusterTitle,
    sectionGap,
  } = showcaseMetrics;
  const { height, panelHeight, renderGroups } = buildShowcaseLayout(groups);
  const summaryHeight = preset === "valuation" && valuation ? 236 : 0;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + summaryHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#04060c");
  background.addColorStop(0.52, "#0a1020");
  background.addColorStop(1, "#11152a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, canvas.height);

  const aura = ctx.createRadialGradient(
    width * 0.72,
    40,
    20,
    width * 0.72,
    40,
    width * 0.8,
  );
  aura.addColorStop(0, "rgba(111,158,232,.24)");
  aura.addColorStop(1, "rgba(4,6,12,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, canvas.height);

  const roundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fill: string,
    stroke?: string,
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  if (summaryHeight && valuation) {
    roundRect(
      pad,
      pad,
      width - pad * 2,
      summaryHeight - sectionGap,
      20,
      "rgba(7,11,20,.86)",
      "rgba(169,207,255,.2)",
    );
    ctx.textAlign = "left";
    ctx.fillStyle = "#9fc8ff";
    ctx.font = "800 20px system-ui";
    ctx.fillText("估價重點", pad + 28, pad + 38);
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "900 48px system-ui";
    ctx.fillText(
      valuation.midpoint === null
        ? "NT$ —"
        : `NT$ ${valuation.midpoint.toLocaleString("zh-TW")}`,
      pad + 28,
      pad + 96,
    );
    ctx.fillStyle = "#b7c8dd";
    ctx.font = "700 18px system-ui";
    const range = valuation.range
      ? `合理區間 NT$ ${valuation.range.low.toLocaleString("zh-TW")}～NT$ ${valuation.range.high.toLocaleString("zh-TW")}`
      : "尚無足夠估價重點";
    ctx.fillText(range, pad + 28, pad + 132);
    ctx.fillText(
      `完整度 ${valuation.completeness}% · ${valuation.confidence} · 估價重點 ${valuation.itemCount} 件`,
      pad + 28,
      pad + 164,
    );
    ctx.fillStyle = "#8fa6c2";
    ctx.font = "600 15px system-ui";
    ctx.fillText(
      valuation.highlights.slice(0, 5).join("　") || "尚未選取估價重點",
      pad + 28,
      pad + 196,
    );
  }

  const icons = await loadIcons(items);
  let y = pad + summaryHeight;
  renderGroups.forEach((group) => {
    const boxHeight = panelHeight(group.layout.height);
    roundRect(
      pad,
      y,
      width - pad * 2,
      boxHeight,
      20,
      "rgba(7,11,20,.76)",
      "rgba(169,207,255,.16)",
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "800 20px system-ui";
    ctx.fillText(group.name, width / 2, y + 29);

    group.layout.placements.forEach(
      ({ cluster, x: clusterX, y: clusterY, w, h, columns }) => {
        const x = pad + panelPad + clusterX;
        const clusterTop = y + titleHeight + clusterY;
        roundRect(
          x,
          clusterTop,
          w,
          h,
          10,
          "rgba(111,158,232,.07)",
          "rgba(169,207,255,.15)",
        );
        ctx.textAlign = "left";
        ctx.fillStyle = "#b7d6ff";
        ctx.font = "700 11px system-ui";
        ctx.fillText(cluster.name, x + clusterPad, clusterTop + 14);

        cluster.items.forEach((item, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const rowItemCount = Math.min(
            columns,
            cluster.items.length - row * columns,
          );
          const rowWidth =
            rowItemCount * cellWidth + (rowItemCount - 1) * iconGap;
          const cellX =
            x + (w - rowWidth) / 2 + col * (cellWidth + iconGap);
          const cellY =
            clusterTop +
            clusterPad +
            clusterTitle +
            row * (cellHeight + iconGap);
          const image = icons.get(item.guid);
          if (image) {
            const maxWidth = cellWidth - 6;
            const maxHeight = cellHeight - 6;
            const scale = Math.min(
              maxWidth / image.naturalWidth,
              maxHeight / image.naturalHeight,
            );
            const drawW = image.naturalWidth * scale;
            const drawH = image.naturalHeight * scale;
            ctx.save();
            ctx.shadowColor = "rgba(143,199,255,.38)";
            ctx.shadowBlur = 9;
            ctx.drawImage(
              image,
              cellX + (cellWidth - drawW) / 2,
              cellY + (cellHeight - drawH) / 2,
              drawW,
              drawH,
            );
            ctx.restore();
          } else {
            ctx.textAlign = "center";
            ctx.fillStyle = "#b7d6ff";
            ctx.font = "700 22px system-ui";
            ctx.fillText("✦", cellX + cellWidth / 2, cellY + 36);
          }
        });
      },
    );
    y += boxHeight + sectionGap;
  });

  return encodeImageWithinLimit((quality) => canvasToJpeg(canvas, quality));
};
