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
  /** Set only after the owner has checked the complete wardrobe. */
  wardrobeConfirmed: boolean;
  /** Private, random, stable account identity used only in local backups. */
  identityId: string;
  candles: string;
  hearts: string;
  ascended: string;
  passes: string;
  bindingNote: string;
  notes: string;
};

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const isAccountIdentityId = (value: unknown): value is string =>
  typeof value === "string" && UUID_V4_PATTERN.test(value);

/** Creates a browser-safe, private identifier without deriving it from account data. */
export const createAccountIdentityId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid && isAccountIdentityId(randomUuid)) return randomUuid;
  throw new Error("Secure UUID v4 generation is unavailable");
};

export const accountResourceLimits = {
  candles: 99_999,
  hearts: 99_999,
  ascended: 99_999,
  passes: 999,
} as const;

type AccountResourceKey = keyof typeof accountResourceLimits;

/** Returns an empty value for a missing or invalid resource quantity. */
export const normalizeAccountResource = (
  value: unknown,
  key: AccountResourceKey,
) => {
  if (typeof value !== "string") return "";
  const raw = value;
  if (!/^\d+$/.test(raw)) return "";
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount <= accountResourceLimits[key]
    ? raw
    : "";
};

export const accountResourceAmount = (
  value: string | number | undefined,
  key: AccountResourceKey = "candles",
) => {
  const raw = typeof value === "number" ? String(value) : value;
  return Number(normalizeAccountResource(raw, key)) || 0;
};

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
