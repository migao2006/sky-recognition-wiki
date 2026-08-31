import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asModuleUrl } from "./helpers/transpile.mjs";
import { marketCollectiblesModuleUrl } from "./helpers/market-collectibles.mjs";
import { injectSeasonItems } from "./helpers/season-items.mjs";
const sources = await Promise.all(
  [
    "account-config.ts",
    "valuation-calibration.ts",
    "valuation-items.ts",
    "valuation-market.ts",
    "valuation-season-bands.ts",
    "valuation-model-core.js",
    "valuation-analysis.ts",
  ].map((file) => readFile(new URL(`../app/${file}`, import.meta.url), "utf8")),
);
const [config, calibration, items, valuationMarket, bands, modelCore, analysis] = sources;
const calibrationLoaded = await import(asModuleUrl(calibration));
const marketAggregate = JSON.parse(
  await readFile(
    new URL("../app/valuation-market-aggregate.json", import.meta.url),
    "utf8",
  ),
);
const marketUrl = await marketCollectiblesModuleUrl();
const itemsUrl = asModuleUrl(
  (await injectSeasonItems(items)).replace(
    'import { marketCollectibleProfile } from "./market-collectibles";',
    `const { marketCollectibleProfile } = await import(${JSON.stringify(marketUrl)});`,
  ),
);
const valuationMarketUrl = asModuleUrl(
  valuationMarket.replace(
    /import marketAggregate[\s\S]*?;\n/,
    `const marketAggregate = ${JSON.stringify(marketAggregate)};\n`,
  ),
);
const bandsUrl = asModuleUrl(
  bands.replace(
    /import valuationMarketAggregate[\s\S]*?;\n/,
    `const valuationMarketAggregate = ${JSON.stringify(marketAggregate)};\n`,
  ),
);
const modelCoreUrl = asModuleUrl(modelCore);
const loaded = await import(
  asModuleUrl(
    analysis
      .replace(
        /import \{([^;]*?)\} from "\.\/valuation-market";/,
        (_, names) =>
          `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(valuationMarketUrl)});`,
      )
      .replace(
        /import \{([^;]*?)\} from "\.\/account-config";/,
        (_, names) =>
          `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(config))});`,
      )
      .replace(
        /import \{([^;]*?)\} from "\.\/valuation-calibration";/,
        (_, names) =>
          `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(calibration))});`,
      )
      .replace(
        /import \{([^;]*?)\} from "\.\/valuation-items";/,
        (_, names) =>
          `const {${names}} = await import(${JSON.stringify(itemsUrl)});`,
      )
      .replace(
        /import \{([^;]*?)\} from "\.\/valuation-season-bands";/,
        (_, names) =>
          `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(bandsUrl)});`,
      )
      .replace(
        /import \{([^;]*?)\} from "\.\/valuation-model-core\.js";/,
        (_, names) =>
          `const {${names}} = await import(${JSON.stringify(modelCoreUrl)});`,
      )
      .replace(
        /export \{ summarizeValuationRange \} from "\.\/valuation-model-core\.js";/,
        `const { summarizeValuationRange } = await import(${JSON.stringify(modelCoreUrl)});\nexport { summarizeValuationRange };`,
      ),
  )
);
const { analyzeValuation, estimateValuation, summarizeValuationRange } = loaded;
const bindings = (values = {}) => ({
  google: "none",
  nintendo: "none",
  gameCenter: "none",
  facebook: "none",
  steam: "none",
  twitch: "none",
  playstation: "none",
  ...values,
});
const item = (values = {}) => ({
  id: 1,
  order: 1,
  guid: Math.random().toString(),
  name: "Item",
  type: "Cape",
  group: "",
  icon: "",
  previewUrl: "",
  wiki: "https://example.test/Item",
  section: "events",
  collection: "event",
  ...values,
});
const domain = {
  isValuationFocus: (value) => value.name !== "ordinary",
  isLimitedItem: (value) =>
    value.collection === "collab" || value.group === "Limited",
  sourceKind: (value) => (value.collection === "collab" ? "聯動" : "活動"),
  getZhName: (value) => value.name,
  getSource: (value) => value.collection,
  ongoingSeasonSlugs: new Set(),
  graduationSeasonSlugs: ["enchantment", "sanctuary"],
  seasonGraduationItems: new Map([
    [
      "enchantment",
      [
        item({ group: "Ultimate", section: "seasons" }),
        item({ group: "Ultimate", section: "seasons" }),
      ],
    ],
    ["sanctuary", [item({ group: "Ultimate", section: "seasons" })]],
  ]),
  sortSeasonSlugs: (slugs) => [...slugs].sort(),
};
const analyze = (
  chosen,
  selectedBindings = bindings(),
  bindingsConfirmed = false,
) =>
  analyzeValuation({
    chosen,
    bindings: selectedBindings,
    bindingNote: "",
    bindingsConfirmed,
    domain,
  });

