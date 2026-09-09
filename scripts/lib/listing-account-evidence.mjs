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
// Keep this deliberately line/punctuation scoped.  A whitespace boundary alone
// would make "GG 無綁" and "其餘 無綁" look like claims about every platform.
const noBindingsPattern = /(?:^|[｜|，,。；;\r\n])\s*(?:帳號\s*)?(?:全\s*)?無綁(?:定)?(?=$|[\s｜|，,。；;])/gu;
const allTransferPattern = /(?:綁全出|綁定全出|綁全可出|綁定全可出|綁皆出|綁定皆出|綁全部可出|綁定全部可出)(?![現现])/gu;
const bindingProblemPattern = /(?:遺失|遗失|異常|异常|不出|不能出|不可出|解不了|無法解|无法解)/u;
const linkedPlatformPattern = /(?:(?:已綁|已绑|有綁|有绑|綁定|绑定)\s*[:：]?\s*(?:Google|GG|Facebook|FB|Nintendo|NS|Game\s*Center|GC|PlayStation|PSN|Steam|Twitch)|(?:Google|GG|Facebook|FB|Nintendo|NS|Game\s*Center|GC|PlayStation|PSN|Steam|Twitch)\s*[:：]?\s*(?:已綁|已绑|有綁|有绑|綁(?:定)?(?:可)?出|绑(?:定)?(?:可)?出|可出|出))/iu;

const platformAliases = {
  google: "Google|GG",
  nintendo: "Nintendo|NS",
  gameCenter: "Game\\s*Center|GC",
  facebook: "Facebook|FB",
  playstation: "PlayStation|PSN",
  steam: "Steam",
  twitch: "Twitch",
};
const platformPattern = Object.entries(platformAliases)
  .map(([key, aliases]) => `(?<${key}>${aliases})`)
  .join("|");
const partialStatusPattern = String.raw`可\s*出|不\s*出|遺失|遗失|異常|异常|無\s*綁(?:定)?|未\s*綁(?:定)?|出`;
const partialEnding = String.raw`(?=$|[\s｜|，,。；;║⸝/、])`;
const partialBindingPattern = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${platformPattern})\s*[:：]?\s*(?:(?:綁定|绑定|綁|绑)\s*)?(?<status>${partialStatusPattern})${partialEnding}`,
  "giu",
);
// A status may be shared only by an explicit list of recognized platforms.
// Keep its whitespace horizontal so a status cannot spill across listing lines.
const inlinePlatformAliases = Object.values(platformAliases)
  .map((aliases) => aliases.replace("\\s*", String.raw`[ \t]*`));
const groupedPlatformSeparator = String.raw`[ \t]*(?:[、,][ \t]*|[ \t]+)`;
const groupedPartialStatusPattern = partialStatusPattern.replaceAll("\\s*", String.raw`[ \t]*`);
const groupedPartialBindingPattern = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?<platformList>(?:${inlinePlatformAliases.join("|")})(?:${groupedPlatformSeparator}(?:${inlinePlatformAliases.join("|")}))+)[ \t]*[:：]?[ \t]*(?:(?:綁定|绑定|綁|绑)[ \t]*)?(?<status>${groupedPartialStatusPattern})${partialEnding}`,
  "giu",
);
const partialContinuationPattern = new RegExp(
  String.raw`^\s*(?:或|/|、|與|和|and)\s*(?<status>${partialStatusPattern})${partialEnding}`,
  "iu",
);
const ambiguousPartialContinuationPattern = new RegExp(
  String.raw`^\s*(?:或|/|、|與|和|and)\s*(?:已綁|已绑|有綁|有绑|不可出|不能出|無法解|无法解|解不了)${partialEnding}`,
  "iu",
);
const questionedPlatformSuffix = /^\s*(?:[?？]|嗎|吗|可否|是否)/u;
const invalidGlobalPrefix = /(?:不是|並非|并非|不算|非|沒有|没有|未|不|不確定|不确定|請問|请问|是否|可否)\s*[:：]?\s*$/u;

const hasEffectiveGlobalStatement = (text, pattern) =>
  [...text.matchAll(pattern)].some((match) =>
    !invalidGlobalPrefix.test(text.slice(Math.max(0, match.index - 24), match.index)) &&
    !questionedPlatformSuffix.test(text.slice(match.index + match[0].length)),
  );
