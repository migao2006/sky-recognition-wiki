import type { WikiItem } from "./wiki-data";
import { marketCollectibleProfile } from "./market-collectibles";
export {
  isGraduationGift,
  isSeasonPendant,
  isSeasonUltimate,
} from "./season-items";

export const isPaidItem = (item: WikiItem) =>
  marketCollectibleProfile(item.name, item.guid)?.paid === true || /Pack/i.test(item.wiki);

export const canonicalPackageKey = (item: WikiItem) => {
  if (!isPaidItem(item)) return null;
  const profileKey = marketCollectibleProfile(item.name, item.guid)?.packageKey;
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
  marketCollectibleProfile(item.name, item.guid)?.availability === "china" ||
  /\b(?:china|cn|guo?fu|netease)\b|國服|国服/i.test(
    `${item.name} ${item.wiki} ${item.collection} ${item.group}`,
  );

export const limitedItemKind = (item: WikiItem) => {
  const profile = marketCollectibleProfile(item.name, item.guid);
  if (profile?.availability === "platform") return "platform" as const;
  if (profile && profile.valuationMultiplier >= 1.5) return "permanent" as const;
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (isChinaOnlyItem(item)) return "china" as const;
  if (/nintendo|playstation|steam|twitch/i.test(source)) return "platform" as const;
  if (/kizuna|aurora|little prince|moomin|cinnamoroll|journey|nine-colored/i.test(source))
    return "permanent" as const;
  if (/days of|anniversary|mischief|feast|fortune|love|bloom|rainbow|summer[_ -]?camping/i.test(source))
    return "annual" as const;
  return "limited" as const;
};

export const packageValuationMultiplier = (item: WikiItem) => {
  const verified = marketCollectibleProfile(item.name, item.guid)?.valuationMultiplier;
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
  const profilePlatform = marketCollectibleProfile(item.name, item.guid)?.platform;
  if (profilePlatform) return profilePlatform;
  const source = `${item.name} ${item.wiki} ${item.collection} ${item.group}`;
  if (/nintendo/i.test(source)) return "nintendo";
  if (/playstation/i.test(source)) return "playstation";
  if (/steam/i.test(source)) return "steam";
  if (/twitch/i.test(source)) return "twitch";
  return null;
};