test("v2 returns a price range and does not treat a pendant as graduation", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({
        name: "Enchantment Ultimate",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
      item({
        name: "Enchantment Ultimate Pendant",
        type: "Necklace",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
    ]),
  });
  assert.ok(result);
  assert.equal(result.range.currency, "TWD");
  assert.ok(result.midpoint >= result.range.low);
  assert.ok(result.midpoint <= result.range.high);
  assert.ok(result.range.high >= result.range.low);
  assert.equal(result.seasonRows[0].selected, 1);
  assert.ok(
    result.contributions.some((row) =>
      row.group === "market" && row.label.includes("季缺少畢業禮"),
    ),
  );
});

test("market anchors produce a centered, narrower reference range", () => {
  assert.deepEqual(summarizeValuationRange(15300, 46200, "high"), {
    low: 30800,
    high: 39200,
    midpoint: 35000,
  });
  assert.deepEqual(summarizeValuationRange(0, 0, "inferred"), {
    low: 0,
    high: 0,
    midpoint: 0,
  });
});

test("a canonical pack is counted once and China-only content is excluded", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({ name: "One", wiki: "https://wiki.test/Pack_Name#One" }),
      item({ name: "Two", wiki: "https://wiki.test/Pack_Name#Two" }),
      item({ name: "國服限定", group: "Limited", collection: "collab" }),
    ]),
  });
  assert.ok(result);
  assert.equal(
    result.contributions.filter((row) => row.group === "package").length,
    1,
  );
  assert.ok(result.warnings.some((warning) => warning.includes("國服限定")));
});

test("verified collaboration combos contribute once per real package", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({ name: "Cinnamoroll Ears" }),
      item({ name: "Cinnamoroll Swirled Hair" }),
      item({ name: "Cinnamoroll Cloud Cape" }),
      item({ name: "Cinnamoroll Bowtie" }),
    ]),
  });
  assert.ok(result);
  assert.equal(
    result.contributions.filter((row) => row.group === "package").length,
    2,
  );
});

test("distinct anniversary rewards in one event collection are all retained", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({ name: "4th Anniversary Hat", guid: "anniversary-4", group: "Limited" }),
      item({ name: "5th Anniversary Headband", guid: "anniversary-5", group: "Limited" }),
      item({ name: "6th Anniversary Hat", guid: "anniversary-6", group: "Limited" }),
    ]),
  });
  assert.ok(result);
  const labels = result.contributions
    .filter((row) => row.group === "limited")
    .map((row) => row.label);
  assert.ok(labels.includes("4th Anniversary Hat"));
  assert.ok(labels.includes("5th Anniversary Headband"));
  assert.ok(labels.includes("6th Anniversary Hat"));
  const netLimitedLow = result.contributions
    .filter((row) => row.group === "limited")
    .reduce((sum, row) => sum + row.low, 0);
  const netLimitedHigh = result.contributions
    .filter((row) => row.group === "limited")
    .reduce((sum, row) => sum + row.high, 0);
  assert.ok(netLimitedLow > 0);
  assert.ok(netLimitedHigh > 0);
});

test("valuation contribution labels use the catalog Chinese name", () => {
  const translatedAnalysis = analyzeValuation({
    chosen: [item({ name: "Kizuna AI Cape", wiki: "https://wiki.test/Kizuna_AI_Pack" })],
    bindings: bindings(),
    bindingNote: "",
    domain: { ...domain, getZhName: () => "絆愛雪紡斗篷" },
  });
  const result = estimateValuation({ analysis: translatedAnalysis });
  assert.ok(result);
  assert.ok(
    result.contributions.some(
      (row) => row.group === "package" && row.label === "絆愛雪紡斗篷",
    ),
  );
});

test("binding penalties are capped and platform issues remove platform value", () => {
  const platform = item({
    name: "Nintendo Cape",
    wiki: "https://wiki.test/Nintendo_Pack",
    group: "Limited",
    collection: "collab",
  });
  const safe = estimateValuation({
    analysis: analyze([platform], bindings({ nintendo: "transfer" })),
  });
  const risky = estimateValuation({
    analysis: analyze(
      [platform],
      bindings({
        nintendo: "issue",
        google: "issue",
        steam: "issue",
        twitch: "issue",
      }),
    ),
  });
  const unbound = estimateValuation({ analysis: analyze([platform]) });
  assert.ok(safe && risky);
  assert.ok(unbound);
  assert.ok(risky.range.high < safe.range.high);
  assert.equal(
    risky.contributions.filter((row) => row.group === "package").length,
    0,
  );
  assert.equal(
    unbound.contributions.filter((row) => row.group === "package").length,
    1,
  );
});

