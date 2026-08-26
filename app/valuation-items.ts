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

export const canonicalPackageKey = (item: WikiItem) => {
  if (!isPaidItem(item)) return null;
  try {
    const url = new URL(item.wiki);
    const path = url.pathname.replace(/\/$/, "").toLocaleLowerCase();
    const hash = decodeURIComponent(url.hash.slice(1)).toLocaleLowerCase();
    if (/pack|set/.test(hash)) return `${url.hostname}${path}#${hash}`;
    if (/pack/.test(path)) return `${url.hostname}${path}`;
  } catch {
    // A stable name fallback is preferable to counting an invalid URL twice.
  }
  return `item:${item.name.trim().toLocaleLowerCase()}`;
};

export const isChinaOnlyItem = (item: WikiItem) =>
  /\b(?:china|cn|guo?fu)\b|國服|国服/i.test(
    `${item.name} ${item.wiki} ${item.collection} ${item.group}`,
  );

export const limitedItemKind = (item: WikiItem) => {
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (isChinaOnlyItem(item)) return "china" as const;
  if (/nintendo|playstation|steam|twitch/i.test(source)) return "platform" as const;
  if (/kizuna|aurora|little prince|moomin|cinnamoroll|journey|nine-colored/i.test(source))
    return "permanent" as const;
  if (/days of|anniversary|mischief|feast|fortune|love|bloom|rainbow/i.test(source))
    return "annual" as const;
  return "limited" as const;
};

export const platformBindingForItem = (item: WikiItem) => {
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (/nintendo/i.test(source)) return "nintendo";
  if (/playstation/i.test(source)) return "playstation";
  if (/steam/i.test(source)) return "steam";
  if (/twitch/i.test(source)) return "twitch";
  return null;
};
