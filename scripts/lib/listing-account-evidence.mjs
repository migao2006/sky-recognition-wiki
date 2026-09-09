export const bindingKeys = [
  "google",
  "nintendo",
  "gameCenter",
  "facebook",
  "steam",
  "twitch",
  "playstation",
];

export const bindingsForStatus = (status) =>
  Object.fromEntries(bindingKeys.map((key) => [key, status]));

// An explicitly separate gifted account is not proof of the main wardrobe.
// Stop at the next blank line; do not infer ownership from generic 「數據」.
export const splitListingInventoryContext = (content) => {
  const inventory = [];
  const separateAccount = [];
  let separate = false;
  for (const line of String(content ?? "").split(/\r?\n/u)) {
    if (/^[^\p{L}\p{N}]*(?:贈號上數據|赠号上数据)\s*[:：]?\s*$/u.test(line)) {
      separate = true;
      continue;
    }
    if (!line.trim()) separate = false;
    (separate ? separateAccount : inventory).push(line);
  }
  return { inventory: inventory.join("\n"), separateAccount: separateAccount.join("\n") };
};
const boundary = String.raw`(?:^|[\s｜|，,。；;])`;
const ending = String.raw`(?=$|[\s｜|，,。；;])`;
const noBindingsPattern = new RegExp(
  `${boundary}(?:帳號)?(?:全)?無綁(?:定)?${ending}`,
  "u",
);
const allTransferPattern = /(?:綁全出|綁定全出|綁全可出|綁定全可出|綁皆出|綁定皆出|綁全部可出|綁定全部可出)/u;
const negatedAllTransferPattern = /(?:不是|並非|并非|不算|非)\s*(?:綁全出|綁定全出|綁全可出|綁定全可出|綁皆出|綁定皆出|綁全部可出|綁定全部可出)/u;
const bindingProblemPattern = /(?:遺失|遗失|異常|异常|不出|不能出|不可出|解不了|無法解|无法解)/u;
const linkedPlatformPattern = /(?:(?:已綁|已绑|有綁|有绑|綁定|绑定)\s*[:：]?\s*(?:Google|GG|Facebook|FB|Nintendo|NS|Game\s*Center|GC|PlayStation|PSN|Steam|Twitch)|(?:Google|GG|Facebook|FB|Nintendo|NS|Game\s*Center|GC|PlayStation|PSN|Steam|Twitch)\s*[:：]?\s*(?:已綁|已绑|有綁|有绑|綁(?:定)?(?:可)?出|绑(?:定)?(?:可)?出|可出|出))/iu;

export const extractCompleteBindings = (content) => {
  const text = String(content ?? "");
  const declaresNone = noBindingsPattern.test(text);
  const declaresAllTransfer = allTransferPattern.test(text);
  if (
    bindingProblemPattern.test(text) ||
    negatedAllTransferPattern.test(text) ||
    (declaresNone && declaresAllTransfer) ||
    (declaresNone && linkedPlatformPattern.test(text))
  )
    return null;
  if (declaresNone)
    return { kind: "none", bindings: bindingsForStatus("none") };
  if (declaresAllTransfer)
    return { kind: "all-transfer", bindings: bindingsForStatus("transfer") };
  return null;
};

const resourceLabels = {
  candles: "白蠟燭|白蜡烛|白蠟|白蜡",
  hearts: "愛心|爱心",
  ascended: "昇華蠟|升華蠟|升华蜡|紅蠟|红蜡",
  passes: "副卡",
};
const resourceMaximums = {
  candles: 1_000_000,
  hearts: 1_000_000,
  ascended: 1_000_000,
  passes: 1_000,
};

const resourceNumber = (literal) => {
  const normalized = literal.replaceAll(",", "");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?([千萬万])?$/u);
  if (!match) return NaN;
  const [, whole, fraction = "", unit] = match;
  const scale = unit === "千" ? 3 : unit ? 4 : 0;
  // Shift decimal digits without rounding fractional resources into whole units.
  if (/[1-9]/u.test(fraction.slice(scale))) return NaN;
  return Number(whole + fraction.slice(0, scale).padEnd(scale, "0"));
};

const resourceNumeric = String.raw`(?<![0-9],)[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?[千萬万]?(?!,[0-9])`;
const resourceAmount = String.raw`(?:約|约|大約|大约)?\s*${resourceNumeric}(?:\s*(?:[-~～至到]\s*${resourceNumeric}|\+|以上|以下|左右))?`;
const resourceQuantity = (literal, maximum) => {
  const match = literal.trim().match(new RegExp(
    String.raw`^(約|约|大約|大约)?\s*(${resourceNumeric})(?:\s*(?:([-~～至到])\s*(${resourceNumeric})|(\+|以上|以下|左右)))?$`, "u",
  ));
  if (!match) return null;
  const [, approximate, first, separator, second, suffix] = match;
  const value = resourceNumber(first);
  const valid = (number) => Number.isSafeInteger(number) && number >= 0 && number <= maximum;
  if (!valid(value)) return null;
  if (approximate || suffix === "左右")
    return separator || (suffix && suffix !== "左右") ? null : { kind: "approximate", value };
  if (separator) {
    const high = resourceNumber(second);
    return valid(high) && high >= value ? { kind: "range", min: value, max: high } : null;
  }
  if (suffix) return suffix === "以下"
    ? { kind: "range", min: 0, max: value }
    : { kind: "range", min: value, max: null };
  return { kind: "exact", value };
};

export const extractResourceEvidence = (content) => {
  const text = String(content ?? "").normalize("NFKC");
  const resources = {};
  const ranges = {};
  const approximations = {};
  for (const [key, labels] of Object.entries(resourceLabels)) {
    const pattern = new RegExp(
      String.raw`${boundary}(?:(?:${labels})\s*[:：]?\s*(${resourceAmount})|(${resourceAmount})\s*(?:${labels})(?:\s*(左右|以上|以下))?)${ending}`,
      "giu",
    );
    const matches = [...text.matchAll(pattern)];
    const quantities = matches.map((match) => {
      // A whitespace boundary must not detach a quantity from its qualifier,
      // negation, range endpoint or malformed thousands prefix.
      const before = /^[｜|，,。；;\r\n]/u.test(match[0]) ? "" : text.slice(0, match.index).trimEnd();
      const after = text.slice(match.index + match[0].length).trimStart();
      if (/(?:約|约|大概|近|超過|超过|不到|至少|最多|不是|沒有|没有|並非|并非|非|不|[0-9],|[0-9]\s*[-~～至到–—])$/u.test(before) || /^(?:(?:左右|以上|以下|多)(?=$|[\s｜|，,。；;])|[+\-~～至到–—])/u.test(after)) return null;
      return resourceQuantity((match[1] ?? match[2]) + (match[3] ?? ""), resourceMaximums[key]);
    });
    const unique = [...new Set(quantities.map((quantity) => JSON.stringify(quantity)))];
    if (unique.length !== 1 || unique[0] === "null") continue;
    const quantity = quantities[0];
    if (quantity.kind === "exact") resources[key] = quantity.value;
    else if (quantity.kind === "range") ranges[key] = { min: quantity.min, max: quantity.max };
    else approximations[key] = quantity.value;
  }
  const observed = Object.keys(resources);
  return {
    resources,
    ranges,
    approximations,
    observed,
    complete: observed.length === Object.keys(resourceLabels).length,
  };
};
