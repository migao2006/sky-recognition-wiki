import { bindingKeys, type BindingKey, type BindingStatus } from "./account-config";
import {
  calibrateHighValueEstimate,
  classifyPackageTier,
  classifySeasonGap,
  type PackageTier,
  type SeasonGapTier,
} from "./valuation-calibration";
import {
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
  monotonicCoefficient,
} from "./valuation-items";
import type { WikiItem } from "./wiki-data";

export type ValuationModel = {
  feature_names: string[];
  keyword_patterns: Record<string, string>;
  scaler_mean: number[];
  scaler_scale: number[];
  coefficients: number[];
  intercept: number;
  clamp_twd: [number, number];
};

export type ValuationDomain = {
  isValuationFocus: (item: WikiItem) => boolean;
  isLimitedItem: (item: WikiItem) => boolean;
  sourceKind: (item: WikiItem) => string;
  getZhName: (name: string) => string;
  getSource: (item: WikiItem) => string;
  ongoingSeasonSlugs: ReadonlySet<string>;
  graduationSeasonSlugs: readonly string[];
  seasonGraduationItems: ReadonlyMap<string, readonly WikiItem[]>;
  sortSeasonSlugs: (slugs: string[]) => string[];
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
  startEvidenceConfidence: number;
  missingSeasonSlugs: string[];
  partialSeasonSlugs: string[];
  gapTier: SeasonGapTier;
  packageTier: PackageTier;
  completeness: number;
  issueCount: number;
  keepCount: number;
};

export const analyzeValuation = (input: {
  chosen: WikiItem[];
  bindings: Record<BindingKey, BindingStatus>;
  bindingNote: string;
  domain: ValuationDomain;
}): ValuationAnalysis => {
  const { chosen, bindings, bindingNote, domain } = input;
  const valuationItems = chosen.filter(domain.isValuationFocus);
  const ultimates = chosen.filter(isGraduationGift);
  const pendants = chosen.filter(isSeasonPendant);
  const packages = chosen.filter(isPaidItem);
  const collabs = chosen.filter((item) => domain.sourceKind(item) === "聯動");
  const limited = chosen.filter(domain.isLimitedItem);
  const ultimateSeasonSlugs = domain.sortSeasonSlugs([
    ...new Set(
      chosen
        .filter(isSeasonUltimate)
        .filter((item) => !domain.ongoingSeasonSlugs.has(item.collection))
        .map((item) => item.collection),
    ),
  ]);
  const startSeasonSlug = ultimateSeasonSlugs[0] || null;
  const earliestGraduationIndex = startSeasonSlug
    ? domain.graduationSeasonSlugs.indexOf(startSeasonSlug)
    : -1;
  const expectedGraduationSlugs =
    earliestGraduationIndex >= 0
      ? domain.graduationSeasonSlugs.slice(earliestGraduationIndex)
      : [];
  const selectedUltimateCount = new Map(
    expectedGraduationSlugs.map((slug) => [
      slug,
      ultimates.filter((item) => item.collection === slug).length,
    ]),
  );
  const pendantSeasonSlugs = new Set(pendants.map((item) => item.collection));
  const expectedUltimateCount = new Map(
    expectedGraduationSlugs.map((slug) => [
      slug,
      domain.seasonGraduationItems.get(slug)?.length ?? 0,
    ]),
  );
  const missingSeasonSlugs = expectedGraduationSlugs.filter(
    (slug) => !selectedUltimateCount.get(slug) && !pendantSeasonSlugs.has(slug),
  );
  const partialSeasonSlugs = expectedGraduationSlugs.filter(
    (slug) =>
      ((selectedUltimateCount.get(slug) || 0) > 0 || pendantSeasonSlugs.has(slug)) &&
      (selectedUltimateCount.get(slug) || 0) <
        (expectedUltimateCount.get(slug) || 0),
  );
  const gapTier = classifySeasonGap({
    hasSeasonData: ultimateSeasonSlugs.length > 0,
    missingSeasons: missingSeasonSlugs.length,
    partialSeasons: partialSeasonSlugs.length,
  });
  const packageTier = classifyPackageTier(packages.length);
  const startEvidenceConfidence = Math.min(
    1,
    Math.max(0, ultimateSeasonSlugs.length - 1) / 8,
  );
  const bindingReviewed =
    bindingKeys.some((key) => bindings[key] !== "none") ||
    Boolean(bindingNote.trim());
  const completeness = Math.round(
    ([
      Boolean(startSeasonSlug),
      valuationItems.length > 0,
      packages.length > 0 || limited.length > 0,
      bindingReviewed,
    ].filter(Boolean).length /
      4) *
      100,
  );
  const issueCount = bindingKeys.filter((key) => bindings[key] === "issue").length;
  const keepCount = bindingKeys.filter((key) => bindings[key] === "keep").length;
  return {
    valuationItems,
    ultimates,
    pendants,
    packages,
    collabs,
    limited,
    ultimateSeasonSlugs,
    startSeasonSlug,
    startEvidenceConfidence,
    missingSeasonSlugs,
    partialSeasonSlugs,
    gapTier,
    packageTier,
    completeness,
    issueCount,
    keepCount,
  };
};

export const estimateValuation = (input: {
  model: ValuationModel | null;
  analysis: ValuationAnalysis;
  accountType: string;
  domain: Pick<ValuationDomain, "getZhName" | "getSource">;
}) => {
  const { model, analysis, accountType, domain } = input;
  if (!model || !analysis.valuationItems.length) return null;
  const derived = [
    ...analysis.valuationItems.flatMap((item) => [
      domain.getZhName(item.name),
      item.name,
      domain.getSource(item),
    ]),
    accountType,
    analysis.packageTier.label,
    analysis.gapTier.label,
  ]
    .filter(Boolean)
    .join(" ");
  const values = model.feature_names.map((name, index) => {
    if (name === "binding_risk") return model.scaler_mean[index];
    try {
      return new RegExp(model.keyword_patterns[name], "i").test(derived) ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const logPrice =
    model.intercept +
    values.reduce(
      (sum, value, index) =>
        sum +
        ((value - model.scaler_mean[index]) / (model.scaler_scale[index] || 1)) *
          monotonicCoefficient(model.coefficients[index]),
      0,
    );
  const raw = Math.expm1(logPrice);
  const tailAnchor = 40000;
  const tailAdjusted =
    raw > tailAnchor ? tailAnchor + Math.sqrt(raw - tailAnchor) * 180 : raw;
  const marketCalibrated = calibrateHighValueEstimate({
    statisticalEstimate: tailAdjusted,
    earliestSeasonSlug: analysis.startSeasonSlug,
    startEvidenceConfidence: analysis.startEvidenceConfidence,
    ultimateCount: analysis.ultimates.length,
    collaborationCount: analysis.collabs.length,
    gapTier: analysis.gapTier,
    packageTier: analysis.packageTier,
    missingSeasonSlugs: analysis.missingSeasonSlugs,
    partialSeasonSlugs: analysis.partialSeasonSlugs,
  });
  const riskMultiplier =
    Math.pow(0.86, analysis.issueCount) * Math.pow(0.95, analysis.keepCount);
  return Math.round(
    Math.max(model.clamp_twd[0], marketCalibrated * riskMultiplier) / 100,
  ) * 100;
};
