#!/usr/bin/env node
/**
 * Read-only Traditional-Chinese name discovery from Fandom's Lua data modules.
 *
 * The report is intentionally review-first: a name is "accepted" only when an
 * exact project icon basename resolves to a module record with a non-English
 * zh override. It never writes app data.
 *
 *   node scripts/sync-fandom-zh-names.mjs > dist/tmp/fandom-zh-names.json
 *   node scripts/sync-fandom-zh-names.mjs --out dist/tmp/fandom-zh-names.json
 *   node scripts/sync-fandom-zh-names.mjs --snapshot
 */
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const API = "https://sky-children-of-the-light.fandom.com/zh/api.php";
const MODULES = [
  "Module:Spirits/data",
  "Module:Seasons/data",
  "Module:Days Item/data",
  "Module:Instruments/data",
  "Module:Spirit Item/data",
];
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith("--")) continue;
  const [key, inline] = argument.slice(2).split("=", 2);
  args.set(key, inline ?? (process.argv[index + 1]?.startsWith("--") ? true : process.argv[++index]));
}
const timeoutMs = Math.max(1_000, Number(args.get("timeout") ?? 25_000));
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const decode = (value) => { try { return decodeURIComponent(value); } catch { return value; } };
const iconBasename = (url) => decode(basename(new URL(url).pathname)).replace(/ /g, "_").toLowerCase();
const isChinese = (value) => /[\u3400-\u9fff]/.test(value || "");

