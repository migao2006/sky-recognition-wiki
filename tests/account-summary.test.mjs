import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { loadRuntimeCatalog } from "../scripts/load-runtime-catalog.mjs";

const { analyzeAccount } = await tsImport("../app/account-summary.ts", import.meta.url);
const { classifySalePackageTier } = await tsImport("../app/account-profile.ts", import.meta.url);
const emptyBindings = (values = {}) => ({
  google: "none", nintendo: "none", gameCenter: "none", facebook: "none",
  steam: "none", twitch: "none", playstation: "none", ...values,
});
const item = (values = {}) => ({
  id: 1, order: 1, guid: `test-${values.name ?? "item"}`, name: "Item",
  type: "Cape", group: "", icon: "", previewUrl: "",
  wiki: "https://example.test/Item", section: "events", collection: "event",
  ...values,
});
const domain = {
  isShowcaseHighlight: (value) => value.name !== "ordinary",
  isLimitedItem: (value) => value.collection === "collab" || value.group === "Limited",
  graduationSeasonSlugs: ["enchantment", "sanctuary"],
  seasonGraduationItems: new Map([
    ["enchantment", [
      item({ name: "one", group: "Ultimate", section: "seasons" }),
      item({ name: "two", group: "Ultimate", section: "seasons" }),
    ]],
    ["sanctuary", [item({ name: "three", group: "Ultimate", section: "seasons" })]],
  ]),
  sortSeasonSlugs: (slugs) => [...slugs].sort(),
};

test("summarizes season progress without treating a partial season as a break", () => {
  const chosen = [
    item({ name: "Enchantment gift", group: "Ultimate", section: "seasons", collection: "enchantment" }),
    item({ name: "Sanctuary gift", group: "Ultimate", section: "seasons", collection: "sanctuary" }),
  ];
  const result = analyzeAccount({ chosen, bindings: emptyBindings(), domain });
  assert.equal(result.startSeasonSlug, "enchantment");
  assert.deepEqual(result.seasonCompletion.get("enchantment"), { selected: 1, expected: 2 });
  assert.equal(result.breakClass, "none");
});

test("excludes non-transferable platform content from the package tier", () => {
  const chosen = [item({
    name: "PlayStation Cape", guid: "OVdKftzplv",
    wiki: "https://wiki.test/PlayStation_Pack", group: "Limited", collection: "collab",
  })];
  const kept = analyzeAccount({ chosen, bindings: emptyBindings({ playstation: "keep" }), domain });
  const transferable = analyzeAccount({ chosen, bindings: emptyBindings({ playstation: "transfer" }), domain });
  assert.equal(kept.canonicalPackageCount, 0);
  assert.equal(transferable.canonicalPackageCount, 1);
});

test("candle redemptions do not become paid packages", async () => {
  const catalog = await loadRuntimeCatalog();
  const chosen = ["si_8YhNtmr", "-HtIAPjYsa"].map((guid) =>
    catalog.wikiItems.find((entry) => entry.guid === guid),
  );
  assert.ok(chosen.every(Boolean));
  const result = analyzeAccount({
    chosen,
    bindings: emptyBindings(),
    domain: {
      isShowcaseHighlight: catalog.isShowcaseHighlight,
      isLimitedItem: catalog.isLimitedItem,
      graduationSeasonSlugs: catalog.graduationSeasonSlugs,
      seasonGraduationItems: catalog.seasonGraduationItems,
      sortSeasonSlugs: catalog.sortSeasonSlugs,
    },
  });
  assert.equal(result.canonicalPackageCount, 0);
});

test("uses conservative unique-package labels", () => {
  assert.equal(classifySalePackageTier(0).key, "few");
  assert.equal(classifySalePackageTier(59).key, "few");
  assert.equal(classifySalePackageTier(60).key, "medium");
  assert.equal(classifySalePackageTier(89).key, "medium");
  assert.equal(classifySalePackageTier(90).key, "many");
});
