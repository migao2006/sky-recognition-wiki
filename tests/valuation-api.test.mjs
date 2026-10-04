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
  for (const packageCount of [0, 99, 100, 200]) assert.ok(isModelRequest({ schemaVersion: 1, features: { packageCount } }));
  for (const packageCount of [1.5, true, "100", -1, NaN, 100000]) assert.equal(isModelRequest({ schemaVersion: 1, features: { packageCount } }), false);
});

test("package multiplier response is validated and cannot invent an exact count", () => {
  const response = { schemaVersion:1, modelRevision:meta.modelRevision, status:"unvalidated", currency:"TWD", range:null, midpoint:1000,
    seasonBands:meta.seasons.map(slug => ({slug,status:"unvalidated",method:meta.method,confidence:"inferred",low:null,high:null,median:1000,sampleCount:meta.seasonCounts[slug],asOf:meta.asOf})) };
  assert.ok(isModelResponse({...response,packageAdjustment:{count:100,multiplier:1.1,basis:"count"}}));
  for(const packageAdjustment of [null,{count:100,multiplier:1,basis:"tier"},{count:null,multiplier:1,basis:"count"},{count:1.5,multiplier:1,basis:"count"},{count:0,multiplier:Infinity,basis:"count"}])
    assert.equal(isModelResponse({...response,packageAdjustment}),false);
});

test("wardrobe bridge preserves unknowns and never sends personal data", () => {
  const itemKeys = meta.columns.filter(k => k.startsWith("item:"));
  assert.equal(itemKeys.length, 0, "percentage model does not separately add individual item prices");
  const analysis = { startSeasonSlug: "moments", seasonCompletion: new Map(), bindings: { google: "none" } };
  const estimate = { marketProfile: { canonicalPackageCount: 105, salePackageTier: "many", breakClass: "none" } };
  const account = { name: "private", identityId: "private", notes: "private", candles: "", hearts: "0", ascended: "", passes: "", wardrobeConfirmed: false, bindingsConfirmed: false };
  const result = buildModelRequest(analysis, estimate, account, new Set(["private-item"]));
  assert.equal(result.features.season, null);
  assert.equal(result.features.packageTier, null);
  assert.equal(result.features.packageCount, null);
  assert.equal(result.features["binding:GG"], null);
  assert.equal(result.features.accountStyle, undefined);
  for (const key of itemKeys) assert.equal(result.features[key], null);
  const present = buildModelRequest(analysis, estimate, account, new Set(["unlisted-item"]));
  assert.deepEqual(present.features, result.features);
  assert.ok(isModelRequest(result));
  assert.ok(!JSON.stringify(result).includes("private"));
  const confirmed = buildModelRequest(analysis, estimate, { ...account, wardrobeConfirmed: true, bindingsConfirmed: true }, new Set());
  assert.equal(confirmed.features.packageTier, "hundred");
  assert.equal(confirmed.features.packageCount, 105);
  assert.equal(confirmed.features["binding:GG"], "unbound");
  for (const key of itemKeys) assert.equal(confirmed.features[key], "absent");
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
