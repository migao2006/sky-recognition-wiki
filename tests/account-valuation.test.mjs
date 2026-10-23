import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { tsImport } from "tsx/esm/api";

const {
  estimateAccountValue,
  valuationPackageTierNames,
} = await tsImport("../app/account-valuation.ts", import.meta.url);

const summary = (values = {}) => ({
  selectedCount: 0,
  highlightItems: [],
  ultimates: [],
  pendants: [],
  packages: [],
  limited: [],
  startSeasonSlug: "enchantment",
  seasonCompletion: new Map(),
  canonicalPackageCount: 0,
  breakClass: "none",
  salePackageTier: "few",
  accountStyle: "regular",
  issueCount: 0,
  keepCount: 0,
  ...values,
});

test("published browser valuation returns a positive listing reference and provenance", () => {
  const result = estimateAccountValue(summary(), true);
  assert.equal(result.status, "unvalidated");
  assert.ok(result.midpoint > 0);
  assert.ok(result.range.low > 0);
  assert.ok(result.range.low <= result.midpoint);
  assert.ok(result.midpoint <= result.range.high);
  assert.equal(result.season, "enchantment");
  assert.equal(result.preliminary, false);
  assert.equal(result.revision, "whole-account-v3.1");
  assert.match(result.asOf, /^\d{4}-\d{2}-\d{2}$/);
});

test("package boundaries use exact package count including the hundred tier", () => {
  const cases = [
    [59, "few"],
    [60, "medium"],
    [89, "medium"],
    [90, "many"],
    [99, "many"],
    [100, "hundred"],
  ];
  for (const [count, tier] of cases) {
    const result = estimateAccountValue(summary({ canonicalPackageCount: count }), true);
    assert.equal(result.packageTier, tier);
    assert.ok(valuationPackageTierNames[result.packageTier]);
  }
});

test("unknown origin uses the pooled market estimate and incomplete wardrobes stay preliminary", () => {
  const result = estimateAccountValue(summary({
    startSeasonSlug: null,
    breakClass: "big",
  }), false);
  assert.equal(result.status, "unvalidated");
  assert.equal(result.method, "pooled");
  assert.equal(result.season, null);
  assert.equal(result.preliminary, true);
  assert.ok(result.midpoint > 0);
});

test("published artifact covers every season with monotonic package and break effects", async () => {
  const artifact = JSON.parse(await readFile(
    new URL("../app/valuation-fresh-data.json", import.meta.url),
    "utf8",
  ));
  const counts = [0, 60, 90, 100];
  const breaks = ["none", "slight", "medium", "big"];

  for (const season of Object.keys(artifact.model.seasons)) {
    let previousPackagePrice = 0;
    for (const canonicalPackageCount of counts) {
      const result = estimateAccountValue(summary({
        startSeasonSlug: season,
        canonicalPackageCount,
      }), true);
      assert.ok(result.midpoint >= previousPackagePrice, season);
      previousPackagePrice = result.midpoint;
    }

    let previousBreakPrice = Infinity;
    for (const breakClass of breaks) {
      const result = estimateAccountValue(summary({
        startSeasonSlug: season,
        breakClass,
      }), true);
      assert.ok(result.midpoint <= previousBreakPrice, season);
      previousBreakPrice = result.midpoint;
    }
  }
});

test("public valuation adapter has no network or server configuration dependency", async () => {
  const source = await readFile(
    new URL("../app/account-valuation.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /fetch\s*\(|VALUATION_BACKEND|TUNNEL|process\.env/);
});
