import type { BindingKey, BindingStatus } from "./account-config";

export const marketPlatformNames: Record<BindingKey, string> = {
  google: "ɢɢ",
  nintendo: "ɴs",
  gameCenter: "ɢᴄ",
  facebook: "ғʙ",
  steam: "sᴛᴇᴀᴍ",
  twitch: "ᴛᴡɪ",
  playstation: "ᴘsɴ",
};

export const marketBindingStatusNames: Record<BindingStatus, string> = {
  none: "無綁",
  transfer: "出",
  keep: "不出",
  issue: "遺失／異常",
};

export const formatMarketPlatform = (key: BindingKey) =>
  marketPlatformNames[key];

export const formatMarketBinding = (
  key: BindingKey,
  status: BindingStatus,
) =>
  `${formatMarketPlatform(key)} ${key === "nintendo" && status === "transfer" ? "解" : marketBindingStatusNames[status]}`;

export const formatMarketBindings = (
  bindings: Partial<Record<BindingKey, BindingStatus>>,
) => {
  const rows = (Object.keys(marketPlatformNames) as BindingKey[])
    .filter((key) => bindings[key] && bindings[key] !== "none")
    .map((key) => formatMarketBinding(key, bindings[key]!));
  return rows.length ? rows.join(" ┊ ") : "無綁";
};