async function fetchModule(page) {
  const url = `${API}?${new URLSearchParams({
    action: "query",
    prop: "revisions",
    titles: page,
    rvprop: "ids|content",
    rvslots: "main",
    formatversion: "2",
    format: "json",
  })}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "Mozilla/5.0 (compatible; SkyCatalogNameSync/1.0)" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const json = await response.json();
      const revision = json.query?.pages?.[0]?.revisions?.[0];
      const text = revision?.slots?.main?.content;
      if (typeof text !== "string") throw new Error("MediaWiki response did not contain revision content");
      return { page, url, text, revisionId: revision.revid ?? null };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await pause(700 * (attempt + 1));
    }
  }
  throw lastError;
}

function balancedBlock(source, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return source.slice(start + 1, index);
  }
  return null;
}
function parseLuaRecords(source) {
  const records = new Map();
  const recordStart = /^\s*([a-zA-Z][\w]*)\s*=\s*\{/gm;
  for (const match of source.matchAll(recordStart)) {
    const opening = source.indexOf("{", match.index);
    const block = balancedBlock(source, opening);
    if (block == null) continue;
    const fields = {};
    for (const field of block.matchAll(/\b([a-zA-Z][\w]*)\s*=\s*(["'])(.*?)\2/g)) fields[field[1]] = field[3];
    records.set(match[1], fields);
  }
  return records;
}

async function loadRuntimeCatalog() {
  // Load the actual runtime catalog rather than trying to reproduce its
  // instrument/held-prop transformations in this synchronizer.
  const directory = await mkdtemp(join(tmpdir(), "sky-fandom-catalog-"));
  try {
    for (const name of ["wiki-data", "valuation-items", "catalog-domain"]) {
      const source = (await readFile(join(ROOT, "app", `${name}.ts`), "utf8"))
        .replace('import wikiZhNames from "./wiki-zh-names.json";', 'const wikiZhNames = { items: {} };');
      const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
        .replaceAll('from "./wiki-data"', 'from "./wiki-data.js"')
        .replaceAll('from "./valuation-items"', 'from "./valuation-items.js"');
      await writeFile(join(directory, `${name}.js`), output, "utf8");
    }
    const runtime = await import(`${pathToFileURL(join(directory, "catalog-domain.js")).href}?v=${Date.now()}`);
    return runtime.wikiItems;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const suffix = {
  hair: "髮型", hairpiece: "髮飾", headpiece: "頭飾", mask: "面具", facepiece: "臉部配件",
  necklace: "項鍊", neckpiece: "頸飾", cape: "斗篷", outfit: "服飾", footwear: "鞋子", shoes: "鞋子", prop: "道具",
};
function assetField(field) { return field.replace(/_\d+$/, "").replace(/_.+$/, ""); }
function translatedName(zh, field, moduleName) {
  const root = assetField(field);
  if (zh[`${root}_name`]) return { name: zh[`${root}_name`], confidence: 1, method: "explicit-field-override" };
  if (root === "icon" && zh.emote_name) return { name: zh.emote_name, confidence: 1, method: "explicit-emote-override" };
  if (root === "instrument" && zh.inst_name) return { name: zh.inst_name, confidence: 1, method: "explicit-instrument-override" };
  // Days Item and Instruments records represent one item, so their `name` is
  // an explicit item label. Season records instead describe an entire season;
  // their generic name must never be automatically adopted for each asset.
  if (["Module:Days Item/data", "Module:Instruments/data"].includes(moduleName) && zh.name)
    return { name: zh.name, confidence: 1, method: "explicit-item-record-name" };
  if (zh.name && suffix[root]) return { name: `${zh.name}${suffix[root]}`, confidence: 0.9, method: "derived-spirit-or-season-label" };
  return zh.name ? { name: zh.name, confidence: 0.55, method: "generic-record-label" } : null;
}

async function main() {
  const catalog = await loadRuntimeCatalog();
  const fetched = [];
  for (const page of MODULES) {
    try {
      const english = await fetchModule(page);
      const chinese = await fetchModule(`${page}/zh`);
      fetched.push({ page, english, chinese, error: null });
    } catch (error) {
      fetched.push({ page, error: String(error.message ?? error) });
    }
  }
  const candidatesByIcon = new Map();
  for (const result of fetched) {
    if (result.error) continue;
    const english = parseLuaRecords(result.english.text);
    const chinese = parseLuaRecords(result.chinese.text);
    for (const [key, record] of english) {
      const translated = chinese.get(key);
      if (!translated) continue;
      for (const [field, filename] of Object.entries(record)) {
        if (!/\.(png|webp|jpe?g)$/i.test(filename)) continue;
        const name = translatedName(translated, field, result.page);
        if (!name || !isChinese(name.name)) continue;
        const normalized = filename.replace(/ /g, "_").toLowerCase();
        const candidate = { zhName: name.name, sourceModule: result.page, sourceKey: key, sourceField: field, confidence: name.confidence, method: name.method };
        if (!candidatesByIcon.has(normalized)) candidatesByIcon.set(normalized, []);
        candidatesByIcon.get(normalized).push(candidate);
      }
    }
  }
  const rows = catalog.map((item) => {
    let key;
    try { key = iconBasename(item.icon); } catch { key = ""; }
    const candidates = candidatesByIcon.get(key) ?? [];
    const uniqueNames = [...new Set(candidates.map((candidate) => candidate.zhName))];
    const selected = candidates[0] ?? null;
    const ambiguous = uniqueNames.length > 1;
    const accepted = Boolean(selected && !ambiguous && selected.confidence >= 0.97);
    return {
      guid: item.guid,
      englishName: item.name,
      catalogType: item.type,
      iconBasename: key,
      zhName: selected?.zhName ?? null,
      sourceModule: selected?.sourceModule ?? null,
      sourceKey: selected?.sourceKey ?? null,
      sourceField: selected?.sourceField ?? null,
      confidence: selected?.confidence ?? null,
      matchMethod: selected?.method ?? null,
      status: accepted ? "matched" : ambiguous ? "ambiguous" : selected ? "review" : "unmatched",
      candidates: ambiguous ? candidates : undefined,
    };
  });
  const counts = Object.fromEntries(["matched", "review", "ambiguous", "unmatched"].map((status) => [status, rows.filter((row) => row.status === status).length]));
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    catalogItems: catalog.length,
    sources: fetched.map((result) => ({ page: result.page, englishUrl: result.english?.url ?? null, zhUrl: result.chinese?.url ?? null, error: result.error })),
    coverage: { ...counts, acceptedRate: catalog.length ? Number((counts.matched / catalog.length).toFixed(4)) : 0 },
    risks: [
      "A match requires exact icon filename equality; renamed or alternate artwork remains unmatched.",
      "Derived spirit or season cosmetic labels are deliberately review-only; only explicit item/emote/instrument labels are accepted.",
      "Only unique, Chinese-language overrides are accepted. Ambiguous aliases remain review-only.",
      "This report never changes app/wiki-data.ts or catalog-domain.ts.",
    ],
    entries: rows,
  };
  if (args.get("snapshot")) {
    const failedSources = fetched.filter((result) => result.error);
    if (failedSources.length) {
      throw new Error(`Refusing to replace the name snapshot: ${failedSources.length} Wiki source(s) failed`);
    }
    const actionTypes = new Set(["Emote", "Call", "Stance"]);
    const safeModules = new Set([
      "Module:Days Item/data",
      "Module:Instruments/data",
      "Module:Spirits/data",
    ]);
    const safeRows = rows.filter((row) =>
      row.status === "matched" &&
      !actionTypes.has(row.catalogType) &&
      safeModules.has(row.sourceModule) &&
      !/[A-Za-z]/.test(row.zhName),
    );
    const snapshot = {
      source: "Sky 光·遇中文 Wiki (Fandom)",
      sourceUrl: "https://sky-children-of-the-light.fandom.com/zh/wiki/Sky%E5%85%89%C2%B7%E9%81%87Wiki?variant=zh-hant",
      generatedAt: report.generatedAt,
      revisions: Object.fromEntries(fetched.flatMap((result) => [
        [result.page, result.english.revisionId],
        [`${result.page}/zh`, result.chinese.revisionId],
      ])),
      policy: "僅收錄唯一圖示精確對應、具完整繁體中文名稱的衣櫃物品；動作與歧義資料不自動匯入。",
      items: Object.fromEntries(safeRows.map((row) => [row.guid, row.zhName])),
    };
    const snapshotTarget = resolve(ROOT, "app/wiki-zh-names.json");
    const currentSnapshot = JSON.parse(await readFile(snapshotTarget, "utf8").catch(() => '{"items":{}}'));
    const currentCount = Object.keys(currentSnapshot.items ?? {}).length;
    if (!args.get("allow-shrink") && safeRows.length < currentCount) {
      throw new Error(`Refusing to shrink the name snapshot from ${currentCount} to ${safeRows.length}; review first or pass --allow-shrink`);
    }
    const temporaryTarget = `${snapshotTarget}.tmp`;
    await writeFile(temporaryTarget, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporaryTarget, snapshotTarget);
    console.error(`Wrote ${safeRows.length} reviewed names: ${snapshotTarget}`);
  }
  const text = `${JSON.stringify(report, null, 2)}\n`;
  const output = args.get("out");
  if (output && output !== true) {
    const target = resolve(ROOT, String(output));
    if (!target.startsWith(`${ROOT}\\`) || !/^(?:dist[\\/]tmp|tmp)[\\/]/i.test(String(output))) throw new Error("--out is restricted to dist/tmp or tmp");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, "utf8");
    console.error(`Wrote dry-run report: ${target}`);
  } else process.stdout.write(text);
  if (fetched.every((result) => result.error)) process.exitCode = 2;
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
