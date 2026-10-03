import itemGuids from "./sky-info-item-guids.json";

export type GiftArchivePreview = { guids: string[]; unknown: string[]; packages: number };

export function parseGiftArchiveHtml(html: string, validGuids: ReadonlySet<string>): GiftArchivePreview {
  // A detached template is inert: scripts, images, iframes and event handlers
  // are never mounted, executed or fetched. Only text/alt attributes are read.
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;
  const rows = root.querySelectorAll("#gl .g-item");
  const expected = root.querySelector("#gc")?.textContent?.trim();
  if (!expected || !/^\d+$/.test(expected) || Number(expected) !== rows.length || rows.length > 1000)
    throw new Error("禮包清單不完整，請等查詢結果全部顯示後重新儲存");
  if (!rows.length) throw new Error("封存檔沒有禮包清單，請先完成禮包查詢再儲存");
  const guids = new Set<string>(), unknown = new Set<string>();
  const mapping: Readonly<Record<string, string>> = itemGuids;
  rows.forEach((row, index) => {
    const icons = row.querySelectorAll(".g-unlocks img");
    if (!icons.length) unknown.add(`第 ${index + 1} 個禮包：缺少物品圖示`);
    icons.forEach((icon) => {
      const name = icon.getAttribute("alt") || "";
      const guid = Object.hasOwn(mapping, name) ? mapping[name] : undefined;
      if (guid && validGuids.has(guid)) guids.add(guid);
      else unknown.add(/^CharSkyKid_[A-Za-z0-9_]{1,160}$/.test(name) ? name : `第 ${index + 1} 個禮包：無法辨識的物品`);
    });
  });
  return { guids: [...guids], unknown: [...unknown], packages: rows.length };
}
