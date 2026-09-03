"use client";

import { useState } from "react";

type FocusMode = "all" | "video" | "ultimate" | "limited";
export type ShowcasePreset = "valuation" | "video" | "collection";
export const INITIAL_VISIBLE_ITEMS = 32;

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

export const useValuationStepState = () => {
  const [showcasePreset, setShowcasePreset] =
    useState<ShowcasePreset>("valuation");
  return { showcasePreset, setShowcasePreset };
};

export type ValuationStepState = ReturnType<typeof useValuationStepState>;
