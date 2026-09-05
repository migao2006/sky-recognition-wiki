import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as cheerio from "cheerio";
import { consolidateMarketListingSnapshots } from "./consolidate-market-listing-snapshots.mjs";

const TAIFEX_URL = "https://openapi.taifex.com.tw/v1/DailyForeignExchangeRates";
const FUNPAY_URL = "https://funpay.com/en/lots/3774/";
const TAOSHOUYOU_FIRST_PAGE = "https://www.taoshouyou.com/game/guang__-15256-0-1";
const seasonMentionPatterns = [
  ["gratitude", /感恩(?:季|毕业|畢業|毕|畢)|\b(?:season of )?gratitude(?: season)?\b/i, /感恩(?:季)?/],
  ["lightseekers", /追光(?:季|毕业|畢業|毕|畢)|\b(?:season of )?lightseekers?(?: season)?\b/i, /追光(?:季)?/],
  ["belonging", /归属(?:季|毕业|毕)|歸屬(?:季|畢業|畢)|\b(?:season of )?belonging(?: season)?\b/i, /(?:归属|歸屬)(?:季)?/],
  ["rhythm", /音韵(?:季|毕业|毕)|音韻(?:季|畢業|畢)|\b(?:season of )?rh(?:ythm|ymth)(?: season)?\b/i, /(?:音韵|音韻)(?:季)?/],
  ["enchantment", /魔法(?:季|毕业|畢業|毕|畢)|\b(?:season of )?enchantment(?: season)?\b/i, /魔法(?:季)?/],
  ["sanctuary", /圣岛(?:季|毕业|毕)|聖島(?:季|畢業|畢)|\b(?:season of )?sanctuary(?: season)?\b/i, /(?:圣岛|聖島)(?:季)?/],
  ["prophecy", /预言(?:季|毕业|毕)|預言(?:季|畢業|畢)|\b(?:season of )?prophecy(?: season)?\b/i, /(?:预言|預言)(?:季)?/],
  ["dreams", /梦想(?:季|毕业|毕)|夢想(?:季|畢業|畢)|\b(?:season of )?dreams?(?: season)?\b/i, /(?:梦想|夢想)(?:季)?/],
  ["assembly", /(?:集结|重组)(?:季|毕业|毕)|(?:集結|重組)(?:季|畢業|畢)|\b(?:season of )?assembly(?: season)?\b/i, /(?:集结|集結|重组|重組)(?:季)?/],
  ["the-little-prince", /小王子(?:季|毕业|畢業|毕|畢)|\b(?:season of )?(?:the )?little prince(?: season)?\b/i, /(?:小王子|王子)(?:季)?/],
  ["flight", /(?:风行|飞行|飛行)(?:季|毕业|畢業|毕|畢)|\b(?:season of )?flight(?: season)?\b/i, /(?:风行|飛行|飞行)(?:季)?/],
  ["abyss", /(?:潜海|深渊)(?:季|毕业|毕)|(?:潛海|深淵)(?:季|畢業|畢)|\b(?:season of )?(?:abyss|deep sea)(?: season)?\b/i, /(?:潜海|潛海|深渊|深淵)(?:季)?/],
  ["performance", /表演(?:季|毕业|畢業|毕|畢)|\b(?:season of )?performance(?: season)?\b/i, /表演(?:季)?/],
  ["shattering", /(?:破晓|破碎)(?:季|毕业|毕)|(?:破曉|破碎)(?:季|畢業|畢)|\b(?:season of )?shattering(?: season)?\b/i, /(?:破晓|破曉|破碎)(?:季)?/],
  ["aurora", /(?:欧若拉|歐若拉|极光|極光)(?:季|毕业|畢業|毕|畢)|\b(?:season of )?aurora(?: season)?\b/i, /(?:欧若拉|歐若拉|极光|極光)(?:季)?/],
  ["remembrance", /(?:追忆|缅怀)(?:季|毕业|毕)|(?:追憶|緬懷)(?:季|畢業|畢)|\b(?:season of )?remembrance(?: season)?\b/i, /(?:追忆|追憶|缅怀|緬懷)(?:季)?/],
  ["passage", /夜行(?:季|毕业|畢業|毕|畢)|\b(?:season of )?passage(?: season)?\b/i, /夜行(?:季)?/],
  ["moments", /拾光(?:季|毕业|畢業|毕|畢)|\b(?:season of )?moments?(?: season)?\b/i, /拾光(?:季)?/],
  ["revival", /归巢(?:季|毕业|毕)|歸巢(?:季|畢業|畢)|\b(?:season of )?revival(?: season)?\b/i, /(?:归巢|歸巢)(?:季)?/],
  ["nine-colored-deer", /九色鹿(?:季|毕业|畢業|毕|畢)|\b(?:season of )?(?:the )?nine[ -]colou?red deer(?: season)?\b/i, /九色鹿(?:季)?/],
  ["nesting", /筑巢(?:季|毕业|毕)|築巢(?:季|畢業|畢)|\b(?:season of )?nesting(?: season)?\b/i, /(?:筑巢|築巢)(?:季)?/],
  ["duets", /(?:二重奏|协奏)(?:季|毕业|毕)|協奏(?:季|畢業|畢)|\b(?:season of )?duets?(?: season)?\b/i, /(?:二重奏|协奏|協奏)(?:季)?/],
  ["moomin", /姆明(?:季|毕业|畢業|毕|畢)|\b(?:season of )?moomin(?: season)?\b/i, /姆明(?:季)?/],
  ["radiance", /(?:彩染|染色)(?:季|毕业|毕)|(?:彩染|染色)(?:季|畢業|畢)|\b(?:season of )?radiance(?: season)?\b/i, /(?:彩染|染色)(?:季)?/],
  ["blue-bird", /青鸟(?:季|毕业|毕)|青鳥(?:季|畢業|畢)|\b(?:season of )?(?:the )?blue bird(?: season)?\b/i, /(?:青鸟|青鳥)(?:季)?/],
  ["two-embers-part-1", /(?:双星|暮星)(?:季|毕业|毕)|(?:雙星|暮星)(?:季|畢業|畢)|\b(?:season of )?(?:the )?two embers(?: part 1)?(?: season)?\b/i, /(?:双星|雙星|暮星)(?:季)?/],
  ["migration", /迁徙(?:季|毕业|毕)|遷徙(?:季|畢業|畢)|\b(?:season of )?migration(?: season)?\b/i, /(?:迁徙|遷徙)(?:季)?/],
  ["lightmending", /织光(?:季|毕业|毕)|織光(?:季|畢業|畢)|\b(?:season of )?lightmending(?: season)?\b/i, /(?:织光|織光)(?:季)?/],
  ["carnival", /狂欢(?:季|毕业|毕)|狂歡(?:季|畢業|畢)|\b(?:season of )?carnival(?: season)?\b/i, /(?:狂欢|狂歡)(?:季)?/],
  ["dear-van-gogh", /(?:致)?梵高(?:季|毕业|毕)|(?:致)?梵谷(?:季|畢業|畢)|\b(?:season of )?dear van gogh(?: season)?\b/i, /(?:致)?(?:梵高|梵谷)(?:季)?/],
];
const seasonSlugs = seasonMentionPatterns.map(([slug]) => slug);

