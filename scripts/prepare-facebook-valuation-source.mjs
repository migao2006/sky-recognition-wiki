import { createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const usage =
  "Usage: VALUATION_HASH_SALT=<secret> node scripts/prepare-facebook-valuation-source.mjs <private-facebook-source.jsonl> > work/facebook-anonymous.jsonl";

const allowedPriceKinds = new Set(["ask", "quick_sale", "sold", "professional_estimate", "comment"]);
const allowedQualities = new Set(["high", "medium", "low"]);
const allowedBreakClasses = new Set(["none", "slight", "medium", "big"]);
const allowedPackageTiers = new Set(["few", "medium", "many", "hundred"]);
const allowedAccountStyles = new Set(["simple", "regular"]);
const allowedConfidence = new Set(["explicit", "structured", "inferred", "unknown"]);
const forbiddenKeys = new Set([
  "author",
  "author_name",
  "author_id",
  "author_url",
  "url",
  "post_url",
  "permalink",
  "group_url",
  "group_name",
  "listing_text",
  "post_text",
  "text",
  "content",
  "comments",
  "comment_text",
]);

const readString = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const normalizedSlug = (value) => {
  const slug = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(slug) ? slug : null;
};

const finiteNumber = (value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const nonNegativeInteger = (value) => {
  const number = finiteNumber(value);
  return number !== undefined && Number.isInteger(number) && number >= 0 ? number : undefined;
};

const normalizedDate = (value) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

const enumValue = (value, allowed) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : undefined;
};

const progressValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (/^(?:0|⁰|completed|complete|畢|none|-|\d+\s*\/\s*\d+)$/.test(normalized))
    return normalized.replace(/\s+/g, "");
  return undefined;
};

const seasonProgress = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, progress]) => [normalizedSlug(key), progressValue(progress)])
    .filter(([key, progress]) => key && progress !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const seasons = (value) => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((season) => {
      const slug = normalizedSlug(typeof season === "string" ? season : season?.slug);
      return slug ? { slug } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.slug.localeCompare(right.slug));
  return normalized.length ? normalized : undefined;
};

const standardizedExclusionReason = (row) => {
  const declared = String(row.exclusion_reason ?? "").trim();
  const context = `${row.region ?? ""} ${row.currency ?? ""} ${declared}`.toLowerCase();
  if (/國服|中國服|陸服|\b(?:cn|china)\b/.test(context)) return "china";
  if (/人民幣|rmb|cny|￥|¥|\busd\b|美金|港幣|hkd/.test(context)) return "foreign_currency";
  const hasPrice = [row.price_twd, row.price_twd_low, row.price_twd_high]
    .map(finiteNumber)
    .some((price) => price !== undefined && price > 0);
  if (!hasPrice) return "missing_price";
  return declared ? "explicit" : undefined;
};

const hmac = (salt, value) =>
  createHmac("sha256", salt).update(value, "utf8").digest("hex");

const identityFor = (row, keys, fallback) => readString(row, keys) || fallback;

export const prepareRow = (row, salt) => {
  if (!row || typeof row !== "object" || Array.isArray(row))
    throw new Error("expected a JSON object");
  if (!salt) throw new Error("VALUATION_HASH_SALT is required");

  const postIdentity = identityFor(
    row,
    ["post_id", "post_url", "permalink", "url"],
    JSON.stringify({ published_at: row.published_at, observed_at: row.observed_at, price_twd: row.price_twd, listing_text: row.listing_text ?? row.text ?? "" }),
  );
  const groupIdentity = identityFor(row, ["group_id", "group_url", "group_name"], "facebook-unknown-group");
  const accountIdentity = readString(row, [
    "account_id",
    "account_identifier",
    "account_fingerprint",
  ]);

  const output = {
    schema_version: 1,
    source: "facebook",
    post_hash: hmac(salt, `post:${postIdentity}`),
    group_hash: hmac(salt, `group:${groupIdentity}`),
  };
  const put = (key, value) => {
    if (value !== undefined) output[key] = value;
  };

  put(
    "account_fingerprint",
    accountIdentity ? hmac(salt, `account:${accountIdentity}`) : undefined,
  );

  put("published_at", normalizedDate(row.published_at));
  put("observed_at", normalizedDate(row.observed_at));
  put("price_twd", finiteNumber(row.price_twd));
  const inputLow = finiteNumber(row.price_twd_low);
  const inputHigh = finiteNumber(row.price_twd_high);
  put("price_twd_low", inputLow !== undefined && inputHigh !== undefined ? Math.min(inputLow, inputHigh) : inputLow);
  put("price_twd_high", inputLow !== undefined && inputHigh !== undefined ? Math.max(inputLow, inputHigh) : inputHigh);
  put("price_kind", enumValue(row.price_kind, allowedPriceKinds));
  put("evidence_kind", enumValue(row.evidence_kind, allowedPriceKinds));
  put("evidence_quality", enumValue(row.evidence_quality, allowedQualities));
  put("region", enumValue(row.region, new Set(["international", "china", "unknown"])));
  put("currency", enumValue(row.currency, new Set(["twd", "cny", "usd", "hkd", "unknown"])));
  put("start_season_slug", normalizedSlug(row.start_season_slug));
  put("start_season_confidence", enumValue(row.start_season_confidence, allowedConfidence));
  put("season_progress", seasonProgress(row.season_progress));
  put("seasons", seasons(row.seasons));
  put("computed_break_class", enumValue(row.computed_break_class, allowedBreakClasses));
  put("missing_season_count", nonNegativeInteger(row.missing_season_count));
  const completionRatio = finiteNumber(row.completion_ratio);
  put("completion_ratio", completionRatio !== undefined && completionRatio >= 0 && completionRatio <= 1 ? completionRatio : undefined);
  put("paid_package_count", nonNegativeInteger(row.paid_package_count));
  put("computed_package_tier", enumValue(row.computed_package_tier, allowedPackageTiers));
  put("account_style", enumValue(row.account_style, allowedAccountStyles));
  put("limited_item_count", nonNegativeInteger(row.limited_item_count));
  put("anniversary_item_count", nonNegativeInteger(row.anniversary_item_count));
  put("graduation_gift_count", nonNegativeInteger(row.graduation_gift_count));
  put("exclusion_reason", standardizedExclusionReason(row));

  // This guard makes future additions fail closed if a private input field is copied in.
  for (const key of Object.keys(output)) if (forbiddenKeys.has(key)) throw new Error(`forbidden output key: ${key}`);
  return output;
};

const inputPath = process.argv[1] === fileURLToPath(import.meta.url) ? process.argv[2] : undefined;
if (inputPath) {
  const salt = process.env.VALUATION_HASH_SALT;
  if (!salt) throw new Error(`${usage}\nVALUATION_HASH_SALT is required.`);
  const input = createInterface({ input: createReadStream(inputPath), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of input) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new Error(`${inputPath}:${lineNumber}: invalid JSON (${error.message})`);
    }
    try {
      process.stdout.write(`${JSON.stringify(prepareRow(row, salt))}\n`);
    } catch (error) {
      throw new Error(`${inputPath}:${lineNumber}: ${error.message}`);
    }
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  throw new Error(usage);
}
