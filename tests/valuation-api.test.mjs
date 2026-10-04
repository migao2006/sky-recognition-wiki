import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { tsImport } from "tsx/esm/api";
const { isModelRequest, isModelResponse } = await tsImport("../app/valuation-api-contract.ts", import.meta.url);
const { buildModelRequest } = await tsImport("../app/valuation-tabpfn-features.ts", import.meta.url);
const { POST } = await tsImport("../app/api/valuation/route.ts", import.meta.url);
const meta = JSON.parse(fs.readFileSync(new URL("../app/valuation-tabpfn-manifest.json", import.meta.url)));

test("model protocol rejects private fields, unknown keys and invalid numbers", () => {
  assert.ok(isModelRequest({ schemaVersion: 1, features: { season: null } }));
  for (const features of [{ price: 3500 }, { accountId: "secret" }, { season: "fake" }, { packageCount: -1 }, { packageCount: Infinity }]) {
    assert.equal(isModelRequest({ schemaVersion: 1, features }), false);
  }
  assert.equal(isModelResponse({ midpoint: 3500 }), false);
});

test("wardrobe bridge preserves unknowns and never sends personal data", () => {
  assert.equal(meta.columns.some(k => k.startsWith("item:")), false);
  const analysis = { startSeasonSlug: "moments", seasonCompletion: new Map(), bindings: { google: "none" } };
  const estimate = { marketProfile: { canonicalPackageCount: 105, salePackageTier: "many", breakClass: "none" } };
  const account = { name: "private", identityId: "private", notes: "private", candles: "", hearts: "0", ascended: "", passes: "", wardrobeConfirmed: false, bindingsConfirmed: false };
  const result = buildModelRequest(analysis, estimate, account, new Set(["private-item"]));
  assert.equal(result.features.season, null);
  assert.equal(result.features.packageTier, null);
  assert.equal(result.features["binding:GG"], null);
  assert.equal(result.features.accountStyle, undefined);
  assert.ok(isModelRequest(result));
  assert.ok(!JSON.stringify(result).includes("private"));
  const confirmed = buildModelRequest(analysis, estimate, { ...account, wardrobeConfirmed: true, bindingsConfirmed: true }, new Set());
  assert.equal(confirmed.features.packageTier, "hundred");
  assert.equal(confirmed.features["binding:GG"], "unbound");
  analysis.seasonCompletion.set("moments", { selected: 1, expected: 2 });
  estimate.marketProfile.breakClass = "big";
  assert.equal(buildModelRequest(analysis, estimate, { ...account, wardrobeConfirmed: true }, new Set()).features.breakClass, "large");
});

test("proxy never falls back when backend configuration is missing", async () => {
  const previous = process.env.VALUATION_BACKEND_URL;
  delete process.env.VALUATION_BACKEND_URL;
  try {
    const r = await POST(new Request("https://example.test/api/valuation", { method: "POST", body: "{}" }));
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { error: "offline" });
  } finally { if (previous !== undefined) process.env.VALUATION_BACKEND_URL = previous; }
});

test("runtime has no imports of the offline price baseline", () => {
  for (const file of ["valuation-analysis.ts", "valuation-season-bands.ts"]) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8"), /from ["']\.\/valuation-fresh/);
  }
});
