import { createHash } from "node:crypto";

const digest = text => createHash("sha256").update(text).digest("hex");
const canonicalText = text => String(text ?? "").normalize("NFKC").replace(/\s+/g, "");
const breakLabel = raw => {
  const text = canonicalText(raw);
  if (/^(?:偽|僞)無斷$|^(?:微斷|小斷|少斷)$/.test(text)) return "slight";
  if (text === "無斷") return "none";
  if (text === "中斷") return "medium";
  if (text === "大斷") return "large";
  return null;
};
const packageLabel = raw => {
  const text = canonicalText(raw);
  if (/中少|中偏少|中多|中偏多/.test(text)) return null;
  if (/百禮/.test(text)) return "hundred";
  if (/多禮/.test(text)) return "many";
  if (/中禮/.test(text)) return "medium";
  if (/少禮|微禮/.test(text)) return "few";
  return null;
};

/** Latest Facebook collection is exploratory ask evidence, not validated data.
 * Raw text/dates/counts stay private. Unknown fields are never manufactured.
 * Review decisions can correct extraction errors or link duplicates, but their
 * source digest must match and each decision needs an auditable explanation.
 */
export function prepareWholeAccountEvidence(rows, { seasons, review = {}, sourceDigest } = {}) {
  if (review.sourceDigest && review.sourceDigest !== sourceDigest) throw new Error("Review/source digest mismatch");
  const known = new Set(seasons);
  const decisions = review.decisions ?? {};
  const keys = new Set(rows.map(row => row.postKey));
  for (const [key, change] of Object.entries(decisions)) {
    if (!keys.has(key) || !change.reason || (change.duplicateOf && !keys.has(change.duplicateOf)))
      throw new Error("Invalid evidence review decision");
  }
  const rootKey = key => {
    const seen = new Set();
    while (decisions[key]?.duplicateOf) {
      if (seen.has(key)) throw new Error("Cyclic duplicate review");
      seen.add(key);
      key = decisions[key].duplicateOf;
    }
    return key;
  };
  const rejected = [], candidates = [];
  for (const raw of rows) {
    const change = decisions[raw.postKey] ?? {};
    const row = { ...raw, ...change };
    const text = [raw.summary, raw.priceRaw].join(" ");
    let reason = change.exclude ?? decisions[rootKey(raw.postKey)]?.exclude ?? null;
    if (!reason && (row.excludeFromModel || row.exclude_from_model || row.intent !== "sell" || row.priceKind !== "ask"))
      reason = "not_account_ask";
    if (!reason && ((row.currency != null && row.currency !== "TWD") ||
        (row.server != null && row.server !== "international") ||
        (row.market != null && row.market !== "taiwan") ||
        /國服|中國服|陆服|陸服|网易|網易/.test(text) ||
        row.converted === true || /約\s*[\d.,]+台|人民幣直出|RM約/.test(text)))
      reason = "foreign_or_converted";
    if (!reason && /刷號|刷禮|刷鳥|刷火|刷紅|刷畢|非正規|髒號|无翼|無翼|墜機/.test(text))
      reason = "special_or_modified_account";
    if (!reason && /競標|起標|拍賣|底價|兩萬內|\d+k以下|合售|每隻/.test(text))
      reason = "not_single_account_point_ask";
    if (!reason && /徽章|勳章|實體|周邊|\d+徽/.test(text) && !change.accountOnlyConfirmed)
      reason = "mixed_goods";
    if (!reason && !/(?:台幣|台|NTD|TWD|NT\$)/i.test(text) && !change.currencyConfirmed)
      reason = "currency_unconfirmed";
    if (!reason && (typeof row.priceTwd !== "number" || !Number.isFinite(row.priceTwd) || row.priceTwd <= 0))
      reason = "invalid_price";
    if (!reason && (!raw.postKey || !/^https:\/\/www\.facebook\.com\//.test(raw.sourceUrl ?? "")))
      reason = "missing_provenance";
    if (reason) { rejected.push({ key: raw.postKey, reason }); continue; }
    const season = Object.hasOwn(change, "season") ? change.season : known.has(raw.seasonSlug) ? raw.seasonSlug : null;
    if (season !== null && !known.has(season)) throw new Error("Unknown reviewed season");
    // A source's old numeric fields are not proof of exact counts or breaks.
    candidates.push({
      accountKey: raw.accountKey ?? rootKey(raw.postKey), postKey: raw.postKey,
      stablePost: raw.sourceUrl.match(/\/(?:posts|permalink)\/(\d+)/)?.[1] ?? null,
      textKey: digest(canonicalText(raw.summary)), season,
      packageTier: Object.hasOwn(change, "packageTier") ? change.packageTier : packageLabel(raw.packageRaw),
      breakClass: Object.hasOwn(change, "breakClass") ? change.breakClass : breakLabel(raw.breakRaw),
      price: row.priceTwd, market: "taiwan", server: "international", currency: "TWD", priceKind: "ask",
      publishedAt: raw.publishedAt ?? null, collectedDate: raw.collectedDate,
      preferred: !change.duplicateOf, completeness: raw.completeness,
    });
  }
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) ||
    Number(b.completeness === "full-text") - Number(a.completeness === "full-text") || a.postKey.localeCompare(b.postKey));
  // Transitive identity components, not a price/season dedup key.
  const parent = candidates.map((_, i) => i), seen = new Map();
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  candidates.forEach((row, i) => {
    for (const key of ["account:" + row.accountKey, "post:" + row.postKey, "text:" + row.textKey,
      ...(row.stablePost ? ["url:" + row.stablePost] : [])]) {
      if (seen.has(key)) {
        const a = find(i), b = find(seen.get(key));
        parent[Math.max(a, b)] = Math.min(a, b);
      } else seen.set(key, i);
    }
  });
  const accepted = candidates.filter((row, i) => {
    if (find(i) === i) return true;
    rejected.push({ key: row.postKey, reason: "duplicate_account_or_post" });
    return false;
  });
  return { accepted, rejected, rejectionCounts: Object.fromEntries([...new Set(rejected.map(r => r.reason))]
    .sort().map(reason => [reason, rejected.filter(row => row.reason === reason).length])),
    datasetDigest: digest(JSON.stringify(accepted)) };
}
