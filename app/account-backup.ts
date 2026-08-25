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

type BackupOptions = {
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  items: WikiItem[];
  getZhName: (name: string) => string;
  getSource: (item: WikiItem) => string;
  exportedAt?: Date;
};

type UnknownRecord = Record<string, unknown>;

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
    zhName: getZhName(item.name),
    type: item.type,
    source: getSource(item),
    sourceUrl: item.wiki,
  })),
});

export const parseAccountBackup = (
  value: unknown,
  validGuids: ReadonlySet<string>,
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
  const account: AccountInfo = {
    name: String(rawAccount.name || ""),
    accountType: importedType.includes("無翼") ? "無翼" : "有翼",
    candles: String(rawAccount.candles || ""),
    hearts: String(rawAccount.hearts || ""),
    ascended: String(rawAccount.ascended || ""),
    passes: String(rawAccount.passes || ""),
    bindingNote: String(rawAccount.bindingNote || ""),
    notes: String(rawAccount.notes || ""),
  };
  const owned = rawOwned.filter(
    (guid): guid is string => typeof guid === "string" && validGuids.has(guid),
  );

  return { account, bindings, owned };
};
