"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { bundlePresets } from "./bundle-presets";
import type { WikiItem } from "./wiki-data";
import type { ValuationDomain } from "./valuation-analysis";

type CatalogDomain = typeof import("./catalog-domain");
type ValuationRuntime = {
  analysis: typeof import("./valuation-analysis");
  bands: typeof import("./valuation-season-bands");
};

// Created once per successful load, never per selection. No placeholder catalog.
function prepareCatalog(domain: CatalogDomain) {
  const bundlePresetItems = new Map(
    bundlePresets.map((preset) => [preset.key, domain.wikiItems.filter((item) =>
      domain.allClosetTypeSet.has(item.type) && ("collection" in preset
        ? item.collection === preset.collection
        : preset.names.includes(item.name as never)),
    )]),
  );
  const valuationDomain: ValuationDomain = {
    isValuationFocus: domain.isValuationFocus,
    isLimitedItem: domain.isLimitedItem,
    ongoingSeasonSlugs: domain.ongoingSeasonSlugs,
    graduationSeasonSlugs: domain.graduationSeasonSlugs,
    seasonGraduationItems: domain.seasonGraduationItems,
    sortSeasonSlugs: domain.sortSeasonSlugs,
    getZhName: domain.zhItemName,
  };
  return {
    ...domain,
    validItemGuids: new Set(domain.wikiItems.map((item) => item.guid)),
    bundlePresetItems,
    saleCopyPresetGuids: new Set([...bundlePresetItems.values()].flatMap((items) => items.map((item) => item.guid))),
    valuationDomain,
    showcaseOrderOptions: (items: WikiItem[]) => ({
      items,
      isUltimate: domain.isSeasonUltimate,
      isLimited: (item: WikiItem) => domain.isPaidItem(item) || domain.isLimitedItem(item),
      isPendant: domain.isSeasonPendant,
      getClusterName: domain.sourceCollectionName,
      getClusterOrder: domain.showcaseClusterOrder,
      getItemTypeName: (item: WikiItem) => domain.labels[item.type] || item.type,
      getItemTypeOrder: (item: WikiItem) => domain.typeOrder.get(item.type) ?? 999,
    }),
  };
}

type ReadyCatalog = ReturnType<typeof prepareCatalog>;

/** Only loads capabilities. Selection validation belongs to the account state. */
export const useOrganizerRuntime = () => {
  const [catalogDomain, setCatalogDomain] = useState<ReadyCatalog | null>(null);
  const [valuationRuntime, setValuationRuntime] = useState<ValuationRuntime | null>(null);
  const [catalogLoadError, setCatalogLoadError] = useState(false);
  const [valuationLoadError, setValuationLoadError] = useState(false);
  const catalogPromise = useRef<Promise<ReadyCatalog> | null>(null);
  const valuationPromise = useRef<Promise<ValuationRuntime> | null>(null);

  const loadCatalog = useCallback(() => {
    if (!catalogPromise.current) {
      setCatalogLoadError(false);
      catalogPromise.current = import("./catalog-domain")
        .then((module) => {
          const catalog = prepareCatalog(module);
          setCatalogDomain(catalog);
          return catalog;
        })
        .catch((error: unknown) => {
          catalogPromise.current = null;
          setCatalogLoadError(true);
          throw error;
        });
    }
    return catalogPromise.current;
  }, []);

  const loadValuation = useCallback(() => {
    if (!valuationPromise.current) {
      setValuationLoadError(false);
      valuationPromise.current = Promise.all([
        import("./valuation-analysis"), import("./valuation-season-bands"),
      ]).then(([analysis, bands]) => {
        const runtime = { analysis, bands };
        setValuationRuntime(runtime);
        return runtime;
      }).catch((error: unknown) => {
        valuationPromise.current = null;
        setValuationLoadError(true);
        throw error;
      });
    }
    return valuationPromise.current;
  }, []);

  const valuationReady = useMemo(() => catalogDomain && valuationRuntime ? {
    ...catalogDomain,
    valuationRuntime,
    seasonPriceBands: valuationRuntime.bands.seasonPriceBands,
    valuationSampleSummary: valuationRuntime.bands.valuationSampleSummary,
  } : null, [catalogDomain, valuationRuntime]);

  return { catalogDomain, valuationRuntime, valuationReady, catalogLoadError,
    valuationLoadError, loadCatalog, loadValuation };
};

export type AccountRuntime = Pick<ReturnType<typeof useOrganizerRuntime>,
  "catalogDomain" | "catalogLoadError" | "loadCatalog">;
export type CatalogRuntime = Pick<ReadyCatalog,
  "wikiItems" | "closetGroups" | "compareCatalogItems" | "allClosetTypeSet" |
  "isLimitedItem" | "isProfessionalVideoFocus" | "matchesSourceFilter" |
  "matchesSub" | "searchIndex" | "seasonZh" | "seasons" | "sourceFilters" |
  "sourceKind" | "zhItemName" | "getNextClosetSub">;
export type ValuationRuntimeCapabilities = NonNullable<ReturnType<typeof useOrganizerRuntime>["valuationReady"]>;