const numberedSeasonSlugs = (value) => {
  const normalized = String(value ?? "")
    .replace(/\(\s*\d{1,2}\s+on schedule\s*\)/gi, "")
    .split(/\s+-\s+|\|/u, 1)[0];
  const numbers = new Set();
  for (const match of normalized.matchAll(/(\d{1,2})\s+to\s+(\d{1,2})|\d{1,2}/gi)) {
    if (match[1] && match[2]) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (start >= 1 && end <= seasonSlugs.length && start <= end) {
        for (let number = start; number <= end; number += 1) numbers.add(number);
      }
      continue;
    }
    const number = Number(match[0]);
    if (number >= 1 && number <= seasonSlugs.length) numbers.add(number);
  }
  return [...numbers].sort((left, right) => left - right).map((number) => seasonSlugs[number - 1]);
};

export const extractNumberedSeasonEvidence = (value) => {
  if (typeof value !== "string") return { mentions: [], full: [] };
  const mentions = new Set();
  const full = new Set();
  const sections = [
    ...value.matchAll(/\b(full\s+)?seasons?\s*:\s*(?:full\s+seasons?\s*)?([0-9][^.]*)/gi),
    ...value.matchAll(/\b(full)\s+seasons?\s+([0-9][^.]*)/gi),
  ];
  for (const section of sections) {
    const slugs = numberedSeasonSlugs(section[2]);
    slugs.forEach((slug) => mentions.add(slug));
    if (section[1]) slugs.forEach((slug) => full.add(slug));
  }
  return {
    mentions: seasonSlugs.filter((slug) => mentions.has(slug)),
    full: seasonSlugs.filter((slug) => full.has(slug)),
  };
};

