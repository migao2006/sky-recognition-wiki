"use client";

import { useCallback, useRef, useState } from "react";
import type { AccountSummaryDomain } from "./account-summary";
import { bundlePresets } from "./bundle-presets";
import type { WikiItem } from "./wiki-data";

type CatalogDomain = typeof import("./catalog-domain");

function prepareCatalog(domain: CatalogDomain) {
  const bundlePresetItems = new Map(
    bundlePresets.map((preset) => [
      preset.key,
      domain.wikiItems.filter(
        (item) =>
          domain.allClosetTypeSet.has(item.type) &&
          ("collection" in preset
            ? item.collection === preset.collection
            : preset.names.includes(item.name as never)),
      ),
    ]),
  );
  const accountSummaryDomain: AccountSummaryDomain = {
    isShowcaseHighlight: domain.isShowcaseHighlight,
    isLimitedItem: domain.isLimitedItem,
    graduationSeasonSlugs: domain.graduationSeasonSlugs,
    seasonGraduationItems: domain.seasonGraduationItems,
    sortSeasonSlugs: domain.sortSeasonSlugs,
  };
  return {
    ...domain,
    validItemGuids: new Set(domain.wikiItems.map((item) => item.guid)),
    bundlePresetItems,
    saleCopyPresetGuids: new Set(
      [...bundlePresetItems.values()].flatMap((items) =>
        items.map((item) => item.guid),
      ),
    ),
    accountSummaryDomain,
    showcaseOrderOptions: (items: WikiItem[]) => ({
      items,
      isUltimate: domain.isSeasonUltimate,
      isLimited: (item: WikiItem) =>
        domain.isPaidItem(item) || domain.isLimitedItem(item),
      isPendant: domain.isSeasonPendant,
      getClusterName: domain.sourceCollectionName,
      getClusterOrder: domain.showcaseClusterOrder,
      getItemTypeName: (item: WikiItem) => domain.labels[item.type] || item.type,
      getItemTypeOrder: (item: WikiItem) =>
        domain.typeOrder.get(item.type) ?? 999,
    }),
  };
}

type ReadyCatalog = ReturnType<typeof prepareCatalog>;

export const useOrganizerRuntime = () => {
  const [catalogDomain, setCatalogDomain] = useState<ReadyCatalog | null>(null);
  const [catalogLoadError, setCatalogLoadError] = useState(false);
  const catalogPromise = useRef<Promise<ReadyCatalog> | null>(null);

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

  return { catalogDomain, catalogLoadError, loadCatalog };
};

export type AccountRuntime = Pick<
  ReturnType<typeof useOrganizerRuntime>,
  "catalogDomain" | "catalogLoadError" | "loadCatalog"
>;
export type CatalogRuntime = Pick<
  ReadyCatalog,
  | "wikiItems"
  | "closetGroups"
  | "compareCatalogItems"
  | "allClosetTypeSet"
  | "isLimitedItem"
  | "isProfessionalVideoFocus"
  | "matchesSourceFilter"
  | "matchesSub"
  | "searchIndex"
  | "seasonZh"
  | "seasons"
  | "sourceFilters"
  | "sourceKind"
  | "zhItemName"
  | "getNextClosetSub"
>;
export type OrganizerRuntimeCapabilities = ReadyCatalog;
