import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";

const loadAccountBackup = async () => {
  const [configSource, backupSource] = await Promise.all(
    ["account-config.ts", "account-backup.ts"].map((file) =>
      readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
    ),
  );
  const moduleSource = backupSource.replace(
    /import \{([\s\S]*?)\} from "\.\/account-config";/,
    (_, imports) =>
      `const {${imports.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(
        asModuleUrl(configSource),
      )});`,
  );
  return import(asModuleUrl(moduleSource));
};

const {
  ACCOUNT_DRAFT_MAX_AGE_MS,
  createAccountBackup,
  createAccountDraft,
  parseAccountBackup,
  parseAccountDraft,
} = await loadAccountBackup();

const account = {
  name: "測試帳號",
  accountType: "有翼",
  bindingsConfirmed: true,
  candles: "12",
  hearts: "3",
  ascended: "1",
  passes: "0",
  bindingNote: "",
  notes: "備註",
};

const item = {
  id: 7,
  order: 1,
  guid: "valid-guid",
  name: "Rainbow Cape",
  type: "Cape",
  group: "",
  icon: "",
  wiki: "https://example.com/rainbow",
  section: "events",
  collection: "days-of-color",
};

test("creates a stable versioned account backup", () => {
  const backup = createAccountBackup({
    account,
    bindings: {
      google: "transfer",
      nintendo: "none",
      gameCenter: "none",
      facebook: "none",
      steam: "none",
      twitch: "keep",
      playstation: "none",
    },
    items: [item],
    getZhName: () => "彩虹斗篷",
    getSource: () => "彩虹日",
    exportedAt: new Date("2026-08-25T00:00:00.000Z"),
  });

  assert.equal(backup.format, "sky-recognition-wiki");
  assert.equal(backup.version, 2);
  assert.equal(backup.exportedAt, "2026-08-25T00:00:00.000Z");
  assert.deepEqual(backup.owned, ["valid-guid"]);
  assert.deepEqual(backup.items[0], {
    guid: "valid-guid",
    id: 7,
    name: "Rainbow Cape",
    zhName: "彩虹斗篷",
    type: "Cape",
    source: "彩虹日",
    sourceUrl: "https://example.com/rainbow",
  });

  const restored = parseAccountBackup(backup, new Set(["valid-guid"]));
  assert.deepEqual(restored.account, account);
  assert.deepEqual(restored.bindings, backup.bindings);
  assert.deepEqual(restored.owned, ["valid-guid"]);
});

test("normalizes imports and keeps only known item ids", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      account: { ...account, accountType: "無翼帳號", candles: 0 },
      bindings: { google: "transfer", twitter: "keep", steam: "unknown" },
      owned: ["valid-guid", "missing-guid", 7],
    },
    new Set(["valid-guid"]),
  );

  assert.equal(imported.account.accountType, "無翼");
  assert.equal(imported.account.candles, "");
  assert.equal(imported.bindings.google, "transfer");
  assert.equal(imported.bindings.twitch, "keep");
  assert.equal(imported.bindings.steam, "none");
  assert.equal(imported.bindings.playstation, "none");
  assert.deepEqual(imported.owned, ["valid-guid"]);
});

test("rejects unrelated JSON files", () => {
  assert.throws(
    () => parseAccountBackup({ format: "other", account, owned: [] }, new Set()),
    /Invalid account backup/,
  );
  assert.throws(
    () =>
      parseAccountBackup(
        { format: "sky-recognition-wiki", account: "invalid", owned: [] },
        new Set(),
      ),
    /Invalid account backup/,
  );
});

test("preserves the legacy version-agnostic import policy", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      version: 999,
      account,
      owned: [],
    },
    new Set(),
  );

  assert.equal(imported.account.name, "測試帳號");
  assert.equal(imported.bindings.playstation, "none");
});

