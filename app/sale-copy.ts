import {
  bindingStatusNames,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { marketCollectibleProfile } from "./market-collectibles";

export type SaleSeasonProgress = {
  name: string;
  owned: number;
  total: number;
};

export type SaleCopyItem = {
  guid: string;
  name: string;
  displayName: string;
  section: string;
  collection: string;
  group: string;
  wiki: string;
  sourceName: string;
  order: number;
};

export type SaleCopyInput = {
  seasons: SaleSeasonProgress[];
  bindingsConfirmed: boolean;
  bindings: Partial<Record<BindingKey, BindingStatus>>;
  items: SaleCopyItem[];
};

type CopyGroup = {
  name: string;
  rank: number;
  items: string[];
};

const divider = "╶────── ✦ ──────╴";
const platformNames: Record<BindingKey, string> = {
  google: "GG",
  nintendo: "NS",
  gameCenter: "GC",
  facebook: "FB",
  steam: "Steam",
  twitch: "Twitch",
  playstation: "PSN",
};
const bindingKeys = Object.keys(platformNames) as BindingKey[];

const formatBindings = (
  confirmed: boolean,
  bindings: Partial<Record<BindingKey, BindingStatus>>,
) => {
  if (!confirmed) return "";
  const rows = bindingKeys.flatMap((key) => {
    const status = bindings[key];
    return status && status !== "none"
      ? [`${platformNames[key]} ${bindingStatusNames[status]}`]
      : [];
  });
  return rows.length ? rows.join("｜") : "無綁";
};

const shortSeasonName = (name: string) => name.trim().replace(/季$/, "");
const wrapSeasonProgress = (seasons: SaleSeasonProgress[]) => {
  const validSeasons = seasons.filter(
    (season) =>
      season.total > 0 && season.owned >= 0 && season.owned <= season.total,
  );
  const start = validSeasons.findIndex((season) => season.owned > 0);
  if (start < 0) return [];
  const tokens = validSeasons.slice(start).map((season) => {
    const name = shortSeasonName(season.name);
    if (!season.owned) return `${name}⁰`;
    if (season.total > 0 && season.owned === season.total) return `${name}畢`;
    return `${name}${season.owned}/${season.total}`;
  });
  return Array.from({ length: Math.ceil(tokens.length / 4) }, (_, index) =>
    tokens.slice(index * 4, index * 4 + 4).join("｜"),
  );
};

const collaborationSeries = [
  { name: "九色鹿", pattern: /nine-colored|九色鹿/i },
  { name: "Nintendo", pattern: /nintendo/i },
  { name: "小王子", pattern: /little prince|小王子/i },
  { name: "AURORA", pattern: /aurora/i },
  { name: "絆愛", pattern: /kizuna|絆愛/i },
  { name: "大耳狗", pattern: /cinnamoroll|大耳狗/i },
  { name: "姆明", pattern: /moomin|姆明/i },
  { name: "風之旅人", pattern: /journey|風之旅人/i },
  { name: "PlayStation", pattern: /playstation/i },
  { name: "Steam", pattern: /sky_for_steam|\bsteam\b/i },
] as const;

const itemSearchText = (item: SaleCopyItem) =>
  [
    item.name,
    item.displayName,
    item.wiki,
    item.collection,
    item.sourceName,
  ].join(" ");
const collaborationOf = (item: SaleCopyItem) => {
  const verified = marketCollectibleProfile(item.name);
  if (verified?.saleCopy && verified.saleSection === "collaboration") {
    const rank = collaborationSeries.findIndex(
      (series) => series.name === verified.series,
    );
    return {
      name: verified.series,
      rank: rank >= 0 ? rank : collaborationSeries.length,
    };
  }
  const rank = collaborationSeries.findIndex((series) =>
    series.pattern.test(itemSearchText(item)),
  );
  return rank >= 0
    ? { name: collaborationSeries[rank].name, rank }
    : null;
};

const tidyItemName = (series: string, name: string) => {
  if (series === "Nintendo")
    return name.replace(/^Nintendo(?: Switch)?\s*/i, "").trim();
  if (series === "九色鹿")
    return name
      .replace(/^染色之九色鹿/, "九色鹿")
      .replace(/^禮物之九色鹿鹿角$/, "鹿角")
      .replace(/^禮物之九色鹿面具$/, "九色鹿面具")
      .replace(/^先祖之壁畫面具$/, "先祖壁畫面具");
  return name;
};

const anniversaryNumber = (item: SaleCopyItem) => {
  const ordinal = item.name.match(/\b(\d+)(?:st|nd|rd|th)\s+Anniversary/i);
  if (ordinal) return Number(ordinal[1]);
  const year = item.wiki.match(/Sky_Anniversary\/(20\d{2})/i);
  return year ? Number(year[1]) - 2019 : null;
};
const ordinalLabel = (value: number) => {
  const mod100 = value % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
};
const tidyAnniversaryName = (name: string) =>
  name
    .replace(/天空慶典\s*\d+(?:st|nd|rd|th)?週年/gi, "週年")
    .replace(/^\d+(?:st|nd|rd|th)?週年/i, "週年")
    .replace(/^週年慶/, "週年")
    .replace(/週年帽子/g, "週年帽")
    .replace(/T恤襯衫/g, "T恤");

const appendGroup = (
  groups: Map<string, CopyGroup>,
  key: string,
  name: string,
  rank: number,
  itemName: string,
) => {
  const group = groups.get(key) ?? { name, rank, items: [] };
  if (!group.items.includes(itemName)) group.items.push(itemName);
  groups.set(key, group);
};

const groupCollectibles = (items: SaleCopyItem[]) => {
  const limited = new Map<string, CopyGroup>();
  const anniversaries = new Map<string, CopyGroup>();
  const special = new Map<string, CopyGroup>();
  const other = new Map<string, CopyGroup>();
  const seen = new Set<string>();
  const seenNames = new Set<string>();

  const isSpecialItem = (item: SaleCopyItem) =>
    item.section === "events" ||
    item.section === "seasons" ||
    item.group === "Limited" ||
    item.sourceName.includes("限定");
  const categoryRank = (item: SaleCopyItem) =>
    item.collection === "event-sky-anniversary"
      ? 0
      : collaborationOf(item)
        ? 1
        : isSpecialItem(item)
          ? 2
          : 3;
  const appendUnique = (
    groups: Map<string, CopyGroup>,
    key: string,
    name: string,
    rank: number,
    itemName: string,
  ) => {
    if (seenNames.has(itemName)) return;
    seenNames.add(itemName);
    appendGroup(groups, key, name, rank, itemName);
  };

  [...items]
    .sort((a, b) => categoryRank(a) - categoryRank(b) || a.order - b.order)
    .forEach((item) => {
      if (seen.has(item.guid)) return;
      seen.add(item.guid);
      if (item.collection === "event-sky-anniversary") {
        const number = anniversaryNumber(item);
        const key = number ? String(number) : "other";
        appendUnique(
          anniversaries,
          key,
          number ? ordinalLabel(number) : "其他",
          number ? -number : 999,
          tidyAnniversaryName(item.displayName),
        );
        return;
      }

      const collaboration = collaborationOf(item);
      if (collaboration) {
        appendUnique(
          limited,
          collaboration.name,
          collaboration.name,
          collaboration.rank,
          tidyItemName(collaboration.name, item.displayName),
        );
        return;
      }

      const sourceName =
        shortSeasonName(item.sourceName).split("／")[0] || "其他";
      appendUnique(
        isSpecialItem(item) ? special : other,
        sourceName,
        sourceName,
        100,
        item.displayName,
      );
    });

  const ordered = (groups: Map<string, CopyGroup>) =>
    [...groups.values()].sort(
      (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "zh-Hant"),
    );
  const format = (groups: Map<string, CopyGroup>) =>
    ordered(groups).map((group) => `${group.name}｜${group.items.join("・")}`);
  const directItems = (groups: Map<string, CopyGroup>) => {
    const names = ordered(groups).flatMap((group) => group.items);
    return Array.from({ length: Math.ceil(names.length / 4) }, (_, index) =>
      names.slice(index * 4, index * 4 + 4).join("・"),
    );
  };
  return {
    limited: format(limited),
    anniversaries: format(anniversaries),
    special: directItems(special),
    other: directItems(other),
  };
};

const section = (heading: string, content: string[]) =>
  content.length ? [`✦ ${heading}`, ...content] : [];
const joinSections = (sections: string[][]) =>
  sections.filter((rows) => rows.length).flatMap((rows, index) =>
    index ? ["", divider, "", ...rows] : rows,
  );

export const buildSaleCopy = (data: SaleCopyInput) => {
  const groups = groupCollectibles(data.items);
  const binding = formatBindings(data.bindingsConfirmed, data.bindings);
  return joinSections([
    section("季節進度", wrapSeasonProgress(data.seasons)),
    section("綁定狀態", binding ? [binding] : []),
    section("限定聯動", groups.limited),
    section("週年收藏", groups.anniversaries),
    section("特殊限定", groups.special),
    section("其他收藏", groups.other),
  ]);
};

export const buildShareSummary = buildSaleCopy;
