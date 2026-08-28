import {
  bindingKeys,
  bindingOptions,
  emptyBindings,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import type { WikiItem } from "./wiki-data";

const BACKUP_FORMAT = "sky-recognition-wiki";
const BACKUP_VERSION = 2;

export const ACCOUNT_DRAFT_STORAGE_KEY = "sky-recognition-wiki:draft:v2";
export const ACCOUNT_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_DRAFT_CLOCK_SKEW_MS = 5 * 60 * 1000;

type BackupOptions = {
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  items: WikiItem[];
  getZhName: (item: WikiItem) => string;
  getSource: (item: WikiItem) => string;
  exportedAt?: Date;
};

type UnknownRecord = Record<string, unknown>;

type DraftOptions = {
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  owned: Iterable<string>;
  savedAt?: Date;
};

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;

export const createAccountBackup = ({
  account,
  bindings,
  items,
  getZhName,
  getSource,
  exportedAt = new Date(),
}: BackupOptions) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: exportedAt.toISOString(),
  account,
  bindings,
  owned: items.map((item) => item.guid),
  items: items.map((item) => ({
    guid: item.guid,
    id: item.id,
    name: item.name,
    zhName: getZhName(item),
    type: item.type,
    source: getSource(item),
    sourceUrl: item.wiki,
  })),
});

export const createAccountDraft = ({
  account,
  bindings,
  owned,
  savedAt = new Date(),
}: DraftOptions) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  savedAt: savedAt.toISOString(),
  account,
  bindings,
  owned: [...owned],
});

const parseAccountData = (
  value: unknown,
  validGuids?: ReadonlySet<string>,
) => {
  const backup = asRecord(value);
  const rawAccount = asRecord(backup?.account);
  const rawBindings = asRecord(backup?.bindings);
  const rawOwned = backup?.owned;

  if (
    backup?.format !== BACKUP_FORMAT ||
    !rawAccount ||
    !Array.isArray(rawOwned)
  ) {
    throw new Error("Invalid account backup");
  }

  const bindings = emptyBindings();
  bindingKeys.forEach((key) => {
    const bindingValue =
      rawBindings?.[key] ??
      (key === "twitch" ? rawBindings?.twitter : undefined);
    if (bindingOptions.some((option) => option.key === bindingValue)) {
      bindings[key] = bindingValue as BindingStatus;
    }
  });

  const importedType = String(rawAccount.accountType || "有翼");
  const rawBindingsConfirmed = rawAccount.bindingsConfirmed;
  const account: AccountInfo = {
    name: String(rawAccount.name || ""),
    accountType: importedType.includes("無翼") ? "無翼" : "有翼",
    bindingsConfirmed:
      typeof rawBindingsConfirmed === "boolean"
        ? rawBindingsConfirmed
        : Object.values(bindings).some((status) => status !== "none"),
    candles: String(rawAccount.candles || ""),
    hearts: String(rawAccount.hearts || ""),
    ascended: String(rawAccount.ascended || ""),
    passes: String(rawAccount.passes || ""),
    bindingNote: String(rawAccount.bindingNote || ""),
    notes: String(rawAccount.notes || ""),
  };
  const owned = rawOwned.filter(
    (guid): guid is string =>
      typeof guid === "string" && (!validGuids || validGuids.has(guid)),
  );

  return { account, bindings, owned };
};

export const parseAccountBackup = (
  value: unknown,
  validGuids: ReadonlySet<string>,
) => parseAccountData(value, validGuids);

export const parseAccountDraft = (
  value: unknown,
  validGuids: ReadonlySet<string> | undefined = undefined,
  now = new Date(),
) => {
  const draft = asRecord(value);
  const savedAt = Date.parse(String(draft?.savedAt || ""));
  if (
    !Number.isFinite(savedAt) ||
    savedAt - now.getTime() > ACCOUNT_DRAFT_CLOCK_SKEW_MS ||
    now.getTime() - savedAt > ACCOUNT_DRAFT_MAX_AGE_MS
  ) {
    throw new Error("Expired account draft");
  }
  return parseAccountData(value, validGuids);
};
