import type { WikiItem } from "./wiki-data";
import {
  buildShowcaseGroups,
  type ShowcaseOrderOptions,
} from "./showcase-order";

type ExportShowcasePreset = "valuation" | "video" | "collection";

type ExportValuationSummary = {
  midpoint: number | null;
  range: { low: number; high: number } | null;
  confidence: string;
  completeness: number;
  itemCount: number;
  highlights: string[];
};

type ExportShowcaseOptions = ShowcaseOrderOptions & {
  preset?: ExportShowcasePreset;
  valuation?: ExportValuationSummary;
  onProgress?: (progress: ExportShowcaseProgress) => void;
};

type ExportShowcaseProgress = {
  completed: number;
  total: number;
  phase: "loading-icons" | "rendering";
};

type ExportShowcaseResult = {
  images: Blob[];
  loadedIconCount: number;
  failedIconCount: number;
};

const iconCache = new Map<string, Promise<HTMLImageElement | null>>();
const exportIconBatchSize = 12;
const exportDrawBatchSize = 48;

const yieldToBrowser = () =>
  new Promise<void>((resolve) => window.setTimeout(resolve, 0));

const loadIcon = (src: string) => {
  const cached = iconCache.get(src);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    let finished = false;
    const timeout = setTimeout(() => {
      image.removeAttribute("src");
      finish(null);
    }, 8000);
    const finish = (value: HTMLImageElement | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(value);
    };

    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      void image.decode().catch(() => undefined).then(() => finish(image));
    };
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

const loadPageIcons = async (
  items: WikiItem[],
  reportProgress: (item: WikiItem, image: HTMLImageElement | null) => void,
) => {
  const icons = new Map<string, HTMLImageElement | null>();
  for (let start = 0; start < items.length; start += exportIconBatchSize) {
    const batch = items.slice(start, start + exportIconBatchSize);
    const decoded = await Promise.all(
      batch.map(async (item) => [item.guid, await loadIcon(item.icon)] as const),
    );
    decoded.forEach(([guid, image], index) => {
      icons.set(guid, image);
      reportProgress(batch[index], image);
    });
    if (start + exportIconBatchSize < items.length) {
      await yieldToBrowser();
    }
  }
  return icons;
};

const releasePageIcons = (
  items: WikiItem[],
  icons: Map<string, HTMLImageElement | null>,
) => {
  const releasedSources = new Set<string>();
  items.forEach((item) => {
    const image = icons.get(item.guid);
    if (image) image.removeAttribute("src");
    if (!releasedSources.has(item.icon)) {
      iconCache.delete(item.icon);
      releasedSources.add(item.icon);
    }
  });
  icons.clear();
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

// Keep each rendered PNG within conservative mobile-browser canvas limits.
const maximumCanvasHeight = Math.min(
  16_384,
  Math.floor(16_000_000 / showcaseMetrics.width),
);

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("image-export-failed")),
      "image/png",
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

