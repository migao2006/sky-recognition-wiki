import { createHash } from "node:crypto";
import { prepareWholeAccountEvidence } from "./whole-account-evidence.mjs";
import { reviewTransactions, accuracyMetrics } from "./transaction-valuation.mjs";
import { fitWholeAccountModel, predictFreshModel, packageTiers, breakClasses } from "../../app/valuation-fresh-core.js";
import { extractMarketTitleEvidence, marketTitleBreakMatchesStart } from "./market-title-evidence.mjs";

const hash = text => createHash("sha256").update(text).digest("hex");
const normalized = text => String(text ?? "").normalize("NFKC").replace(/\s/g, "");
const validDay = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const evidenceGrades = ["sold", "sold_proxy", "ask"];

export function adaptDriveListing(snapshot, sourceDigest, { seasons, seasonNames }) {
  const content = String(snapshot.result?.content ?? "").normalize("NFKC");
  const title = content.split(/\r?\n/).find(line => line.includes("▍")) ?? snapshot.metadata.title;
  const titleEvidence = extractMarketTitleEvidence(title);
  const priceBlock = content.split("♧")[1]?.split("◇")[0] ?? "";
  const prices = [...priceBlock.matchAll(/(\d+(?:\.\d+)?)\s*(w|萬)?\s*(?:NTD|TWD|台幣)/gi)]
    .map(m => Number(m[1]) * (m[2] ? 10000 : 1));
  const uniquePrices = [...new Set(prices)];
  const progress = content.split("♤")[1]?.split("♡")[0] ?? "";
  const tokens = progress.split(/[┊|\r\n]/).map(t => t.replace(/^[\s›]+/, "").trim());
  const found = seasons.filter(s => (seasonNames[s] ?? []).some(name => tokens.some(t =>
    t.startsWith(name) && !/有卡|季卡|∅|⁰/.test(t) && /^\s*(?:$|~|[12１２]|\d[⁄/])/.test(t.slice(name.length)))));
  const season = found[0] ?? titleEvidence.startSeasonSlug;
  const breakClass = marketTitleBreakMatchesStart(title, season, titleEvidence.startSeasonSlug) ? titleEvidence.breakClass : null;
  const breakNames = { none: "無斷", slight: "微斷", medium: "中斷", big: "大斷" };
  const packageNames = { few: "少禮", medium: "中禮", many: "多禮" };
  return { postKey: `drive:${snapshot.metadata.id}`, accountKey: `drive:${snapshot.metadata.id}`,
    sourceRecordRef: `${sourceDigest}:drive:${snapshot.metadata.id}`, sourceUrl: snapshot.metadata.url,
    groupId: "drive:1lX7g1HnugqZWgIfL47CTmbp6-uHUfyXm", summary: content, priceRaw: priceBlock,
    priceTwd: uniquePrices.length === 1 ? uniquePrices[0] : null, priceKind: "ask", intent: "sell",
    seasonSlug: season, breakRaw: breakNames[breakClass] ?? null,
    packageRaw: /百禮/.test(title) ? "百禮" : packageNames[titleEvidence.salePackageTier] ?? null,
    publishedAt: null, documentModifiedAt: snapshot.metadata.modified_time,
    excludeFromModel: snapshot.error || uniquePrices.length !== 1 || /NTD\s*底|底價|起標|\d+\s*直出/.test(priceBlock) ||
      /買就送無翼|合售|贈號|送號/.test(content),
    priceBasis: /包仲介|包仲/.test(priceBlock) ? "including_fees" : "unknown" };
}

// Legacy derived counts/classes are not evidence. Keep only explicit labels.
export function adaptLegacyListing(row, sourceDigest) {
  const summary = row.listing_text ?? "";
  return { postKey: row.post_id, accountKey: row.account_id || row.post_id,
    sourceRecordRef: `${sourceDigest}:${row.post_id}`, sourceUrl: row.source_url ?? null,
    groupId: row.group_id ?? null, summary, priceRaw: summary, priceTwd: row.price_twd,
    priceKind: row.price_kind === "sold" ? "sold_proxy" : row.price_kind === "ask" || row.price_kind === "quick_sale" ? "ask" : "manual",
    intent: /(?:^|[；;，,\s])(?:收|徵|求購|求购)|預算/.test(summary) ? "buy" : "sell",
    server: row.region === "international" ? "international" : row.region === "china" ? "china" : "unknown",
    currency: String(row.currency ?? "unknown").toUpperCase(), converted: row.converted === true,
    seasonSlug: row.start_season_confidence === "explicit" ? row.start_season_slug : null,
    breakRaw: summary.match(/偽無斷|僞無斷|無斷|微斷|小斷|少斷|中斷|大斷/)?.[0] ?? null,
    packageRaw: summary.match(/中少禮|中偏少禮|中多禮|中偏多禮|百禮|多禮|中禮|少禮|微禮/)?.[0] ?? null,
    publishedAt: validDay(row.published_at) ? row.published_at : null,
    excludeFromModel: row.excludeFromModel === true || row.exclude_from_model === true,
    knownAnswer: row.knownAnswer === true || row.known_answer === true };
}

