import { createHash } from "node:crypto";
import { extractMarketTitleEvidence, marketTitleBreakMatchesStart, marketSeasonNamesFor } from "./market-title-evidence.mjs";

const normalize = value => String(value ?? "").normalize("NFKC").trim();
const unique = values => [...new Set(values)];
const numeric = text => Number(text.replaceAll(",", ""));

// No price, identity, source, file title or unrestricted text enters X.
// Every non-null extension carries a literal source quote for private review.
export function extractBenchmarkFeatures(row, { seasons, seasonNames, resolveItem }) {
  const text = normalize(row.summary);
  // Skip posting labels, not arbitrary content: scanning inventory for a season
  // name would turn purchased capes into false account-start claims.
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const heading = (lines.find(line => line.includes("▍")) ?? lines.find(line =>
    !/^(?:#?(?:售|出售|售號|售号|賣號|卖号|緩售|缓售|代售|代掛|代挂|已售|已售出|急售|收|求購|求购)[\s,，、]*)+$/.test(line)) ?? "").split(/[；;]/)[0];
  const progressLine = /^(?:✦\s*)?(?:畢業季節|毕业季节|畢業|毕业|季節進度|季节进度)\s*[:：]/;
  const title = extractMarketTitleEvidence(progressLine.test(heading) ? "" : heading);
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
  const resourceClaim = /(?:純|裸)?(?:資源|资源|蠟燭|蜡烛|白蠟|白蜡)(?:簡|简)(?:號|号)/.exec(heading);
  if (resourceClaim && !/(?:不是|並非|并非|不算|非)\s*$/.test(heading.slice(0, resourceClaim.index))) add("accountStyle", "resource", resourceClaim[0]);
  else if (title.accountStyle) add("accountStyle", title.accountStyle, heading);
  if (/(?:^|[\s；;，,。｜|])(?:無|没有|沒有)禮包(?=[\s；;，,。｜|]|$)/.test(text))
    add("packageCount", 0, text.match(/(?:無|没有|沒有)禮包/)[0]);
  const explicitProgress = lines.filter(line => progressLine.test(line))
    .map(line => line.replace(/^[^:：]*[:：]/, "")).join("｜");
  const progress = [text.split("♤")[1]?.split("♡")[0], explicitProgress].filter(Boolean).join("｜");
  let completeProgressParse = Boolean(progress);
  if (progress) {
    for (const token of progress.split(/[┊|｜、,，\r\n]/).map(t => t.replace(/^[\s›]+/, "").trim()).filter(Boolean)) {
      const claims = [];
      for (const season of seasons) for (const name of unique([...(seasonNames[season] ?? []), ...marketSeasonNamesFor(season)])) {
        if (!token.startsWith(name)) continue;
        const tail = token.slice(name.length).replace(/^季/, "").trim();
        if (/^(?:畢|畢業|全畢)?$/.test(tail)) claims.push([season, 1]);
        else if (/^(?:0|∅|未畢)$/.test(tail)) claims.push([season, 0]);
        else {
          const fraction = tail.match(/^([0-9]+)\s*[/⁄]\s*([1-9][0-9]*)$/);
          if (fraction && +fraction[1] <= +fraction[2]) claims.push([season, +fraction[1] / +fraction[2]]);
        }
      }
      const distinctClaims = [...new Map(claims.map(c => [JSON.stringify(c), c])).values()];
      if (distinctClaims.length === 1) {
        const [season, value] = distinctClaims[0], key = `progress:${season}`;
        if (key in features && features[key] !== value) { features[key] = null; evidence[key] += ` | CONFLICT: ${token}`; }
        else if (!(key in features)) add(key, value, token);
      } else completeProgressParse = false;
    }
  }
  if (canFill("season") && completeProgressParse && !Object.entries(features).some(([key,value]) => key.startsWith("progress:") && value === null)) {
    const first = seasons.find(season => features[`progress:${season}`] > 0);
    if (first) {
      basic.season = first;
      corrections.push({ field: "season", before: null, after: first, quote: evidence[`progress:${first}`] });
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
