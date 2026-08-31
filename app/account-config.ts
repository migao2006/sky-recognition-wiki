export type BindingKey =
  | "google"
  | "nintendo"
  | "gameCenter"
  | "facebook"
  | "steam"
  | "twitch"
  | "playstation";

export type BindingStatus = "none" | "transfer" | "keep" | "issue";

export type AccountInfo = {
  name: string;
  accountType: string;
  bindingsConfirmed: boolean;
  candles: string;
  hearts: string;
  ascended: string;
  passes: string;
  bindingNote: string;
  notes: string;
};

export const accountResourceAmount = (
  value: string | number | undefined,
) => Math.max(0, Number.parseInt(String(value ?? "0"), 10) || 0);

export const bindingNames: Record<BindingKey, string> = {
  google: "Google（GG）",
  nintendo: "Nintendo（NS）",
  gameCenter: "Game Center（GC）",
  facebook: "Facebook（FB）",
  steam: "Steam",
  twitch: "Twitch（TWI）",
  playstation: "PlayStation Network（PSN）",
};

export const bindingKeys = Object.keys(bindingNames) as BindingKey[];

export const bindingStatusNames: Record<BindingStatus, string> = {
  none: "無綁",
  transfer: "出",
  keep: "不出",
  issue: "遺失／異常",
};

export const bindingOptions = (
  Object.entries(bindingStatusNames) as [BindingStatus, string][]
).map(([key, name]) => ({ key, name }));

export const emptyBindings = () =>
  Object.fromEntries(bindingKeys.map((key) => [key, "none"])) as Record<
    BindingKey,
    BindingStatus
  >;
