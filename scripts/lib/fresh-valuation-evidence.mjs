import { createHash } from "node:crypto";

const day = 86400000;
const text = value => typeof value === "string" && value.trim().length > 0;
const date = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
};

/** Explicit schema for newly reviewed observations. Legacy aggregate rows are
 * intentionally incompatible: collection time is not publication time, FX is
 * not a Taiwan quote, and a package tier is not an exact package count.
 * Input/output is private; only anonymous aggregate parameters may be shipped.
 */
export function reviewFreshEvidence(rows, { asOf, recheckedSince, seasons }) {
  const now = date(asOf), since = date(recheckedSince);
  if (!Number.isFinite(now) || !Number.isFinite(since) || since > now) throw new Error("Invalid review dates");
  if (!Array.isArray(seasons) || !seasons.length || new Set(seasons).size !== seasons.length) throw new Error("Canonical seasons required");
  const known = new Set(seasons), accepted = [], rejected = [];
  // Stable latest-review precedence prevents input order changing the model.
  const sorted = [...rows].sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)) || String(a.id).localeCompare(String(b.id)));
  for (const row of sorted) {
    let reason = null;
    const reviewed = date(row.reviewedAt), published = date(row.publishedAt);
    if (!text(row.id) || !text(row.accountKey) || !text(row.postKey) || !text(row.sourceGroup) ||
        !text(row.sourceUrl) || !/^https:\/\//.test(row.sourceUrl)) reason = "missing_provenance";
    else if (row.reviewed !== true || !Number.isFinite(reviewed) || reviewed < since || reviewed > now) reason = "not_freshly_reviewed";
    else if (row.excludeFromModel === true || row.accountOnly !== true || row.intent !== "sell") reason = "not_account_only_sale";
    else if (!known.has(row.season)) reason = "unknown_start_season";
    else if (!Number.isFinite(published) || published > now) reason = "publication_date_unknown";
    else if (now - published > 365 * day) reason = "stale";
    else if (row.market !== "taiwan" || row.server !== "international" || row.currency !== "TWD" || row.converted === true) reason = "foreign_or_unknown_market";
    else if (!["ask", "sold", "manual"].includes(row.priceKind) || typeof row.price !== "number" || !Number.isFinite(row.price) || row.price <= 0) reason = "invalid_price";
    else if (row.priceKind === "sold" && row.transactionConfirmed !== true) reason = "unconfirmed_transaction_price";
    if (reason) { rejected.push({ id: row.id ?? null, reason }); continue; }
    accepted.push({ ...row, window: now - published <= 180 * day ? "recent180" : "extended365" });
  }
  // Connected components also catch A/account1/post1, B/account2/post2,
  // C/account1/post2. A greedy seen-set would incorrectly retain both A and B.
  const parent = accepted.map((_, i) => i), identities = new Map();
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  accepted.forEach((row, i) => {
    for (const key of [`account:${row.accountKey}`, `post:${row.postKey}`]) {
      if (identities.has(key)) {
        const a = find(i), b = find(identities.get(key));
        parent[Math.max(a, b)] = Math.min(a, b);
      } else identities.set(key, i);
    }
  });
  const unique = accepted.filter((row, i) => {
    if (find(i) === i) return true;
    rejected.push({ id: row.id, reason: "duplicate_account_or_post" });
    return false;
  });
  // Extend only a sparse season/price-kind cohort; never silently pool sold/ask.
  const selected = unique.filter(row => row.window === "recent180" ||
    unique.filter(other => other.season === row.season && other.priceKind === row.priceKind && other.window === "recent180").length < 5);
  const coverage = Object.fromEntries(seasons.map(slug => {
    const matches = selected.filter(row => row.season === slug);
    return [slug, { status: matches.some(row => row.priceKind !== "manual") ? "direct" : matches.length ? "manual" : "unavailable",
      ask: matches.filter(row => row.priceKind === "ask").length,
      sold: matches.filter(row => row.priceKind === "sold").length,
      manual: matches.filter(row => row.priceKind === "manual").length,
      extended365: matches.filter(row => row.window === "extended365").length }];
  }));
  const digestRows = selected.map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
  return { schemaVersion: 1, asOf, recheckedSince, validation: "unvalidated",
    datasetDigest: createHash("sha256").update(JSON.stringify(digestRows)).digest("hex"),
    accepted: selected, rejected, coverage,
    deferredOutsideRecentWindow: unique.length - selected.length };
}
