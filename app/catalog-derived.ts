import type { WikiItem } from "./wiki-data";
import { isPaidItem } from "./valuation-items";
import { isGraduationGift, isSeasonPendant, isSeasonUltimate } from "./season-items";
import { wikiItems } from "./catalog-seeds";
import {
  allClosetTypeSet,
  heldClosetOrder,
  labels,
} from "./catalog-taxonomy";
import {
  eventZh,
  ongoingSeasonSlugs,
  realmZh,
  seasonOrder,
  seasonZh,
  seasonSearchAliases,
  seasons,
  source,
  sourceKind,
} from "./catalog-sources";
import { zhItemSearchNames } from "./catalog-zh";
const valuationKey = (x: WikiItem) => {
  if (isSeasonPendant(x)) return "pendant";
  if (isGraduationGift(x)) return "discontinued";
  if (x.section === "seasons") return "season";
  const kind = sourceKind(x);
  if (kind === "聯動") return "collab";
  if (kind === "年度活動" || kind === "特殊活動") return "annual";
  if (kind === "平台限定") return "platform";
  return kind === "國服限定" ? "china" : "permanent";
};
const valuationClass = (x: WikiItem) =>
  ({
    discontinued: "絕版核心 · 季節畢業禮",
    pendant: "季卡項鍊 · 非畢業禮",
    season: "季節物品 · 可能復刻",
    collab: "聯動限定 · 返場不確定",
    annual: "年度／特殊活動 · 通常可返場",
    platform: "平台專屬物品",
    china: "國服限定物品",
    permanent: "常駐／一般取得",
  })[valuationKey(x)];
export const sourceFilters = [
  { key: "all", name: "全部來源" },
  { key: "seasons", name: "季節" },
  { key: "annual", name: "年度／特殊活動" },
  { key: "collab", name: "聯動" },
  { key: "package", name: "付費物品" },
  { key: "platform", name: "平台限定" },
  { key: "permanent", name: "常駐" },
  { key: "other", name: "國服／其他限定" },
];
export const typeOrder = new Map(
  [...allClosetTypeSet].map((type, index) => [type, index]),
);
export type CatalogOrderMode = "type" | "held" | "shared";
export const compareCatalogItems = (
  left: WikiItem,
  right: WikiItem,
  mode: CatalogOrderMode = "type",
) => {
  if (mode === "held") {
    const heldOrderDifference =
      (heldClosetOrder.get(left.guid) ?? 999) -
      (heldClosetOrder.get(right.guid) ?? 999);
    if (heldOrderDifference) return heldOrderDifference;
  }
  return (
    (mode === "type"
      ? (typeOrder.get(left.type) ?? 99) - (typeOrder.get(right.type) ?? 99)
      : 0) ||
    left.order - right.order ||
    left.name.localeCompare(right.name) ||
    left.guid.localeCompare(right.guid)
  );
};
const limitedSourceKinds = new Set(["聯動", "平台限定", "限定"]);
export const isLimitedItem = (x: WikiItem) =>
  x.group === "Limited" || limitedSourceKinds.has(sourceKind(x));
export const uniqueByGuid = (items: WikiItem[]) => {
  const unique = new Map<string, WikiItem>();
  items.forEach((item) => unique.set(item.guid, item));
  return [...unique.values()];
};
export const sortSeasonSlugs = (slugs: string[]) =>
  [...slugs].sort(
    (a, b) => (seasonOrder.get(a) ?? 999) - (seasonOrder.get(b) ?? 999),
  );
export const seasonUltimateSlugs = seasons
  .map(([slug]) => slug)
  .filter((slug) =>
    wikiItems.some(
      (x) =>
        x.section === "seasons" &&
        x.collection === slug &&
        isSeasonUltimate(x) &&
        allClosetTypeSet.has(x.type),
    ),
  );
const ultimateItemsForSeason = (slug: string) =>
  wikiItems
    .filter(
      (x) =>
        x.section === "seasons" &&
        x.collection === slug &&
        isSeasonUltimate(x) &&
        allClosetTypeSet.has(x.type),
    )
    .sort(
      (a, b) =>
        Number(isSeasonPendant(b)) - Number(isSeasonPendant(a)) || a.id - b.id,
    );
export const seasonUltimateItems = new Map(
  seasonUltimateSlugs.map((slug) => [slug, ultimateItemsForSeason(slug)]),
);
export const seasonGraduationItems = new Map(
  seasonUltimateSlugs.map((slug) => [
    slug,
    (seasonUltimateItems.get(slug) || []).filter(isGraduationGift),
  ]),
);
export const graduationSeasonSlugs = seasonUltimateSlugs.filter(
  (slug) =>
    !ongoingSeasonSlugs.has(slug) &&
    (seasonGraduationItems.get(slug)?.length ?? 0) > 0,
);
export const matchesSourceFilter = (x: WikiItem, key: string) => {
  if (key === "all") return true;
  const kind = sourceKind(x);
  if (key === "seasons") return x.section === "seasons";
  if (key === "annual") return ["年度活動", "特殊活動"].includes(kind);
  if (key === "collab") return kind === "聯動";
  if (key === "package") return isPaidItem(x);
  if (key === "platform") return kind === "平台限定";
  if (key === "permanent")
    return (
      ["realms", "base"].includes(x.section) ||
      (x.section === "store" && !isPaidItem(x) && kind !== "平台限定")
    );
  return key === "other" && ["國服限定", "限定"].includes(kind);
};
const marketHighlightNames = new Set([
  "Prophet of Fire Outfit",
  "Peeking Postman Cape",
  "Festival Spin Dancer Outfit",
  "Respectful Pianist Hair",
  "Daydream Forester Hair",
]);
export const isValuationFocus = (x: WikiItem) =>
  isSeasonUltimate(x) ||
  isLimitedItem(x) ||
  isPaidItem(x) ||
  marketHighlightNames.has(x.name);
const professionalVideoKinds = new Set(["聯動", "平台限定"]);
export const isProfessionalVideoFocus = (x: WikiItem) => {
  const kind = sourceKind(x);
  return (
    kind !== "國服限定" &&
    (isSeasonUltimate(x) ||
      isPaidItem(x) ||
      professionalVideoKinds.has(kind) ||
      marketHighlightNames.has(x.name))
  );
};
export const searchIndex = new Map(
  wikiItems
    .filter((x) => allClosetTypeSet.has(x.type))
    .map((x) => [
      x.guid,
      [
        ...zhItemSearchNames(x),
        labels[x.type] || x.type,
        source(x),
        sourceKind(x),
        valuationClass(x),
        String(x.id),
        seasonZh[x.collection] || "",
        ...(seasonSearchAliases[x.collection] ?? []),
        eventZh[x.collection] || "",
        realmZh[x.collection] || "",
      ]
        .join(" ")
        .toLocaleLowerCase("zh-Hant"),
    ]),
);
