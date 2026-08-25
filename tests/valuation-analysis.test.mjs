import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const asModuleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )}`;

const loadValuationAnalysis = async () => {
  const [configSource, calibrationSource, itemsSource, analysisSource] =
    await Promise.all(
      [
        "account-config.ts",
        "valuation-calibration.ts",
        "valuation-items.ts",
        "valuation-analysis.ts",
      ].map((file) => readFile(new URL(`../app/${file}`, import.meta.url), "utf8")),
    );
  const moduleSource = analysisSource
    .replace(
      /import \{([\s\S]*?)\} from "\.\/account-config";/,
      (_, imports) =>
        `const {${imports.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(configSource))});`,
    )
    .replace(
      /import \{([\s\S]*?)\} from "\.\/valuation-calibration";/,
      (_, imports) =>
        `const {${imports.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(calibrationSource))});`,
    )
    .replace(
      /import \{([\s\S]*?)\} from "\.\/valuation-items";/,
      (_, imports) =>
        `const {${imports}} = await import(${JSON.stringify(asModuleUrl(itemsSource))});`,
    );
  return import(asModuleUrl(moduleSource));
};

const { analyzeValuation, estimateValuation } = await loadValuationAnalysis();

const emptyBindings = () => ({
  google: "none",
  nintendo: "none",
  gameCenter: "none",
  facebook: "none",
  steam: "none",
  twitch: "none",
});

const item = (overrides = {}) => ({
  id: 1,
  order: 1,
  guid: "test",
  name: "Test Item",
  type: "Cape",
  group: "",
  icon: "",
  previewUrl: "",
  wiki: "https://example.test/item",
  section: "events",
  collection: "event-test",
  ...overrides,
});

const domain = {
  isValuationFocus: (value) => value.name !== "Ordinary Item",
  isLimitedItem: (value) => value.collection === "collab",
  sourceKind: (value) => (value.collection === "collab" ? "聯動" : "活動"),
  getZhName: (name) => `中:${name}`,
  getSource: (value) => `來源:${value.collection}`,
  ongoingSeasonSlugs: new Set(["ongoing"]),
  graduationSeasonSlugs: ["first", "second"],
  seasonGraduationItems: new Map([
    ["first", [item(), item()]],
    ["second", [item()]],
  ]),
  sortSeasonSlugs: (slugs) => [...slugs].sort(),
};

const analyze = (chosen = [], bindings = emptyBindings(), bindingNote = "") =>
  analyzeValuation({ chosen, bindings, bindingNote, domain });

test("empty data reports no valuation evidence and zero completeness", () => {
  const analysis = analyze();
  assert.equal(analysis.completeness, 0);
  assert.equal(analysis.startSeasonSlug, null);
  assert.equal(analysis.valuationItems.length, 0);
  assert.equal(analysis.gapTier.key, "unknown");
});

test("paid, ultimate and collaboration fixtures produce representative analysis", () => {
  const ultimate = item({
    guid: "ultimate",
    name: "First Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "first",
  });
  const paidCollab = item({
    guid: "paid-collab",
    name: "Collab Pack",
    wiki: "https://example.test/Collab_Pack",
    collection: "collab",
  });
  const analysis = analyze([ultimate, paidCollab]);
  assert.deepEqual(analysis.ultimateSeasonSlugs, ["first"]);
  assert.equal(analysis.ultimates.length, 1);
  assert.equal(analysis.packages.length, 1);
  assert.equal(analysis.collabs.length, 1);
  assert.equal(analysis.limited.length, 1);
  assert.deepEqual(analysis.partialSeasonSlugs, ["first"]);
  assert.deepEqual(analysis.missingSeasonSlugs, ["second"]);
  assert.equal(analysis.completeness, 75);
});

test("binding issues and kept bindings are independently counted", () => {
  const bindings = emptyBindings();
  bindings.google = "issue";
  bindings.steam = "keep";
  bindings.twitch = "keep";
  const analysis = analyze([item({ guid: "paid", wiki: "https://x/Pack" })], bindings);
  assert.equal(analysis.issueCount, 1);
  assert.equal(analysis.keepCount, 2);
  assert.equal(analysis.completeness, 75);
});

test("estimate returns null without a model or valuation-eligible item", () => {
  const noModel = estimateValuation({
    model: null,
    analysis: analyze([item()]),
    accountType: "有翼",
    domain,
  });
  const noItems = estimateValuation({
    model: { feature_names: [], keyword_patterns: {}, scaler_mean: [], scaler_scale: [], coefficients: [], intercept: 1, clamp_twd: [0, 9999] },
    analysis: analyze([item({ name: "Ordinary Item" })]),
    accountType: "有翼",
    domain,
  });
  assert.equal(noModel, null);
  assert.equal(noItems, null);
});

test("fixed model estimates are stable, respect the lower clamp, and apply binding risk", () => {
  const model = {
    feature_names: ["collab", "binding_risk"],
    keyword_patterns: { collab: "Collab" },
    scaler_mean: [0, 0],
    scaler_scale: [1, 1],
    coefficients: [1, -100],
    intercept: Math.log(5001),
    clamp_twd: [1000, 999999],
  };
  const chosen = [item({ guid: "collab", name: "Collab Pack", wiki: "https://x/Pack", collection: "collab" })];
  const safe = estimateValuation({ model, analysis: analyze(chosen), accountType: "有翼", domain });
  const riskyBindings = emptyBindings();
  riskyBindings.google = "issue";
  riskyBindings.steam = "keep";
  const risky = estimateValuation({ model, analysis: analyze(chosen, riskyBindings), accountType: "有翼", domain });
  const clamped = estimateValuation({
    model: { ...model, feature_names: [], intercept: 0, clamp_twd: [1200, 999999] },
    analysis: analyze(chosen),
    accountType: "有翼",
    domain,
  });
  const highTail = estimateValuation({
    model: { ...model, feature_names: [], intercept: Math.log(100001) },
    analysis: analyze(chosen),
    accountType: "有翼",
    domain,
  });
  const riskClamped = estimateValuation({
    model: { ...model, clamp_twd: [12000, 999999] },
    analysis: analyze(chosen, riskyBindings),
    accountType: "有翼",
    domain,
  });
  assert.equal(safe, 13600);
  assert.equal(risky, 11100);
  assert.equal(clamped, 1200);
  assert.equal(highTail, 84100);
  assert.equal(riskClamped, 12000);
});
