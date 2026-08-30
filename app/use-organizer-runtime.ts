"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { bundlePresets } from "./bundle-presets";
import type { WikiItem } from "./wiki-data";
import type { ValuationDomain } from "./valuation-analysis";
import {
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "./valuation-items";

type CatalogDomain = typeof import("./catalog-domain");
type ValuationRuntime = {
  analysis: typeof import("./valuation-analysis");
  bands: typeof import("./valuation-season-bands");
};

const emptyWikiItems: WikiItem[] = [];
const emptyStringSet = new Set<string>();
const emptyStringMap = new Map<string, string>();
const emptyNumberMap = new Map<string, number>();
const emptyItemMap = new Map<string, WikiItem[]>();
const emptyLabels: Record<string, string> = {};
const emptyStringList: string[] = [];
const alwaysFalse = () => false;
const alwaysTrue = () => true;
const emptyItemText = () => "";
const itemEnglishName = (item: WikiItem) => item.name;
const fallbackCloset = {
  key: "outfit",
  order: "01",
  name: "服裝衣櫃",
  types: ["Outfit", "Shoes", "OutfitShoes"],
  subs: [{ key: "Outfit", name: "一般服裝", types: ["Outfit"] }],
};
const emptyValuationSampleSummary = {
  sourceRows: 0,
  eligibleRows: 0,
  facebookRows: 0,
  facebookEligibleRows: 0,
  secondaryMarketRows: 0,
  asOf: "",
};

export const useOrganizerRuntime = (
  setOwned: Dispatch<SetStateAction<Set<string>>>,
) => {
  const [catalogDomain, setCatalogDomain] = useState<CatalogDomain | null>(
    null,
  );
  const [valuationRuntime, setValuationRuntime] =
    useState<ValuationRuntime | null>(null);
  const [catalogLoadError, setCatalogLoadError] = useState(false);
  const [valuationLoadError, setValuationLoadError] = useState(false);
  const catalogPromise = useRef<Promise<CatalogDomain> | null>(null);
  const valuationPromise = useRef<Promise<ValuationRuntime> | null>(null);
  const catalogValidGuids = useRef<ReadonlySet<string> | undefined>(undefined);

  const loadCatalog = useCallback(() => {
    if (!catalogPromise.current) {
      setCatalogLoadError(false);
      catalogPromise.current = import("./catalog-domain")
        .then((module) => {
          const validGuids = new Set(module.wikiItems.map((item) => item.guid));
          catalogValidGuids.current = validGuids;
          setOwned((previous) => {
            const filtered = new Set(
              [...previous].filter((guid) => validGuids.has(guid)),
            );
            return filtered.size === previous.size ? previous : filtered;
          });
          setCatalogDomain(module);
          return module;
        })
        .catch((error: unknown) => {
          catalogPromise.current = null;
          setCatalogLoadError(true);
          throw error;
        });
    }
    return catalogPromise.current;
  }, [setOwned]);

  const loadValuation = useCallback(() => {
    if (!valuationPromise.current) {
      setValuationLoadError(false);
      valuationPromise.current = Promise.all([
        import("./valuation-analysis"),
        import("./valuation-season-bands"),
      ])
        .then(([analysis, bands]) => {
          const runtime = { analysis, bands };
          setValuationRuntime(runtime);
          return runtime;
        })
        .catch((error: unknown) => {
          valuationPromise.current = null;
          setValuationLoadError(true);
          throw error;
        });
    }
    return valuationPromise.current;
  }, []);

  const wikiItems = catalogDomain?.wikiItems ?? emptyWikiItems;
  const closetGroups = catalogDomain?.closetGroups ?? [fallbackCloset];
  const allClosetTypeSet = catalogDomain?.allClosetTypeSet ?? emptyStringSet;
  const graduationSeasonSlugs =
    catalogDomain?.graduationSeasonSlugs ?? emptyStringList;
  const heldClosetOrder = catalogDomain?.heldClosetOrder ?? emptyNumberMap;
  const isLimitedItem = catalogDomain?.isLimitedItem ?? alwaysFalse;
  const isProfessionalVideoFocus =
    catalogDomain?.isProfessionalVideoFocus ?? alwaysFalse;
  const isValuationFocus = catalogDomain?.isValuationFocus ?? alwaysFalse;
  const labels = catalogDomain?.labels ?? emptyLabels;
  const matchesSourceFilter = catalogDomain?.matchesSourceFilter ?? alwaysTrue;
  const matchesSub = catalogDomain?.matchesSub ?? alwaysFalse;
  const ongoingSeasonSlugs =
    catalogDomain?.ongoingSeasonSlugs ?? emptyStringSet;
  const searchIndex = catalogDomain?.searchIndex ?? emptyStringMap;
  const seasonGraduationItems =
    catalogDomain?.seasonGraduationItems ?? emptyItemMap;
  const seasonUltimateItems =
    catalogDomain?.seasonUltimateItems ?? emptyItemMap;
  const seasonUltimateSlugs =
    catalogDomain?.seasonUltimateSlugs ?? emptyStringList;
  const seasonZh = catalogDomain?.seasonZh ?? emptyLabels;
  const seasons = catalogDomain?.seasons ?? [];
  const source = catalogDomain?.source ?? emptyItemText;
  const sourceCollectionName =
    catalogDomain?.sourceCollectionName ?? emptyItemText;
  const sourceFilters = catalogDomain?.sourceFilters ?? [];
  const sourceKind = catalogDomain?.sourceKind ?? emptyItemText;
  const typeOrder = catalogDomain?.typeOrder ?? emptyNumberMap;
  const zhItemName = catalogDomain?.zhItemName ?? itemEnglishName;
  const uniqueByGuid =
    catalogDomain?.uniqueByGuid ??
    ((items: WikiItem[]) => [
      ...new Map(items.map((item) => [item.guid, item])).values(),
    ]);
  const getNextClosetSub = catalogDomain?.getNextClosetSub ?? (() => null);
  const validItemGuids = useMemo(
    () => new Set(wikiItems.map((item) => item.guid)),
    [wikiItems],
  );
  const bundlePresetItems = useMemo(
    () =>
      new Map(
        bundlePresets.map((preset) => [
          preset.key,
          wikiItems.filter(
            (item) =>
              allClosetTypeSet.has(item.type) &&
              ("collection" in preset
                ? item.collection === preset.collection
                : preset.names.includes(item.name as never)),
          ),
        ]),
      ),
    [allClosetTypeSet, wikiItems],
  );
  const saleCopyPresetGuids = useMemo(
    () =>
      new Set(
        [...bundlePresetItems.values()].flatMap((items) =>
          items.map((item) => item.guid),
        ),
      ),
    [bundlePresetItems],
  );
  const valuationDomain = useMemo<ValuationDomain>(
    () => ({
      isValuationFocus,
      isLimitedItem,
      ongoingSeasonSlugs,
      graduationSeasonSlugs,
      seasonGraduationItems,
      sortSeasonSlugs:
        catalogDomain?.sortSeasonSlugs ?? ((slugs) => [...slugs]),
      getZhName: zhItemName,
    }),
    [
      catalogDomain,
      graduationSeasonSlugs,
      isLimitedItem,
      isValuationFocus,
      ongoingSeasonSlugs,
      seasonGraduationItems,
      zhItemName,
    ],
  );
  const showcaseOrderOptions = useCallback(
    (items: WikiItem[]) => ({
      items,
      isUltimate: isSeasonUltimate,
      isLimited: (item: WikiItem) => isPaidItem(item) || isLimitedItem(item),
      isPendant: isSeasonPendant,
      getClusterName: sourceCollectionName,
      getClusterOrder: catalogDomain?.showcaseClusterOrder ?? (() => 9999),
      getItemTypeName: (item: WikiItem) => labels[item.type] || item.type,
      getItemTypeOrder: (item: WikiItem) => typeOrder.get(item.type) ?? 999,
    }),
    [catalogDomain, isLimitedItem, labels, sourceCollectionName, typeOrder],
  );

  return {
    catalogDomain,
    valuationRuntime,
    catalogLoadError,
    valuationLoadError,
    catalogValidGuids,
    loadCatalog,
    loadValuation,
    wikiItems,
    closetGroups,
    allClosetTypeSet,
    isValuationFocus,
    heldClosetOrder,
    isLimitedItem,
    isProfessionalVideoFocus,
    labels,
    matchesSourceFilter,
    matchesSub,
    searchIndex,
    ongoingSeasonSlugs,
    seasonGraduationItems,
    seasonUltimateItems,
    seasonUltimateSlugs,
    seasonZh,
    seasons,
    source,
    sourceCollectionName,
    sourceFilters,
    sourceKind,
    typeOrder,
    uniqueByGuid,
    zhItemName,
    getNextClosetSub,
    validItemGuids,
    bundlePresetItems,
    saleCopyPresetGuids,
    valuationDomain,
    showcaseOrderOptions,
    seasonPriceBands: valuationRuntime?.bands.seasonPriceBands ?? [],
    valuationSampleSummary:
      valuationRuntime?.bands.valuationSampleSummary ??
      emptyValuationSampleSummary,
  };
};

export type OrganizerRuntime = ReturnType<typeof useOrganizerRuntime>;