export const extractSeasonMentions = (...values) => {
  const text = values.filter((value) => typeof value === "string").join(" ");
  return seasonMentionPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([slug]) => slug);
};

export const extractSeasonGraduation = (value) => {
  if (typeof value !== "string") return [];
  const section = value.match(
    /(?:毕业|畢業)季(?:节|節)\s*[：:]\s*(.*?)(?=(?:毕业|畢業)(?:季(?:节|節))?物品|热门礼包|熱門禮包|礼包|禮包|资源|資源|已毕业地图|已畢業地圖|$)/i,
  )?.[1];
  if (!section) return [];
  return seasonMentionPatterns.flatMap(([slug, , graduationPattern]) => {
    const match = graduationPattern.exec(section);
    if (!match) return [];
    const before = section.slice(Math.max(0, match.index - 4), match.index);
    const after = section.slice(match.index + match[0].length, match.index + match[0].length + 10);
    if (/未(?:毕业|畢業)\s*$/.test(before)
      || /^\s*(?:季)?卡/.test(after)
      || /^\s*未(?:毕业|畢業)/.test(after)) return [];
    const ratio = after.match(/^\s*(\d+)\s*\/\s*(\d+)/);
    const numerator = ratio ? Number(ratio[1]) : null;
    const denominator = ratio ? Number(ratio[2]) : null;
    if (ratio && (numerator === 0 || denominator === 0 || numerator > denominator)) return [];
    const partial = /半\s*$/.test(before)
      || /^半(?:毕业|畢業)?/.test(after)
      || (ratio && numerator < denominator);
    return [{ slug, status: partial ? "partial" : "full" }];
  });
};
const READER_PREFIX = "https://r.jina.ai/";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const numberValue = (value) => {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const localizedPriceValue = (value) => {
  const compact = String(value ?? "").replace(/[\s\u00a0]/g, "").replace(/[^\d,.-]/g, "");
  if (!compact) return undefined;
  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  const decimalIndex = Math.max(comma, dot);
  const fractionalLength = decimalIndex >= 0 ? compact.length - decimalIndex - 1 : 0;
  const hasDecimal = decimalIndex >= 0 && fractionalLength > 0 && fractionalLength <= 2;
  const normalized = hasDecimal
    ? `${compact.slice(0, decimalIndex).replace(/[,.]/g, "")}.${compact.slice(decimalIndex + 1)}`
    : compact.replace(/[,.]/g, "");
  return numberValue(normalized);
};

export const redactContact = (value) => String(value ?? "")
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[已移除聯絡方式]")
  .replace(/\b1[3-9]\d{9}\b/g, "[已移除聯絡方式]")
  .replace(/(?:QQ|微信|vx|wechat)\s*[:：]?\s*[\w-]{5,}/gi, "[已移除聯絡方式]")
  .trim();

const nextNonEmpty = (lines, index) => {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const value = lines[cursor].trim();
    if (value) return value;
  }
  return undefined;
};

const parseArgs = (argv) => {
  const options = {
    taoshouyouPages: 40,
    taoshouyouDetails: 120,
    concurrency: 2,
    delayMs: 2_000,
    cacheHours: 6,
    refresh: false,
    outputDirectory: "work/market-listings",
  };
  for (const argument of argv) {
    const [key, value] = argument.split("=", 2);
    if (key === "--taoshouyou-pages") options.taoshouyouPages = Number(value);
    if (key === "--taoshouyou-details") options.taoshouyouDetails = Number(value);
    if (key === "--concurrency") options.concurrency = Number(value);
    if (key === "--delay-ms") options.delayMs = Number(value);
    if (key === "--cache-hours") options.cacheHours = Number(value);
    if (key === "--refresh") options.refresh = true;
    if (key === "--out") options.outputDirectory = value;
  }
  for (const key of ["taoshouyouPages", "taoshouyouDetails", "concurrency", "delayMs"]) {
    if (!Number.isInteger(options[key]) || options[key] < (["taoshouyouDetails", "delayMs"].includes(key) ? 0 : 1)) {
      throw new Error(`Invalid ${key}`);
    }
  }
  if (!Number.isFinite(options.cacheHours) || options.cacheHours < 0) throw new Error("Invalid cacheHours");
  if (options.concurrency > 8) throw new Error("concurrency must not exceed 8");
  return options;
};

