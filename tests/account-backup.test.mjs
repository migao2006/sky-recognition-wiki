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
  ).replace(
    'import { legacyCatalogGuidAliases } from "./catalog-legacy-guids";',
    'const legacyCatalogGuidAliases = { "instrument-harp": "biKOov4qJQ", "held-manatee-staff": "Ll1veXMDa9" };',
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
  assert.equal(backup.version, 3);
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
  assert.deepEqual(
    { imported: restored.imported, migrated: restored.migrated, ignored: restored.ignored },
    { imported: 1, migrated: 0, ignored: 0 },
  );
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
  assert.deepEqual(imported.unknownGuids, [{ guid: "missing-guid", name: "" }]);
  assert.deepEqual(imported.duplicates, []);
  assert.equal(imported.invalidEntries, 1);
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

test("migrates v1, v2, and versionless backups but rejects future versions", () => {
  for (const version of [undefined, 1, 2]) {
    const imported = parseAccountBackup(
      {
        format: "sky-recognition-wiki",
        ...(version === undefined ? {} : { version }),
        account,
        owned: [],
      },
      new Set(),
    );
    assert.equal(imported.account.name, "測試帳號");
  }
  assert.throws(
    () => parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      version: 999,
      account,
      owned: [],
    },
    new Set(),
  ), /Unsupported account backup version/);
});

test("migrates legacy ids, deduplicates owned items, and counts ignored entries", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      version: 2,
      account,
      owned: ["instrument-harp", "biKOov4qJQ", "missing", "instrument-harp", 42],
    },
    new Set(["biKOov4qJQ"]),
  );
  assert.deepEqual(imported.owned, ["biKOov4qJQ"]);
  assert.deepEqual(
    { imported: imported.imported, migrated: imported.migrated, ignored: imported.ignored },
    { imported: 0, migrated: 1, ignored: 4 },
  );
  assert.deepEqual(imported.duplicates, ["biKOov4qJQ", "biKOov4qJQ"]);
  assert.deepEqual(imported.unknownGuids, [{ guid: "missing", name: "" }]);
  assert.equal(imported.invalidEntries, 1);
});

test("migrates the legacy manatee staff GUID to the upstream identity", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      version: 2,
      account,
      owned: ["held-manatee-staff"],
    },
    new Set(["Ll1veXMDa9"]),
  );

  assert.deepEqual(imported.owned, ["Ll1veXMDa9"]);
  assert.equal(imported.migrated, 1);
  assert.equal(imported.ignored, 0);
});

test("rejects excessively large ownership lists and normalizes imported text and resources", () => {
  assert.throws(
    () => parseAccountBackup({ format: "sky-recognition-wiki", account, owned: Array(5001).fill("valid-guid") }, new Set(["valid-guid"])),
    /Too many owned items/,
  );
  const imported = parseAccountBackup(
    { format: "sky-recognition-wiki", account: { ...account, name: "名".repeat(101), candles: "燭".repeat(33), notes: "注".repeat(1001) }, owned: [] },
    new Set(),
  );
  assert.equal(imported.account.name.length, 100);
  assert.equal(imported.account.candles, "");
  assert.equal(imported.account.notes.length, 1000);
});

test("reports unknown v3 GUIDs with only their saved item snapshot names", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      version: 3,
      account,
      owned: ["unknown-guid", "unknown-guid", "another-unknown"],
      items: [
        { guid: "unknown-guid", zhName: "備份中的中文名稱", name: "Wrong English" },
        { guid: "another-unknown", name: "Only saved English name" },
        { guid: "not-owned", zhName: "不可使用" },
      ],
    },
    new Set(["valid-guid"]),
  );
  assert.deepEqual(imported.unknownGuids, [
    { guid: "unknown-guid", name: "備份中的中文名稱" },
    { guid: "another-unknown", name: "Only saved English name" },
  ]);
  assert.deepEqual(imported.duplicates, ["unknown-guid"]);
  assert.equal(imported.ignored, 3);
});

test("accepts only bounded non-negative integer resources", () => {
  const imported = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      account: {
        ...account,
        candles: "900",
        hearts: "-1",
        ascended: "10.5",
        passes: "001",
      },
      owned: [],
    },
    new Set(),
  );
  assert.equal(imported.account.candles, "900");
  assert.equal(imported.account.hearts, "");
  assert.equal(imported.account.ascended, "");
  assert.equal(imported.account.passes, "001");
  const oversized = parseAccountBackup(
    {
      format: "sky-recognition-wiki",
      account: { ...account, candles: "100000", passes: "1000" },
      owned: [],
    },
    new Set(),
  );
  assert.equal(oversized.account.candles, "");
  assert.equal(oversized.account.passes, "");
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
  const restored = parseAccountDraft(draft, new Set(["valid-guid"]), savedAt);
  assert.deepEqual(
    { account: restored.account, bindings: restored.bindings, owned: restored.owned },
    { account, bindings: draft.bindings, owned: ["valid-guid"] },
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
