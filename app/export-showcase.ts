import type { WikiItem } from "./wiki-data";

type ExportShowcaseOptions = {
  items: WikiItem[];
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
  width: 1200,
  pad: 40,
  panelPad: 28,
  titleHeight: 58,
  cellWidth: 86,
  cellHeight: 86,
  iconGap: 8,
  clusterGap: 12,
  clusterPad: 11,
  clusterTitle: 30,
  maxClusterColumns: 10,
  clusterMinWidth: 200,
  sectionGap: 24,
} as const;

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
    titleHeight + Math.max(cellHeight + 26, layoutHeight) + panelPad;
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
  return { width: showcaseMetrics.width, height };
};

export const renderShowcaseImage = async (options: ExportShowcaseOptions) => {
  const { items } = options;
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

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#04060c");
  background.addColorStop(0.52, "#0a1020");
  background.addColorStop(1, "#11152a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

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
  ctx.fillRect(0, 0, width, height);

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

  const icons = await loadIcons(items);
  let y = pad;
  renderGroups.forEach((group) => {
    const boxHeight = panelHeight(group.layout.height);
    roundRect(
      pad,
      y,
      width - pad * 2,
      boxHeight,
      28,
      "rgba(7,11,20,.76)",
      "rgba(169,207,255,.16)",
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "800 24px system-ui";
    ctx.fillText(group.name, width / 2, y + 38);

    group.layout.placements.forEach(
      ({ cluster, x: clusterX, y: clusterY, w, h, columns }) => {
        const x = pad + panelPad + clusterX;
        const clusterTop = y + titleHeight + clusterY;
        roundRect(
          x,
          clusterTop,
          w,
          h,
          16,
          "rgba(111,158,232,.07)",
          "rgba(169,207,255,.15)",
        );
        ctx.textAlign = "left";
        ctx.fillStyle = "#b7d6ff";
        ctx.font = "700 14px system-ui";
        ctx.fillText(cluster.name, x + clusterPad, clusterTop + 21);

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
          roundRect(
            cellX,
            cellY,
            cellWidth,
            cellHeight,
            13,
            "rgba(255,255,255,.045)",
            "rgba(255,255,255,.06)",
          );
          const image = icons.get(item.guid);
          if (image) {
            const maxWidth = cellWidth - 16;
            const maxHeight = 70;
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
            ctx.font = "700 28px system-ui";
            ctx.fillText("✦", cellX + cellWidth / 2, cellY + 55);
          }
        });
      },
    );
    y += boxHeight + sectionGap;
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("image-export-failed")),
      "image/png",
    );
  });
};
