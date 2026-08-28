import type { WikiItem } from "./wiki-data";
import { marketCollectibleProfile } from "./market-collectibles";

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
  "Fledgling Harp",
  "Rhythm Guitar",
  "Triumph Handpan",
  "Blue Electric Guitar",
  "Voice of AURORA",
  "Vessel Flute",
  "Triumph Violin",
  "Fledgling Upright Piano",
  "Days of Fortune Enchanted Umbrella",
  "Days of Fortune Hand Fan",
  "Days of Love Serendipitous Scepter",
  "Bloom Lilypad Umbrella",
  "Bloom Sunflower Umbrella",
  "Lantern",
  "Summer Parasol",
  "Mischief Withered Broom",
  "Fortune Plush Mount",
  "Anniversary Popcorn Prop",
  "Anniversary Cinema 3D Glasses",
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
  marketCollectibleProfile(item.name) !== null ||
  /Pack/i.test(item.wiki) ||
  paidMarketNames.has(item.name);

export const canonicalPackageKey = (item: WikiItem) => {
  if (!isPaidItem(item)) return null;
  const profileKey = marketCollectibleProfile(item.name)?.packageKey;
  if (profileKey) return `verified:${profileKey}`;
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
  marketCollectibleProfile(item.name)?.availability === "china" ||
  /\b(?:china|cn|guo?fu|netease)\b|國服|国服/i.test(
    `${item.name} ${item.wiki} ${item.collection} ${item.group}`,
  );

export const limitedItemKind = (item: WikiItem) => {
  const profile = marketCollectibleProfile(item.name);
  if (profile?.availability === "platform") return "platform" as const;
  if (profile && profile.valuationMultiplier >= 1.5) return "permanent" as const;
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (isChinaOnlyItem(item)) return "china" as const;
  if (/nintendo|playstation|steam|twitch/i.test(source)) return "platform" as const;
  if (/kizuna|aurora|little prince|moomin|cinnamoroll|journey|nine-colored/i.test(source))
    return "permanent" as const;
  if (/days of|anniversary|mischief|feast|fortune|love|bloom|rainbow/i.test(source))
    return "annual" as const;
  return "limited" as const;
};

export const packageValuationMultiplier = (item: WikiItem) => {
  const verified = marketCollectibleProfile(item.name)?.valuationMultiplier;
  if (verified !== undefined) return verified;
  const kind = limitedItemKind(item);
  return kind === "permanent"
    ? 1.5
    : kind === "platform"
      ? 1.25
      : kind === "annual"
        ? 0.9
        : 0.75;
};

export const platformBindingForItem = (item: WikiItem) => {
  const profilePlatform = marketCollectibleProfile(item.name)?.platform;
  if (profilePlatform) return profilePlatform;
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (/nintendo/i.test(source)) return "nintendo";
  if (/playstation/i.test(source)) return "playstation";
  if (/steam/i.test(source)) return "steam";
  if (/twitch/i.test(source)) return "twitch";
  return null;
};
