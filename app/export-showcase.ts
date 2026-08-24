import type { WikiItem } from "./wiki-data";

type ExportShowcaseOptions = {
  items: WikiItem[];
  accountName: string;
  accountType: string;
  transferBindings: string;
  keptBindings: string;
  resources: string;
  isUltimate: (item: WikiItem) => boolean;
  isLimited: (item: WikiItem) => boolean;
  getClusterName: (item: WikiItem) => string;
  getClusterOrder: (item: WikiItem) => number;
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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return icons;
};

export const renderShowcaseImage = async ({
  items,
  accountName,
  accountType,
  transferBindings,
  keptBindings,
  resources,
  isUltimate,
  isLimited,
  getClusterName,
  getClusterOrder,
}: ExportShowcaseOptions) => {
  const ultimates = items.filter(isUltimate);
  const limited = items.filter((item) => !isUltimate(item) && isLimited(item));
  const featured = new Set([...ultimates, ...limited].map((item) => item.guid));
  const groups = [
    { name: "畢業禮", items: ultimates },
    { name: "禮包／限定", items: limited },
    { name: "其他物品", items: items.filter((item) => !featured.has(item.guid)) },
  ].filter((group) => group.items.length);

  const clusterItems = (clusterSource: WikiItem[]) => {
    const map = new Map<string, { name: string; items: WikiItem[]; order: number }>();
    clusterSource.forEach((item) => {
      const key = `${item.section}:${item.collection}`;
      const current = map.get(key);
      if (current) current.items.push(item);
      else map.set(key, { name: getClusterName(item), items: [item], order: getClusterOrder(item) });
    });
    return [...map.values()].sort((a, b) => a.order - b.order);
  };

  const width = 1200;
  const pad = 48;
  const panelPad = 28;
  const titleHeight = 62;
  const cell = 66;
  const iconGap = 8;
  const clusterGap = 12;
  const clusterPad = 11;
  const clusterTitle = 24;
  const maxClusterColumns = 6;
  const contentWidth = width - pad * 2 - panelPad * 2;

  const layoutClusters = (clusterSource: WikiItem[]) => {
    let cursorX = 0;
    let cursorY = 0;
    let shelfHeight = 0;
    const placements = clusterItems(clusterSource).map((cluster) => {
      const columns = Math.min(maxClusterColumns, Math.max(1, cluster.items.length));
      const rows = Math.ceil(cluster.items.length / columns);
      const w = clusterPad * 2 + columns * cell + (columns - 1) * iconGap;
      const h = clusterPad * 2 + clusterTitle + rows * cell + (rows - 1) * iconGap;
      if (cursorX && cursorX + w > contentWidth) {
        cursorX = 0;
        cursorY += shelfHeight + clusterGap;
        shelfHeight = 0;
      }
      const placement = { cluster, x: cursorX, y: cursorY, w, h, columns };
      cursorX += w + clusterGap;
      shelfHeight = Math.max(shelfHeight, h);
      return placement;
    });
    return { placements, height: cursorY + shelfHeight };
  };

  const headerHeight = 214;
  const footerHeight = 88;
  const sectionGap = 28;
  const visibleGroups = groups.length ? groups : [{ name: "衣櫃清單", items: [] as WikiItem[] }];
  const renderGroups = visibleGroups.map((group) => ({ ...group, layout: layoutClusters(group.items) }));
  const panelHeight = (layoutHeight: number) => titleHeight + Math.max(cell + 26, layoutHeight) + panelPad;
  const height = pad + headerHeight + renderGroups.reduce((sum, group) => sum + panelHeight(group.layout.height) + sectionGap, 0) + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#07131d");
  background.addColorStop(0.48, "#15303d");
  background.addColorStop(1, "#294955");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const aura = ctx.createRadialGradient(width * 0.72, 40, 20, width * 0.72, 40, width * 0.8);
  aura.addColorStop(0, "rgba(120,190,205,.25)");
  aura.addColorStop(1, "rgba(7,19,29,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  const roundRect = (x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) => {
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

  roundRect(pad, pad, width - pad * 2, headerHeight, 28, "rgba(5,15,23,.62)", "rgba(184,225,232,.15)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#f3f8f7";
  ctx.font = "800 38px system-ui";
  ctx.fillText(accountName || "光遇帳號衣櫃", pad + 32, pad + 58);
  ctx.fillStyle = "#b9dce2";
  ctx.font = "600 20px system-ui";
  ctx.fillText(`${accountType}　已登錄 ${items.length} 件`, pad + 32, pad + 96);
  ctx.fillStyle = "#91aeb6";
  ctx.font = "18px system-ui";
  ctx.fillText(`可出：${transferBindings}　｜　不出：${keptBindings}`, pad + 32, pad + 132, width - pad * 2 - 64);
  ctx.fillText(resources, pad + 32, pad + 166, width - pad * 2 - 64);

  const icons = await loadIcons(items);
  let y = pad + headerHeight + sectionGap;
  renderGroups.forEach((group) => {
    const boxHeight = panelHeight(group.layout.height);
    roundRect(pad, y, width - pad * 2, boxHeight, 28, "rgba(5,15,23,.55)", "rgba(184,225,232,.13)");
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "800 24px system-ui";
    ctx.fillText(`${group.name}　${group.items.length} 件`, width / 2, y + 40);

    if (!group.items.length) {
      ctx.fillStyle = "#9ab1b8";
      ctx.font = "20px system-ui";
      ctx.fillText("尚未選取任何衣櫃物品", width / 2, y + titleHeight + cell / 2 + 8);
    }

    group.layout.placements.forEach(({ cluster, x: clusterX, y: clusterY, w, h, columns }) => {
      const x = pad + panelPad + clusterX;
      const clusterTop = y + titleHeight + clusterY;
      roundRect(x, clusterTop, w, h, 16, "rgba(132,177,187,.08)", "rgba(184,225,232,.16)");
      ctx.textAlign = "left";
      ctx.fillStyle = "#a9cbd2";
      ctx.font = "700 14px system-ui";
      ctx.fillText(`${cluster.name}　${cluster.items.length}`, x + clusterPad, clusterTop + 21, w - clusterPad * 2);

      cluster.items.forEach((item, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const cellX = x + clusterPad + col * (cell + iconGap);
        const cellY = clusterTop + clusterPad + clusterTitle + row * (cell + iconGap);
        roundRect(cellX, cellY, cell, cell, 13, "rgba(255,255,255,.045)", "rgba(255,255,255,.06)");
        const image = icons.get(item.guid);
        if (image) {
          const max = cell - 16;
          const scale = Math.min(max / image.naturalWidth, max / image.naturalHeight);
          const drawW = image.naturalWidth * scale;
          const drawH = image.naturalHeight * scale;
          ctx.save();
          ctx.shadowColor = "rgba(255,224,139,.42)";
          ctx.shadowBlur = 9;
          ctx.drawImage(image, cellX + (cell - drawW) / 2, cellY + (cell - drawH) / 2, drawW, drawH);
          ctx.restore();
        } else {
          ctx.textAlign = "center";
          ctx.fillStyle = "#ffe4a8";
          ctx.font = "700 28px system-ui";
          ctx.fillText("✦", cellX + cell / 2, cellY + cell * 0.64);
        }
      });
    });
    y += boxHeight + sectionGap;
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#91aeb6";
  ctx.font = "16px system-ui";
  ctx.fillText("資料來源：SkyGame-Data・SkyGame-Planner・BWiki 中文清單", pad, y + 18);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ead49f";
  ctx.font = "700 18px system-ui";
  ctx.fillText(`全部：${items.length} 件`, width - pad, y + 18);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("image-export-failed")), "image/png");
  });
};
