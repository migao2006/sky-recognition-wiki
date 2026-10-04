import type { BindingKey, BindingStatus } from "./account-config";
import { classifyAccountStyle, classifyBreakClass, classifySalePackageTier,
  type SalePackageTierKey, type MarketAccountStyle, type MarketBreakClass, type PackageTierKey } from "./valuation-profile";
import { canonicalPackageKey, isChinaOnlyItem, isGraduationGift, isPaidItem, isSeasonPendant, platformBindingForItem } from "./valuation-items";
import { seasonBandBySlug, type SeasonConfidence, type SeasonPriceBand } from "./valuation-season-bands";
import manifest from "./valuation-tabpfn-manifest.json";
import type { ModelResponse } from "./valuation-api-contract";
import type { WikiItem } from "./wiki-data";

export type ValuationDomain = {
  isValuationFocus: (item: WikiItem) => boolean;
  isLimitedItem: (item: WikiItem) => boolean;
  ongoingSeasonSlugs: ReadonlySet<string>;
  graduationSeasonSlugs: readonly string[];
  seasonGraduationItems: ReadonlyMap<string, readonly WikiItem[]>;
  sortSeasonSlugs: (slugs: string[]) => string[];
  getZhName: (item: WikiItem) => string;
};
type ValuationResources = {
  candles?: string | number;
  hearts?: string | number;
  ascended?: string | number;
  passes?: string | number;
};
type ValuationContribution = {
  group: "season" | "package" | "limited" | "binding" | "resource" | "market";
  label: string;
  low: number;
  high: number;
  percent?: number;
};
type ValuationSeasonRow = SeasonPriceBand & {
  selected: number;
  expected: number;
  completion: number;
};
export type ValuationEstimate = {
  status: "unavailable" | "unvalidated";
  range: { low: number; high: number; currency: "TWD" } | null;
  midpoint: number | null;
  confidence: SeasonConfidence;
  contributions: ValuationContribution[];
  warnings: string[];
  seasonRows: ValuationSeasonRow[];
  /** UI classification snapshot; the actual TabPFN payload is built in valuation-tabpfn-features.ts. */
  modelFeatures?: { modelRevision: string; season: string | null; packageCount: number; breakClass: MarketBreakClass | null; bindingRiskCount: number | null };
  evidence: { method: string | null; directSampleCount: number; modelRevision: string };
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
  selectedCount: number;
  valuationItems: WikiItem[];
  ultimates: WikiItem[];
  pendants: WikiItem[];
  packages: WikiItem[];
  limited: WikiItem[];
  startSeasonSlug: string | null;
  seasonCompletion: ReadonlyMap<string, { selected: number; expected: number }>;
  completeness: number;
  issueCount: number;
  keepCount: number;
  bindings: Record<string, BindingStatus>;
  bindingsConfirmed?: boolean;
  getZhName: (item: WikiItem) => string;
};

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
      ultimates.map((item) => item.collection),
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
  const statuses = Object.values(bindings);
  const reviewed =
    bindingsConfirmed ||
    statuses.some((status) => status !== "none") ||
    Boolean(bindingNote.trim());
  return {
    selectedCount: chosen.length,
    valuationItems,
    ultimates,
    pendants,
    packages,
    limited,
    startSeasonSlug,
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

// Whole-account model only: no per-item premiums, fixed resource prices or caps.
export const estimateValuation = ({ analysis, response }: {
  analysis: ValuationAnalysis;
  resources?: ValuationResources;
  response?: ModelResponse;
}): ValuationEstimate | null => {
  if (!analysis.selectedCount) return null;
  const warnings: string[] = [];
  const paid = analysis.packages.filter(item => {
    if (isChinaOnlyItem(item)) return false;
    const platform = platformBindingForItem(item);
    if (platform && ["keep", "issue"].includes(analysis.bindings[platform])) {
      warnings.push(`${platform} 綁定未能轉移，該平台禮包不計入可出禮包數。`);
      return false;
    }
    return true;
  });
  const canonicalPackageCount = new Set(paid.map(canonicalPackageKey).filter(Boolean)).size;
  const breaks = classifyBreakClass(analysis.seasonCompletion);
  const tier = classifySalePackageTier(canonicalPackageCount);
  const seasonRows = [...analysis.seasonCompletion].flatMap(([slug, state]) => {
    const band = response?.seasonBands.find(b => b.slug === slug) ?? seasonBandBySlug.get(slug);
    return band ? [{ ...band, ...state, completion: state.expected ? state.selected / state.expected : 0 }] : [];
  });
  const input = {
    season: analysis.startSeasonSlug,
    packageCount: canonicalPackageCount,
    breakClass: analysis.seasonCompletion.size ? breaks.key : null,
    bindingRiskCount: analysis.bindingsConfirmed ? analysis.issueCount + analysis.keepCount : null,
  };
  const sampleCount = manifest.seasonCounts[analysis.startSeasonSlug as keyof typeof manifest.seasonCounts] ?? 0;
  warnings.push("百分比模型依起季基準與整號刊登行情推估，尚未通過獨立成交驗證；目前不提供價格區間。");
  if (!analysis.bindingsConfirmed) warnings.push("綁定尚未確認，不推測為無綁。");
  if (!analysis.startSeasonSlug) warnings.push("未判定起季，使用未指定起季的整號行情推算；季卡項鍊不代表畢業。");
  warnings.push("物品、資源及綁定以模型已學習的特徵綜合推估，不另加固定金額；未填資料保持未知。");
  return {
    status: response ? "unvalidated" : "unavailable",
    range: null,
    midpoint: response?.midpoint ?? null,
    confidence: "inferred",
    contributions: [],
    warnings: [...new Set(warnings)],
    seasonRows,
    evidence: { method: manifest.method, directSampleCount: sampleCount, modelRevision: manifest.modelRevision },
    modelFeatures: { modelRevision: manifest.modelRevision, ...input },
    marketProfile: {
      breakClass: breaks.key, packageTier: tier.key, salePackageTier: tier.key,
      accountStyle: classifyAccountStyle({ paidItemCount: canonicalPackageCount,
        graduationCount: analysis.ultimates.length, seasonCount: analysis.seasonCompletion.size }),
      missingSeasons: breaks.missingSeasons, partialSeasons: breaks.partialSeasons,
      completionRatio: breaks.completionRatio, effectiveSample: sampleCount,
      paidItemCount: paid.length, canonicalPackageCount,
      evidenceQuality: "limited", priceStage: "低資訊參考", sourceConcentration: 0,
    },
  };
};
