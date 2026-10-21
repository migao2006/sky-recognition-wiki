import type { BindingKey, BindingStatus } from "./account-config";
import {
  classifyAccountStyle,
  classifyBreakClass,
  classifySalePackageTier,
  type MarketAccountStyle,
  type MarketBreakClass,
  type SalePackageTierKey,
} from "./account-profile";
import {
  canonicalPackageKey,
  isChinaOnlyItem,
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  platformBindingForItem,
} from "./catalog-item-traits";
import type { WikiItem } from "./wiki-data";

export type AccountSummaryDomain = {
  isShowcaseHighlight: (item: WikiItem) => boolean;
  isLimitedItem: (item: WikiItem) => boolean;
  graduationSeasonSlugs: readonly string[];
  seasonGraduationItems: ReadonlyMap<string, readonly WikiItem[]>;
  sortSeasonSlugs: (slugs: string[]) => string[];
};

export type AccountSummary = {
  selectedCount: number;
  highlightItems: WikiItem[];
  ultimates: WikiItem[];
  pendants: WikiItem[];
  packages: WikiItem[];
  limited: WikiItem[];
  startSeasonSlug: string | null;
  seasonCompletion: ReadonlyMap<string, { selected: number; expected: number }>;
  canonicalPackageCount: number;
  breakClass: MarketBreakClass;
  salePackageTier: SalePackageTierKey;
  accountStyle: MarketAccountStyle;
  issueCount: number;
  keepCount: number;
};

export const analyzeAccount = ({
  chosen,
  bindings,
  domain,
}: {
  chosen: WikiItem[];
  bindings: Record<BindingKey | string, BindingStatus>;
  domain: AccountSummaryDomain;
}): AccountSummary => {
  const highlightItems = chosen.filter(domain.isShowcaseHighlight);
  const ultimates = chosen.filter(isGraduationGift);
  const pendants = chosen.filter(isSeasonPendant);
  const packages = chosen.filter(isPaidItem);
  const limited = chosen.filter(domain.isLimitedItem);
  const ultimateSeasonSlugs = domain.sortSeasonSlugs([
    ...new Set(ultimates.map((item) => item.collection)),
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
  const transferablePackages = packages.filter((item) => {
    if (isChinaOnlyItem(item)) return false;
    const platform = platformBindingForItem(item);
    return !platform || !["keep", "issue"].includes(bindings[platform]);
  });
  const canonicalPackageCount = new Set(
    transferablePackages.map(canonicalPackageKey).filter(Boolean),
  ).size;
  const breakClass = classifyBreakClass(seasonCompletion).key;
  const salePackageTier = classifySalePackageTier(canonicalPackageCount).key;
  const statuses = Object.values(bindings);

  return {
    selectedCount: chosen.length,
    highlightItems,
    ultimates,
    pendants,
    packages,
    limited,
    startSeasonSlug,
    seasonCompletion,
    canonicalPackageCount,
    breakClass,
    salePackageTier,
    accountStyle: classifyAccountStyle({
      paidItemCount: canonicalPackageCount,
      graduationCount: ultimates.length,
      seasonCount: seasonCompletion.size,
    }),
    issueCount: statuses.filter((status) => status === "issue").length,
    keepCount: statuses.filter((status) => status === "keep").length,
  };
};