export const planShowcasePages = (options: ExportShowcaseOptions) => {
  const groups = buildShowcaseGroups(options);
  const {
    height: layoutHeight,
    panelHeight,
    renderGroups,
  } = buildShowcaseLayout(groups);
  const { width } = showcaseMetrics;
  const summaryHeight =
    options.preset === "valuation" && options.valuation ? 236 : 0;
  const totalHeight = layoutHeight + summaryHeight;
  const breakpoints = new Set([0, totalHeight]);
  let groupTop = showcaseMetrics.pad + summaryHeight;

  // Prefer complete group panels. Very large groups fall back to complete icon
  // rows, so an export page never cuts an item cell in half.
  renderGroups.forEach((group) => {
    const boxHeight = panelHeight(group.layout.height);
    const groupEnd = groupTop + boxHeight + showcaseMetrics.sectionGap;
    breakpoints.add(Math.min(groupEnd, totalHeight));
    group.layout.placements.forEach((placement) => {
      const itemTop =
        groupTop +
        showcaseMetrics.titleHeight +
        placement.y +
        showcaseMetrics.clusterPad +
        showcaseMetrics.clusterTitle;
      const rows = Math.ceil(placement.cluster.items.length / placement.columns);
      for (let row = 1; row <= rows; row += 1) {
        const rowEnd =
          itemTop +
          row * showcaseMetrics.cellHeight +
          (row - 1) * showcaseMetrics.iconGap +
          showcaseMetrics.clusterPad;
        if (rowEnd < groupEnd) breakpoints.add(rowEnd);
      }
    });
    groupTop = groupEnd;
  });

  const sortedBreakpoints = [...breakpoints].sort((left, right) => left - right);
  const pages: { index: number; width: number; height: number; offsetY: number }[] = [];
  let offsetY = 0;
  while (offsetY < totalHeight) {
    const maximumEnd = Math.min(offsetY + maximumCanvasHeight, totalHeight);
    const safeEnd = sortedBreakpoints.reduce(
      (best, point) =>
        point > offsetY && point <= maximumEnd ? Math.max(best, point) : best,
      offsetY,
    );
    const end = safeEnd > offsetY ? safeEnd : maximumEnd;
    pages.push({
      index: pages.length,
      width,
      height: end - offsetY,
      offsetY,
    });
    offsetY = end;
  }
  return pages;
};

export const planShowcasePageItems = (options: ExportShowcaseOptions) => {
  const groups = buildShowcaseGroups(options);
  const { panelHeight, renderGroups } = buildShowcaseLayout(groups);
  const summaryHeight =
    options.preset === "valuation" && options.valuation ? 236 : 0;
  const pages = planShowcasePages(options);
  const pageItems = pages.map(() => [] as WikiItem[]);
  let groupY = showcaseMetrics.pad + summaryHeight;

  for (const group of renderGroups) {
    for (const placement of group.layout.placements) {
      const cellTop =
        groupY +
        showcaseMetrics.titleHeight +
        placement.y +
        showcaseMetrics.clusterPad +
        showcaseMetrics.clusterTitle;
      placement.cluster.items.forEach((item, index) => {
        const row = Math.floor(index / placement.columns);
        const top =
          cellTop + row * (showcaseMetrics.cellHeight + showcaseMetrics.iconGap);
        const bottom = top + showcaseMetrics.cellHeight;
        const matchingPages = pages.filter(
          (page) => top < page.offsetY + page.height && bottom > page.offsetY,
        );
        const targets = matchingPages.length
          ? matchingPages
          : pages.slice(-1);
        targets.forEach((page) => pageItems[page.index].push(item));
      });
    }
    groupY += panelHeight(group.layout.height) + showcaseMetrics.sectionGap;
  }

  return { pages, pageItems };
};

