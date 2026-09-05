import {
  accountResourceAmount,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import {
  classifyPackageTier,
  classifySalePackageTier,
  limitedValueCap,
  packageValueCap,
  type SalePackageTierKey,
} from "./valuation-calibration";
import {
  classifyAccountStyle,
  classifyBreakClass,
  marketAccountStyleMultiplier,
  marketBreakMultiplier,
  marketPackageMultiplier,
  marketValidation,
  valuationMarketAggregate,
  type MarketAccountStyle,
  type MarketBreakClass,
  type PackageTierKey,
} from "./valuation-market";
import {
  canonicalPackageKey,
  isChinaOnlyItem,
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  limitedItemKind,
  packageValuationMultiplier,
  platformBindingForItem,
} from "./valuation-items";
import {
  seasonBandBySlug,
  type SeasonConfidence,
  type SeasonPriceBand,
} from "./valuation-season-bands";
import type { WikiItem } from "./wiki-data";
import { calculateValuationModel } from "./valuation-model-core.js";
import {
  adjustConfidenceForEvidence,
  valuationEvidenceProfile,
} from "./valuation-season-band-core.js";

export type ValuationDomain = {
  isValuationFocus: (item: WikiItem) => boolean;
  isLimitedItem: (item: WikiItem) => boolean;
  ongoingSeasonSlugs: ReadonlySet<string>;
  graduationSeasonSlugs: readonly string[];
  seasonGraduationItems: ReadonlyMap<string, readonly WikiItem[]>;
  sortSeasonSlugs: (slugs: string[]) => string[];
  getZhName: (item: WikiItem) => string;
};
export type ValuationResources = {
  candles?: string | number;
  hearts?: string | number;
  ascended?: string | number;
  passes?: string | number;
};
export type ValuationContribution = {
  group: "season" | "package" | "limited" | "binding" | "resource" | "market";
  label: string;
  low: number;
  high: number;
  percent?: number;
};
export type ValuationSeasonRow = SeasonPriceBand & {
  selected: number;
  expected: number;
  completion: number;
};
export type ValuationModelFeatures = {
  baseLow: number;
  baseHigh: number;
  breakMultiplier: number;
  partialDiscountLow: number;
  partialDiscountHigh: number;
  packageLow: number;
  packageHigh: number;
  packageMarketMultiplier: number;
  limitedLow: number;
  limitedHigh: number;
  resourceLow: number;
  resourceHigh: number;
  accountStyleMultiplier: number;
  bindingRisk: number;
  transferHighMultiplier: number;
  confidence: SeasonConfidence;
};
export type ValuationEstimate = {
  range: { low: number; high: number; currency: "TWD" };
  midpoint: number;
  confidence: SeasonConfidence;
  contributions: ValuationContribution[];
  warnings: string[];
  seasonRows: ValuationSeasonRow[];
  /** Exact numeric inputs used by the browser calculation for model replay. */
  modelFeatures?: ValuationModelFeatures;
  marketProfile: {
    breakClass: MarketBreakClass;
    packageTier: PackageTierKey;
    salePackageTier: SalePackageTierKey;
    accountStyle: MarketAccountStyle;
    missingSeasons: number;
    partialSeasons: number;
    completionRatio: number;
    effectiveSample: number;
    paidItemCount: number;
    canonicalPackageCount: number;
    evidenceQuality: "strong" | "mixed" | "limited";
    priceStage: "成交樣本" | "刊登樣本" | "混合參考" | "低資訊參考";
    sourceConcentration: number;
  };
};
export type ValuationAnalysis = {
  valuationItems: WikiItem[];
  ultimates: WikiItem[];
  pendants: WikiItem[];
  packages: WikiItem[];
  limited: WikiItem[];
  startSeasonSlug: string | null;
  conservativeAddOnCaps: boolean;
  seasonCompletion: ReadonlyMap<string, { selected: number; expected: number }>;
  completeness: number;
  issueCount: number;
  keepCount: number;
  bindings: Record<string, BindingStatus>;
  bindingsConfirmed?: boolean;
  getZhName: (item: WikiItem) => string;
};

export { summarizeValuationRange } from "./valuation-model-core.js";
const roundHundred = (value: number) => Math.round(value / 100) * 100;

export const analyzeValuation = ({
  chosen,
  bindings,
  bindingNote,
  bindingsConfirmed = false,
  domain,
}: {
  chosen: WikiItem[];
  bindings: Record<BindingKey | string, BindingStatus>;
  bindingNote: string;
  bindingsConfirmed?: boolean;
  domain: ValuationDomain;
}): ValuationAnalysis => {
  const valuationItems = chosen.filter(domain.isValuationFocus);
  const ultimates = chosen.filter(isGraduationGift);
  const pendants = chosen.filter(isSeasonPendant);
  const packages = chosen.filter(isPaidItem);
  const limited = chosen.filter(domain.isLimitedItem);
  const ultimateSeasonSlugs = domain.sortSeasonSlugs([
    ...new Set(
      ultimates
        .filter((item) => !domain.ongoingSeasonSlugs.has(item.collection))
        .map((item) => item.collection),
    ),
  ]);
  const startSeasonSlug = ultimateSeasonSlugs[0] || null;
  const startIndex = startSeasonSlug
    ? domain.graduationSeasonSlugs.indexOf(startSeasonSlug)
    : -1;
  const recentStartIndex = domain.graduationSeasonSlugs.indexOf("moments");
  const fallbackSeasonEvidence = domain.sortSeasonSlugs([
    ...new Set([...pendants, ...ultimates].map((item) => item.collection)),
  ])[0];
  // The earliest season with graduation-reward progress is the primary
  // market-age signal. Pendants only provide a fallback when no graduation
  // reward is selected; partial progress is discounted later and is not a break.
  const accountAgeEvidence = startSeasonSlug ?? fallbackSeasonEvidence;
  const evidenceIndex = accountAgeEvidence
    ? domain.graduationSeasonSlugs.indexOf(accountAgeEvidence)
    : -1;
  const conservativeAddOnCaps =
    !accountAgeEvidence ||
    domain.ongoingSeasonSlugs.has(accountAgeEvidence) ||
    evidenceIndex < 0 ||
    (recentStartIndex >= 0 && evidenceIndex >= recentStartIndex);
  const expectedSlugs =
    startIndex >= 0 ? domain.graduationSeasonSlugs.slice(startIndex) : [];
  const seasonCompletion = new Map(
    expectedSlugs.map((slug) => {
      const expected =
        domain.seasonGraduationItems.get(slug)?.filter(isGraduationGift)
          .length ?? 0;
      const selected = ultimates.filter(
        (item) => item.collection === slug,
      ).length;
      return [slug, { selected, expected }];
    }),
  );
  const statuses = Object.values(bindings);
  const reviewed =
    bindingsConfirmed ||
    statuses.some((status) => status !== "none") ||
    Boolean(bindingNote.trim());
  return {
    valuationItems,
    ultimates,
    pendants,
    packages,
    limited,
    startSeasonSlug,
    conservativeAddOnCaps,
    seasonCompletion,
    completeness: Math.round(
      ([
        Boolean(startSeasonSlug),
        valuationItems.length > 0,
        packages.length > 0 || limited.length > 0,
        reviewed,
      ].filter(Boolean).length /
        4) *
        100,
    ),
    issueCount: statuses.filter((status) => status === "issue").length,
    keepCount: statuses.filter((status) => status === "keep").length,
    bindings: bindings as Record<string, BindingStatus>,
    bindingsConfirmed,
    getZhName: domain.getZhName,
  };
};

const resourceValue = (
  resources: ValuationResources | undefined,
  conservative = false,
) => {
  const tier = (
    value: number,
    thresholds: readonly [number, number, number][],
  ) =>
    thresholds.reduce<[number, number]>(
      (result, [minimum, low, high]) =>
        value >= minimum ? [low, high] : result,
      [0, 0],
    );
  const values = [
    tier(accountResourceAmount(resources?.candles, "candles"), [
      [200, 100, 200],
      [500, 250, 450],
      [1000, 500, 800],
      [2000, 800, 1200],
    ]),
    tier(accountResourceAmount(resources?.hearts, "hearts"), [
      [50, 100, 200],
      [200, 200, 400],
      [500, 400, 700],
    ]),
    tier(accountResourceAmount(resources?.ascended, "ascended"), [
      [20, 50, 100],
      [50, 100, 200],
      [100, 200, 350],
    ]),
    [
      Math.min(accountResourceAmount(resources?.passes, "passes"), 5) * 80,
      Math.min(accountResourceAmount(resources?.passes, "passes"), 5) * 150,
    ],
  ];
  return {
    low: Math.min(
      values.reduce((sum, value) => sum + value[0], 0),
      conservative ? 250 : 1500,
    ),
    high: Math.min(
      values.reduce((sum, value) => sum + value[1], 0),
      conservative ? 400 : 2500,
    ),
  };
};

const isPlatformTransferable = (
  item: WikiItem,
  bindings: Readonly<Record<string, BindingStatus>>,
  warnings: string[],
  label: string,
) => {
  const platform = platformBindingForItem(item);
  if (
    !platform ||
    bindings[platform] === "none" ||
    bindings[platform] === "transfer"
  )
    return true;
  warnings.push(`${platform} 未標示可出或綁定異常，該平台${label}不列入參考價格。`);
  return false;
};

export const estimateValuation = ({
  analysis,
  resources,
}: {
  analysis: ValuationAnalysis;
  resources?: ValuationResources;
}): ValuationEstimate | null => {
  if (!analysis.valuationItems.length) return null;
  if (!analysis.valuationItems.some((item) => !isChinaOnlyItem(item))) {
    return {
      range: { low: 0, high: 0, currency: "TWD" },
      midpoint: 0,
      confidence: "inferred",
      contributions: [],
      warnings: ["國服限定物品不列入國際服參考價格。"],
      seasonRows: [],
      marketProfile: {
        breakClass: "big",
        packageTier: "few",
        salePackageTier: "few",
        accountStyle: "simple",
        missingSeasons: 0,
        partialSeasons: 0,
        completionRatio: 0,
        effectiveSample: 0,
        paidItemCount: 0,
        canonicalPackageCount: 0,
        evidenceQuality: "limited",
        priceStage: "低資訊參考",
        sourceConcentration: 1,
      },
    };
  }
  const warnings: string[] = [];
  const contributions: ValuationContribution[] = [];
  const seasonRows = [...analysis.seasonCompletion.keys()].flatMap((slug) => {
    const band = seasonBandBySlug.get(slug);
    if (!band) return [];
    const state = analysis.seasonCompletion.get(slug) ?? {
      selected: 0,
      expected: 0,
    };
    return [
      {
        ...band,
        ...state,
        completion: state.expected ? state.selected / state.expected : 0,
      },
    ];
  });
  let low = 500;
  let high = 1200;
  const startBand = analysis.startSeasonSlug
    ? seasonBandBySlug.get(analysis.startSeasonSlug)
    : undefined;
  if (startBand) {
    low = startBand.low;
    high = startBand.high;
    contributions.push({
      group: "season",
      label: "起始畢業季基準",
      low,
      high,
    });
  } else if (analysis.startSeasonSlug)
    warnings.push("最早畢業季不在目前的市場樣本範圍，已使用保守基準。");
  const baseLow = low;
  const baseHigh = high;
  const breakProfile = classifyBreakClass(analysis.seasonCompletion);
  const breakMultiplier = marketBreakMultiplier(breakProfile.key);
  if (breakMultiplier !== 1)
    contributions.push({
      group: "market",
      label: `${breakProfile.missingSeasons} 季缺少畢業禮`,
      low: 0,
      high: 0,
      percent: Math.round((breakMultiplier - 1) * 100),
    });
  const partialSeasonDiscount = seasonRows.reduce(
    (total, row) => {
      if (!row.selected || row.selected >= row.expected) return total;
      const missingRatio = Math.max(0, 1 - row.completion);
      return {
        low: total.low + row.contributionLow * missingRatio,
        high: total.high + row.contributionHigh * missingRatio,
      };
    },
    { low: 0, high: 0 },
  );
  if (partialSeasonDiscount.low || partialSeasonDiscount.high) {
    contributions.push({
      group: "season",
      label: "未完成畢業禮",
      low: -roundHundred(partialSeasonDiscount.low),
      high: -roundHundred(partialSeasonDiscount.high),
    });
  }
  const packageMap = new Map<string, WikiItem>();
  // Keep the raw item count for diagnostics, but price tiers and caps must use
  // one entry per real package. Multi-item sets otherwise cross tier boundaries
  // merely because one purchase contains several catalog records.
  const transferablePaidItems = analysis.packages.filter((item) => {
    if (isChinaOnlyItem(item)) {
      warnings.push("國服限定物品不列入國際服參考價格。");
      return false;
    }
    if (!isPlatformTransferable(item, analysis.bindings, warnings, "物品"))
      return false;
    return true;
  });
  const paidItemCount = transferablePaidItems.length;
  transferablePaidItems.forEach((item) => {
    const key = canonicalPackageKey(item);
    if (key) packageMap.set(key, item);
  });
  const canonicalPackageCount = packageMap.size;
  const packageTier = classifyPackageTier(canonicalPackageCount);
  const salePackageTier = classifySalePackageTier(canonicalPackageCount);
  const packageMarketMultiplier = marketPackageMultiplier(packageTier.key);
  const packageWeightTotal = [...packageMap.values()].reduce(
    (sum, item) => sum + packageValuationMultiplier(item),
    0,
  );
  for (const item of packageMap.values()) {
    const multiplier = packageValuationMultiplier(item);
    const base = packageWeightTotal
      ? (packageTier.premium * packageMarketMultiplier * multiplier) /
        packageWeightTotal
      : 0;
    contributions.push({
      group: "package",
      label: analysis.getZhName(item),
      low: Math.round(base * 0.7),
      high: Math.round(base * 1.15),
    });
  }
  const packageKeys = new Set(packageMap.keys());
  const limitedKeys = new Set<string>();
  for (const item of analysis.limited) {
    if (isChinaOnlyItem(item)) {
      warnings.push("國服限定物品不列入國際服參考價格。");
      continue;
    }
    const packageKey = canonicalPackageKey(item);
    if (packageKey && packageKeys.has(packageKey)) continue;
    const kind = limitedItemKind(item);
    if (!isPlatformTransferable(item, analysis.bindings, warnings, "限定"))
      continue;
    // A collection is an event series, not a single collectible. For example,
    // the 4th, 5th and 6th anniversary rewards share one collection but are
    // separate limited items. Real paid bundles were already deduplicated by
    // canonicalPackageKey above, so only collapse duplicate catalog records here.
    const key = `${kind}:${item.guid || item.name}`;
    if (limitedKeys.has(key)) continue;
    limitedKeys.add(key);
    const [itemLow, itemHigh] =
      kind === "permanent"
        ? [300, 800]
        : kind === "platform"
          ? [200, 500]
          : kind === "annual"
            ? [100, 300]
            : [100, 250];
    contributions.push({
      group: "limited",
      label: analysis.getZhName(item),
      low: itemLow,
      high: itemHigh,
    });
  }
  const packageRows = contributions.filter((row) => row.group === "package");
  const limitedRows = contributions.filter((row) => row.group === "limited");
  const rawPackageLow = packageRows.reduce(
    (sum, row) => sum + Math.max(0, row.low),
    0,
  );
  const rawPackageHigh = packageRows.reduce(
    (sum, row) => sum + Math.max(0, row.high),
    0,
  );
  const rawLimitedLow = limitedRows.reduce(
    (sum, row) => sum + Math.max(0, row.low),
    0,
  );
  const rawLimitedHigh = limitedRows.reduce(
    (sum, row) => sum + Math.max(0, row.high),
    0,
  );
  const capContext = { conservative: analysis.conservativeAddOnCaps };
  const packageCap = packageValueCap(canonicalPackageCount, capContext);
  const limitedCap = limitedValueCap(limitedKeys.size, capContext);
  const packageLow = Math.min(rawPackageLow, packageCap.low);
  const packageHigh = Math.min(rawPackageHigh, packageCap.high);
  const limitedLow = Math.min(rawLimitedLow, limitedCap.low);
  const limitedHigh = Math.min(rawLimitedHigh, limitedCap.high);
  if (rawPackageLow > packageLow || rawPackageHigh > packageHigh) {
    contributions.push({
      group: "package",
      label: "禮包加值上限",
      low: packageLow - rawPackageLow,
      high: packageHigh - rawPackageHigh,
    });
  }
  if (rawLimitedLow > limitedLow || rawLimitedHigh > limitedHigh) {
    contributions.push({
      group: "limited",
      label: "限定加值上限",
      low: limitedLow - rawLimitedLow,
      high: limitedHigh - rawLimitedHigh,
    });
  }
  const resource = resourceValue(resources, analysis.conservativeAddOnCaps);
  if (resource.low || resource.high)
    contributions.push({ group: "resource", label: "帳號資源", ...resource });
  const accountStyle = classifyAccountStyle({
    paidItemCount: canonicalPackageCount,
    graduationCount: analysis.ultimates.length,
    seasonCount: analysis.seasonCompletion.size,
  });
  const accountStyleMultiplier = marketAccountStyleMultiplier(accountStyle);
  if (accountStyleMultiplier !== 1)
    contributions.push({
      group: "market",
      label: "簡號市場區間",
      low: 0,
      high: 0,
      percent: Math.round((accountStyleMultiplier - 1) * 100),
    });
  const risk =
    Math.max(0.7, 1 - analysis.issueCount * 0.1) *
    Math.max(0.84, 1 - analysis.keepCount * 0.04);
  if (risk < 1)
    contributions.push({
      group: "binding",
      label: "綁定限制",
      low: 0,
      high: 0,
      percent: Math.round((risk - 1) * 100),
    });
  if (
    Object.values(analysis.bindings).some((value) => value === "transfer") &&
    !analysis.issueCount &&
    !analysis.keepCount
  ) {
    contributions.push({
      group: "binding",
      label: "可出綁定",
      low: 0,
      high: 0,
      percent: 3,
    });
  }
  const startEvidence = analysis.startSeasonSlug
    ? valuationMarketAggregate.segments.startSeason[
        analysis.startSeasonSlug as keyof typeof valuationMarketAggregate.segments.startSeason
      ]
    : undefined;
  const evidenceProfile = valuationEvidenceProfile({
    aggregate: valuationMarketAggregate,
    evidence: startEvidence,
  });
  const confidence = adjustConfidenceForEvidence({
    aggregate: valuationMarketAggregate,
    confidence: startBand?.confidence ?? "inferred",
    evidence: startEvidence,
    validated: marketValidation.isValidated,
  }) as SeasonConfidence;
  const transferHighMultiplier =
    Object.values(analysis.bindings).some((value) => value === "transfer") &&
    !analysis.issueCount &&
    !analysis.keepCount
      ? 1.03
      : 1;
  const modelFeatures: ValuationModelFeatures = {
    baseLow,
    baseHigh,
    breakMultiplier,
    partialDiscountLow: partialSeasonDiscount.low,
    partialDiscountHigh: partialSeasonDiscount.high,
    packageLow,
    packageHigh,
    limitedLow,
    limitedHigh,
    resourceLow: resource.low,
    resourceHigh: resource.high,
    accountStyleMultiplier,
    bindingRisk: risk,
    transferHighMultiplier,
    confidence,
    packageMarketMultiplier,
  };
  const summary = calculateValuationModel(modelFeatures);
  if (!analysis.startSeasonSlug)
    warnings.push("未辨識到完整畢業季，參考價格採禮包／限定保守基準。");
  if (!marketValidation.isValidated)
    warnings.push("市場資料尚未通過完整模型驗證，目前為參考估價。");
  return {
    range: { low: summary.low, high: summary.high, currency: "TWD" },
    midpoint: summary.midpoint,
    confidence,
    contributions,
    warnings: [...new Set(warnings)],
    seasonRows,
    modelFeatures,
    marketProfile: {
      breakClass: breakProfile.key,
      packageTier: packageTier.key,
      salePackageTier: salePackageTier.key,
      accountStyle,
      missingSeasons: breakProfile.missingSeasons,
      partialSeasons: breakProfile.partialSeasons,
      completionRatio: breakProfile.completionRatio,
      effectiveSample: startEvidence?.sampleCount ?? 0,
      paidItemCount,
      canonicalPackageCount,
      ...evidenceProfile,
    },
  };
};
