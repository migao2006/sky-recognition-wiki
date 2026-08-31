import {
  bindingStatusNames,
  type BindingKey,
  type BindingStatus,
} from "./account-config";

const marketPlatformNames: Record<BindingKey, string> = {
  google: "ɢɢ",
  nintendo: "ɴs",
  gameCenter: "ɢᴄ",
  facebook: "ғʙ",
  steam: "sᴛᴇᴀᴍ",
  twitch: "ᴛᴡɪ",
  playstation: "ᴘsɴ",
};

const marketBindingStatusNames = bindingStatusNames;

export const formatMarketPlatform = (key: BindingKey) =>
  marketPlatformNames[key];

const formatMarketBinding = (
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
