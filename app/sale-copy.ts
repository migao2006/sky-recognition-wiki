import type { BindingKey, BindingStatus } from "./account-config";
import { formatMarketBindings } from "./market-copy";

export type SaleCopyInput = {
  accountName: string;
  accountType: string;
  selectedCount: number;
  earliestGraduationSeason: string;
  seasonNames: string[];
  graduationStatus: string[];
  bindings: Partial<Record<BindingKey, BindingStatus>>;
  resources: {
    candles: string;
    hearts: string;
    ascended: string;
    passes: string;
  };
  uniqueEvents: string[];
  otherPackages: string[];
  highlights: string[];
  notes: string;
};

const compactList = (items: string[]) =>
  [...new Set(items.map((item) => item.trim()).filter(Boolean))].join("⸝");

const hasValue = (value: string) => {
  const normalized = value.trim();
  return normalized && Number(normalized) !== 0 ? normalized : "";
};

const resourceLine = (resources: SaleCopyInput["resources"]) => {
  const rows = ([
    ["candles", "𖠜"],
    ["hearts", "ෆ"],
    ["ascended", "✦"],
  ] as const)
    .map(([key, suffix]) => {
      const value = hasValue(resources[key]);
      return value ? `${value}${suffix}` : "";
    })
    .filter(Boolean);
  const passes = hasValue(resources.passes);
  if (passes) rows.push(`${passes}副卡`);
  return rows.join("｜");
};

const titleOf = (data: SaleCopyInput) => {
  if (data.accountName.trim()) return data.accountName.trim();
  return `${data.accountType || "光遇"}號`;
};

const section = (heading: string, content: string[]) =>
  content.length ? [heading, ...content, ""] : [];

export const buildSaleCopy = (data: SaleCopyInput) => {
  const seasons = compactList(data.seasonNames);
  const graduation = compactList(data.graduationStatus);
  const seasonContent = [
    data.earliestGraduationSeason
      ? `最早畢業季：${data.earliestGraduationSeason}`
      : "",
    seasons ? `季節物品：${seasons}` : "",
    graduation ? `畢業：${graduation}` : "",
  ].filter(Boolean);
  const uniqueEvents = compactList(data.uniqueEvents);
  const otherPackages = compactList(data.otherPackages);
  const resources = resourceLine(data.resources);
  const notes = data.notes.trim();

  return [
    `▍⬪ ${titleOf(data)}`,
    "",
    ...section("♤ › 季節", seasonContent),
    ...section("♡ › 綁定", [formatMarketBindings(data.bindings)]),
    ...section("◇ › 限定／聯動", uniqueEvents ? [uniqueEvents] : []),
    ...section("ᴏᴛʜᴇʀs ╻", otherPackages ? [otherPackages] : []),
    ...section("⭔ › 資源", resources ? [resources] : []),
    ...section("⚝ › 備註", notes ? [notes] : []),
    "─── ☁ 文案為輔 · 影片為主 ☁ ───",
  ];
};

export const buildShareSummary = (data: SaleCopyInput) => {
  const graduation = compactList(data.graduationStatus);
  const season = [
    data.earliestGraduationSeason
      ? `最早畢業季 ${data.earliestGraduationSeason}`
      : "",
    graduation ? `畢業 ${graduation}` : "",
  ].filter(Boolean);
  const highlights = compactList(data.highlights.slice(0, 12));
  const resources = resourceLine(data.resources);

  return [
    `▍⬪ ${titleOf(data)}`,
    season.length ? `♤ › ${season.join(" ┊ ")}` : "",
    `♡ › ${formatMarketBindings(data.bindings)}`,
    highlights ? `◇ › ${highlights}` : "",
    resources ? `⭔ › ${resources}` : "",
    data.selectedCount ? `衣櫃 ${data.selectedCount} 件` : "",
    data.notes.trim() ? `⚝ › ${data.notes.trim()}` : "",
    "─── ☁ 文案為輔 · 影片為主 ☁ ───",
  ].filter(Boolean);
};
