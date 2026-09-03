import assert from "node:assert/strict";
import test from "node:test";
import { buildIapCatalogRows } from "../scripts/lib/iap-catalog-sync.mjs";

const iaps = [{ guid: "iap-paid", name: "Paid Pack", price: 9.99, items: ["known-guid"] }];
const upstreamItems = [{ guid: "known-guid", id: 1, name: "Known Item", type: "Held" }];
const catalogItems = [{ guid: "known-guid", name: "Known Item", collection: "Days of Test" }];

test("IAP sync maps offers by exact GUID without relying on a matching name", () => {
  const { rows } = buildIapCatalogRows({
    iaps,
    upstreamItems,
    catalogItems,
    zhName: () => "測試物品",
  });
  assert.deepEqual(rows.map((row) => row.guid), ["known-guid"]);
  assert.equal(rows[0].playerName, "測試物品");
});

test("IAP sync refuses an upstream GUID absent from the runtime catalog", () => {
  assert.throws(
    () => buildIapCatalogRows({
      iaps: [{ ...iaps[0], items: ["missing-runtime-guid"] }],
      upstreamItems: [{
        guid: "missing-runtime-guid",
        id: 2,
        name: "Missing Runtime Item",
        type: "Held",
      }],
      catalogItems,
      zhName: () => "不應使用",
    }),
    /IAP sync refused: 1 exact GUID mappings are unresolved\.\nPaid Pack: Missing Runtime Item \(missing-runtime-guid\) is absent from the runtime catalog/,
  );
});

test("IAP sync refuses an IAP GUID missing from the upstream item source", () => {
  assert.throws(
    () => buildIapCatalogRows({
      iaps: [{ ...iaps[0], items: ["unknown-upstream-guid"] }],
      upstreamItems,
      catalogItems,
      zhName: () => "不應使用",
    }),
    /Paid Pack: unknown upstream item unknown-upstream-guid/,
  );
});

test("IAP sync preserves the existing exclusion for upstream Special items", () => {
  const { rows } = buildIapCatalogRows({
    iaps: [{ ...iaps[0], items: ["special-guid"] }],
    upstreamItems: [{
      guid: "special-guid",
      id: 3,
      name: "Special Item",
      type: "Special",
    }],
    catalogItems,
    zhName: () => "不應使用",
  });
  assert.deepEqual(rows, []);
});
