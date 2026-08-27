import { type BindingKey, type BindingStatus } from "./account-config";
import { classifyPackageTier } from "./valuation-calibration";
import {
  canonicalPackageKey,
  isChinaOnlyItem,
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  limitedItemKind,
  platformBindingForItem,
} from "./valuation-items";
import {
  seasonBandBySlug,
  valuationSampleSummary,
  type SeasonConfidence,
  type SeasonPriceBand,
} from "./valuation-season-bands";
import type { WikiItem } from "./wiki-data";

export type ValuationDomain = {
  isValuationFocus: (item: WikiItem) => boolean;
  isLimitedItem: (item: WikiItem) => boolean;
  sourceKind: (item: WikiItem) => string;
  ongoingSeasonSlugs: ReadonlySet<string>;
  graduationSeasonSlugs: readonly string[];
  seasonGraduationItems: ReadonlyMap<string, readonly WikiItem[]>;
  sortSeasonSlugs: (slugs: string[]) => string[];
};
export type ValuationResources = {
  candles?: string | number;
  hearts?: string | number;
  ascended?: string | number;
  passes?: string | number;
};
export type ValuationContribution = {
  group: "season" | "package" | "limited" | "binding" | "resource";
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
export type ValuationEstimate = {
  range: { low: number; high: number; currency: "TWD" };
  midpoint: number;
  confidence: SeasonConfidence;
  contributions: ValuationContribution[];
  warnings: string[];
  seasonRows: ValuationSeasonRow[];
  dataAsOf: string;
};
export type ValuationAnalysis = {
  valuationItems: WikiItem[];
  ultimates: WikiItem[];
  pendants: WikiItem[];
  packages: WikiItem[];
  collabs: WikiItem[];
  limited: WikiItem[];
  ultimateSeasonSlugs: string[];
  startSeasonSlug: string | null;
  missingSeasonSlugs: string[];
  partialSeasonSlugs: string[];
  seasonCompletion: ReadonlyMap<string, { selected: number; expected: number }>;
  completeness: number;
  issueCount: number;
  keepCount: number;
  bindings: Record<string, BindingStatus>;
};

const roundHundred = (value: number) => Math.round(value / 100) * 100;
const roundFiveHundred = (value: number) => Math.round(value / 500) * 500;

export const summarizeValuationRange = (
  rawLow: number,
  rawHigh: number,
  confidence: SeasonConfidence,
) => {
  if (rawHigh <= 0) return { low: 0, high: 0, midpoint: 0 };

  // Listing prices usually sit above realized transactions. A 64% position
  // between quick-sale and listing anchors best represents the reference set.
  const midpoint = roundFiveHundred(rawLow + (rawHigh - rawLow) * 0.64);
  const spread =
    confidence === "high"
      ? 0.12
      : confidence === "medium"
        ? 0.14
        : confidence === "low"
          ? 0.16
          : 0.18;

  return {
    low: roundHundred(Math.max(rawLow, midpoint * (1 - spread))),
    high: roundHundred(Math.min(rawHigh, midpoint * (1 + spread))),
    midpoint,
  };
};

export const analyzeValuation = ({
  chosen,
  bindings,
  bindingNote,
  domain,
}: {
  chosen: WikiItem[];
  bindings: Record<BindingKey | string, BindingStatus>;
  bindingNote: string;
  domain: ValuationDomain;
}): ValuationAnalysis => {
  const valuationItems = chosen.filter(domain.isValuationFocus);
  const ultimates = chosen.filter(isGraduationGift);
  const pendants = chosen.filter(isSeasonPendant);
  const packages = chosen.filter(isPaidItem);
  const collabs = chosen.filter((item) => domain.sourceKind(item) === "聯動");
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
  const missingSeasonSlugs = expectedSlugs.filter(
    (slug) => !seasonCompletion.get(slug)?.selected,
  );
  const partialSeasonSlugs = expectedSlugs.filter((slug) => {
    const row = seasonCompletion.get(slug);
    return Boolean(row && row.selected > 0 && row.selected < row.expected);
  });
  const statuses = Object.values(bindings);
  const reviewed =
    statuses.some((status) => status !== "none") || Boolean(bindingNote.trim());
  return {
    valuationItems,
    ultimates,
    pendants,
    packages,
    collabs,
    limited,
    ultimateSeasonSlugs,
    startSeasonSlug,
    missingSeasonSlugs,
    partialSeasonSlugs,
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
  };
};

const resourceValue = (resources: ValuationResources | undefined) => {
  const amount = (value: string | number | undefined) =>
    Math.max(0, Number.parseInt(String(value ?? "0"), 10) || 0);
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
    tier(amount(resources?.candles), [
      [200, 100, 200],
      [500, 250, 450],
      [1000, 500, 800],
      [2000, 800, 1200],
    ]),
    tier(amount(resources?.hearts), [
      [50, 100, 200],
      [200, 200, 400],
      [500, 400, 700],
    ]),
    tier(amount(resources?.ascended), [
      [20, 50, 100],
      [50, 100, 200],
      [100, 200, 350],
    ]),
    [
      Math.min(amount(resources?.passes), 5) * 80,
      Math.min(amount(resources?.passes), 5) * 150,
    ],
  ];
  return {
    low: Math.min(
      values.reduce((sum, value) => sum + value[0], 0),
      1500,
    ),
    high: Math.min(
      values.reduce((sum, value) => sum + value[1], 0),
      2500,
    ),
  };
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
      dataAsOf: valuationSampleSummary.asOf,
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
      label: `最早畢業季 ${analysis.startSeasonSlug}`,
      low,
      high,
    });
  } else if (analysis.startSeasonSlug)
    warnings.push("最早畢業季不在目前的市場樣本範圍，已使用保守基準。");
  for (const row of seasonRows) {
    if (row.completion >= 1) continue;
    const absent = 1 - row.completion;
    const deductionLow = roundHundred(row.contributionHigh * absent);
    const deductionHigh = roundHundred(row.contributionLow * absent);
    low -= deductionLow;
    high -= deductionHigh;
    contributions.push({
      group: "season",
      label: `${row.slug} 畢業禮完成 ${Math.round(row.completion * 100)}%`,
      low: -deductionLow,
      high: -deductionHigh,
    });
  }
  const packageMap = new Map<string, WikiItem>();
  analysis.packages.forEach((item) => {
    if (isChinaOnlyItem(item)) {
      warnings.push("國服限定物品不列入國際服參考價格。");
      return;
    }
    const platform = platformBindingForItem(item);
    const status = platform
      ? (analysis.bindings[platform] ?? "none")
      : "transfer";
    if (platform && status !== "transfer") {
      warnings.push(
        `${platform} 無綁或無法交易，該平台物品不列入參考價格。`,
      );
      return;
    }
    const key = canonicalPackageKey(item);
    if (key) packageMap.set(key, item);
  });
  const packageTier = classifyPackageTier(packageMap.size);
  const packageUnit = packageMap.size
    ? packageTier.premium / packageMap.size
    : 0;
  for (const item of packageMap.values()) {
    const kind = limitedItemKind(item);
    const multiplier =
      kind === "permanent"
        ? 1.5
        : kind === "platform"
          ? 1.25
          : kind === "annual"
            ? 0.9
            : 0.75;
    const base = packageUnit * multiplier;
    contributions.push({
      group: "package",
      label: item.name,
      low: roundHundred(base * 0.7),
      high: roundHundred(base * 1.15),
    });
  }
  const packageKeys = new Set(packageMap.keys());
  const limitedKeys = new Set<string>();
  for (const item of analysis.limited) {
    if (isChinaOnlyItem(item)) {
      warnings.push("國服限定物品不列入國際服參考價格。");
      continue;
    }
    if (
      canonicalPackageKey(item) &&
      packageKeys.has(canonicalPackageKey(item)!)
    )
      continue;
    const kind = limitedItemKind(item);
    const platform = platformBindingForItem(item);
    const status = platform
      ? (analysis.bindings[platform] ?? "none")
      : "transfer";
    if (platform && status !== "transfer") {
      warnings.push(
        `${platform} 無綁或無法交易，該平台限定不列入參考價格。`,
      );
      continue;
    }
    const key = `${kind}:${item.collection || item.name}`;
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
      label: item.name,
      low: itemLow,
      high: itemHigh,
    });
  }
  const extras = contributions.filter(
    (row) => row.group === "package" || row.group === "limited",
  );
  const rawExtraLow = extras.reduce(
    (sum, row) => sum + Math.max(0, row.low),
    0,
  );
  const rawExtraHigh = extras.reduce(
    (sum, row) => sum + Math.max(0, row.high),
    0,
  );
  const extraLow = Math.min(rawExtraLow, 8000);
  const extraHigh = Math.min(rawExtraHigh, 12000);
  low += extraLow;
  high += extraHigh;
  if (rawExtraLow > extraLow || rawExtraHigh > extraHigh) {
    contributions.push({
      group: "limited",
      label: "禮包／限定加值上限",
      low: extraLow - rawExtraLow,
      high: extraHigh - rawExtraHigh,
    });
  }
  const resource = resourceValue(resources);
  if (resource.low || resource.high)
    contributions.push({ group: "resource", label: "帳號資源", ...resource });
  low += resource.low;
  high += resource.high;
  const risk =
    Math.max(0.7, 1 - analysis.issueCount * 0.1) *
    Math.max(0.84, 1 - analysis.keepCount * 0.04);
  if (risk < 1)
    contributions.push({
      group: "binding",
      label: "綁定風險",
      low: 0,
      high: 0,
      percent: Math.round((risk - 1) * 100),
    });
  if (
    Object.values(analysis.bindings).some((value) => value === "transfer") &&
    !analysis.issueCount &&
    !analysis.keepCount
  ) {
    high *= 1.03;
    contributions.push({
      group: "binding",
      label: "可出綁定",
      low: 0,
      high: 0,
      percent: 3,
    });
  }
  low = roundHundred(Math.max(300, low * risk));
  high = roundHundred(Math.max(low, high * risk));
  const confidence: SeasonConfidence = startBand?.confidence ?? "inferred";
  const summary = summarizeValuationRange(low, high, confidence);
  if (!analysis.startSeasonSlug)
    warnings.push("未辨識到完整畢業季，參考價格採禮包／限定保守基準。");
  return {
    range: { low: summary.low, high: summary.high, currency: "TWD" },
    midpoint: summary.midpoint,
    confidence,
    contributions,
    warnings: [...new Set(warnings)],
    seasonRows,
    dataAsOf: seasonRows[0]?.asOf ?? valuationSampleSummary.asOf,
  };
};
