#!/usr/bin/env node
/**
 * Collect package, event, collaboration, anniversary, and limited-item evidence
 * from the two Chinese Sky MediaWiki sites. Raw articles are not mirrored: the
 * report keeps page metadata and short market-relevant lines only. Optional OCR
 * handles text-bearing posters while skipping ordinary wardrobe icons.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { load } from "cheerio";

const ROOT = resolve(import.meta.dirname, "..");
const WORK = resolve(ROOT, "work", "wiki-market-evidence");
const IMAGE_DIR = resolve(WORK, "images");
const REPORT_PATH = resolve(WORK, "report.json");
const PAGE_CACHE_PATH = resolve(WORK, "page-cache.json");
const OCR_CACHE_PATH = resolve(WORK, "ocr-cache.json");
const OCR_LANGUAGE_CACHE = resolve(WORK, "tesseract-language");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith("--")) continue;
  const [key, inline] = argument.slice(2).split("=", 2);
  args.set(
    key,
    inline ??
      (process.argv[index + 1]?.startsWith("--")
        ? true
        : process.argv[++index]),
  );
}

const maxPages = Math.max(10, Number(args.get("max-pages") ?? 500));
const ocrLimit = Math.max(0, Number(args.get("ocr-limit") ?? 80));
const useOcr = Boolean(args.get("ocr"));
const sourceFilter = args.get("source");
const useCachedPages = Boolean(args.get("cached"));
const ocrPipelineVersion = 2;
const timeoutMs = Math.max(5_000, Number(args.get("timeout") ?? 30_000));
const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const sources = [
  {
    id: "bwiki-zh-cn",
    region: "china",
    api: "https://wiki.biligame.com/sky/api.php",
    pageBase: "https://wiki.biligame.com/sky/",
    seeds: ["礼包图鉴"],
    searches: ["礼包", "限定", "联动", "周年 活动"],
  },
  {
    id: "fandom-zh",
    region: "global",
    api: "https://sky-children-of-the-light.fandom.com/zh/api.php",
    pageBase: "https://sky-children-of-the-light.fandom.com/zh/wiki/",
    seeds: ["節日與特別活動", "特別活動", "季节活动"],
    searches: ["禮包", "限定", "內購", "週年 活動"],
  },
];
const marketPattern =
  /禮包|礼包|限定|限時|限时|內購|内购|活動|活动|聯動|联动|週年|周年|復刻|复刻|季節|季节|斗篷|髮型|发型|面具|頭飾|头饰|道具|￥|¥|NT\$|USD|價格|价格/u;
const ocrImagePattern =
  /公告|海報|海报|宣傳|宣传|禮包|礼包|價格|价格|主視覺|主视觉|總覽|总览|圖鑑|图鉴|表格|清單|清单|兌換|兑换/u;
const iconPattern =
  /UI-|Icon|圖示|图标|無框|无框|礼包bg|禮包bg|logo|徽章|貨幣|货币|先祖|物品圖鑑|物品图鉴|展示圖|展示图|位置圖|位置图/iu;
const ocrCandidateScore = (title) =>
  (/禮包|礼包|價格|价格|圖鑑|图鉴|清單|清单|兌換|兑换/u.test(title) ? 100 : 0) +
  (/202[4-9]/u.test(title) ? 25 : 0) +
  (/公告|海報|海报|宣傳|宣传/u.test(title) ? 10 : 0);
const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const pageUrl = (source, title) =>
  `${source.pageBase}${encodeURIComponent(title.replace(/ /g, "_"))}`;

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent":
            "SkyRecognitionWikiEvidenceCollector/1.0 (+https://github.com/migao2006/sky-recognition-wiki)",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await pause(Math.min(8_000, 1_200 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function api(source, params) {
  const url = `${source.api}?${new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2",
  })}`;
  return fetchJson(url);
}

async function searchTitles(source, search) {
  const titles = [];
  let continuation;
  do {
    const json = await api(source, {
      action: "query",
      list: "search",
      srsearch: search,
      srnamespace: "0",
      srlimit: "max",
      ...(continuation ? { sroffset: continuation } : {}),
    });
    titles.push(...(json.query?.search ?? []).map((row) => row.title));
    continuation = json.continue?.sroffset;
  } while (continuation != null && titles.length < maxPages);
  return titles;
}

async function parsePage(source, title) {
  const json = await api(source, {
    action: "parse",
    page: title,
    prop: "text|images|links|categories|revid",
    disabletoc: "1",
  });
  if (json.error) throw new Error(`${title}: ${json.error.info ?? json.error.code}`);
  const parsed = json.parse;
  const $ = load(parsed.text ?? "");
  $("script,style,noscript,.mw-editsection,.navbox,.toc,.noprint").remove();
  const imageLabels = [];
  $("img[data-image-name], img[data-image-key]").each((_, element) => {
    const image = $(element);
    const filename = normalizeText(
      image.attr("data-image-name") ?? image.attr("data-image-key"),
    );
    if (!filename) return;
    const alt = normalizeText(image.attr("alt"));
    const container = image.closest("td,li,figure,.gallerybox,.wikia-gallery-item");
    const context = normalizeText(container.first().text()).slice(0, 180);
    imageLabels.push({
      filename,
      ...(alt ? { alt } : {}),
      ...(context && context !== alt ? { context } : {}),
    });
  });
  const evidence = [];
  $("h1,h2,h3,h4,tr,li,p,figcaption").each((_, element) => {
    const line = normalizeText($(element).text());
    if (!line || line.length > 260 || !marketPattern.test(line)) return;
    evidence.push(line);
  });
  return {
    source: source.id,
    region: source.region,
    title: parsed.title ?? title,
    revisionId: parsed.revid ?? null,
    url: pageUrl(source, parsed.title ?? title),
    evidenceLines: unique(evidence).slice(0, 160),
    images: unique(parsed.images ?? []),
    imageLabels: [
      ...new Map(
        imageLabels.map((entry) => [
          `${entry.filename}|${entry.alt ?? ""}|${entry.context ?? ""}`,
          entry,
        ]),
      ).values(),
    ],
    links: (parsed.links ?? [])
      .filter((link) => link.ns === 0 && link.exists !== false)
      .map((link) => link.title),
    categories: (parsed.categories ?? []).map((category) => category.category),
  };
}

async function mapConcurrent(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function discoverPages(source) {
  const seedPages = [];
  const errors = [];
  for (const seed of source.seeds) {
    try {
      seedPages.push(await parsePage(source, seed));
    } catch (error) {
      errors.push({ title: seed, error: String(error.message ?? error) });
    }
  }
  if (!seedPages.length)
    throw new Error(`${source.id}: every seed page failed (${errors.map((row) => row.error).join("; ")})`);
  const searched = [];
  for (const term of source.searches) {
    try {
      searched.push(...(await searchTitles(source, term)));
    } catch (error) {
      errors.push({ title: `search:${term}`, error: String(error.message ?? error) });
    }
  }
  const linked = seedPages.flatMap((page) => page.links);
  const titles = unique([
    ...source.seeds,
    ...linked,
    ...searched.filter((title) => marketPattern.test(title)),
  ]).slice(0, maxPages);
  const seedByTitle = new Map(seedPages.map((page) => [page.title, page]));
  const pages = await mapConcurrent(titles, source.region === "china" ? 2 : 4, async (title) => {
    if (seedByTitle.has(title)) return seedByTitle.get(title);
    if (source.region === "china") await pause(180);
    try {
      return await parsePage(source, title);
    } catch (error) {
      errors.push({ title, error: String(error.message ?? error) });
      return null;
    }
  });
  return { pages: pages.filter(Boolean), errors };
}

async function imageInfo(source, names) {
  const output = [];
  const errors = [];
  for (let offset = 0; offset < names.length; offset += 40) {
    const batch = names.slice(offset, offset + 40);
    let json;
    try {
      json = await api(source, {
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size|mime|sha1",
        titles: batch.map((name) => `File:${name}`).join("|"),
      });
    } catch (error) {
      errors.push({
        source: source.id,
        images: batch,
        error: String(error.message ?? error),
      });
      continue;
    }
    for (const page of json.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      output.push({
        source: source.id,
        title: page.title.replace(/^(?:File|文件|檔案):/u, ""),
        url: info.url,
        width: info.width,
        height: info.height,
        size: info.size,
        mime: info.mime,
        sha1: info.sha1,
      });
    }
  }
  return { images: output, errors };
}

const relevantOcrLines = (text) =>
  unique(
    normalizeText(text)
      .split("\n")
      .map((line) => normalizeText(line))
      .filter((line) => line.length >= 2 && line.length <= 100),
  ).slice(0, 120);

async function downloadImage(image) {
  const extension = extname(new URL(image.url).pathname).slice(0, 6) || ".img";
  const filename = `${createHash("sha256").update(image.url).digest("hex")}${extension}`;
  const target = resolve(IMAGE_DIR, filename);
  const existing = await readFile(target).catch(() => null);
  if (existing) return target;
  const response = await fetch(image.url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "SkyRecognitionWikiEvidenceCollector/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${image.url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

async function runOcr(images) {
  const cache = JSON.parse(
    await readFile(OCR_CACHE_PATH, "utf8").catch(() => '{"items":{}}'),
  );
  const candidates = images
    .filter(
      (image) =>
        ocrImagePattern.test(image.title) &&
        !iconPattern.test(image.title) &&
        image.size <= 8_000_000 &&
        image.width * image.height <= 14_000_000,
    )
    .sort((left, right) =>
      ocrCandidateScore(right.title) - ocrCandidateScore(left.title) ||
      left.title.localeCompare(right.title, "zh-Hant"),
    )
    .slice(0, ocrLimit);
  if (!candidates.length) return { candidates: 0, completed: 0, entries: [] };
  const [{ createWorker }, { default: sharp }] = await Promise.all([
    import("tesseract.js"),
    import("sharp"),
  ]);
  const worker = await createWorker("chi_tra+chi_sim+eng", undefined, {
    cachePath: OCR_LANGUAGE_CACHE,
    logger: (message) => {
      if (message.status === "recognizing text" && message.progress === 1)
        process.stderr.write(".");
    },
  });
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: "11",
  });
  const entries = [];
  try {
    for (const image of candidates) {
      const cached = cache.items?.[image.url];
      if (cached?.sha1 === image.sha1 && cached.pipelineVersion === ocrPipelineVersion) {
        entries.push({ ...image, ocrLines: cached.ocrLines, cached: true });
        continue;
      }
      try {
        const target = await downloadImage(image);
        const prepared = `${target}.ocr.png`;
        await sharp(target)
          .resize({ width: Math.max(1600, image.width), withoutEnlargement: false })
          .grayscale()
          .normalize()
          .sharpen()
          .png()
          .toFile(prepared);
        const result = await worker.recognize(prepared);
        const ocrLines = relevantOcrLines(result.data.text);
        cache.items[image.url] = {
          sha1: image.sha1,
          pipelineVersion: ocrPipelineVersion,
          ocrLines,
        };
        entries.push({ ...image, ocrLines, cached: false });
      } catch (error) {
        entries.push({ ...image, ocrLines: [], error: String(error.message ?? error) });
      }
    }
  } finally {
    await worker.terminate();
    process.stderr.write("\n");
  }
  await writeFile(OCR_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return {
    candidates: candidates.length,
    completed: entries.filter((entry) => !entry.error).length,
    entries,
  };
}

async function main() {
  await Promise.all([
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(OCR_LANGUAGE_CACHE, { recursive: true }),
  ]);
  const previous = await readFile(PAGE_CACHE_PATH, "utf8")
    .then(JSON.parse)
    .catch(async () => {
      const report = await readFile(REPORT_PATH, "utf8").then(JSON.parse).catch(() => null);
      return report?.sources ?? [];
    });
  const cachedBySource = new Map(
    previous.map((result) => {
      const id = result.source?.id ?? result.id;
      return [
        id,
        {
          source: sources.find((source) => source.id === id),
          pages: result.pages ?? [],
          errors: result.errors ?? [],
        },
      ];
    }),
  );
  const selectedSources = sourceFilter
    ? sources.filter((source) => source.id === sourceFilter)
    : sources;
  if (!selectedSources.length)
    throw new Error(`Unknown source: ${sourceFilter}`);
  for (const source of useCachedPages ? [] : selectedSources) {
    try {
      const result = await discoverPages(source);
      cachedBySource.set(source.id, { source, ...result });
    } catch (error) {
      const cached = cachedBySource.get(source.id);
      if (!cached?.pages?.length) throw error;
      cachedBySource.set(source.id, {
        ...cached,
        source,
        errors: [
          ...(cached.errors ?? []),
          { title: "refresh", error: `Using cached pages: ${String(error.message ?? error)}` },
        ],
      });
    }
    await writeFile(
      PAGE_CACHE_PATH,
      `${JSON.stringify([...cachedBySource.values()], null, 2)}\n`,
      "utf8",
    );
  }
  if (useCachedPages && !cachedBySource.size)
    throw new Error("--cached requires an existing page cache");
  const collected = sources
    .map((source) => cachedBySource.get(source.id))
    .filter(Boolean)
    .map((result) => ({ ...result }));
  const allImages = [];
  const imageErrors = [];
  let imageCount = 0;
  for (const result of collected) {
    const names = unique(result.pages.flatMap((page) => page.images));
    imageCount += names.length;
    if (useOcr) {
      const candidates = names.filter(
        (name) => ocrImagePattern.test(name) && !iconPattern.test(name),
      );
      const resolved = await imageInfo(result.source, candidates);
      allImages.push(...resolved.images);
      imageErrors.push(...resolved.errors);
    }
  }
  const ocr = useOcr
    ? await runOcr(allImages)
    : { candidates: 0, completed: 0, entries: [] };
  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      scope: "頁面中與禮包、活動、限定、聯動、週年及價格直接相關的短行；不鏡像完整文章。",
      region: "Fandom 標記 global；BWiki 標記 china，禁止自動跨服合併。",
      ocr: "只辨識公告、海報、活動及禮包展示圖；純 icon 排除。",
    },
    totals: {
      pages: collected.reduce((sum, result) => sum + result.pages.length, 0),
      evidenceLines: collected.reduce(
        (sum, result) =>
          sum + result.pages.reduce((pageSum, page) => pageSum + page.evidenceLines.length, 0),
        0,
      ),
      images: imageCount,
      ocrCandidates: ocr.candidates,
      ocrCompleted: ocr.completed,
      errors: collected.reduce((sum, result) => sum + result.errors.length, 0),
      imageErrors: imageErrors.length,
    },
    sources: collected.map((result) => ({
      id: result.source.id,
      region: result.source.region,
      api: result.source.api,
      pages: result.pages,
      errors: result.errors,
    })),
    ocr: ocr.entries,
    imageErrors,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ report: REPORT_PATH, ...report.totals }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