const fetchText = async (url, { attempts = 3, timeoutMs = 45_000 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "sky-recognition-wiki-public-market-research/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText}`);
        error.retryAfter = Number(response.headers.get("retry-after"));
        error.status = response.status;
        throw error;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const retryDelay = lastError?.status === 429
          ? Math.max(Number.isFinite(lastError.retryAfter) ? lastError.retryAfter * 1_000 : 0, 10_000 * attempt)
          : 700 * attempt;
        await sleep(retryDelay);
      }
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError?.message ?? lastError}`);
};

const createRateLimiter = (delayMs) => {
  let queue = Promise.resolve();
  let nextAllowedAt = 0;
  return () => {
    const scheduled = queue.then(async () => {
      const wait = Math.max(0, nextAllowedAt - Date.now());
      if (wait) await sleep(wait);
      nextAllowedAt = Date.now() + delayMs;
    });
    queue = scheduled.catch(() => {});
    return scheduled;
  };
};

const fetchParsed = async (url, cachePath, parser, { cacheHours, refresh, rateLimit }) => {
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    const age = Date.now() - new Date(cached.observed_at).getTime();
    if (!refresh && age >= 0 && age <= cacheHours * 3_600_000) return cached;
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  await rateLimit();
  const content = await fetchText(url);
  const payload = { observed_at: new Date().toISOString(), value: parser(content) };
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(payload)}\n`);
  return payload;
};

const writeAtomic = async (destination, content) => {
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, destination);
};

const prepareOutputDirectory = async (outputDirectory) => {
  const workRoot = path.resolve("work");
  if (outputDirectory !== workRoot && !outputDirectory.startsWith(`${workRoot}${path.sep}`)) {
    throw new Error("Market listing output must stay inside work/");
  }
  for (const file of ["public-listings.jsonl", "summary.json"]) {
    await rm(path.join(outputDirectory, file), { force: true });
  }
  for (const directory of ["taoshouyou-pages", "taoshouyou-details"]) {
    const legacyDirectory = path.join(outputDirectory, "cache", directory);
    try {
      const entries = await readdir(legacyDirectory, { withFileTypes: true });
      await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => rm(path.join(legacyDirectory, entry.name), { force: true })));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
};

export const taoshouyouPageUrl = (page) => {
  if (page === 1) return TAOSHOUYOU_FIRST_PAGE;
  const filters = new URLSearchParams({
    antiAddictionStatus: "0",
    bornType: "-1",
    isActivity: "0",
    isCertificationShop: "2",
    isPreviewRank: "0",
    isinsurance: "0",
    popularize: "0",
    quotaid: "0",
    tags: "",
  });
  return `https://www.taoshouyou.com/game/guangyu-15256-0-1/0-0-0-0-0-0-0-0-0-2-2-2-${page}?${filters}`;
};

export const parseTaoshouyouList = (markdown, page = 1) => {
  const pattern = /\]\((https:\/\/www\.taoshouyou\.com\/taoid_(\d+)\.html)\)\s*\n\n([^\n]+\|[^\n]+)\s*\n\n￥([\d,.]+)/g;
  return [...markdown.matchAll(pattern)].map((match) => ({
    schema_version: 1,
    source: "taoshouyou",
    market_scope: "cn_netease",
    listing_id: match[2],
    listing_url: match[1],
    source_page: page,
    client: match[3].split("|")[0].trim(),
    source_summary: match[3].trim(),
    price_original: numberValue(match[4]),
    currency_original: "CNY",
    price_kind: "ask",
    account_candidate: true,
  }));
};

export const inspectTaoshouyouList = (markdown, page = 1) => {
  const rows = parseTaoshouyouList(markdown, page);
  const hasPageShell = /淘手游|光遇/.test(markdown)
    && (rows.length > 0 || /总共\s*\d+\s*页|上一页|下一页|加载中|暂无/.test(markdown));
  return { rows, healthy: hasPageShell };
};

