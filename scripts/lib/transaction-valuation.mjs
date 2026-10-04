import { createHash } from "node:crypto";
import { fitWholeAccountModel, predictFreshModel, packageTiers, breakClasses } from "../../app/valuation-fresh-core.js";

const text = value => typeof value === "string" && value.trim().length > 0;
const day = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

/** Strict transaction evidence, not a converter for legacy sold/asking labels.
 * Receipt content stays private. Confirmation flags represent human review,
 * not automatic authentication of a transaction or account identity.
 */
export function reviewTransactions(rows, { seasons, asOf }) {
  if (!day(asOf) || !Array.isArray(seasons) || !seasons.length) throw new Error("Invalid audit configuration");
  const known = new Set(seasons), rejected = [], accepted = [];
  // Link before filtering: a quarantined duplicate cannot escape via a new post.
  const parent = rows.map((_, i) => i), keys = new Map();
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  rows.forEach((row, i) => {
    for (const [kind, key] of [["account", row.accountKey], ["post", row.postKey], ["receipt", row.evidence?.sha256]]) {
      if (!text(key)) continue;
      const identity = kind + ":" + key;
      if (keys.has(identity)) parent[root(i)] = root(keys.get(identity));
      keys.set(identity, i);
    }
  });
  const quarantined = new Set(rows.flatMap((r, i) => r.knownAnswer === true || r.excludeFromModel === true ||
    r.exclude_from_model === true ? [root(i)] : []));
  const candidates = [];
  rows.forEach((row, i) => {
    let reason;
    if (quarantined.has(root(i))) reason = "quarantined_identity";
    else if (row.schemaVersion !== 1) reason = "legacy_requires_evidence_review";
    else if (row.priceKind !== "sold") reason = "not_transaction_price";
    else if (!text(row.id) || !text(row.accountKey) || !text(row.postKey) || !text(row.sourceGroup) ||
      !/^https:\/\//.test(row.sourceUrl ?? "")) reason = "missing_provenance";
    else if (row.accountIdentityVerified !== true || row.knownAnswer !== false) reason = "identity_or_quarantine_unreviewed";
    else if (row.reviewed !== true || !day(row.reviewedAt) || row.reviewedAt > asOf ||
      row.transactionConfirmed !== true || !/^[a-f0-9]{64}$/.test(row.evidence?.sha256 ?? "") ||
      !text(row.evidence?.priceQuote) || !text(row.evidence?.dateQuote)) reason = "transaction_evidence_unconfirmed";
    else if (!day(row.soldAt) || row.soldAt > row.reviewedAt || row.soldAt > asOf) reason = "invalid_transaction_date";
    else if (Date.parse(asOf) - Date.parse(row.soldAt) > 365 * 86400000) reason = "stale_transaction";
    else if (row.market !== "taiwan" || row.server !== "international" || row.currency !== "TWD" ||
      row.converted !== false) reason = "foreign_or_unknown_market";
    else if (row.intent !== "sell" || row.accountOnly !== true || row.accountStyle !== "normal" ||
      row.priceBasis !== "account_excluding_fees") reason = "not_comparable_account_price";
    else if (typeof row.price !== "number" || !Number.isFinite(row.price) || row.price <= 0) reason = "invalid_price";
    else if (row.season !== null && !known.has(row.season)) reason = "invalid_season";
    else if ((row.packageTier !== null && !packageTiers.includes(row.packageTier)) ||
      (row.breakClass !== null && !breakClasses.includes(row.breakClass))) reason = "invalid_categories";
    if (reason) rejected.push({ id: row.id ?? null, reason });
    else candidates.push({ row, component: root(i) });
  });
  // Latest confirmed transaction per identity; equal-date price conflicts need review.
  const components = new Map();
  for (const candidate of candidates) {
    const group = components.get(candidate.component) ?? [];
    group.push(candidate.row); components.set(candidate.component, group);
  }
  for (const group of components.values()) {
    group.sort((a, b) => b.soldAt.localeCompare(a.soldAt) || a.id.localeCompare(b.id));
    const latest = group.filter(row => row.soldAt === group[0].soldAt);
    const conflicting = new Set(latest.map(row => JSON.stringify([row.price, row.season, row.packageTier, row.breakClass]))).size > 1;
    group.forEach((row, i) => {
      if (conflicting || i) rejected.push({ id: row.id, reason: conflicting ? "conflicting_transaction" : "duplicate_identity" });
      else accepted.push(row);
    });
  }
  accepted.sort((a, b) => a.soldAt.localeCompare(b.soldAt) || a.accountKey.localeCompare(b.accountKey));
  return { accepted, rejected, datasetDigest: hash(canonical(accepted)),
    rejectionCounts: Object.fromEntries([...new Set(rejected.map(r => r.reason))].sort()
      .map(reason => [reason, rejected.filter(r => r.reason === reason).length])) };
}

const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * p;
  return sorted[Math.floor(index)] + (sorted[Math.ceil(index)] - sorted[Math.floor(index)]) * (index % 1);
};

