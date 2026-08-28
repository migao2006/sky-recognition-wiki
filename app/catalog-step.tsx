"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CatalogItemCard } from "./catalog-item-card";
import type { OrganizerRuntime } from "./use-organizer-runtime";
import {
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "./valuation-items";

type FocusMode = "all" | "video" | "ultimate" | "limited";
type ClosetSubRoute = {
  closetKey: string;
  closetName: string;
  subKey: string;
  subName: string;
};

const INITIAL_VISIBLE_ITEMS = 40;
const VISIBLE_ITEM_BATCH = 40;

export const useCatalogStepState = () => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [closet, setCloset] = useState("outfit");
  const [sub, setSub] = useState("Outfit");
  const [season, setSeason] = useState("全部季節");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [focusMode, setFocusMode] = useState<FocusMode>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  return {
    visibleCount,
    setVisibleCount,
    closet,
    setCloset,
    sub,
    setSub,
    season,
    setSeason,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    focusMode,
    setFocusMode,
    filterPanelOpen,
    setFilterPanelOpen,
  };
};

export type CatalogStepState = ReturnType<typeof useCatalogStepState>;

export function CatalogStep({
  runtime,
  state,
  owned,
  onToggleOwned,
  onBack,
  onNext,
}: {
  runtime: OrganizerRuntime;
  state: CatalogStepState;
  owned: ReadonlySet<string>;
  onToggleOwned: (guid: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const {
    visibleCount,
    setVisibleCount,
    closet,
    setCloset,
    sub,
    setSub,
    season,
    setSeason,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    focusMode,
    setFocusMode,
    filterPanelOpen,
    setFilterPanelOpen,
  } = state;
  const deferredQuery = useDeferredValue(query);
  const searchPending = query !== deferredQuery;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const {
    wikiItems,
    closetGroups,
    allClosetTypeSet,
    heldClosetOrder,
    isLimitedItem,
    isProfessionalVideoFocus,
    labels,
    matchesSourceFilter,
    matchesSub,
    searchIndex,
    seasonZh,
    seasons,
    sourceFilters,
    sourceKind,
    typeOrder,
    zhItemName,
    getNextClosetSub,
  } = runtime;
  const activeCloset =
    closetGroups.find((entry) => entry.key === closet) || closetGroups[0];
  const activeSub =
    activeCloset.subs.find((entry) => entry.key === sub) ||
    activeCloset.subs[0];
  const nextClosetSub = getNextClosetSub(activeCloset.key, activeSub.key);

  useEffect(() => {
    if (!nextClosetSub) return;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData) return;
    const nextIcons = wikiItems
      .filter((item) => matchesSub(item, nextClosetSub.subKey))
      .slice(0, 12)
      .map((item) => item.icon);
    const timer = window.setTimeout(() => {
      nextIcons.forEach((src) => {
        const image = new Image();
        image.referrerPolicy = "no-referrer";
        image.src = src;
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [matchesSub, nextClosetSub, wikiItems]);

  const filtered = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("zh-Hant");
    return wikiItems
      .filter(
        (item) =>
          (normalizedQuery
            ? allClosetTypeSet.has(item.type)
            : activeCloset.types.includes(item.type)) &&
          (!normalizedQuery ? matchesSub(item, sub) : true) &&
          matchesSourceFilter(item, sourceFilter) &&
          (sourceFilter !== "seasons" ||
            season === "全部季節" ||
            item.collection === season) &&
          (focusMode !== "ultimate" || isSeasonUltimate(item)) &&
          (focusMode !== "limited" ||
            isPaidItem(item) ||
            isLimitedItem(item)) &&
          (focusMode !== "video" || isProfessionalVideoFocus(item)) &&
          (!normalizedQuery ||
            searchIndex.get(item.guid)?.includes(normalizedQuery)),
      )
      .sort((left, right) =>
        sub === "held"
          ? (heldClosetOrder.get(left.name) ?? 999) -
            (heldClosetOrder.get(right.name) ?? 999)
          : left.type === right.type
            ? left.order - right.order || left.name.localeCompare(right.name)
            : (typeOrder.get(left.type) ?? 99) -
              (typeOrder.get(right.type) ?? 99),
      );
  }, [
    activeCloset,
    allClosetTypeSet,
    deferredQuery,
    focusMode,
    heldClosetOrder,
    isLimitedItem,
    isProfessionalVideoFocus,
    matchesSourceFilter,
    matchesSub,
    searchIndex,
    season,
    sourceFilter,
    sub,
    typeOrder,
    wikiItems,
  ]);
  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const visibleCards = useMemo(
    () =>
      visibleItems.map((item) => ({
        item,
        displayName: zhItemName(item),
        sourceLabel: sourceKind(item),
        typeLabel: labels[item.type] || item.type,
        ultimate: isSeasonUltimate(item),
        pendant: isSeasonPendant(item),
      })),
    [labels, sourceKind, visibleItems, zhItemName],
  );
  const hasMoreItems = visibleCount < filtered.length;

  useEffect(() => {
    if (
      !hasMoreItems ||
      !loadMoreRef.current ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleCount((count) =>
          Math.min(count + VISIBLE_ITEM_BATCH, filtered.length),
        );
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filtered.length, hasMoreItems, setVisibleCount]);

  const resetVisibleItems = () => setVisibleCount(INITIAL_VISIBLE_ITEMS);
  const selectClosetSub = (route: ClosetSubRoute, scrollToResults = false) => {
    setCloset(route.closetKey);
    setSub(route.subKey);
    setQuery("");
    resetVisibleItems();
    if (!scrollToResults) return;
    window.requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      document
        .querySelector(".result-head")
        ?.scrollIntoView({ behavior, block: "start" });
    });
  };
  const resetAdvancedFilters = () => {
    setSourceFilter("all");
    setSeason("全部季節");
    setFocusMode("all");
    resetVisibleItems();
  };
  const activeFilterCount = [
    sourceFilter !== "all",
    season !== "全部季節",
    focusMode !== "all",
  ].filter(Boolean).length;

  return (
    <section className="catalog" id="top">
      <div className="catalog-intro">
        <h1>選擇物品</h1>
        <button type="button" onClick={onNext}>
          估價 · {owned.size} 件
        </button>
      </div>
      <div className="discovery-tools">
        <div className="discovery-primary">
          <label className="catalog-search">
            <span className="visually-hidden">搜尋物品</span>
            <div>
              <i>⌕</i>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetVisibleItems();
                }}
                placeholder="搜尋名稱、季節或 ID"
                aria-label="搜尋全部衣櫃物品"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    resetVisibleItems();
                  }}
                  aria-label="清除搜尋"
                >
                  ×
                </button>
              )}
            </div>
          </label>
          <button
            type="button"
            className={`filter-trigger${filterPanelOpen ? " open" : ""}${activeFilterCount ? " active" : ""}`}
            aria-expanded={filterPanelOpen}
            aria-controls="advanced-filters"
            onClick={() => setFilterPanelOpen((open) => !open)}
          >
            <span>
              <b>篩選</b>
              {activeFilterCount > 0 && <em>{activeFilterCount}</em>}
            </span>
            <i aria-hidden="true">⌄</i>
          </button>
        </div>
        <div className="focus-shortcuts" aria-label="快速辨識篩選">
          {(
            [
              ["video", "快速核對"],
              ["ultimate", "季節畢業"],
              ["limited", "禮包限定"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={focusMode === key ? "active" : ""}
              aria-pressed={focusMode === key}
              onClick={() => {
                setFocusMode((current) => (current === key ? "all" : key));
                resetVisibleItems();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="filter-panel"
          id="advanced-filters"
          hidden={!filterPanelOpen}
        >
          <label className="source-select">
            <span>來源</span>
            <select
              value={sourceFilter}
              onChange={(event) => {
                const next = event.target.value;
                setSourceFilter(next);
                if (next !== "seasons") setSeason("全部季節");
                resetVisibleItems();
              }}
              aria-label="來源篩選"
            >
              {sourceFilters.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          {sourceFilter === "seasons" && (
            <label className="source-select season-select">
              <span>季節</span>
              <select
                aria-label="季節篩選"
                value={season}
                onChange={(event) => {
                  setSeason(event.target.value);
                  resetVisibleItems();
                }}
              >
                <option value="全部季節">全部季節</option>
                {seasons.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="clear-filters"
            onClick={resetAdvancedFilters}
            disabled={activeFilterCount === 0}
          >
            清除篩選
          </button>
        </div>
      </div>
      <div className="closet-nav" aria-label="衣櫃順序">
        {closetGroups.map((entry) => (
          <button
            type="button"
            key={entry.key}
            className={closet === entry.key ? "selected" : ""}
            aria-pressed={closet === entry.key}
            onClick={() => {
              const firstSub = entry.subs[0];
              selectClosetSub({
                closetKey: entry.key,
                closetName: entry.name,
                subKey: firstSub.key,
                subName: firstSub.name,
              });
            }}
          >
            {entry.order && <b>{entry.order}</b>}
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
      {activeCloset.subs.length > 0 && (
        <div className="closet-subs">
          {activeCloset.subs.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              className={sub === entry.key ? "selected" : ""}
              aria-pressed={sub === entry.key}
              onClick={() => {
                selectClosetSub({
                  closetKey: activeCloset.key,
                  closetName: activeCloset.name,
                  subKey: entry.key,
                  subName: entry.name,
                });
              }}
            >
              <i>{index + 1}</i>
              {entry.name}
            </button>
          ))}
        </div>
      )}
      <div className="result-head">
        <h2>
          {deferredQuery
            ? `「${deferredQuery.trim()}」搜尋結果`
            : season !== "全部季節"
              ? seasonZh[season]
              : focusMode === "video"
                ? "快速核對"
                : focusMode === "ultimate"
                  ? "季節畢業"
                  : focusMode === "limited"
                    ? "禮包限定"
                    : `${activeCloset.name}／${activeSub.name}`}{" "}
          · {filtered.length.toLocaleString()} 件
        </h2>
        {searchPending && <small role="status">搜尋中…</small>}
      </div>
      {filtered.length ? (
        <div className="grid" aria-busy={searchPending}>
          {visibleCards.map((card) => (
            <CatalogItemCard
              key={card.item.guid}
              item={card.item}
              selected={owned.has(card.item.guid)}
              onToggle={onToggleOwned}
              displayName={card.displayName}
              sourceLabel={card.sourceLabel}
              typeLabel={card.typeLabel}
              ultimate={card.ultimate}
              pendant={card.pendant}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <b>找不到符合條件的物品</b>
        </div>
      )}
      {hasMoreItems && (
        <div className="load-more" ref={loadMoreRef}>
          <span>
            已顯示 {visibleItems.length.toLocaleString()}／
            {filtered.length.toLocaleString()} 件
          </span>
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + VISIBLE_ITEM_BATCH, filtered.length),
              )
            }
          >
            顯示更多
          </button>
        </div>
      )}
      <div className="step-actions catalog-next">
        <button type="button" className="secondary" onClick={onBack}>
          返回帳號資料
        </button>
        <button
          type="button"
          onClick={() => {
            if (!query.trim() && nextClosetSub) {
              selectClosetSub(nextClosetSub, true);
            } else {
              onNext();
            }
          }}
        >
          {!query.trim() && nextClosetSub
            ? nextClosetSub.closetKey === activeCloset.key
              ? `下一類：${nextClosetSub.subName}`
              : `下一衣櫃：${nextClosetSub.closetName} · ${nextClosetSub.subName}`
            : "估價與匯出"}
        </button>
      </div>
    </section>
  );
}
