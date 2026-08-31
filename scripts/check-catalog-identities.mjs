import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";

const SOURCE_VERSION = "1.3.10";
const SOURCE_URL = `https://unpkg.com/skygame-data@${SOURCE_VERSION}/assets/everything.json`;
const FETCH_TIMEOUT_MS = 20_000;

const response = await fetch(SOURCE_URL, {
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
}).catch((error) => {
  throw new Error(`SkyGame-Data ${SOURCE_VERSION} download failed: ${error.message}`);
});
if (!response.ok)
  throw new Error(`SkyGame-Data ${SOURCE_VERSION} download failed: ${response.status}`);
const source = await response.json().catch((error) => {
  throw new Error(`SkyGame-Data ${SOURCE_VERSION} did not contain valid JSON: ${error.message}`);
});
if (!Array.isArray(source?.items?.items))
  throw new Error("SkyGame-Data item schema is invalid.");

const catalog = await loadRuntimeCatalog();
const upstreamByGuid = new Map(source.items.items.map((item) => [item.guid, item]));
const sourceBacked = catalog.wikiItems.filter((item) => upstreamByGuid.has(item.guid));
const differences = sourceBacked.flatMap((item) => {
  const upstream = upstreamByGuid.get(item.guid);
  return ["id", "order", "name", "group", "type"].flatMap((field) => {
    const runtimeValue = field === "type" ? item.sourceType ?? item.type : item[field];
    return (runtimeValue ?? "") === (upstream[field] ?? "")
      ? []
      : [`${item.guid}: ${field} runtime=${JSON.stringify(runtimeValue ?? "")} upstream=${JSON.stringify(upstream[field] ?? "")}`];
  });
});

if (!sourceBacked.length)
  throw new Error("Catalog check found no source-backed items.");
if (differences.length)
  throw new Error(
    `Catalog identity check failed for ${differences.length} field(s).\n${differences.join("\n")}`,
  );

console.log(
  `Catalog identities are current: ${sourceBacked.length} source-backed items verified against SkyGame-Data ${SOURCE_VERSION}.`,
);