test("resource brackets preserve their explicit low and high values", () => {
  const analysis = analyze([
    item({ name: "Pack", wiki: "https://wiki.test/Pack" }),
  ]);
  const cases = [
    [200, [100, 200]],
    [500, [250, 450]],
    [1000, [500, 800]],
    [2000, [800, 1200]],
  ];
  for (const [candles, expected] of cases) {
    const result = estimateValuation({ analysis, resources: { candles } });
    const resource = result?.contributions.find(
      (row) => row.group === "resource",
    );
    assert.deepEqual(resource && [resource.low, resource.high], expected);
  }
});

test("China-only content has zero international-market value", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({ name: "國服限定斗篷", group: "Limited", collection: "collab" }),
    ]),
  });
  assert.ok(result);
  assert.deepEqual(result.range, { low: 0, high: 0, currency: "TWD" });
});

test("resources add a small capped contribution", () => {
  const result = estimateValuation({
    analysis: analyze([item({ name: "Pack", wiki: "https://wiki.test/Pack" })]),
    resources: { candles: 9000, hearts: 9000, ascended: 9000, passes: 99 },
  });
  assert.ok(result);
  const resource = result.contributions.find((row) => row.group === "resource");
  assert.deepEqual(resource && [resource.low, resource.high], [1500, 2500]);
});

test("empty resources add no value", () => {
  const result = estimateValuation({
    analysis: analyze([item({ name: "Pack", wiki: "https://wiki.test/Pack" })]),
    resources: { candles: "", hearts: "", ascended: "", passes: "" },
  });
  assert.ok(result);
  assert.equal(
    result.contributions.some((row) => row.group === "resource"),
    false,
  );
});

test("a partial season is not treated as a break and kept platform content is excluded", () => {
  const partial = item({
    name: "Enchantment Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "enchantment",
  });
  const platform = item({
    name: "PlayStation Cape",
    wiki: "https://wiki.test/PlayStation_Pack",
    group: "Limited",
    collection: "collab",
  });
  const completeNextSeason = item({
    name: "Sanctuary Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "sanctuary",
  });
  const result = estimateValuation({
    analysis: analyze(
      [partial, completeNextSeason, platform],
      bindings({ playstation: "keep" }),
    ),
  });
  assert.ok(result);
  assert.equal(result.marketProfile.breakClass, "none");
  assert.equal(result.marketProfile.partialSeasons, 1);
  assert.equal(
    result.contributions.some(
      (row) => row.group === "market" && row.label.includes("缺少畢業禮"),
    ),
    false,
  );
  assert.equal(
    result.contributions.some((row) => row.group === "package"),
    false,
  );
  assert.ok(result.warnings.some((warning) => warning.includes("playstation")));
});

test("partial graduation is below full graduation without a second break penalty", () => {
  const firstUltimate = item({
    name: "Enchantment Ultimate 1",
    group: "Ultimate",
    section: "seasons",
    collection: "enchantment",
  });
  const secondUltimate = item({
    name: "Enchantment Ultimate 2",
    group: "Ultimate",
    section: "seasons",
    collection: "enchantment",
  });
  const nextUltimate = item({
    name: "Sanctuary Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "sanctuary",
  });
  const partial = estimateValuation({
    analysis: analyze([firstUltimate, nextUltimate]),
  });
  const complete = estimateValuation({
    analysis: analyze([firstUltimate, secondUltimate, nextUltimate]),
  });
  assert.ok(partial && complete);
  assert.equal(partial.marketProfile.breakClass, "none");
  assert.equal(partial.marketProfile.partialSeasons, 1);
  assert.ok(partial.midpoint < complete.midpoint);
  assert.equal(
    partial.contributions.some((row) => row.label.includes("缺少畢業禮")),
    false,
  );
  assert.ok(
    partial.contributions.some((row) => row.label === "未完成畢業禮"),
  );
});

test("market package tier uses paid item count while package value stays deduplicated", () => {
  const items = Array.from({ length: 100 }, (_, index) =>
    item({
      name: `Same Pack Item ${index}`,
      wiki: "https://wiki.test/Shared_Pack",
    }),
  );
  const result = estimateValuation({ analysis: analyze(items) });
  assert.ok(result);
  assert.equal(result.marketProfile.paidItemCount, 100);
  assert.equal(result.marketProfile.canonicalPackageCount, 1);
  assert.equal(result.marketProfile.packageTier, "hundred");
  assert.equal(
    result.contributions.filter((row) => row.group === "package").length,
    1,
  );
});