const groupedPlatformPrefix = new RegExp(
  String.raw`(?:${Object.values(platformAliases).join("|")})\s*[、,，/]\s*$`,
  "iu",
);
const listPrefixItem = /(?:^|[\s｜|，,。；;║⸝/])\s*(?<item>[^\s｜|，,。；;║⸝/、]+)\s*[、,]\s*$/u;
const platformAliasPattern = new RegExp(`^(?:${Object.values(platformAliases).join("|")})$`, "iu");
const platformAliasTokenPattern = new RegExp(Object.values(platformAliases).join("|"), "giu");
const declarationOrHeadingSuffix = new RegExp(
  String.raw`(?:${partialStatusPattern}|(?:帳號\s*)?(?:綁定|绑定|綁|绑))$`, "iu",
);
const hasUnknownListPrefix = (prefix) => {
  if (/(?:^|[^A-Za-z0-9])(?:Apple[ \t]+ID|ID|ST)(?:[ \t]+|\/[ \t]*)$/iu.test(prefix)) return true;
  const item = prefix.match(listPrefixItem)?.groups?.item;
  return Boolean(item) && !platformAliasPattern.test(item) && !declarationOrHeadingSuffix.test(item);
};

const platformKeyForMatch = (groups) =>
  bindingKeys.find((key) => groups[key] !== undefined);

const statusForPartialBinding = (status) => {
  if (/^可\s*出$|^出$/u.test(status)) return "transfer";
  if (/^不\s*出$/u.test(status)) return "keep";
  if (/^(?:遺失|遗失|異常|异常)$/u.test(status)) return "issue";
  return "none";
};

const platformKeysForList = (platformList) =>
  [...platformList.matchAll(platformAliasTokenPattern)]
    .map((match) => match[0])
    .filter((name) => platformAliasPattern.test(name))
    .map((name) => bindingKeys.find((key) => new RegExp(`^(?:${platformAliases[key]})$`, "iu").test(name)));

// Only known platforms in an explicit comma/、 or horizontal-space list may
// share a status. Do not interpret Apple ID/st, slash alternatives, or
// group/"其餘" statements as per-platform evidence.
export const extractPartialBindings = (content) => {
  const text = String(content ?? "").normalize("NFKC");
  const bindings = {};
  const conflicts = new Set();
  // Preserve the meaning of a rejected whole group: its final platform must
  // not be recovered later as a misleading direct declaration.
  const groupedMatches = [...text.matchAll(groupedPartialBindingPattern)];
  const register = (keys, status, after) => {
    const continuation = after.match(partialContinuationPattern);
    const contradictory =
      ambiguousPartialContinuationPattern.test(after) ||
      (continuation && statusForPartialBinding(continuation.groups.status) !== status);
    for (const key of keys) {
      if (contradictory) {
        conflicts.add(key);
        delete bindings[key];
        continue;
      }
      if (conflicts.has(key)) continue;
      if (bindings[key] && bindings[key] !== status) {
        conflicts.add(key);
        delete bindings[key];
        continue;
      }
      bindings[key] = status;
    }
  };
  for (const match of groupedMatches) {
    const prefix = text.slice(Math.max(0, match.index - 24), match.index);
    if (
      invalidGlobalPrefix.test(prefix) ||
      groupedPlatformPrefix.test(prefix) ||
      hasUnknownListPrefix(prefix) ||
      questionedPlatformSuffix.test(text.slice(match.index + match[0].length))
    ) continue;
    const status = statusForPartialBinding(match.groups.status);
    register(platformKeysForList(match.groups.platformList), status, text.slice(match.index + match[0].length));
  }
  for (const match of text.matchAll(partialBindingPattern)) {
    const key = platformKeyForMatch(match.groups);
    const prefix = text.slice(Math.max(0, match.index - 24), match.index);
    if (
      !key ||
      /[\r\n]/u.test(match[0]) ||
      groupedMatches.some((group) => match.index >= group.index && match.index < group.index + group[0].length) ||
      invalidGlobalPrefix.test(prefix) ||
      groupedPlatformPrefix.test(prefix) ||
      hasUnknownListPrefix(prefix) ||
      questionedPlatformSuffix.test(text.slice(match.index + match[0].length))
    ) continue;
    register([key], statusForPartialBinding(match.groups.status), text.slice(match.index + match[0].length));
  }
  const declaredNone = hasEffectiveGlobalStatement(text, noBindingsPattern);
  const declaredAllTransfer = hasEffectiveGlobalStatement(text, allTransferPattern);
  for (const [key, status] of Object.entries(bindings)) {
    if ((declaredNone && status !== "none") || (declaredAllTransfer && status !== "transfer")) {
      conflicts.add(key);
      delete bindings[key];
    }
  }
  return { bindings, conflicts: [...conflicts] };
};

export const extractCompleteBindings = (content) => {
  const text = String(content ?? "");
  const declaresNone = hasEffectiveGlobalStatement(text, noBindingsPattern);
  const declaresAllTransfer = hasEffectiveGlobalStatement(text, allTransferPattern);
  const partial = extractPartialBindings(text);
  if (
    bindingProblemPattern.test(text) ||
    (declaresNone && declaresAllTransfer) ||
    (declaresNone && linkedPlatformPattern.test(text)) ||
    ((declaresNone || declaresAllTransfer) && partial.conflicts.length)
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
