import { createHash } from "node:crypto";
import { extractMarketTitleEvidence } from "./market-title-evidence.mjs";
import { extractCompleteBindings, extractPartialBindings } from "./listing-account-evidence.mjs";

const hash = value => createHash("sha256").update(`facebook-market-v1:${value}`).digest("hex");
export const facebookPostHash = value => hash(normalize(value));
const normalize = value => String(value ?? "").normalize("NFKC").replaceAll("\u00a0", " ").trim();
const compact = value => normalize(value).replaceAll(/\s+/gu, " ");
const unique = values => [...new Set(values)];

const buyPattern = /(?:^|[\s#＃])(?:收|求購|求购|徵|征|尋|寻|想收|預算|预算|蹲)(?=$|[\s:：#＃])/u;
const sellPattern = /(?:^|[\s#＃])(?:售|出售|賣|卖|代出|代售|代掛|代挂|緩出|缓出|緩售|缓售|急售|秒出|已售|已出)(?=$|[\s:：#＃])/u;
const swapPattern = /(?:^|[\s#＃])(?:換|换|交換|交换|主換|主换)(?=$|[\s:：#＃])/u;
const servicePattern = /(?:代儲|代充|陪玩|跑圖|跑图|互心|季卡|代跑|工作室|租號|租号)/u;
const foreignPattern = /(?:國服|国服|渠道服|安卓服|華為服|华为服|人民幣|人民币|\bRMB\b|\bCNY\b|港幣|港币|\bHKD\b|馬幣|马币|\bRM\b|美元|\bUSD\b)/iu;
const modifiedPattern = /(?:刷號|刷号|刷篝火|猛\s*0|科技號|科技号|修改號|修改号|無翼|无翼)/u;
const mixedGoodsPattern = /(?:iPhone|安卓手機|安卓手机|禮物卡|礼物卡|實體徽章|实体徽章|周邊|周边|合售)/iu;
const auctionPattern = /(?:競標|竞标|起標|起标|喊價|喊价|價高者得|价高者得)/u;
const estimatePattern = /(?:估價|估价|問價|问价|值多少|多少錢|多少钱)/u;

const numberedHeading = /^(?:[0-9]{1,2}(?:\uFE0F?\u20E3|[.、:：)])|[①②③④⑤⑥⑦⑧⑨⑩]|[❶❷❸❹❺❻❼❽❾❿])\s*$/u;
const numberedPrefix = /^(?:[0-9]{1,2}(?:\uFE0F?\u20E3|[.、:：)])|[①②③④⑤⑥⑦⑧⑨⑩]|[❶❷❸❹❺❻❼❽❾❿])\s*/u;

/** Split explicit numbered broker posts without inventing account boundaries. */
export function splitFacebookAccountOffers(content) {
  const lines = normalize(content).split(/\r?\n/u);
  const starts = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (numberedHeading.test(trimmed) || numberedPrefix.test(trimmed)) starts.push(index);
  });
  if (starts.length < 2) return [normalize(content)];
  const prefix = lines.slice(0, starts[0]).join("\n").trim();
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? lines.length;
    const section = lines.slice(start, end);
    section[0] = section[0].replace(numberedPrefix, "");
    return [prefix, section.join("\n")].filter(Boolean).join("\n").trim();
  }).filter(Boolean);
}

