import type { CatalogStepState } from "./organizer-step-state";
import type { CatalogRuntime } from "./use-organizer-runtime";
import { isPaidItem, isSeasonUltimate } from "./valuation-items";

type FilterOptions = Pick<CatalogStepState,
  "sub" | "query" | "season" | "sourceFilter" | "focusMode"
> & { closetTypes: readonly string[] };

/** Search spans closets, but still respects source, season and focus filters. */
export function filterCatalogItems(runtime: CatalogRuntime, options: FilterOptions) {
  const { closetTypes, sub, season, sourceFilter, focusMode } = options;
  const query = options.query.trim().toLocaleLowerCase("zh-Hant");
  const order = query ? "type" : sub === "held" ? "held" : sub === "large" ? "shared" : "type";
  return runtime.wikiItems.filter((item) =>
    (query ? runtime.allClosetTypeSet.has(item.type) : closetTypes.includes(item.type)) &&
    (query || runtime.matchesSub(item, sub)) &&
    runtime.matchesSourceFilter(item, sourceFilter) &&
    (sourceFilter !== "seasons" || season === "全部季節" || item.collection === season) &&
    (focusMode !== "ultimate" || isSeasonUltimate(item)) &&
    (focusMode !== "limited" || isPaidItem(item) || runtime.isLimitedItem(item)) &&
    (focusMode !== "video" || runtime.isProfessionalVideoFocus(item)) &&
    (!query || runtime.searchIndex.get(item.guid)?.includes(query)),
  ).sort((left, right) => runtime.compareCatalogItems(left, right, order));
}
