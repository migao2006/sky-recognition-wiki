import type { WikiItem } from "./wiki-data";

export const isSeasonUltimate = (item: WikiItem) =>
  item.section === "seasons" && item.group === "Ultimate";

export const isSeasonPendant = (item: WikiItem) =>
  isSeasonUltimate(item) &&
  item.type === "Necklace" &&
  /Ultimate Pendant/i.test(item.name);

export const isGraduationGift = (item: WikiItem) =>
  isSeasonUltimate(item) && !isSeasonPendant(item);