/** Failed predictions remain in the denominator; never improve accuracy by
 * dropping hard accounts. Wilson interval is descriptive, not a release gate.
 */
export function accuracyMetrics(pairs) {
  if (!pairs.length) return { count: 0, hit10: null, medianApe: null, mape: null, p90Ape: null, wilson95: null, failed: 0 };
  if (pairs.some(p => !Number.isFinite(p.actual) || p.actual <= 0)) throw new Error("Invalid actual price");
  const valid = pairs.filter(p => typeof p.predicted === "number" && Number.isFinite(p.predicted) && p.predicted > 0);
  const errors = valid.map(p => Math.abs(p.predicted - p.actual) / p.actual);
  const hits = errors.filter(e => e <= .1 + Number.EPSILON).length, n = pairs.length, rate = hits / n;
  const z = 1.959963984540054, denominator = 1 + z * z / n;
  const center = (rate + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n)) / denominator;
  const failed = n - valid.length;
  return { count: n, hit10: rate, failed,
    medianApe: failed ? null : quantile(errors, .5),
    mape: failed ? null : errors.reduce((a, b) => a + b, 0) / n,
    p90Ape: failed ? null : quantile(errors, .9),
    overestimate20: valid.filter(p => p.predicted > p.actual * 1.2).length,
    underestimate20: valid.filter(p => p.predicted < p.actual * .8).length,
    wilson95: [Math.max(0, center - margin), Math.min(1, center + margin)] };
}

/** Forward chronological development check only. Not independent blind testing.
 * The production predictor is reused; no alternative monetary anchors.
 */
export function evaluateTransactionDevelopment(rows, { seasons }) {
  const sorted = [...rows].sort((a, b) => a.soldAt.localeCompare(b.soldAt));
  if (sorted.length < 10) return { status: "pending_data", requiredMinimum: 10, available: sorted.length };
  const cutoff = sorted[Math.floor(sorted.length * .8)].soldAt;
  const training = sorted.filter(r => r.soldAt < cutoff), testing = sorted.filter(r => r.soldAt >= cutoff);
  if (training.length < 5 || !training.some(r => r.season !== null)) return { status: "pending_date_diversity" };
  for (const key of ["accountKey", "postKey"]) {
    const trainKeys = new Set(training.map(r => r[key]));
    if (testing.some(r => trainKeys.has(r[key]))) throw new Error("Training/evaluation identity overlap");
  }
  // Whitelist predictors: an incidental legacy numeric packageCount must not
  // override an explicitly unknown reviewed tier through the runtime fallback.
  const features = row => ({ season: row.season, packageTier: row.packageTier, breakClass: row.breakClass });
  const model = fitWholeAccountModel(training.map(row => ({ ...features(row), accountKey: row.accountKey,
    price: row.price, priceKind: "sold", market: "taiwan", server: "international", currency: "TWD" })),
  { seasons, priceKind: "sold" });
  const pairs = testing.map(row => ({ ...row, actual: row.price, predicted: predictFreshModel(model, features(row)).midpoint }));
  const groups = field => Object.fromEntries([...new Set([...pairs.map(r => r[field] ?? "unknown"),
    ...(field === "season" ? seasons : field === "packageTier" ? packageTiers : field === "breakClass" ? breakClasses : [])])]
    .map(key => [key, accuracyMetrics(pairs.filter(r => (r[field] ?? "unknown") === key))]));
  return { status: "development_only", cutoff, trainingCount: training.length, testingCount: testing.length,
    metrics: accuracyMetrics(pairs), bySeason: groups("season"), byPackage: groups("packageTier"),
    byBreak: groups("breakClass"), bySource: groups("sourceGroup"),
    validation: "unvalidated", blindTest: false, fullFrontendVerified: false,
    productionChanged: false };
}
