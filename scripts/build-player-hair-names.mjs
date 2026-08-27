#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const evidencePath = resolve(ROOT, "data/hair-name-evidence.json");
const researchPath = resolve(ROOT, "data/hair-name-research.json");
const runtimePath = resolve(ROOT, "app/player-hair-names.json");
const write = process.argv.includes("--write");
const normalize = (value) => String(value ?? "").trim();
const unique = (values) => [...new Set(values.map(normalize).filter(Boolean))];
const canonicalTerm = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/髮型|頭/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

const catalog = await loadRuntimeCatalog({
  stubJsonFiles: ["player-hair-names.json"],
});
const hairItems = catalog.wikiItems.filter((item) => item.type === "Hair");
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const byGuid = new Map(hairItems.map((item) => [item.guid, item]));

for (const guid of Object.keys(evidence.items)) {
  if (!byGuid.has(guid)) throw new Error(`Hair evidence has an unknown GUID: ${guid}`);
}

const researchItems = hairItems.map((item) => {
  const currentName = evidence.baselineNames?.[item.guid] ?? catalog.zhItemName(item);
  const entry = evidence.items[item.guid] ?? null;
  const displayName = normalize(entry?.displayName) || currentName;
  const sources = entry?.sources ?? [];
  if (displayName !== currentName) {
    const canonicalDisplayName = canonicalTerm(displayName);
    const supporters = new Set(
      sources
        .filter(
          (source) =>
            normalize(source.name) === displayName &&
            normalize(source.author) &&
            !normalize(source.platform).toLowerCase().includes("wiki") &&
            canonicalTerm(source.observedName || source.name).includes(
              canonicalDisplayName,
            ),
        )
        .map((source) => normalize(source.author).toLowerCase()),
    );
    if (supporters.size < 2) {
      throw new Error(`${item.guid} changes its display name without two independent player authors`);
    }
  }
  return {
    guid: item.guid,
    englishName: item.name,
    currentName,
    displayName,
    aliases: unique([...(entry?.aliases ?? []), ...sources.map((source) => source.name)])
      .filter((name) => name !== displayName),
    confidence: displayName === currentName ? "fallback" : "consensus",
    identitySources: [
      item.wiki,
      "https://wiki.biligame.com/sky/%E6%A8%A1%E6%9D%BF%3A%E5%8F%91%E5%9E%8B",
    ],
    playerSources: sources,
  };
});

if (researchItems.length !== 187) {
  throw new Error(`Expected 187 Hair items, found ${researchItems.length}`);
}

const research = {
  method: evidence.method,
  count: researchItems.length,
  items: researchItems,
};
const runtime = {
  description: "髮型共識顯示名與搜尋別名；詳細來源保留在 data/hair-name-research.json。",
  items: Object.fromEntries(
    researchItems.map((item) => [
      item.guid,
      { displayName: item.displayName, aliases: item.aliases },
    ]),
  ),
};
const outputs = [
  [researchPath, `${JSON.stringify(research, null, 2)}\n`],
  [runtimePath, `${JSON.stringify(runtime, null, 2)}\n`],
];

if (write) {
  for (const [path, content] of outputs) await writeFile(path, content, "utf8");
  console.error(`Wrote ${researchItems.length} researched Hair entries`);
} else {
  let changed = false;
  for (const [path, content] of outputs) {
    const current = await readFile(path, "utf8").catch(() => "");
    if (current !== content) {
      changed = true;
      console.error(`Out of date: ${path}`);
    }
  }
  if (changed) process.exitCode = 1;
  else console.error(`Hair-name snapshots are current (${researchItems.length})`);
}
