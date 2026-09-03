import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";
import { buildIapCatalogRows } from "./lib/iap-catalog-sync.mjs";
import {
  assertSnapshotNotShrunk,
  writeFileAtomically,
} from "./lib/sync-safety.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const REVIEWED_NAMES_PATH = resolve(ROOT, "app", "reviewed-iap-player-names.json");
const PACKAGE_SOURCE = "https://unpkg.com/skygame-data@latest/package.json";
const writeSnapshot = process.argv.includes("--write");
const allowShrink = process.argv.includes("--allow-shrink");
const FETCH_TIMEOUT_MS = 20_000;
const reviewedNames = JSON.parse(await readFile(REVIEWED_NAMES_PATH, "utf8"));


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
uniqueMap([...source.items.items, ...pendingUpstreamItems], "item");
const localByGuid = new Map(catalog.wikiItems.map((item) => [item.guid, item]));
if (localByGuid.size !== catalog.wikiItems.length)
  throw new Error("Runtime catalog contains duplicate item GUIDs.");
for (const [guid, entry] of Object.entries(reviewedNames.items ?? {})) {
  if (!localByGuid.has(guid))
    throw new Error(`Reviewed IAP player name uses an unknown catalog GUID: ${guid}`);
  if (
    !entry ||
    typeof entry.playerName !== "string" ||
    !entry.playerName.trim() ||
    !Array.isArray(entry.aliases) ||
    entry.aliases.some((alias) => typeof alias !== "string" || !alias.trim())
  )
    throw new Error(`Reviewed IAP player name is malformed: ${guid}`);
}

// SkyGame-Data intentionally lists some items in both standalone and bundle
// IAPs. The shared mapper selects the smallest/least expensive offer and
// refuses any item GUID that cannot be resolved in the runtime catalog.
const { rows, offersByItem } = buildIapCatalogRows({
  iaps,
  upstreamItems: [...source.items.items, ...pendingUpstreamItems],
  catalogItems: catalog.wikiItems,
  zhName: catalog.zhName,
  reviewedNames: reviewedNames.items,
});
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
