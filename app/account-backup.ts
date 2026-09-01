import {
  bindingKeys,
  bindingOptions,
  emptyBindings,
  normalizeAccountResource,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { legacyCatalogGuidAliases } from "./catalog-legacy-guids";
import type { WikiItem } from "./wiki-data";

const BACKUP_FORMAT = "sky-recognition-wiki";
const BACKUP_VERSION = 3;
const LEGACY_BACKUP_VERSIONS = new Set([1, 2]);
export const ACCOUNT_BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const ACCOUNT_BACKUP_MAX_OWNED_ITEMS = 5_000;

export const ACCOUNT_DRAFT_STORAGE_KEY = "sky-recognition-wiki:draft:v3";
export const ACCOUNT_LEGACY_DRAFT_STORAGE_KEYS = [
  "sky-recognition-wiki:draft:v2",
] as const;
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

type AccountImportResult = {
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  owned: string[];
  imported: number;
  migrated: number;
  ignored: number;
  /** Unknown official GUIDs are retained for an import preview, never restored. */
  unknownGuids: Array<{ guid: string; name: string }>;
  /** Valid GUIDs repeated in the file after legacy migration. */
  duplicates: string[];
  /** Entries in owned that are not strings. */
  invalidEntries: number;
};

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

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

type BackupItemSnapshot = { guid: string; name: string };

const v3ItemSnapshots = (backup: UnknownRecord): Map<string, string> => {
  if (backup.version !== BACKUP_VERSION || !Array.isArray(backup.items)) {
    return new Map();
  }
  const snapshots = new Map<string, string>();
  backup.items.forEach((entry) => {
    const item = asRecord(entry);
    if (!item || typeof item.guid !== "string") return;
    const name = text(item.zhName, 100) || text(item.name, 100);
    if (name) snapshots.set(item.guid, name);
  });
  return snapshots;
};

const supportedVersion = (backup: UnknownRecord) => {
  const version = backup.version;
  if (version === undefined) return 0;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("Unsupported account backup version");
  }
  if (version === BACKUP_VERSION || LEGACY_BACKUP_VERSIONS.has(version)) {
    return version;
  }
  throw new Error("Unsupported account backup version");
};

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
): AccountImportResult => {
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
  supportedVersion(backup);
  if (rawOwned.length > ACCOUNT_BACKUP_MAX_OWNED_ITEMS) {
    throw new Error("Too many owned items in account backup");
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

  const importedType = text(rawAccount.accountType, 100) || "有翼";
  const rawBindingsConfirmed = rawAccount.bindingsConfirmed;
  const account: AccountInfo = {
    name: text(rawAccount.name, 100),
    accountType: importedType.includes("無翼") ? "無翼" : "有翼",
    bindingsConfirmed:
      typeof rawBindingsConfirmed === "boolean"
        ? rawBindingsConfirmed
        : Object.values(bindings).some((status) => status !== "none"),
    candles: normalizeAccountResource(rawAccount.candles, "candles"),
    hearts: normalizeAccountResource(rawAccount.hearts, "hearts"),
    ascended: normalizeAccountResource(rawAccount.ascended, "ascended"),
    passes: normalizeAccountResource(rawAccount.passes, "passes"),
    bindingNote: text(rawAccount.bindingNote, 1_000),
    notes: text(rawAccount.notes, 1_000),
  };
  const owned: string[] = [];
  const seen = new Set<string>();
  let imported = 0;
  let migrated = 0;
  let invalidEntries = 0;
  const unknownGuids: BackupItemSnapshot[] = [];
  const duplicates: string[] = [];
  const snapshots = v3ItemSnapshots(backup);
  rawOwned.forEach((rawGuid) => {
    if (typeof rawGuid !== "string") {
      invalidEntries += 1;
      return;
    }
    const mappedGuid = legacyCatalogGuidAliases[rawGuid] ?? rawGuid;
    const wasMigrated = mappedGuid !== rawGuid;
    if (seen.has(mappedGuid)) {
      duplicates.push(mappedGuid);
      return;
    }
    if (validGuids && !validGuids.has(mappedGuid)) {
      seen.add(mappedGuid);
      unknownGuids.push({
        guid: mappedGuid,
        name: snapshots.get(rawGuid) || "",
      });
      return;
    }
    seen.add(mappedGuid);
    owned.push(mappedGuid);
    if (wasMigrated) migrated += 1;
    else imported += 1;
  });

  const ignored = unknownGuids.length + duplicates.length + invalidEntries;
  return {
    account,
    bindings,
    owned,
    imported,
    migrated,
    ignored,
    unknownGuids,
    duplicates,
    invalidEntries,
  };
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