export const parseTaoshouyouDetail = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const detail = {};
  const fields = new Map([
    ["发布时间：", ["published_at", String]],
    ["更新时间：", ["updated_at", String]],
    ["客户端：", ["client", String]],
    ["所在区服：", ["server", String]],
    ["蜡烛数量：", ["white_candles", numberValue]],
    ["爱心数量：", ["hearts", numberValue]],
    ["升华蜡烛数量：", ["ascended_candles", numberValue]],
    ["毕业地图数量：", ["completed_realms", numberValue]],
    ["毕业季节数量：", ["completed_seasons", numberValue]],
    ["光翼数量：", ["winged_light", numberValue]],
    ["是否防沉迷：", ["anti_addiction", String]],
    ["账号亮点：", ["description", String]],
  ]);
  for (let index = 0; index < lines.length; index += 1) {
    const field = fields.get(lines[index].trim());
    if (!field) continue;
    const value = nextNonEmpty(lines, index);
    if (value !== undefined) detail[field[0]] = field[1](value);
  }
  const title = lines[0]?.match(/^Title:\s*(.+?)_光遇_淘手游/)?.[1];
  const price = markdown.match(/^\s*￥([\d,.]+)(?:\.\d+)?\s*$/m)?.[1];
  if (title) detail.title = redactContact(title);
  if (price) detail.price_original = numberValue(price);
  if (detail.description) detail.description = redactContact(detail.description);
  return detail;
};

export const parseFunpay = (html) => {
  const $ = cheerio.load(html);
  return $("a.tc-item").map((_, element) => {
    const item = $(element);
    const href = item.attr("href") ?? "";
    const listingId = new URL(href, FUNPAY_URL).searchParams.get("id");
    const title = redactContact(item.find(".tc-desc-text").text().replace(/\s+/g, " "));
    const priceText = item.find(".tc-price div").first().text().replace(/\s+/g, " ").trim();
    const currency = priceText.match(/([€$₽])/)?.[1] ?? "€";
    const currencyCode = currency === "$" ? "USD" : currency === "₽" ? "RUB" : "EUR";
    const emptySteamAccount = /\bsteam account\b/i.test(title)
      && /\b(?:full access|auto[ -]?delivery|warranty|key)\b/i.test(title)
      && !/\b(?:season|candle|heart|wing|item|elder|cape|hair)\b/i.test(title);
    const likelyService = /\b(?:rent|rental|service|top[ -]?up|daily quests?|farming)\b/i.test(title) || emptySteamAccount;
    const machinePrice = numberValue(item.find(".tc-price").attr("data-s"));
    return {
      schema_version: 1,
      source: "funpay",
      market_scope: "global",
      listing_id: listingId,
      listing_url: new URL(href, FUNPAY_URL).href,
      title,
      price_original: machinePrice ?? localizedPriceValue(priceText),
      currency_original: currencyCode,
      price_kind: "ask",
      account_candidate: !likelyService,
    };
  }).get().filter((row) => row.listing_id && row.price_original !== undefined);
};

export const parseTaifexRates = (jsonText) => JSON.parse(jsonText)
  .map((row) => ({
    date: `${row.Date.slice(0, 4)}-${row.Date.slice(4, 6)}-${row.Date.slice(6, 8)}`,
    CNY: numberValue(row["RMB/NTD"]),
    USD: numberValue(row["USD/NTD"]),
    EUR: numberValue(row["EUR/USD"]) * numberValue(row["USD/NTD"]),
    HKD: numberValue(row["USD/NTD"]) / numberValue(row["USD/HKD"]),
  }))
  .filter((row) => row.date && row.CNY && row.USD)
  .sort((left, right) => left.date.localeCompare(right.date));

const rateFor = (rates, currency, date) => {
  const normalizedDate = String(date ?? "").slice(0, 10);
  const candidates = rates.filter((rate) => rate.date <= normalizedDate && rate[currency]);
  const selected = candidates.at(-1);
  return selected ? { fx_date: selected.date, fx_twd_per_unit: selected[currency] } : undefined;
};

