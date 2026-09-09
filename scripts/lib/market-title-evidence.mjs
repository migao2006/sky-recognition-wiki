// Seller titles are useful market evidence, but they are deliberately kept
// separate from wardrobe reconstruction. This parser only accepts explicit,
// account-level claims and never creates seasonal progress or item GUIDs.

const seasonAliases = [
  ["gratitude", ["感恩"]],
  ["lightseekers", ["追光"]],
  ["belonging", ["歸屬", "归属"]],
  ["rhythm", ["音韻", "音韵"]],
  ["enchantment", ["魔法"]],
  ["sanctuary", ["聖島", "圣岛"]],
  ["prophecy", ["預言", "预言"]],
  ["dreams", ["夢想", "梦想"]],
  ["assembly", ["集結", "集结", "重組", "重组"]],
  ["the-little-prince", ["小王子", "王子"]],
  ["flight", ["風行", "风行", "飛行", "飞行", "飛翔", "飞翔"]],
  ["abyss", ["潛海", "潜海", "深淵", "深渊"]],
  ["performance", ["表演"]],
  ["shattering", ["破碎", "破曉", "破晓"]],
  ["aurora", ["極光", "极光", "歐若拉", "欧若拉", "aurora"]],
  ["remembrance", ["緬懷", "缅怀", "追憶", "追忆"]],
  ["passage", ["夜行"]],
  // These also occur as ordinary prose/a location; require the season suffix.
  ["moments", ["拾光", "時光季", "时光季"]],
  ["revival", ["歸巢", "归巢", "雲巢季", "云巢季"]],
  ["nine-colored-deer", ["九色鹿"]],
  ["nesting", ["築巢", "筑巢"]],
  ["duets", ["協奏", "协奏", "二重奏"]],
  ["moomin", ["姆明"]],
  ["radiance", ["染色", "彩染"]],
  ["blue-bird", ["青鳥", "青鸟"]],
  ["two-embers-part-1", ["暮星"]],
  ["migration", ["遷徙", "迁徙", "遷徒", "遷途"]],
  ["lightmending", ["織光", "织光"]],
  ["carnival", ["狂歡", "狂欢"]],
  ["dear-van-gogh", ["致梵谷", "致梵高", "梵谷", "梵高"]],
];

const normalizedTitle = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .replaceAll(/\s+/gu, "")
  .trim();

const hasNegated = (text, expression) =>
  new RegExp(`(?:非|不是|並非|并非|不算|非為|非为)(?:${expression})`, "u").test(text);

const unique = (values) => [...new Set(values)];

// Both calibration and the report read the same actual heading, not a blank
// metadata field or the document viewer's page marker.
export const marketHeadlineFor = (row) => {
  const usable = value => typeof value === "string" && value.trim() &&
    !/^(?:unknown|n\/a|null|none|-|分頁\s*\d+)$/iu.test(value.trim());
  return [row.title, row.listing_title, ...String(row.listing_text ?? "").split(/\r?\n/u)]
    .find(usable)?.trim() ?? "";
};

const seasonClaimsFor = (text) => {
  const claims = [];
  for (const [slug, aliases] of seasonAliases) {
    for (const alias of aliases) {
      for (const match of text.matchAll(new RegExp(alias, "gu"))) {
        claims.push({ slug, index: match.index, length: alias.length });
      }
    }
  }
  return claims;
};

// Mentions are not account-start claims: they may identify a cape or bundle.
const marketTitleSeasonMentions = (title) =>
  unique(seasonClaimsFor(normalizedTitle(title)).map(claim => claim.slug));

export const marketTitleBreakMatchesStart = (title, start, headlineStart) =>
  !start || (headlineStart ? headlineStart === start :
    marketTitleSeasonMentions(title).every(slug => slug === start));

const breakClassForTitle = (text) => {
  if (/(?:偽|伪)(?:無斷|无断)/u.test(text)) return "slight";
  const definitions = [
    ["none", "(?:無斷|无断|不斷|不断)"],
    ["slight", "(?:微|小)(?:斷|断)"],
    ["medium", "中(?:斷|断)"],
    ["big", "大(?:斷|断)"],
  ];
  const matches = definitions
    .filter(([, expression]) => new RegExp(expression, "u").test(text) && !hasNegated(text, expression))
    .map(([key]) => key);
  return unique(matches).length === 1 ? matches[0] : null;
};