test("modern multi-pack accounts use diminishing bundled resale value", () => {
  const paid = Array.from({ length: 48 }, (_, index) =>
    item({
      name: `Modern Pack ${index}`,
      wiki: `https://wiki.test/Modern_Pack_${index}`,
    }),
  );
  const result = estimateValuation({ analysis: analyze(paid) });
  assert.ok(result);
  assert.equal(result.marketProfile.packageTier, "many");
  const packageTotal = result.contributions
    .filter((row) => row.group === "package" && row.low > 0)
    .reduce((sum, row) => sum + row.low, 0);
  assert.ok(packageTotal >= 500);
  assert.ok(packageTotal <= 2000);
});

test("package calibration stays monotonic across tier boundaries", () => {
  const { classifyPackageTier, packageValueCap } = calibrationLoaded;
  for (const [before, after] of [[14, 15], [39, 40], [99, 100]]) {
    const priorTier = classifyPackageTier(before);
    const nextTier = classifyPackageTier(after);
    const priorCap = packageValueCap(before);
    const nextCap = packageValueCap(after);
    const priorSignal =
      priorTier.premium *
      marketAggregate.modifiers.packageTier[priorTier.key].multiplier;
    const nextSignal =
      nextTier.premium *
      marketAggregate.modifiers.packageTier[nextTier.key].multiplier;
    assert.ok(nextSignal >= priorSignal);
    assert.ok(nextSignal <= priorSignal * 1.15);
    assert.ok(nextCap.low >= priorCap.low);
    assert.ok(nextCap.high >= priorCap.high);
    assert.ok(nextCap.high <= priorCap.high * 1.15);
  }
});

test("confirmed all-none bindings count as complete account information", () => {
  const unconfirmed = analyze([item({ wiki: "https://wiki.test/Pack" })]);
  const confirmed = analyze([item({ wiki: "https://wiki.test/Pack" })], bindings(), true);
  assert.ok(confirmed.completeness > unconfirmed.completeness);
  assert.equal(confirmed.bindingsConfirmed, true);
});

test("listing-only start-season evidence is never presented as a completed sale", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({
        name: "Enchantment Ultimate 1",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
      item({
        name: "Enchantment Ultimate 2",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
    ]),
  });
  assert.ok(result);
  assert.equal(result.marketProfile.priceStage, "刊登樣本");
  assert.notEqual(result.marketProfile.evidenceQuality, "strong");
});

test("listing-only evidence can never produce the highest confidence", () => {
  const result = estimateValuation({
    analysis: analyze([
      item({
        name: "Prophecy Ultimate 1",
        group: "Ultimate",
        section: "seasons",
        collection: "prophecy",
      }),
    ]),
  });
  assert.ok(result);
  assert.equal(result.marketProfile.priceStage, "刊登樣本");
  assert.notEqual(result.confidence, "high");
});

test("unbound platform items count while unavailable paid items do not", () => {
  const transferable = Array.from({ length: 14 }, (_, index) =>
    item({
      name: `Pack ${index}`,
      wiki: `https://wiki.test/Pack_${index}`,
    }),
  );
  const excluded = [
    item({
      name: "Nintendo Pack",
      wiki: "https://wiki.test/Nintendo_Pack",
    }),
    item({
      name: "國服限定 Pack",
      wiki: "https://wiki.test/China_Pack",
    }),
  ];
  const baseline = estimateValuation({ analysis: analyze(transferable) });
  const mixed = estimateValuation({
    analysis: analyze([...transferable, ...excluded]),
  });

  assert.ok(baseline && mixed);
  assert.equal(baseline.marketProfile.paidItemCount, 14);
  assert.equal(mixed.marketProfile.paidItemCount, 15);
  assert.equal(baseline.marketProfile.packageTier, "few");
  assert.equal(mixed.marketProfile.packageTier, "medium");
  const mixedPackageLabels = mixed.contributions
    .filter((row) => row.group === "package")
    .map((row) => row.label);
  assert.ok(mixedPackageLabels.includes("Nintendo Pack"));
  assert.equal(mixedPackageLabels.includes("國服限定 Pack"), false);

  const unavailable = estimateValuation({
    analysis: analyze([...transferable, ...excluded], bindings({ nintendo: "keep" })),
  });
  assert.ok(unavailable);
  assert.equal(unavailable.marketProfile.paidItemCount, 14);
  assert.equal(unavailable.marketProfile.packageTier, "few");
});