export const convertToTwd = (row, rates, collectedAt) => {
  const rate = rateFor(rates, row.currency_original, row.published_at ?? collectedAt);
  if (!rate) return row;
  return {
    ...row,
    ...rate,
    price_twd_fx: Math.round(row.price_original * rate.fx_twd_per_unit),
    fx_source: "TAIFEX DailyForeignExchangeRates",
  };
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const markPriceOutliers = (rows) => {
  const comparableRows = rows.filter((row) => row.account_candidate
    && row.price_original > 0);
  const groups = Map.groupBy(comparableRows, (row) => `${row.source}:${row.currency_original}`);
  const stats = new Map([...groups].map(([key, group]) => {
    const logs = group.map((row) => Math.log(row.price_original)).filter(Number.isFinite);
    const center = median(logs);
    const deviation = median(logs.map((value) => Math.abs(value - center)));
    return [key, { center, deviation, count: logs.length }];
  }));
  return rows.map((row) => {
    const { center, deviation, count } = stats.get(`${row.source}:${row.currency_original}`) ?? {};
    const logPrice = Math.log(row.price_original);
    const robustZ = deviation > 0 && Number.isFinite(center) ? 0.6745 * Math.abs(logPrice - center) / deviation : undefined;
    const centerPrice = Number.isFinite(center) ? Math.exp(center) : undefined;
    const zeroMadOutlier = deviation === 0 && Number.isFinite(centerPrice)
      && (row.price_original > centerPrice * 10 || row.price_original < centerPrice / 10);
    const priceOutlier = !Number.isFinite(logPrice) || zeroMadOutlier || (robustZ !== undefined && robustZ > 5);
    const hasFx = Number.isFinite(row.price_twd_fx) && Number.isFinite(row.fx_twd_per_unit);
    const enoughComparableRows = (count ?? 0) >= 5;
    const qualityFlags = [
      !row.account_candidate && "likely_non_account",
      !hasFx && "missing_fx",
      !enoughComparableRows && "insufficient_currency_group",
      priceOutlier && "price_outlier",
    ].filter(Boolean);
    return {
      ...row,
      price_outlier: priceOutlier,
      relative_price_candidate: row.account_candidate && enoughComparableRows && !priceOutlier,
      ratio_candidate: row.account_candidate && hasFx && enoughComparableRows && !priceOutlier,
      quality_flags: qualityFlags,
    };
  });
};

const daysBetween = (left, right) => Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 86_400_000;

export const assessCollectionHealth = ({
  rates,
  funpayHtml,
  funpayRows,
  taoshouyouPageResults,
  requestedPages,
  collectedAt,
}) => {
  const latestRate = rates.at(-1);
  const rateHasRequiredCurrencies = latestRate
    && [latestRate.CNY, latestRate.USD, latestRate.EUR].every((value) => Number.isFinite(value) && value > 0);
  const taoshouyouRows = taoshouyouPageResults.flatMap((result) => result.rows ?? []);
  const lastNonemptyPage = Math.max(0, ...taoshouyouRows.map((row) => row.source_page));
  const requestFailedPages = taoshouyouPageResults
    .filter((result) => result.status === "request_failed")
    .map((result) => result.page);
  const unhealthyPages = taoshouyouPageResults
    .filter((result) => result.status === "unhealthy")
    .map((result) => result.page);
  const emptyPages = taoshouyouPageResults
    .filter((result) => result.status === "empty")
    .map((result) => result.page);
  const internalEmptyPages = emptyPages.filter((page) => page <= lastNonemptyPage);
  const lastPageSize = taoshouyouPageResults.find((result) => result.page === lastNonemptyPage)?.rows?.length ?? 0;
  const trailingPages = taoshouyouPageResults.filter((result) => result.page > lastNonemptyPage);
  const paginationEndConfirmed = lastNonemptyPage > 0
    && lastPageSize > 0
    && lastPageSize < 20
    && trailingPages.length > 0
    && trailingPages.every((result) => result.status === "empty");
  const taoshouyouHealthy = taoshouyouPageResults.some((result) => result.page === 1 && result.status === "ok")
    && requestFailedPages.length === 0
    && unhealthyPages.length === 0
    && internalEmptyPages.length === 0;
  const sourceHealth = {
    taifex: {
      healthy: Boolean(rateHasRequiredCurrencies && daysBetween(latestRate.date, collectedAt) <= 10),
      rows: rates.length,
      latest_date: latestRate?.date,
    },
    funpay: {
      healthy: funpayRows.length > 0 && /class=["'][^"']*tc-item/.test(funpayHtml),
      rows: funpayRows.length,
    },
    taoshouyou: {
      healthy: taoshouyouHealthy,
      rows: taoshouyouRows.length,
      last_nonempty_page: lastNonemptyPage,
      request_failed_pages: requestFailedPages,
      unhealthy_pages: unhealthyPages,
      internal_empty_pages: internalEmptyPages,
      trailing_empty_pages: emptyPages.filter((page) => page > lastNonemptyPage),
      pagination_end_confirmed: paginationEndConfirmed,
    },
  };
  const snapshotComplete = Object.values(sourceHealth).every((source) => source.healthy);
  return {
    sourceHealth,
    snapshotComplete,
    latestEligible: snapshotComplete && requestedPages >= 40 && paginationEndConfirmed,
    lastTaoshouyouPage: lastNonemptyPage,
    incompleteTaoshouyouPages: [...new Set([
      ...requestFailedPages,
      ...unhealthyPages,
      ...internalEmptyPages,
    ])].sort((left, right) => left - right),
  };
};

const mapLimit = async (values, concurrency, delayMs, mapper) => {
  const output = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(values[index], index);
      if (delayMs) await sleep(delayMs);
    }
  });
  await Promise.all(workers);
  return output;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const collectedAt = new Date().toISOString();
  const outputDirectory = path.resolve(options.outputDirectory);
  await prepareOutputDirectory(outputDirectory);
  const cacheDirectory = path.join(outputDirectory, "cache");
  const rateLimit = createRateLimiter(options.delayMs);
  const rates = parseTaifexRates(await fetchText(TAIFEX_URL));
  const funpayHtml = await fetchText(FUNPAY_URL);
  const funpay = parseFunpay(funpayHtml);
  const pages = Array.from({ length: options.taoshouyouPages }, (_, index) => index + 1);
  const taoshouyouPageResults = await mapLimit(pages, options.concurrency, 0, async (page) => {
    const sourceUrl = taoshouyouPageUrl(page);
    const cachePath = path.join(cacheDirectory, "taoshouyou-pages", `${page}.json`);
    try {
      const cached = await fetchParsed(
        `${READER_PREFIX}${sourceUrl}`,
        cachePath,
        (markdown) => inspectTaoshouyouList(markdown, page),
        { ...options, rateLimit },
      );
      const inspected = Array.isArray(cached.value)
        ? { rows: cached.value, healthy: cached.value.length > 0 }
        : cached.value;
      const rows = inspected.rows.map((row) => ({ ...row, observed_at: cached.observed_at }));
      const status = !inspected.healthy ? "unhealthy" : rows.length ? "ok" : "empty";
      if (status !== "ok") {
        await rm(cachePath, { force: true });
      }
      process.stderr.write(`taoshouyou page ${page}: ${rows.length} (${status})\n`);
      return { page, rows, status };
    } catch (error) {
      process.stderr.write(`taoshouyou page ${page} skipped: ${error.message}\n`);
      return { page, rows: [], status: "request_failed" };
    }
  });
  let taoshouyou = taoshouyouPageResults.flatMap((result) => result.rows);
  const health = assessCollectionHealth({
    rates,
    funpayHtml,
    funpayRows: funpay,
    taoshouyouPageResults,
    requestedPages: options.taoshouyouPages,
    collectedAt,
  });
  const detailTargets = taoshouyou.slice(0, options.taoshouyouDetails);
  const details = await mapLimit(detailTargets, options.concurrency, 0, async (row, index) => {
    try {
      const cached = await fetchParsed(
        `${READER_PREFIX}${row.listing_url}`,
        path.join(cacheDirectory, "taoshouyou-details", `${row.listing_id}.json`),
        parseTaoshouyouDetail,
        { ...options, rateLimit },
      );
      if ((index + 1) % 10 === 0) process.stderr.write(`taoshouyou details: ${index + 1}/${detailTargets.length}\n`);
      return [row.listing_id, { ...cached.value, detail_observed_at: cached.observed_at }];
    } catch (error) {
      process.stderr.write(`detail ${row.listing_id} skipped: ${error.message}\n`);
      return [row.listing_id, {}];
    }
  });
  const detailById = new Map(details);
  taoshouyou = taoshouyou.map((row) => {
    const merged = { ...row, ...detailById.get(row.listing_id) };
    const seasonMentions = extractSeasonMentions(merged.title, merged.description);
    const graduation = extractSeasonGraduation(merged.description);
    const fullGraduationCount = graduation.filter((entry) => entry.status === "full").length;
    const hasReportedCount = Number.isInteger(merged.completed_seasons);
    const graduationCountConsistent = hasReportedCount
      && fullGraduationCount === merged.completed_seasons;
    return {
      ...merged,
      ...(seasonMentions.length ? { season_mentions: seasonMentions } : {}),
      ...(graduation.length ? {
        season_graduation_mentions: graduation,
        season_graduation_count_consistent: graduationCountConsistent,
        ...(graduationCountConsistent ? { start_season_candidate: graduation[0].slug } : {}),
      } : {}),
    };
  });
  const funpayWithSeasons = funpay.map((row) => {
    const numbered = extractNumberedSeasonEvidence(row.title);
    const mentionSet = new Set([...extractSeasonMentions(row.title), ...numbered.mentions]);
    const seasonMentions = seasonSlugs.filter((slug) => mentionSet.has(slug));
    return {
      ...row,
      ...(seasonMentions.length ? { season_mentions: seasonMentions } : {}),
      ...(numbered.full.length ? {
        season_graduation_mentions: numbered.full.map((slug) => ({ slug, status: "full" })),
      } : {}),
    };
  });
  const snapshotComplete = health.snapshotComplete;
  const unique = new Map();
  for (const row of [...taoshouyou, ...funpayWithSeasons]) {
    unique.set(`${row.source}:${row.listing_id}`, convertToTwd({
      ...row,
      observed_at: row.observed_at ?? collectedAt,
      snapshot_collected_at: collectedAt,
      snapshot_complete: snapshotComplete,
    }, rates, collectedAt));
  }
  const rows = markPriceOutliers([...unique.values()]).sort((left, right) =>
    left.source.localeCompare(right.source) || String(left.listing_id).localeCompare(String(right.listing_id)));
  const seasonCoverage = Object.fromEntries(seasonMentionPatterns.map(([slug]) => {
    const matching = rows.filter((row) => row.season_mentions?.includes(slug));
    const graduated = rows.filter((row) => row.season_graduation_mentions?.some((entry) => entry.slug === slug));
    return [slug, {
      listings: matching.length,
      relative_price_candidates: matching.filter((row) => row.relative_price_candidate).length,
      ratio_candidates: matching.filter((row) => row.ratio_candidate).length,
      explicit_graduation: graduated.filter((row) => row.season_graduation_mentions
        .some((entry) => entry.slug === slug && entry.status === "full")).length,
      explicit_partial: graduated.filter((row) => row.season_graduation_mentions
        .some((entry) => entry.slug === slug && entry.status === "partial")).length,
      by_source: Object.fromEntries([...new Set(matching.map((row) => row.source))]
        .sort()
        .map((source) => [source, matching.filter((row) => row.source === source).length])),
    }];
  }));
  const summary = {
    schema_version: 1,
    collected_at: collectedAt,
    evidence_kind: "public_asking_price",
    snapshot_complete: snapshotComplete,
    total: rows.length,
    account_candidates: rows.filter((row) => row.account_candidate).length,
    relative_price_candidates: rows.filter((row) => row.relative_price_candidate).length,
    ratio_candidates: rows.filter((row) => row.ratio_candidate).length,
    price_outliers: rows.filter((row) => row.price_outlier).length,
    enriched_taoshouyou_details: rows.filter((row) => row.source === "taoshouyou" && row.description).length,
    incomplete_taoshouyou_pages: health.incompleteTaoshouyouPages,
    last_taoshouyou_page: health.lastTaoshouyouPage,
    source_health: health.sourceHealth,
    latest_eligible: health.latestEligible,
    by_source: Object.fromEntries([...new Set(rows.map((row) => row.source))].map((source) => [source, rows.filter((row) => row.source === source).length])),
    season_coverage: seasonCoverage,
    latest_fx_date: rates.at(-1)?.date,
    warning: "FX-converted TWD is not a Taiwan market estimate or a confirmed transaction price.",
  };
  const snapshotId = collectedAt.replaceAll(/[-:.]/g, "");
  const snapshotDirectory = path.join(outputDirectory, "snapshots", snapshotId);
  await mkdir(snapshotDirectory, { recursive: true });
  await writeAtomic(path.join(snapshotDirectory, "public-listings.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  await writeAtomic(path.join(snapshotDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  if (health.latestEligible) {
    await writeAtomic(path.join(outputDirectory, "latest.json"), `${JSON.stringify({ snapshot_id: snapshotId, snapshot_directory: path.relative(outputDirectory, snapshotDirectory) }, null, 2)}\n`);
  }
  await consolidateMarketListingSnapshots(outputDirectory);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