const explicitPackageCountFor = (text) => {
  // Bounded/approximate counts are useful evidence, but never exact counts.
  if (/\d+\+(?:禮|礼)|(?:禮包|礼包)\d+\+|百(?:禮|礼)|\d+[-~～至到]\d+(?:禮|礼)/u.test(text)) return null;
  const values = [
    ...text.matchAll(/(?:禮包|礼包)\s*(\d+)(?!\d)/gu),
    ...text.matchAll(/(?<!\d)(\d+)(?!\d)\s*(?:禮包|礼包)/gu),
    ...text.matchAll(/(?<!\d)(\d+)(?!\d)\s*(?:禮|礼)(?!包)/gu),
  ].map((match) => Number(match[1]));
  const counts = unique(values.filter((value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 999,
  ));
  return counts.length === 1 ? counts[0] : null;
};

export const extractMarketPackageRange = (value) => {
  const text = normalizedTitle(value);
  // Upper bounds, approximations and negations must not become lower bounds.
  if (/(?:不到|不滿|不满|不足|不破|不超過|不超过|未滿|未满|未達|未达|未到|未破|最多|至多|少於|少于|低於|低于|近|約|约|非)[^｜|,，]{0,6}(?:百|\d+)[^｜|,，]{0,3}(?:禮|礼)|(?:禮|礼)(?:包)?(?:以內|以内|以下|左右|上下)/u.test(text)) return null;
  const matches = [...text.matchAll(/(?<!\d)(\d+)[-~～至到](\d+)(?:禮|礼)(?:包)?|(?<!\d)(\d+)\+(?:禮|礼)(?:包)?|(?:禮包|礼包)(\d+)\+|(?<![半幾几數数兩两二三四五六七八九十])(?:破)?百(?:禮|礼)(?:包)?/gu)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const remainder = text.slice(0, match.index) + text.slice(match.index + match[0].length);
  if (/(?:禮包|礼包)\d+|\d+(?:禮|礼)/u.test(remainder)) return null;
  const min = Number(match[1] ?? match[3] ?? match[4] ?? (match[0].startsWith("破") ? 101 : 100));
  const max = match[2] === undefined ? null : Number(match[2]);
  if (!Number.isSafeInteger(min) || min < 0 || min > 999 || (max !== null && (max < min || max > 999))) return null;
  return { min, max };
};

const salePackageTierFor = (text) => {
  const labels = [
    ["few", "少(?:禮|礼)"],
    ["medium", "(?:中|適中|适中)(?:禮|礼)"],
    ["many", "多(?:禮|礼)"],
  ].filter(([, expression]) =>
    new RegExp(expression, "u").test(text) && !hasNegated(text, expression),
  ).map(([key]) => key);
  const explicit = unique(labels);
  if (explicit.length === 1) return explicit[0];
  return null;
};

const accountStyleFor = (text) => {
  const labels = [
    ["simple", "(?:簡|简)(?:號|号|帳|帐)|(?:簡|简)(?=$|[,，｜|])"],
    ["regular", "(?:普|普通)(?:號|号|帳|帐)"],
  ].filter(([, expression]) =>
    new RegExp(expression, "u").test(text) && !hasNegated(text, expression),
  )
    .map(([key]) => key);
  return unique(labels).length === 1 ? labels[0] : null;
};

const startSeasonFor = (text, breakClass, accountStyle) => {
  const claims = seasonClaimsFor(text);
  const slugs = unique(claims.map((claim) => claim.slug));
  if (slugs.length !== 1) return null;
  const claim = claims[0];
  const after = text.slice(claim.index + claim.length);
  const before = text.slice(0, claim.index);
  // A seasonal pass or a named item is not evidence that the account began
  // that season, even when the same title also contains seller shorthand.
  const packageAccount = /^(?:季)?(?:綁全出|绑全出)?(?:禮包|礼包)(?:號|号|帳|帐|簡|简|無翼|无翼)/u.test(after);
  if (/^(?:季)?(?:卡|(?:通行)?證|斗篷|披風|面具|髮型|发型|髮飾|发饰|樂器|乐器)/u.test(after) || (/^(?:禮包|礼包)/u.test(after) && !packageAccount))
    return null;
  if (/(?:非|不是|並非|并非)(?:季)?$/.test(before) && /^(?:季)?起/u.test(after))
    return null;
  const explicitStart = /^(?:季)?起/u.test(after) || /(?:起季|起號|起号|入坑)$/.test(before);
  const accountTitle = /(?:號|号|帳|帐)/u.test(text);
  const sellerSummary = /(?:少|中|多)(?:禮|礼)|(?:禮包|礼包)\d+|\d+(?:禮|礼)(?:包)?/u.test(text);
  const explicitBreakSeason = /(?:斷|断)季/u.test(text);
  const countedSeasons = /^(?:\d+|[一二兩两三四五六七八九十]+)季(?:禮包|礼包)?(?:號|号|帳|帐)/u.test(after);
  const transferableWingless = /^(?:季)?(?:(?:綁全出|绑全出)(?:無翼|无翼)|(?:無翼|无翼)(?:綁全出|绑全出))/u.test(after);
  const adjacentAccountStyle = accountStyle !== null && /^(?:季)?(?:綁全出|绑全出)?(?:簡|简|普|普通)/u.test(after);
  const accountEvidence = accountTitle || accountStyle !== null || breakClass !== null || explicitBreakSeason || packageAccount || transferableWingless;
  return explicitStart || (accountEvidence && (breakClass !== null || sellerSummary || explicitBreakSeason || adjacentAccountStyle || countedSeasons || packageAccount || transferableWingless))
    ? claim.slug
    : null;
};

export const extractMarketTitleEvidence = (title) => {
  const text = normalizedTitle(title);
  const breakClass = breakClassForTitle(text);
  const paidPackageCount = explicitPackageCountFor(text);
  const accountStyle = accountStyleFor(text);
  const wingless = /無翼|无翼/u.test(text) && !hasNegated(text, "(?:無翼|无翼)");

  return {
    startSeasonSlug: startSeasonFor(text, breakClass, accountStyle),
    breakClass,
    paidPackageCount,
    salePackageTier: salePackageTierFor(text),
    accountStyle,
    wingless,
  };
};
