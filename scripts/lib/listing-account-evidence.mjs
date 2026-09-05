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

const resourcePatterns = {
  candles: /(?:^|[\s｜|，,。；;])(?:白蠟|白蜡|白蠟燭|白蜡烛)\s*[:：]?\s*([0-9][0-9,]*)/iu,
  hearts: /(?:^|[\s｜|，,。；;])(?:愛心|爱心)\s*[:：]?\s*([0-9][0-9,]*)/iu,
  ascended: /(?:^|[\s｜|，,。；;])(?:昇華蠟|升華蠟|升华蜡|紅蠟|红蜡)\s*[:：]?\s*([0-9][0-9,]*)/iu,
  passes: /(?:^|[\s｜|，,。；;])副卡\s*[:：]?\s*([0-9][0-9,]*)/iu,
};
const resourceMaximums = {
  candles: 1_000_000,
  hearts: 1_000_000,
  ascended: 1_000_000,
  passes: 1_000,
};

export const extractResourceEvidence = (content) => {
  const text = String(content ?? "");
  const resources = {};
  for (const [key, pattern] of Object.entries(resourcePatterns)) {
    const matches = [...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
    const values = [...new Set(matches.map((match) => Number(match[1].replaceAll(",", ""))))];
    if (values.length !== 1) continue;
    const [value] = values;
    if (Number.isSafeInteger(value) && value >= 0 && value <= resourceMaximums[key])
      resources[key] = value;
  }
  const observed = Object.keys(resources);
  return {
    resources,
    observed,
    complete: observed.length === Object.keys(resourcePatterns).length,
  };
};