/** All original records participate in identity linking, including rejected
 * duplicates. Search URLs are not identities; exact summaries are surrogates.
 * Groups are exploratory, not independently verified accounts.
 */
export function prepareGradedEvidence(batches, { seasons, asOf, seasonNames = {} }) {
  if (!validDay(asOf)) throw new Error("Invalid collection date");
  const records = [], candidates = [], rejected = [];
  for (const batch of batches) {
    const rows = batch.format === "legacy" ? batch.rows.map(row => adaptLegacyListing(row, batch.sourceDigest)) :
      batch.format === "drive" ? batch.rows.map(row => adaptDriveListing(row, batch.sourceDigest, { seasons, seasonNames })) : batch.rows;
    const start = records.length;
    records.push(...rows.map(row => {
      const review = batch.review?.decisions?.[row.postKey];
      return { row, effective: { ...row, ...review }, digest: batch.sourceDigest, review };
    }));
    if (batch.format === "transaction") {
      const report = reviewTransactions(rows, { seasons, asOf });
      rejected.push(...report.rejected.map(r => ({ ...r, sourceDigest: batch.sourceDigest })));
      for (const row of report.accepted) candidates.push({ ...row, recordIndex: start + rows.indexOf(row), date: row.soldAt });
      continue;
    }
    const report = prepareWholeAccountEvidence(rows, { seasons, sourceDigest: batch.sourceDigest, review: batch.review,
      allowedPriceKinds: ["ask", "sold_proxy"], allowPrivateReference: ["legacy", "drive"].includes(batch.format), deduplicate: false });
    rejected.push(...report.rejected.map(r => ({ ...r, sourceDigest: batch.sourceDigest })));
    for (const row of report.accepted) {
      const index = rows.findIndex(raw => raw.postKey === row.postKey), raw = rows[index];
      if (validDay(row.publishedAt) && row.publishedAt > asOf) {
        rejected.push({ key: row.postKey, reason: "future_publication_date" }); continue;
      }
      candidates.push({ ...row, sourceGroup: raw.groupId ?? "unknown", sourceDigest: batch.sourceDigest,
        sourceFormat: batch.format, summary: raw.summary ?? "", sourceUrl: raw.sourceUrl ?? null,
        reviewedFields: Object.keys(batch.review?.decisions?.[raw.postKey] ?? {}),
        priceBasis: raw.priceBasis ?? "unknown", documentModifiedAt: raw.documentModifiedAt ?? null,
        priceKind: row.priceKind === "sold_proxy" || /已售|已出/.test(raw.summary ?? "") ? "sold_proxy" : "ask",
        recordIndex: start + index, date: validDay(row.publishedAt) ? row.publishedAt : null });
    }
  }
  const parent = records.map((_, i) => i), keys = new Map();
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  records.forEach(({ effective, review }, i) => {
    const text = normalized(effective.summary);
    const identifiers = [effective.accountKey && `account:${effective.accountKey}`, effective.postKey && `post:${effective.postKey}`,
      review?.duplicateOf && `post:${review.duplicateOf}`, text && `text:${hash(text)}`,
      // A broker post may deliberately list several separate accounts. Its
      // account lines retain a common stablePost for CV grouping, while this
      // identity pass must not collapse them into one contradictory account.
      effective.separateAccountInPost !== true && effective.sourceUrl?.match(/\/(?:posts|permalink)\/(\d+)/)?.[1] && `post:${effective.sourceUrl.match(/\/(?:posts|permalink)\/(\d+)/)[1]}`];
    for (const key of identifiers.filter(Boolean)) {
      if (keys.has(key)) parent[root(i)] = root(keys.get(key));
      keys.set(key, i);
    }
  });
  const blocked = new Set(records.flatMap(({ row, review }, i) => review?.exclude || row.knownAnswer === true || row.excludeFromModel === true ||
    row.exclude_from_model === true ? [root(i)] : []));
  const groups = new Map();
  for (const row of candidates) {
    const identity = root(row.recordIndex);
    if (blocked.has(identity)) { rejected.push({ key: row.postKey, reason: "quarantined_identity" }); continue; }
    const group = groups.get(identity) ?? []; group.push(row); groups.set(identity, group);
  }
  const accepted = [];
  for (const [identity, group] of groups) {
    group.sort((a, b) => evidenceGrades.indexOf(a.priceKind) - evidenceGrades.indexOf(b.priceKind) ||
      Number(b.preferred !== false) - Number(a.preferred !== false) ||
      (b.date ?? "").localeCompare(a.date ?? "") || a.postKey.localeCompare(b.postKey));
    const first = group[0];
    const peers = group.filter(r => r.priceKind === first.priceKind && r.date === first.date && r.preferred === first.preferred);
    const conflict = new Set(peers.map(r => JSON.stringify([r.price, r.season, r.packageTier, r.breakClass]))).size > 1;
    const memberKeys = [...new Set(records.flatMap((r, i) => root(i) === identity ?
      [r.row.accountKey && `account:${r.row.accountKey}`, `post:${r.row.postKey}`].filter(Boolean) : []))].sort();
    group.forEach((row, i) => {
      if (conflict || i) rejected.push({ key: row.postKey, reason: conflict ? "conflicting_identity" : "cross_batch_duplicate" });
      else {
        const { recordIndex: _index, ...evidence } = row;
        void _index;
        accepted.push({ ...evidence, accountKey: hash(memberKeys.join("\n")), identityAliases: memberKeys,
          identityQuality: "reviewed_or_surrogate_not_blind" });
      }
    });
  }
  accepted.sort((a, b) => a.accountKey.localeCompare(b.accountKey));
  return { accepted, rejected, datasetDigest: hash(JSON.stringify(accepted)),
    rejectionCounts: Object.fromEntries([...new Set(rejected.map(r => r.reason))].sort()
      .map(reason => [reason, rejected.filter(r => r.reason === reason).length])) };
}