const priceValue = (literal, unit, suffix) => {
  const numeric = Number(literal.replaceAll(",", ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const normalizedUnit = String(unit ?? "").toLowerCase();
  if (normalizedUnit === "萬" || normalizedUnit === "万" || normalizedUnit === "w") return Math.round(numeric * 10_000);
  // Taiwan trade shorthand: 6.8台 means NT$68,000, while 6800台 is literal.
  if ((suffix === "台" || suffix === "臺") && numeric < 100 && literal.includes(".")) return Math.round(numeric * 10_000);
  return Math.round(numeric);
};

const priceMatches = text => {
  const results = [];
  const pattern = /(?<![\p{L}\p{N}])(?<prefix>秒價|秒价|秒出|秒|直出價|直出价|直出|直價|直价|直|售價|售价|價格|价格|價錢|价钱|售|出)?\s*[:：]?\s*(?:NTD|TWD|NT\$?|新台幣|新台币|台幣|臺幣)?\s*(?<number>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?<unit>[萬万wW])?\s*(?<suffix>NTD|TWD|NT|元|塊|块|台幣|臺幣|台币|台|臺)?/giu;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].trim();
    const prefix = match.groups.prefix ?? "";
    const value = priceValue(match.groups.number, match.groups.unit, match.groups.suffix);
    const explicitMoney = Boolean(match.groups.unit || match.groups.suffix || prefix);
    if (!value || value < 500 || value > 1_000_000 || !explicitMoney) continue;
    // Resource quantities, dates, instalments and follower/member counts are not prices.
    const before = text.slice(Math.max(0, match.index - 18), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 18);
    if (/(?:蠟|蜡|愛心|爱心|紅蠟|红蜡|身高|粉絲|粉丝|成員|成员|追蹤|追踪|預算|预算)\s*[:：]?\s*$/u.test(before) ||
        /^(?:個月|个月|期|人收|人求)/u.test(after)) continue;
    const kind = /秒/u.test(prefix) ? "quick" : /直/u.test(prefix) ? "direct" : "ask";
    results.push({ value, kind, raw, inferredCurrency: !match.groups.suffix && !/NTD|TWD|NT\$?|新台幣|新台币|台幣|臺幣|台币/iu.test(raw) });
  }
  for (const match of text.matchAll(/(?<number>\d{3,6}(?:\.\d+)?)\s*(?<unit>[萬万wW])?\s*(?<kind>直出|直|秒價|秒价|秒出|秒)(?![\p{L}\p{N}])/giu)) {
    const value = priceValue(match.groups.number, match.groups.unit, null);
    if (!value || value < 500 || value > 1_000_000) continue;
    results.push({ value, kind: /秒/u.test(match.groups.kind) ? "quick" : "direct", raw: match[0], inferredCurrency: true });
  }
  for (const match of text.matchAll(/^\s*(?<number>\d{3,6}(?:\.\d+)?)\s*(?<unit>[萬万wW])?\s*$/gmu)) {
    const value = priceValue(match.groups.number, match.groups.unit, null);
    if (!value || value < 500 || value > 1_000_000) continue;
    results.push({ value, kind: "ask", raw: match[0].trim(), inferredCurrency: true });
  }
  return results;
};

export function parseTaiwanListingPrice(text) {
  const matches = priceMatches(normalize(text));
  const byKind = Object.fromEntries(["quick", "direct", "ask"].map(kind => {
    const values = unique(matches.filter(item => item.kind === kind).map(item => item.value));
    return [kind, values.length === 1 ? matches.find(item => item.kind === kind && item.value === values[0]) : null];
  }));
  const chosen = byKind.quick ?? byKind.direct ?? byKind.ask;
  const all = unique(matches.map(item => item.value));
  // Multiple unlabeled prices cannot safely identify one account value.
  if (!chosen || (chosen.kind === "ask" && all.length !== 1)) return { chosen: null, matches, reason: matches.length ? "ambiguous_price" : "missing_price" };
  return { chosen, matches, reason: null };
}

const modelPackageTier = title => title.salePackageTier ??
  (Number.isSafeInteger(title.paidPackageCount)
    ? title.paidPackageCount >= 100 ? "hundred" : title.paidPackageCount >= 90 ? "many" : title.paidPackageCount >= 60 ? "medium" : "few"
    : null);

const evidenceHeading = segment => {
  const lines = segment.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  const candidates = lines.slice(0, 18).map(line => ({ line, evidence: extractMarketTitleEvidence(line) }))
    .filter(({ evidence }) => evidence.startSeasonSlug || evidence.breakClass || evidence.salePackageTier || Number.isSafeInteger(evidence.paidPackageCount));
  const complete = candidates.filter(({ evidence }) => evidence.startSeasonSlug && evidence.breakClass && modelPackageTier(evidence));
  const keys = unique(complete.map(({ evidence }) => [evidence.startSeasonSlug, evidence.breakClass, modelPackageTier(evidence)].join("|")));
  if (keys.length !== 1) return null;
  return complete.find(({ evidence }) => [evidence.startSeasonSlug, evidence.breakClass, modelPackageTier(evidence)].join("|") === keys[0]);
};

const bindingFeatures = text => {
  const complete = extractCompleteBindings(text);
  const partial = complete?.bindings ?? extractPartialBindings(text).bindings;
  return Object.fromEntries(Object.entries(partial).map(([key, value]) => [
    `binding:${key === "gameCenter" ? "GC" : key === "google" ? "GG" : key === "nintendo" ? "NS" : key === "playstation" ? "PSN" : key.toUpperCase()}`,
    value === "none" ? "unbound" : value === "transfer" ? "transferable" : value,
  ]));
};

