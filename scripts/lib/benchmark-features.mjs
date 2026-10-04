import { createHash } from "node:crypto";
import { extractMarketTitleEvidence, marketTitleBreakMatchesStart } from "./market-title-evidence.mjs";

const normalize = value => String(value ?? "").normalize("NFKC").trim();
const unique = values => [...new Set(values)];
const numeric = text => Number(text.replaceAll(",", ""));

// No price, identity, source, file title or unrestricted text enters X.
// Every non-null extension carries a literal source quote for private review.
export function extractBenchmarkFeatures(row, { seasons, seasonNames, resolveItem }) {
  const text = normalize(row.summary);
  const heading = text.split(/\r?\n/).find(line => line.includes("▍")) ?? text.split(/\r?\n/)[0];
  const title = extractMarketTitleEvidence(heading);
  const evidence = {}, corrections = [], features = {};
  const add = (key, value, quote) => { features[key] = value; evidence[key] = quote; };
  const basic = { season: row.season, breakClass: row.breakClass, packageTier: row.packageTier };
  const canFill = key => basic[key] == null && !row.reviewedFields?.includes(key);
  // Fill only explicit, unambiguous account claims. Never override a review.
  if (canFill("season") && title.startSeasonSlug) {
    basic.season = title.startSeasonSlug;
    corrections.push({ field: "season", before: null, after: basic.season, quote: heading });
  }
  if (canFill("breakClass") && basic.season && title.startSeasonSlug === basic.season &&
      !/半(?:後|后)?[無无]斷/.test(heading) && title.breakClass && marketTitleBreakMatchesStart(heading, basic.season, title.startSeasonSlug)) {
    basic.breakClass = title.breakClass === "big" ? "large" : title.breakClass;
    corrections.push({ field: "breakClass", before: null, after: basic.breakClass, quote: heading });
  }
  const hundred = /百[禮礼]/.test(heading) && !/(?:非|不|無|无|沒有|未達|不到)百[禮礼]/.test(heading);
  if (canFill("packageTier") && !/中(?:偏)?[少多][禮礼]|中[禮礼][少多]|[少多]中[禮礼]/.test(heading) && (title.salePackageTier || hundred)) {
    basic.packageTier = hundred ? "hundred" : title.salePackageTier;
    corrections.push({ field: "packageTier", before: null, after: basic.packageTier, quote: heading });
  }
  if (Number.isSafeInteger(title.paidPackageCount)) add("packageCount", title.paidPackageCount, heading);
  if (/^(?:純|裸)?資源簡號/.test(heading)) add("accountStyle", "resource", heading);
  else if (title.accountStyle) add("accountStyle", title.accountStyle, heading);
  if (/(?:^|[\s；;，,。｜|])(?:無|没有|沒有)禮包(?=[\s；;，,。｜|]|$)/.test(text))
    add("packageCount", 0, text.match(/(?:無|没有|沒有)禮包/)[0]);
  const progress = text.split("♤")[1]?.split("♡")[0];
  if (progress) {
    for (const token of progress.split(/[┊|｜\r\n]/).map(t => t.replace(/^[\s›]+/, "").trim())) {
      const claims = [];
      for (const season of seasons) for (const name of seasonNames[season] ?? []) {
        if (!token.startsWith(name)) continue;
        const tail = token.slice(name.length).replace(/^季/, "").trim();
        if (/^(?:畢|畢業|全畢)?$/.test(tail)) claims.push([season, 1]);
        else if (/^(?:0|∅|未畢)$/.test(tail)) claims.push([season, 0]);
        else {
          const fraction = tail.match(/^([0-9]+)\s*[/⁄]\s*([1-9][0-9]*)$/);
          if (fraction && +fraction[1] <= +fraction[2]) claims.push([season, +fraction[1] / +fraction[2]]);
        }
      }
      if (claims.length === 1) {
        const [season, value] = claims[0], key = `progress:${season}`;
        if (key in features && features[key] !== value) { features[key] = null; evidence[key] += ` | CONFLICT: ${token}`; }
        else if (!(key in features)) add(key, value, token);
      }
    }
  }
  for (const [key, name] of [["candles", "白蠟|白蜡"], ["hearts", "愛心|爱心"], ["ascended", "昇華蠟|升華蠟|升华蜡"], ["passes", "副卡"]]) {
    const matches = [...text.matchAll(new RegExp(`(?:${name})[ ：:]*([0-9][0-9,]*)(?![0-9,.+＋萬万千])(?=[\\s｜|┊・，,、。;；]|$)`, "g"))];
    const values = unique(matches.map(m => numeric(m[1])));
    if (values.length === 1) add(key, values[0], matches[0][0]);
  }
  for (const platform of ["GG", "GC", "NS", "PSN", "STEAM", "FB", "APPLE"]) {
    const matches = [...text.matchAll(new RegExp(`\\b${platform}[ ：:]*((?:未綁|無綁|不出|可出|出|遺失|異常))(?![\\p{L}])`, "giu"))];
    const values = unique(matches.map(m => /未綁|無綁/.test(m[1]) ? "unbound" : /可出|^出$/.test(m[1]) ? "transferable" : m[1]));
    if (values.length === 1) add(`binding:${platform}`, values[0], matches[0][0]);
  }
  const unresolved = [];
  // Only isolated exact aliases; do not scan price/heading text for item names.
  const inventory = text.split("◇")[1] ?? text.split(/✦ (?:限定聯動|重要禮包|特殊限定)/).slice(1).join("\n");
  for (const token of inventory.split(/[\r\n┊｜|・⸝╻›、,，;；]+/).map(normalize).filter(Boolean)) {
    const absent = /^(?:沒有|缺少|不含|無)/.test(token);
    const term = token.replace(/^(?:沒有|缺少|不含|無)/, "");
    const resolved = resolveItem?.(term);
    if (resolved?.method === "exact" && resolved.candidates.length === 1) {
      const key = `item:${resolved.candidates[0].guid}`, value = absent ? "absent" : "present";
      if (key in features && features[key] !== value) { features[key] = null; evidence[key] += ` | CONFLICT: ${token}`; }
      else if (!(key in features)) add(key, value, token);
    } else unresolved.push(token);
  }
  return { ...basic, features, evidence, corrections, unresolved };
}

export function fixedFolds(rows, count = 5) {
  const keys = [...new Set(rows.map(r => r.splitGroup ?? r.accountKey))].sort((a, b) => {
    const hash = key => createHash("sha256").update(`market-benchmark-v1:${key}`).digest("hex");
    return hash(a).localeCompare(hash(b));
  });
  const folds = new Map(keys.map((key, i) => [key, i % count]));
  return rows.map(r => folds.get(r.splitGroup ?? r.accountKey));
}