export function compareGradedModels(rows, { seasons }) {
  const features = r => ({ season: r.season, packageTier: r.packageTier, breakClass: r.breakClass });
  return Object.fromEntries(evidenceGrades.map(priceKind => {
    const cohort = rows.filter(r => r.priceKind === priceKind);
    const fit = source => fitWholeAccountModel(source.map(r => ({ ...features(r), accountKey: r.accountKey,
      price: r.price, priceKind, market: "taiwan", server: "international", currency: "TWD" })), { seasons, priceKind });
    const evaluate = (subset, temporal) => {
      if (subset.length < 10) return { status: "pending_data", available: subset.length };
      const ordered = [...subset].sort((a, b) => temporal ? a.date.localeCompare(b.date) :
        hash(a.accountKey).localeCompare(hash(b.accountKey)));
      const pivot = Math.floor(ordered.length * .8), cutoff = temporal ? ordered[pivot].date : null;
      const train = temporal ? ordered.filter(r => r.date < cutoff) : ordered.slice(0, pivot);
      const test = temporal ? ordered.filter(r => r.date >= cutoff) : ordered.slice(pivot);
      if (train.length < 5 || !train.some(r => r.season !== null)) return { status: "pending_training_diversity" };
      const model = fit(train);
      const pairs = test.map(r => ({ ...r, actual: r.price, predicted: predictFreshModel(model, features(r)).midpoint }));
      const grouped = (field, labels) => Object.fromEntries([...new Set([...labels, ...pairs.map(r => r[field] ?? "unknown")])]
        .map(label => [label, accuracyMetrics(pairs.filter(r => (r[field] ?? "unknown") === label))]));
      return { status: "development_only", method: temporal ? "time_split" : "public_deterministic_group_split_not_blind",
        cutoff, trainCount: train.length, testCount: test.length, metrics: accuracyMetrics(pairs),
        bySeason: grouped("season", seasons), byPackage: grouped("packageTier", packageTiers),
        byBreak: grouped("breakClass", breakClasses), bySource: grouped("sourceGroup", []) };
    };
    return [priceKind, { count: cohort.length, validation: "unvalidated", blindTest: false, fullFrontendVerified: false,
      missing: Object.fromEntries(["season", "packageTier", "breakClass", "date"].map(k => [k, cohort.filter(r => r[k] == null).length])),
      seasonCoverage: Object.fromEntries(seasons.map(s => [s, cohort.filter(r => r.season === s).length])),
      candidate: cohort.some(r => r.season !== null) ? fit(cohort) : null,
      knownDates: evaluate(cohort.filter(r => r.date !== null), true),
      unknownDates: evaluate(cohort.filter(r => r.date === null), false) }];
  }));
}
