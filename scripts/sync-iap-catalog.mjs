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

const packageResponse = await fetch(PACKAGE_SOURCE);
if (!packageResponse.ok)
  throw new Error(`SkyGame-Data version download failed: ${packageResponse.status}`);
const sourcePackage = await packageResponse.json();
const sourceVersion = sourcePackage.version;
if (typeof sourceVersion !== "string" || !sourceVersion)
  throw new Error("SkyGame-Data package did not report a version.");
const sourceUrl = `https://unpkg.com/skygame-data@${sourceVersion}/assets/everything.json`;
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`SkyGame-Data download failed: ${response.status}`);
const source = await response.json();
const catalog = await loadRuntimeCatalog();
const upstreamByGuid = new Map(source.items.items.map((item) => [item.guid, item]));
const localByGuid = new Map(catalog.wikiItems.map((item) => [item.guid, item]));
const localByName = new Map(catalog.wikiItems.map((item) => [item.name, item]));
const seen = new Set();
const rows = [];

for (const iap of source.iaps.items) {
  for (const upstreamGuid of iap.items ?? []) {
    const upstream = upstreamByGuid.get(upstreamGuid);
    const local = localByGuid.get(upstreamGuid) ?? localByName.get(upstream?.name);
    if (!local || seen.has(local.guid)) continue;
    seen.add(local.guid);
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
    });
  }
}

rows.sort((a, b) => a.guid.localeCompare(b.guid));
const payload = {
  source: "SkyGame-Data",
  sourceUrl,
  sourceVersion,
  packages: source.iaps.items.length,
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
