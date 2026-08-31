import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import {
  assertSnapshotNotShrunk,
  writeFileAtomically,
} from "./lib/sync-safety.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE_SOURCE = "https://unpkg.com/skygame-data@latest/package.json";
const writeSnapshot = process.argv.includes("--write");
const allowShrink = process.argv.includes("--allow-shrink");
const FETCH_TIMEOUT_MS = 20_000;

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

// Exact data from Silverfeelin/SkyGame-Data PR #125 while it awaits merge.
const pendingUpstreamIaps = [
  {
    guid: "h09-v8Mh-Q",
    name: "Starry Night's Canopy",
    price: 14.99,
    items: ["OAGgi-B-xa"],
  },
];
const pendingUpstreamItems = [
  {
    id: 3269,
    order: 5500,
    guid: "OAGgi-B-xa",
    name: "Starry Night's Canopy",
    type: "Held",
  },
];
const ignoredIapItemTypes = new Set(["Special"]);

const fetchJson = async (url, label) => {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`${label} download failed: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${label} download failed: ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} did not contain valid JSON: ${error.message}`);
  }
};
const hasItemShape = (item) =>
  item &&
  typeof item.guid === "string" && item.guid.length > 0 &&
  typeof item.name === "string" && item.name.length > 0 &&
  typeof item.id === "number";
const hasIapShape = (iap) =>
  iap &&
  typeof iap.guid === "string" && iap.guid.length > 0 &&
  typeof iap.name === "string" && iap.name.length > 0 &&
  Number.isFinite(Number(iap.price)) && Number(iap.price) >= 0 &&
  Array.isArray(iap.items) &&
  iap.items.every((guid) => typeof guid === "string" && guid.length > 0) &&
  new Set(iap.items).size === iap.items.length;

const uniqueMap = (rows, label) => {
  const result = new Map();
  for (const row of rows) {
    if (result.has(row.guid))
      throw new Error(`SkyGame-Data contains a duplicate ${label} GUID: ${row.guid}`);
    result.set(row.guid, row);
  }
  return result;
};

const sourcePackage = await fetchJson(PACKAGE_SOURCE, "SkyGame-Data version");
const sourceVersion = sourcePackage.version;
if (typeof sourceVersion !== "string" || !sourceVersion)
  throw new Error("SkyGame-Data package did not report a version.");
const sourceUrl = `https://unpkg.com/skygame-data@${sourceVersion}/assets/everything.json`;
const source = await fetchJson(sourceUrl, "SkyGame-Data");
if (!Array.isArray(source?.items?.items) || !source.items.items.every(hasItemShape))
  throw new Error("SkyGame-Data item schema is invalid.");
if (!Array.isArray(source?.iaps?.items) || !source.iaps.items.every(hasIapShape))
  throw new Error("SkyGame-Data IAP schema is invalid.");
const iaps = [...source.iaps.items];
for (const pending of pendingUpstreamIaps) {
  if (!iaps.some((iap) => iap.guid === pending.guid)) iaps.push(pending);
}
uniqueMap(iaps, "IAP");
const catalog = await loadRuntimeCatalog();
const upstreamByGuid = uniqueMap(
  [...source.items.items, ...pendingUpstreamItems],
  "item",
);
const localByGuid = new Map(catalog.wikiItems.map((item) => [item.guid, item]));
if (localByGuid.size !== catalog.wikiItems.length)
  throw new Error("Runtime catalog contains duplicate item GUIDs.");

// SkyGame-Data intentionally lists some items in both standalone and bundle
// IAPs. Select the smallest/least expensive offer deterministically and retain
// every alternative key in the generated row. This is distinct from malformed
// duplicate GUIDs, which are rejected above.
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
  for (const upstreamGuid of iap.items ?? []) {
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
    rows.push({
      guid: local.guid,
      name: local.name,
      playerName: catalog.zhName(local.name),
      aliases: upstream?.name && upstream.name !== local.name ? [upstream.name] : [],
      packageKey: stableKey(iap),
      packageName: iap.name,
      paid: Number(iap.price) > 0,
      series: classifySeries(local.name, iap.name, local.collection),
      availability: availabilityFor(local.name, iap.name),
      ...(platform ? { platform } : {}),
      importance: "standard",
      returning: "unknown",
      ...(offers.length > 1
        ? { alternativePackageCount: offers.length - 1 }
        : {}),
    });
  }
}

if (unresolved.length)
  throw new Error(
    `IAP sync refused: ${unresolved.length} exact GUID mappings are unresolved.\n${unresolved.join("\n")}`,
  );

rows.sort((a, b) => a.guid.localeCompare(b.guid));
const payload = {
  source: "SkyGame-Data",
  sourceUrl,
  sourceVersion,
  packages: iaps.length,
  multiPackageItems: [...offersByItem.values()].filter((offers) => offers.length > 1).length,
  packageSelection: "fewest-items, lowest-price, guid",
  items: rows,
};
const destination = resolve(ROOT, "app", "iap-catalog.json");
const output = `${JSON.stringify(payload, null, 2)}\n`;
const previous = await readFile(destination, "utf8").catch(() => null);
if (previous === output) {
  console.log(`IAP catalog is current: ${rows.length} mappings from ${payload.packages} packages.`);
} else if (writeSnapshot) {
  const previousCount = previous
    ? (JSON.parse(previous).items?.length ?? 0)
    : 0;
  assertSnapshotNotShrunk({
    label: "the IAP catalog",
    previousCount,
    nextCount: rows.length,
    allowShrink,
  });
  await writeFileAtomically(destination, output);
  console.log(`Wrote ${rows.length} catalog IAP item mappings from ${payload.packages} packages.`);
} else {
  console.error(
    `IAP catalog is outdated: ${rows.length} mappings from ${payload.packages} packages. Run with --write after review.`,
  );
  process.exitCode = 1;
}
