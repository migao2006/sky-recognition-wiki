import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";
import { loadValuationRuntime } from "../scripts/load-valuation-runtime.mjs";

const calibrationLoaded = await tsImport(
  "../app/valuation-calibration.ts",
  import.meta.url,
);
const marketModule = await tsImport(
  "../app/market-collectibles.ts",
  import.meta.url,
);
const marketGuidByName = new Map(
  marketModule.importantMarketCollectibles.flatMap((profile) =>
    [profile.name, ...profile.aliases].map((name) => [name, profile.guid]),
  ),
);
const loaded = await loadValuationRuntime();
const marketAggregate = JSON.parse(
  await readFile(
    new URL("../app/valuation-market-aggregate.json", import.meta.url),
    "utf8",
  ),
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
  guid: marketGuidByName.get(values.name) ?? values.guid ?? `test-${values.name ?? "item"}`,
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
    item({
      name: "Enchantment Ultimate",
      group: "Ultimate",
      section: "seasons",
      collection: "enchantment",
    }),
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
    analysis: analyze([
      item({
        name: "Enchantment Ultimate",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
      item({ name: "Pack", wiki: "https://wiki.test/Pack" }),
    ]),
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
  const partialAnalysis = analyze([firstUltimate, nextUltimate]);
  const partial = estimateValuation({ analysis: partialAnalysis });
  const complete = estimateValuation({
    analysis: analyze([firstUltimate, secondUltimate, nextUltimate]),
  });
  assert.ok(partial && complete);
  assert.equal(partialAnalysis.startSeasonSlug, "enchantment");
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

test("market package tier and value count one real package only once", () => {
  const items = Array.from({ length: 100 }, (_, index) =>
    item({
      name: `Same Pack Item ${index}`,
      wiki: "https://wiki.test/Shared_Pack",
    }),
  );
  const result = estimateValuation({
    analysis: analyze([
      item({
        name: "Enchantment Ultimate",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
      ...items,
    ]),
  });
  const singleItemResult = estimateValuation({
    analysis: analyze([
      item({
        name: "Enchantment Ultimate",
        group: "Ultimate",
        section: "seasons",
        collection: "enchantment",
      }),
      items[0],
    ]),
  });
  assert.ok(result);
  assert.ok(singleItemResult);
  assert.equal(result.marketProfile.paidItemCount, 100);
  assert.equal(result.marketProfile.canonicalPackageCount, 1);
  assert.equal(result.marketProfile.packageTier, "few");
  assert.equal(result.marketProfile.salePackageTier, "few");
  assert.equal(result.marketProfile.accountStyle, "simple");
  assert.deepEqual(result.range, singleItemResult.range);
  assert.equal(result.midpoint, singleItemResult.midpoint);
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
  assert.equal(result.marketProfile.salePackageTier, "few");
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

test("sale package wording uses conservative unique-package thresholds", () => {
  const { classifySalePackageTier } = calibrationLoaded;
  assert.equal(classifySalePackageTier(0).key, "few");
  assert.equal(classifySalePackageTier(59).key, "few");
  assert.equal(classifySalePackageTier(60).key, "medium");
  assert.equal(classifySalePackageTier(89).key, "medium");
  assert.equal(classifySalePackageTier(90).key, "many");
  assert.equal(classifySalePackageTier(189).key, "many");
});

test("recent-season accounts use conservative add-on caps", () => {
  const { packageValueCap, limitedValueCap } = calibrationLoaded;
  assert.deepEqual(packageValueCap(54, { conservative: true }), {
    low: 700,
    high: 1000,
  });
  assert.deepEqual(limitedValueCap(21, { conservative: true }), {
    low: 300,
    high: 500,
  });
  assert.deepEqual(packageValueCap(54), { low: 1920, high: 2620 });
  assert.deepEqual(limitedValueCap(21), { low: 700, high: 1200 });
});

test("Moments-or-later starts cap resources without changing early accounts", () => {
  const momentsUltimate = item({
    name: "Moments Ultimate",
    group: "Ultimate",
    section: "seasons",
    collection: "moments",
  });
  const recentDomain = {
    ...domain,
    graduationSeasonSlugs: ["enchantment", "sanctuary", "moments"],
    seasonGraduationItems: new Map([
      ...domain.seasonGraduationItems,
      ["moments", [momentsUltimate]],
    ]),
  };
  const paid = Array.from({ length: 54 }, (_, index) =>
    item({
      name: `Recent Pack ${index}`,
      wiki: `https://wiki.test/Recent_Pack_${index}`,
    }),
  );
  const limited = Array.from({ length: 21 }, (_, index) =>
    item({ name: `Recent Limited ${index}`, group: "Limited" }),
  );
  const recentAnalysis = analyzeValuation({
    chosen: [momentsUltimate, ...paid, ...limited],
    bindings: bindings(),
    bindingNote: "",
    domain: recentDomain,
  });
  const earlyAnalysis = analyze([
    item({
      name: "Enchantment Ultimate",
      group: "Ultimate",
      section: "seasons",
      collection: "enchantment",
    }),
  ]);
  const resources = { candles: 3000, hearts: 800, ascended: 200, passes: 5 };
  const recent = estimateValuation({ analysis: recentAnalysis, resources });
  const early = estimateValuation({ analysis: earlyAnalysis, resources });
  assert.equal(recentAnalysis.conservativeAddOnCaps, true);
  assert.equal(earlyAnalysis.conservativeAddOnCaps, false);
  assert.deepEqual(
    recent.contributions.find((row) => row.group === "resource"),
    { group: "resource", label: "帳號資源", low: 250, high: 400 },
  );
  assert.deepEqual(
    early.contributions.find((row) => row.group === "resource"),
    { group: "resource", label: "帳號資源", low: 1500, high: 2500 },
  );
  const contributionTotal = (group, side) =>
    recent.contributions
      .filter((row) => row.group === group)
      .reduce((sum, row) => sum + row[side], 0);
  assert.equal(contributionTotal("package", "low"), 700);
  assert.equal(contributionTotal("package", "high"), 1000);
  assert.equal(contributionTotal("limited", "low"), 300);
  assert.equal(contributionTotal("limited", "high"), 500);
  assert.ok(recent.midpoint >= recent.range.low);
  assert.ok(recent.midpoint <= recent.range.high);
});

test("season evidence selects conservative caps at the Moments boundary", () => {
  const seasonItem = (slug, type = "Cape") =>
    item({
      name: `${slug} Ultimate${type === "Necklace" ? " Pendant" : ""}`,
      type,
      group: "Ultimate",
      section: "seasons",
      collection: slug,
    });
  const passage = seasonItem("passage");
  const momentsPendant = seasonItem("moments", "Necklace");
  const revivalPendant = seasonItem("revival", "Necklace");
  const currentUltimate = seasonItem("dear-van-gogh");
  const ageDomain = {
    ...domain,
    ongoingSeasonSlugs: new Set(["dear-van-gogh"]),
    graduationSeasonSlugs: ["passage", "moments", "revival"],
    seasonGraduationItems: new Map([
      ["passage", [passage]],
      ["moments", [seasonItem("moments")]],
      ["revival", [seasonItem("revival")]],
    ]),
    sortSeasonSlugs: (slugs) =>
      [...slugs].sort(
        (left, right) =>
          ["passage", "moments", "revival", "dear-van-gogh"].indexOf(left) -
          ["passage", "moments", "revival", "dear-van-gogh"].indexOf(right),
      ),
  };
  const analyzeAge = (chosen) =>
    analyzeValuation({
      chosen,
      bindings: bindings(),
      bindingNote: "",
      domain: ageDomain,
    });
  assert.equal(analyzeAge([passage]).conservativeAddOnCaps, false);
  assert.equal(analyzeAge([momentsPendant]).conservativeAddOnCaps, true);
  assert.equal(analyzeAge([revivalPendant]).conservativeAddOnCaps, true);
  assert.equal(
    analyzeAge([seasonItem("moments"), seasonItem("passage", "Necklace")])
      .conservativeAddOnCaps,
    true,
  );
  assert.equal(analyzeAge([currentUltimate]).conservativeAddOnCaps, true);
  assert.equal(
    analyzeAge([item({ wiki: "https://wiki.test/Recent_Pack" })])
      .conservativeAddOnCaps,
    true,
  );
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
    ...Array.from({ length: 4 }, (_, index) => item({
      name: `Nintendo Pack Item ${index}`,
      wiki: "https://wiki.test/Nintendo_Pack",
    })),
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
  assert.equal(mixed.marketProfile.paidItemCount, 18);
  assert.equal(mixed.marketProfile.canonicalPackageCount, 15);
  assert.equal(baseline.marketProfile.packageTier, "few");
  assert.equal(mixed.marketProfile.packageTier, "medium");
  const mixedPackageLabels = mixed.contributions
    .filter((row) => row.group === "package")
    .map((row) => row.label);
  assert.equal(
    mixedPackageLabels.filter((label) => label.startsWith("Nintendo Pack Item")).length,
    1,
  );
  assert.equal(mixedPackageLabels.includes("國服限定 Pack"), false);

  const unavailable = estimateValuation({
    analysis: analyze([...transferable, ...excluded], bindings({ nintendo: "keep" })),
  });
  assert.ok(unavailable);
  assert.equal(unavailable.marketProfile.paidItemCount, 14);
  assert.equal(unavailable.marketProfile.canonicalPackageCount, 14);
  assert.equal(unavailable.marketProfile.packageTier, "few");
});