test("migrates legacy backups and drafts without PlayStation bindings", () => {
  const legacyAccount = { ...account };
  delete legacyAccount.bindingsConfirmed;
  const legacy = {
    format: "sky-recognition-wiki",
    version: 2,
    savedAt: "2026-08-26T00:00:00.000Z",
    account: legacyAccount,
    bindings: { google: "transfer", twitch: "keep" },
    owned: [],
  };

  const imported = parseAccountBackup(legacy, new Set());
  const draft = parseAccountDraft(
    legacy,
    new Set(),
    new Date("2026-08-26T00:00:00.000Z"),
  );

  assert.equal(imported.bindings.playstation, "none");
  assert.equal(draft.bindings.playstation, "none");
  assert.equal(imported.account.bindingsConfirmed, true);
});

test("creates and restores a compact account draft", () => {
  const savedAt = new Date("2026-08-26T00:00:00.000Z");
  const draft = createAccountDraft({
    account,
    bindings: {
      google: "transfer",
      nintendo: "none",
      gameCenter: "none",
      facebook: "none",
      steam: "none",
      twitch: "keep",
      playstation: "none",
    },
    owned: ["valid-guid"],
    savedAt,
  });

  assert.equal(draft.savedAt, savedAt.toISOString());
  assert.equal("items" in draft, false);
  assert.deepEqual(
    parseAccountDraft(draft, new Set(["valid-guid"]), savedAt),
    {
      account,
      bindings: draft.bindings,
      owned: ["valid-guid"],
    },
  );
});

test("restores draft ids before the wardrobe catalog finishes loading", () => {
  const savedAt = new Date("2026-08-26T00:00:00.000Z");
  const draft = createAccountDraft({
    account,
    bindings: {
      google: "none",
      nintendo: "none",
      gameCenter: "none",
      facebook: "none",
      steam: "none",
      twitch: "none",
      playstation: "none",
    },
    owned: ["valid-guid", "stale-guid"],
    savedAt,
  });

  assert.deepEqual(parseAccountDraft(draft, undefined, savedAt).owned, [
    "valid-guid",
    "stale-guid",
  ]);
  assert.deepEqual(
    parseAccountDraft(draft, new Set(["valid-guid"]), savedAt).owned,
    ["valid-guid"],
  );
});

test("preserves an explicit unconfirmed binding state", () => {
  const savedAt = new Date("2026-08-26T00:00:00.000Z");
  const draft = createAccountDraft({
    account: { ...account, bindingsConfirmed: false },
    bindings: {
      google: "transfer",
      nintendo: "none",
      gameCenter: "none",
      facebook: "none",
      steam: "none",
      twitch: "none",
      playstation: "none",
    },
    owned: [],
    savedAt,
  });

  const restored = parseAccountDraft(draft, new Set(), savedAt);
  assert.equal(restored.account.bindingsConfirmed, false);
  assert.equal(restored.bindings.google, "transfer");
});

test("rejects expired or malformed drafts", () => {
  const savedAt = new Date("2026-08-26T00:00:00.000Z");
  const draft = createAccountDraft({
    account,
    bindings: {
      google: "none",
      nintendo: "none",
      gameCenter: "none",
      facebook: "none",
      steam: "none",
      twitch: "none",
      playstation: "none",
    },
    owned: [],
    savedAt,
  });
  const expiredAt = new Date(savedAt.getTime() + ACCOUNT_DRAFT_MAX_AGE_MS + 1);

  assert.throws(
    () => parseAccountDraft(draft, new Set(), expiredAt),
    /Expired account draft/,
  );
  assert.throws(
    () => parseAccountDraft({ ...draft, savedAt: "invalid" }, new Set()),
    /Expired account draft/,
  );
  assert.throws(
    () =>
      parseAccountDraft(
        { ...draft, savedAt: "2027-08-26T00:00:00.000Z" },
        new Set(),
        savedAt,
      ),
    /Expired account draft/,
  );
});
