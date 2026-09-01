"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CatalogItemCard } from "./catalog-item-card";
import {
  INITIAL_VISIBLE_ITEMS,
  type CatalogStepState,
} from "./organizer-step-state";
import type { ClosetSubRoute } from "./catalog-taxonomy";
import type { CatalogRuntime } from "./use-organizer-runtime";
import {
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "./valuation-items";

const VISIBLE_ITEM_BATCH = 40;

export function CatalogStep({
  runtime,
  state,
  owned,
  onToggleOwned,
  onBack,
  onNext,
}: {
  runtime: CatalogRuntime;
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
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const {
    wikiItems,
    closetGroups,
    allClosetTypeSet,
    compareCatalogItems,
    isLimitedItem,
    isProfessionalVideoFocus,
    matchesSourceFilter,
    matchesSub,
    searchIndex,
    seasonZh,
    seasons,
    sourceFilters,
    sourceKind,
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
    const media = window.matchMedia("(max-width: 700px)");
    const updateMobileFilters = () => setMobileFilters(media.matches);
    updateMobileFilters();
    media.addEventListener("change", updateMobileFilters);
    return () => media.removeEventListener("change", updateMobileFilters);
  }, []);

  useEffect(() => {
    if (!filterPanelOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements: HTMLElement[] = mobileFilters
      ? Array.from(catalogRef.current?.children ?? []).filter(
          (element) =>
            !element.classList.contains("filter-panel") &&
            !element.classList.contains("filter-backdrop"),
        ) as HTMLElement[]
      : [];
    const backgroundState = backgroundElements.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement & { inert: boolean }).inert,
    }));
    if (mobileFilters) document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      (element as HTMLElement & { inert: boolean }).inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    const focusFrame = mobileFilters
      ? window.requestAnimationFrame(() => {
          filterPanelRef.current
            ?.querySelector<HTMLElement>("button, select")
            ?.focus();
        })
      : 0;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFilterPanelOpen(false);
        return;
      }
      if (
        !mobileFilters ||
        event.key !== "Tab" ||
        !filterPanelRef.current
      )
        return;
      const focusable = Array.from(
        filterPanelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (!filterPanelRef.current.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeys);
      if (mobileFilters) document.body.style.overflow = previousOverflow;
      backgroundState.forEach(({ element, ariaHidden, inert }) => {
        (element as HTMLElement & { inert: boolean }).inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [filterPanelOpen, mobileFilters, setFilterPanelOpen]);

  useEffect(() => {
    if (!nextClosetSub) return;
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;
    if (
      connection?.saveData ||
      ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "")
    )
      return;
    const nextIcons = wikiItems
      .filter((item) => matchesSub(item, nextClosetSub.subKey))
      .slice(0, 4)
      .map((item) => item.icon);
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    const preload = () => {
      if (cancelled) return;
      nextIcons.forEach((src) => {
        const image = new Image();
        image.referrerPolicy = "no-referrer";
        image.src = src;
        images.push(image);
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleHandle = idleWindow.requestIdleCallback?.(preload);
    const timeoutHandle =
      idleHandle === undefined ? window.setTimeout(preload, 650) : undefined;
    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
      images.forEach((image) => {
        image.removeAttribute("src");
      });
    };
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
        compareCatalogItems(
          left,
          right,
          normalizedQuery
            ? "type"
            : sub === "held"
              ? "held"
              : sub === "large"
                ? "shared"
                : "type",
        ),
      );
  }, [
    activeCloset,
    allClosetTypeSet,
    compareCatalogItems,
    deferredQuery,
    focusMode,
    isLimitedItem,
    isProfessionalVideoFocus,
    matchesSourceFilter,
    matchesSub,
    searchIndex,
    season,
    sourceFilter,
    sub,
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
        ultimate: isSeasonUltimate(item),
        pendant: isSeasonPendant(item),
      })),
    [sourceKind, visibleItems, zhItemName],
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
  const filterPanel = (
    <div
      className="filter-panel"
      id="advanced-filters"
      ref={filterPanelRef}
      role={mobileFilters ? "dialog" : "region"}
      aria-modal={mobileFilters || undefined}
      aria-labelledby="filter-panel-title"
      hidden={!filterPanelOpen}
    >
      <div className="filter-panel-head">
        <b id="filter-panel-title">篩選物品</b>
        <button type="button" onClick={() => setFilterPanelOpen(false)}>
          完成
        </button>
      </div>
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
  );

  return (
    <section className="catalog" id="top" ref={catalogRef}>
      <div className="catalog-intro">
        <h1>選擇物品</h1>
        <button type="button" onClick={onNext}>
          前往估價
        </button>
      </div>
      <div className="discovery-tools">
        <div className="discovery-primary">
          <div className="catalog-search">
            <label className="visually-hidden" htmlFor="catalog-search">
              搜尋物品
            </label>
            <div>
              <i>⌕</i>
              <input
                id="catalog-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetVisibleItems();
                }}
                placeholder="搜尋名稱、季節或 ID"
              />
            </div>
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
        <div
          className="focus-shortcuts"
          role="group"
          aria-label="快速辨識篩選"
        >
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
        {!mobileFilters && filterPanel}
      </div>
      <nav className="closet-nav" aria-label="衣櫃順序">
        {closetGroups.map((entry) => (
          <button
            type="button"
            key={entry.key}
            className={closet === entry.key ? "selected" : ""}
            aria-pressed={closet === entry.key}
            onClick={() => {
              const firstSub = entry.subs[0];
              selectClosetSub(
                {
                  closetKey: entry.key,
                  closetName: entry.name,
                  subKey: firstSub.key,
                  subName: firstSub.name,
                },
                true,
              );
            }}
          >
            <span>{entry.name}</span>
          </button>
        ))}
      </nav>
      {activeCloset.subs.length > 0 && (
        <nav className="closet-subs" aria-label={`${activeCloset.name}子分類`}>
          {activeCloset.subs.map((entry, index) => (
            <button
              type="button"
              key={entry.key}
              className={sub === entry.key ? "selected" : ""}
              aria-pressed={sub === entry.key}
              onClick={() => {
                selectClosetSub(
                  {
                    closetKey: activeCloset.key,
                    closetName: activeCloset.name,
                    subKey: entry.key,
                    subName: entry.name,
                  },
                  true,
                );
              }}
            >
              <i>{index + 1}</i>
              {entry.name}
            </button>
          ))}
        </nav>
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
        <div className="result-status">
          <b>已選 {owned.size.toLocaleString()}</b>
          {searchPending && <small role="status">搜尋中…</small>}
        </div>
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
      {filterPanelOpen && (
        <button
          type="button"
          className="filter-backdrop"
          aria-label="關閉篩選"
          onClick={() => setFilterPanelOpen(false)}
        />
      )}
      {mobileFilters && filterPanel}
    </section>
  );
}