export const renderShowcaseImage = async (options: ExportShowcaseOptions) => {
  const { items, preset = "collection", valuation, onProgress } = options;
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
  const { panelHeight, renderGroups } = buildShowcaseLayout(groups);
  const summaryHeight = preset === "valuation" && valuation ? 236 : 0;

  const roundRect = (
    ctx: CanvasRenderingContext2D,
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
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const { pages, pageItems } = planShowcasePageItems(options);
  const images: Blob[] = [];
  let completedIconCount = 0;
  const completedIconGuids = new Set<string>();
  const loadedIconGuids = new Set<string>();
  onProgress?.({ completed: 0, total: items.length, phase: "loading-icons" });

  for (const page of pages) {
    const icons = await loadPageIcons(pageItems[page.index], (item, image) => {
      if (!completedIconGuids.has(item.guid)) {
        completedIconGuids.add(item.guid);
        completedIconCount = Math.min(items.length, completedIconCount + 1);
      }
      if (image) loadedIconGuids.add(item.guid);
      onProgress?.({
        completed: completedIconCount,
        total: items.length,
        phase: "loading-icons",
      });
    });
    onProgress?.({
      completed: page.index,
      total: pages.length,
      phase: "rendering",
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.save();
    ctx.translate(0, -page.offsetY);

  if (summaryHeight && valuation) {
    roundRect(
      ctx,
      pad,
      pad,
      width - pad * 2,
      summaryHeight - sectionGap,
      20,
      "#0b111e",
      "rgba(169,207,255,.08)",
    );
    ctx.textAlign = "left";
    ctx.fillStyle = "#9fc8ff";
    ctx.font = "800 20px system-ui";
    ctx.fillText("估價摘要", pad + 28, pad + 38);
    ctx.fillStyle = "#b7c8dd";
    ctx.font = "700 15px system-ui";
    ctx.fillText("參考中位價", pad + 28, pad + 62);
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "900 48px system-ui";
    ctx.fillText(
      valuation.midpoint === null
        ? "NT$ —"
        : `NT$ ${valuation.midpoint.toLocaleString("zh-TW")}`,
      pad + 28,
      pad + 106,
    );
    ctx.fillStyle = "#b7c8dd";
    ctx.font = "700 18px system-ui";
    const range = valuation.range
      ? `價格區間 NT$ ${valuation.range.low.toLocaleString("zh-TW")}～NT$ ${valuation.range.high.toLocaleString("zh-TW")}`
      : "選取估價物品後顯示";
    ctx.fillText(range, pad + 28, pad + 142);
    ctx.fillText(
      `估價完整度 ${valuation.completeness}% · ${valuation.confidence} · 已納入 ${valuation.itemCount} 件`,
      pad + 28,
      pad + 174,
    );
    ctx.fillStyle = "#8fa6c2";
    ctx.font = "600 15px system-ui";
    ctx.fillText(
      valuation.highlights.slice(0, 5).join("　") || "尚未選取估價物品",
      pad + 28,
      pad + 206,
    );
  }

  let y = pad + summaryHeight;
  let drawnSinceYield = 0;
  for (const group of renderGroups) {
    const boxHeight = panelHeight(group.layout.height);
    roundRect(
      ctx,
      pad,
      y,
      width - pad * 2,
      boxHeight,
      20,
      "#0b111e",
      "rgba(169,207,255,.07)",
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "800 20px system-ui";
    ctx.fillText(group.name, width / 2, y + 29);

    for (const { cluster, x: clusterX, y: clusterY, w, h, columns } of group.layout.placements) {
        const x = pad + panelPad + clusterX;
        const clusterTop = y + titleHeight + clusterY;
        roundRect(
          ctx,
          x,
          clusterTop,
          w,
          h,
          10,
          "#101827",
          "rgba(169,207,255,.06)",
        );
        ctx.textAlign = "left";
        ctx.fillStyle = "#b7d6ff";
        ctx.font = "700 11px system-ui";
        ctx.fillText(cluster.name, x + clusterPad, clusterTop + 14);

        for (const [index, item] of cluster.items.entries()) {
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
            ctx.drawImage(
              image,
              cellX + (cellWidth - drawW) / 2,
              cellY + (cellHeight - drawH) / 2,
              drawW,
              drawH,
            );
          } else {
            ctx.textAlign = "center";
            ctx.fillStyle = "#b7d6ff";
            ctx.font = "700 22px system-ui";
            ctx.fillText("✦", cellX + cellWidth / 2, cellY + 36);
          }
          drawnSinceYield += 1;
          if (drawnSinceYield === exportDrawBatchSize) {
            drawnSinceYield = 0;
            await yieldToBrowser();
          }
        }
    }
    y += boxHeight + sectionGap;
  }
    ctx.restore();
    images.push(await canvasToPng(canvas));
    releasePageIcons(pageItems[page.index], icons);
    canvas.width = 1;
    canvas.height = 1;
    onProgress?.({
      completed: page.index + 1,
      total: pages.length,
      phase: "rendering",
    });
  }

  return {
    images,
    loadedIconCount: loadedIconGuids.size,
    failedIconCount: items.length - loadedIconGuids.size,
  } satisfies ExportShowcaseResult;
};
