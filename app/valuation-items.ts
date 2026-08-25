import type { WikiItem } from "./wiki-data";

const paidMarketNames = new Set([
  "Spooky Bat Cape",
  "Cat Cape",
  "Cat Mask",
  "Mischief Witch Hair",
  "Mischief Witch Hat",
  "Mischief Withered Antlers",
  "Mischief Withered Cape",
  "Snowflake Cape",
  "Winter Feast Snowglobe",
  "Days of Feast Horns",
  "Rainbow Headphones",
  "Little Prince Asteroid Jacket",
  "Little Prince Scarf Cape",
  "Little Prince Fox",
  "Wings of AURORA",
  "Giving In Cape",
  "To The Love Outfit",
  "Kizuna AI Cape",
  "Kizuna AI Hair",
  "Kizuna AI Bow",
  "Radiance of the Nine-Colored Deer Cape",
  "Gift of the Nine-Colored Deer Antlers",
  "Gift of the Nine-Colored Deer Mask",
  "Moominmamma's Masterpiece Cape",
  "Moomintroll Ears",
  "Moomintroll Tail",
  "Hattifattener Shoulder Buddy",
  "Pointed Snufkin Hat",
  "Roving Snufkin Robe",
  "Roving Snufkin Scarf",
  "Cinnamoroll Plushie",
  "Cinnamoroll Ears",
  "Cinnamoroll Swirled Hair",
  "Cinnamoroll Cloud Cape",
  "Cinnamoroll Bowtie",
  "Cinnamoroll Mini Companion",
]);

export const isSeasonUltimate = (item: WikiItem) =>
  item.section === "seasons" && item.group === "Ultimate";

export const isSeasonPendant = (item: WikiItem) =>
  isSeasonUltimate(item) &&
  item.type === "Necklace" &&
  /Ultimate Pendant/i.test(item.name);

export const isGraduationGift = (item: WikiItem) =>
  isSeasonUltimate(item) && !isSeasonPendant(item);

export const isPaidItem = (item: WikiItem) =>
  /Pack/i.test(item.wiki) || paidMarketNames.has(item.name);

export const monotonicCoefficient = (coefficient: number) =>
  Math.max(0, coefficient);