const rejectionReason = (segment, parent) => {
  const segmentSell = sellPattern.test(segment);
  const segmentBuy = buyPattern.test(segment);
  if (!segmentSell && !sellPattern.test(parent)) return segmentBuy || buyPattern.test(parent) ? "buy_not_sell" : "missing_sell_intent";
  if (segmentBuy && !segmentSell) return "buy_not_sell";
  if (swapPattern.test(segment) && !segmentSell) return "swap_not_sell";
  if (servicePattern.test(segment)) return "service_or_topup";
  if (foreignPattern.test(segment)) return "foreign_or_china_market";
  if (modifiedPattern.test(segment)) return "modified_or_special_account";
  if (mixedGoodsPattern.test(segment)) return "mixed_goods";
  if (auctionPattern.test(segment)) return "auction";
  if (estimatePattern.test(segment) && !segmentSell) return "estimate_only";
  return null;
};

/** Convert one Facebook export row into privacy-safe account observations. */
export function adaptFacebookCsvRow(row) {
  const content = normalize(row.content);
  const postId = normalize(row.post_id);
  if (!content || !postId) return { accepted: [], rejected: [{ reason: "missing_content_or_post_id" }] };
  const segments = splitFacebookAccountOffers(content);
  const accepted = [], rejected = [];
  for (const [index, segment] of segments.entries()) {
    const reason = rejectionReason(segment, content.slice(0, 300));
    if (reason) { rejected.push({ postId: hash(postId), segment: index, reason }); continue; }
    const price = parseTaiwanListingPrice(segment);
    if (!price.chosen) { rejected.push({ postId: hash(postId), segment: index, reason: price.reason }); continue; }
    const heading = evidenceHeading(segment);
    if (!heading) { rejected.push({ postId: hash(postId), segment: index, reason: "missing_or_conflicting_title_features" }); continue; }
    const title = heading.evidence;
    const normalizedSegment = compact(segment);
    const repostComparable = compact(segment.split(/\r?\n/u)
      .filter(line => !/^(?:\s*#[^\s#＃]+)+\s*$/u.test(line))
      .join("\n"));
    const sold = /(?:已售出|已售|已出)/u.test(segment);
    const accountKey = hash(`${postId}:${index}:${normalizedSegment}`);
    accepted.push({
      accountKey,
      postKey: `facebook:${hash(postId).slice(0, 24)}:${index}`,
      stablePost: hash(postId),
      textKey: hash(repostComparable),
      season: title.startSeasonSlug,
      packageTier: modelPackageTier(title),
      breakClass: title.breakClass === "big" ? "large" : title.breakClass,
      price: price.chosen.value,
      market: "taiwan",
      server: "international",
      currency: "TWD",
      currencyInferred: price.chosen.inferredCurrency,
      priceKind: sold ? "sold_proxy" : "ask",
      publishedAt: /^\d{4}-\d{2}-\d{2}T/u.test(row.date_posted ?? "") ? row.date_posted : null,
      separateAccountInPost: segments.length > 1,
      preferred: price.chosen.kind === "quick",
      priceVariant: price.chosen.kind,
      observedPrices: Object.fromEntries(price.matches.map(item => [item.kind, item.value])),
      completeness: "facebook-full-text",
      sourceGroup: normalize(row.group_id) || null,
      sourceFormat: "facebook_csv",
      sourceFamily: "facebook",
      sourceDigest: hash(content),
      summary: segment,
      reviewedFields: [],
      priceBasis: "listing_text",
      documentModifiedAt: null,
      date: row.date_posted ?? null,
      identityAliases: [`post:${hash(postId)}`],
      identityQuality: "source_post_and_segment",
      accountOnly: true,
      excludeFromModel: false,
      originalFeatures: { season: title.startSeasonSlug, packageTier: modelPackageTier(title), breakClass: title.breakClass === "big" ? "large" : title.breakClass },
      features: {
        ...(Number.isSafeInteger(title.paidPackageCount) ? { packageCount: title.paidPackageCount } : {}),
        ...bindingFeatures(segment),
      },
      evidence: { title: heading.line, price: price.chosen.raw },
      corrections: [],
      unresolved: [],
      splitGroup: `facebook-seller:${hash(normalize(row.profile_id) || postId)}`,
    });
  }
  return { accepted, rejected };
}

export function dedupeFacebookMarketRows(rows) {
  const seenPosts = new Set(), seenTexts = new Set(), kept = [], rejected = [];
  for (const row of rows.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)))) {
    const postSegment = `${row.stablePost}:${row.evidence.title}:${row.price}`;
    if (seenPosts.has(postSegment)) { rejected.push({ postId: row.stablePost, reason: "duplicate_post_segment" }); continue; }
    if (seenTexts.has(row.textKey)) { rejected.push({ postId: row.stablePost, reason: "duplicate_repost_text" }); continue; }
    seenPosts.add(postSegment); seenTexts.add(row.textKey); kept.push(row);
  }
  return { kept, rejected };
}
