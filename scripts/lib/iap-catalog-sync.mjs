const classifySeries = (name, packageName, collection) => {
  const text = `${name} ${packageName} ${collection}`.toLowerCase();
  if (/nine.?colored|九色鹿/.test(text)) return "九色鹿";
  if (/nintendo/.test(text)) return "Nintendo";
  if (/little prince/.test(text)) return "小王子";
  if (/aurora/.test(text)) return "AURORA";
  if (/kizuna/.test(text)) return "絆愛";
  if (/cinnamoroll/.test(text)) return "大耳狗";
  if (/moomin/.test(text)) return "姆明";
  if (/journey/.test(text)) return "風之旅人";
  if (/playstation/.test(text)) return "PlayStation";
  return "付費禮包";
};

const platformFor = (name, packageName) => {
  const text = `${name} ${packageName}`.toLowerCase();
  if (/nintendo/.test(text)) return "nintendo";
  if (/playstation/.test(text)) return "playstation";
  if (/steam/.test(text)) return "steam";
  if (/twitch/.test(text)) return "twitch";
  return undefined;
};

const availabilityFor = (name, packageName) => {
  const text = `${name} ${packageName}`.toLowerCase();
  if (/netease|china|guo?fu|国服|國服/.test(text)) return "china";
  return platformFor(name, packageName) ? "platform" : "global";
};

const stableKey = (iap) => `iap:${iap.guid}`;
const ignoredIapItemTypes = new Set(["Special"]);

const offerRank = (iap) => [
  iap.items.length,
  Number.isFinite(Number(iap.price)) ? Number(iap.price) : Number.MAX_SAFE_INTEGER,
  iap.guid,
];
const compareOffers = (left, right) => {
  const leftRank = offerRank(left);
  const rightRank = offerRank(right);
  return leftRank[0] - rightRank[0] || leftRank[1] - rightRank[1] || leftRank[2].localeCompare(rightRank[2]);
};

export const buildIapCatalogRows = ({
  iaps,
  upstreamItems,
  catalogItems,
  zhName,
  reviewedNames = {},
}) => {
  const upstreamByGuid = new Map(upstreamItems.map((item) => [item.guid, item]));
  const localByGuid = new Map(catalogItems.map((item) => [item.guid, item]));
  const offersByItem = new Map();
  for (const iap of iaps) {
    for (const guid of iap.items) {
      const offers = offersByItem.get(guid) ?? [];
      offers.push(iap);
      offersByItem.set(guid, offers);
    }
  }
  for (const offers of offersByItem.values()) offers.sort(compareOffers);

  const rows = [];
  const unresolved = [];
  for (const iap of iaps) {
    for (const upstreamGuid of iap.items) {
      const offers = offersByItem.get(upstreamGuid) ?? [];
      if (offers[0] !== iap) continue;
      const upstream = upstreamByGuid.get(upstreamGuid);
      if (!upstream) {
        unresolved.push(`${iap.name}: unknown upstream item ${upstreamGuid}`);
        continue;
      }
      const local = localByGuid.get(upstreamGuid);
      if (!local) {
        if (ignoredIapItemTypes.has(upstream.type)) continue;
        unresolved.push(`${iap.name}: ${upstream.name} (${upstreamGuid}) is absent from the runtime catalog`);
        continue;
      }
      const platform = platformFor(local.name, iap.name);
      const generatedPlayerName = zhName(local.name);
      const reviewedName = reviewedNames[local.guid];
      const playerName = reviewedName?.playerName ?? generatedPlayerName;
      const aliases = Array.from(
        new Set([
          ...(upstream.name && upstream.name !== local.name ? [upstream.name] : []),
          ...(reviewedName?.aliases ?? []),
          ...(reviewedName && generatedPlayerName !== playerName ? [generatedPlayerName] : []),
        ]),
      ).filter((alias) => alias !== playerName);
      rows.push({
        guid: local.guid,
        name: local.name,
        playerName,
        aliases,
        ...(reviewedName ? { nameReviewed: true } : {}),
        packageKey: stableKey(iap),
        packageName: iap.name,
        paid: Number(iap.price) > 0,
        series: classifySeries(local.name, iap.name, local.collection),
        availability: availabilityFor(local.name, iap.name),
        ...(platform ? { platform } : {}),
        importance: "standard",
        returning: "unknown",
        ...(offers.length > 1 ? { alternativePackageCount: offers.length - 1 } : {}),
      });
    }
  }
  if (unresolved.length)
    throw new Error(
      `IAP sync refused: ${unresolved.length} exact GUID mappings are unresolved.\n${unresolved.join("\n")}`,
    );
  rows.sort((a, b) => a.guid.localeCompare(b.guid));
  return { rows, offersByItem };
};
