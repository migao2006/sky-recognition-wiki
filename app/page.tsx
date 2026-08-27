"use client";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  bindingKeys,
  bindingNames,
  bindingOptions,
  bundlePresets,
  emptyBindings,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import {
  formatMarketBindings,
  formatMarketPlatform,
} from "./market-copy";
import {
  ACCOUNT_DRAFT_STORAGE_KEY,
  createAccountBackup,
  createAccountDraft,
  parseAccountBackup,
  parseAccountDraft,
} from "./account-backup";
import type { WikiItem } from "./wiki-data";
import {
  allClosetTypeSet,
  closetGroups,
  getNextClosetSub,
  eventZh,
  graduationSeasonSlugs,
  heldClosetOrder,
  isLimitedItem,
  isProfessionalVideoFocus,
  isValuationFocus,
  labels,
  matchesSourceFilter,
  matchesSub,
  ongoingSeasonSlugs,
  realmZh,
  searchIndex,
  seasonGraduationItems,
  seasonUltimateItems,
  seasonUltimateSlugs,
  seasonZh,
  seasons,
  showcaseClusterOrder,
  sortSeasonSlugs,
  source,
  sourceFilters,
  sourceKind,
  storeSource,
  typeOrder,
  type ClosetSubRoute,
  uniqueByGuid,
  wikiItems,
  zhItemName,
} from "./catalog-domain";
import {
  isGraduationGift,
  isChinaOnlyItem,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "./valuation-items";
import {
  analyzeValuation,
  estimateValuation,
  type ValuationDomain,
} from "./valuation-analysis";
import {
  seasonPriceBands,
  valuationSampleSummary,
  type SeasonConfidence,
} from "./valuation-season-bands";

const safeFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名";
const formatTwd = (value: number) =>
  `NT$ ${Math.abs(value).toLocaleString("zh-TW")}`;
const formatContribution = (low: number, high: number) => {
  const signed = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatTwd(value)}`;
  return low === high ? signed(low) : `${signed(low)}～${signed(high)}`;
};
const confidenceNames: Record<SeasonConfidence, string> = {
  high: "高可信",
  medium: "中可信",
  low: "低可信",
  inferred: "推估",
};
const localizeValuationLabel = (label: string) => {
  const match = Object.entries(seasonZh).find(([slug]) => label.includes(slug));
  return match ? label.replace(match[0], match[1]) : label;
};
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const valuationDomain: ValuationDomain = {
  isValuationFocus,
  isLimitedItem,
  sourceKind,
  ongoingSeasonSlugs,
  graduationSeasonSlugs,
  seasonGraduationItems,
  sortSeasonSlugs,
  getZhName: zhItemName,
};
const bundlePresetItems = new Map(
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
);
const saleCopyPresetGuids = new Set(
  [...bundlePresetItems.values()].flatMap((items) =>
    items.map((item) => item.guid),
  ),
);
const validItemGuids = new Set(wikiItems.map((item) => item.guid));
const emptySelectedGuids = new Set<string>();
type FocusMode = "all" | "video" | "ultimate" | "limited";
type ShowcasePreset = "valuation" | "video" | "collection";
const showcasePresetNames: Record<ShowcasePreset, string> = {
  valuation: "專業估價",
  video: "快速核對",
  collection: "完整衣櫃",
};
const showcasePresetDescriptions: Record<ShowcasePreset, string> = {
  valuation: "含參考價格",
  video: "重點物品",
  collection: "全部物品",
};
const showcaseClusterName = (item: WikiItem) =>
  item.section === "seasons"
    ? seasonZh[item.collection] || item.collection
    : item.section === "events"
      ? eventZh[item.collection] || item.collection
      : item.section === "realms"
        ? realmZh[item.collection] || "常駐地圖"
        : item.section === "store"
          ? storeSource(item)
          : sourceKind(item);
const orderShowcaseItems = (items: WikiItem[]) =>
  [...items].sort((a, b) => {
    const groupRank = (item: WikiItem) =>
      isSeasonUltimate(item)
        ? 0
        : isPaidItem(item) || isLimitedItem(item)
          ? 1
          : 2;
    const rankA = groupRank(a);
    const rankB = groupRank(b);
    const group = rankA - rankB;
    if (group) return group;
    const cluster =
      rankA === 2
        ? (typeOrder.get(a.type) ?? 999) - (typeOrder.get(b.type) ?? 999) ||
          (labels[a.type] || a.type).localeCompare(
            labels[b.type] || b.type,
            "zh-Hant",
          )
        : showcaseClusterOrder(a) - showcaseClusterOrder(b) ||
          showcaseClusterName(a).localeCompare(
            showcaseClusterName(b),
            "zh-Hant",
          );
    if (cluster) return cluster;
    return (
      (isSeasonUltimate(a)
        ? Number(isSeasonPendant(b)) - Number(isSeasonPendant(a))
        : (typeOrder.get(a.type) ?? 999) -
          (typeOrder.get(b.type) ?? 999)) ||
      a.order - b.order ||
      a.id - b.id ||
      a.guid.localeCompare(b.guid)
    );
  });
const emptyAccount = (): AccountInfo => ({
  name: "",
  accountType: "有翼",
  bindingsConfirmed: false,
  candles: "",
  hearts: "",
  ascended: "",
  passes: "",
  bindingNote: "",
  notes: "",
});
const hasAccountData = (
  account: AccountInfo,
  bindings: Record<BindingKey, BindingStatus>,
  owned: ReadonlySet<string>,
) =>
  owned.size > 0 ||
  account.accountType !== "有翼" ||
  account.bindingsConfirmed ||
  [
    account.name,
    account.candles,
    account.hearts,
    account.ascended,
    account.passes,
    account.bindingNote,
    account.notes,
  ].some((value) => value.trim()) ||
  Object.values(bindings).some((value) => value !== "none");

const CatalogItemCard = memo(function CatalogItemCard({
  item,
  selected,
  onToggle,
}: {
  item: WikiItem;
  selected: boolean;
  onToggle: (guid: string) => void;
}) {
  return (
    <button
      className={`item-card selectable ${selected ? "owned" : ""}`}
      onClick={() => onToggle(item.guid)}
      aria-pressed={selected}
    >
      <div className="image-wrap">
        <span className="owned-check">{selected ? "✓" : "＋"}</span>
        {isSeasonUltimate(item) && (
          <span className="discontinued-badge">
            {isSeasonPendant(item) ? "季卡" : "畢業"}
          </span>
        )}
        <span className="source-badge">{sourceKind(item)}</span>
        <span className={`type type-${item.type} type-badge`}>
          {labels[item.type] || item.type}
        </span>
        {/* External catalog icons must keep their source URL and referrer policy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.icon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="card-body">
        <h2>{zhItemName(item)}</h2>
      </div>
    </button>
  );
});

export default function AccountOrganizer() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [visibleCount, setVisibleCount] = useState(80);
  const [closet, setCloset] = useState(closetGroups[0].key),
    [sub, setSub] = useState(closetGroups[0].subs[0].key),
    [season, setSeason] = useState("全部季節");
  const [query, setQuery] = useState(""),
    [sourceFilter, setSourceFilter] = useState("all");
  const [focusMode, setFocusMode] = useState<FocusMode>("all");
  const [showcasePreset, setShowcasePreset] =
    useState<ShowcasePreset>("valuation");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchPending = query !== deferredQuery;
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<AccountInfo>(emptyAccount);
  const [bindings, setBindings] =
    useState<Record<BindingKey, BindingStatus>>(emptyBindings);
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const importRef = useRef<HTMLInputElement>(null);
  const skipNextDraftSave = useRef(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let restored: ReturnType<typeof parseAccountDraft> | null = null;
      let available = true;
      try {
        const stored = localStorage.getItem(ACCOUNT_DRAFT_STORAGE_KEY);
        if (stored) {
          restored = parseAccountDraft(JSON.parse(stored), validItemGuids);
        }
      } catch {
        try {
          localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
        } catch {
          available = false;
        }
      }
      if (cancelled) return;
      if (restored) {
        const restoredOwned = new Set(restored.owned);
        if (hasAccountData(restored.account, restored.bindings, restoredOwned)) {
          skipNextDraftSave.current = true;
          setAccount(restored.account);
          setBindings(restored.bindings);
          setOwned(restoredOwned);
          setNotice("已恢復此裝置上的草稿");
        } else {
          try {
            localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
          } catch {
            available = false;
          }
        }
      }
      setDraftAvailable(available);
      setDraftReady(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!draftReady || !draftAvailable) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        if (hasAccountData(account, bindings, owned)) {
          localStorage.setItem(
            ACCOUNT_DRAFT_STORAGE_KEY,
            JSON.stringify(
              createAccountDraft({ account, bindings, owned }),
            ),
          );
        } else {
          localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
        }
      } catch {
        try {
          localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
        } catch {
          // Storage is unavailable; the in-memory session remains usable.
        }
        setDraftAvailable(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [account, bindings, draftAvailable, draftReady, owned]);
  const activeCloset =
    closetGroups.find((x) => x.key === closet) || closetGroups[0];
  const activeSub =
    activeCloset.subs.find((entry) => entry.key === sub) ||
    activeCloset.subs[0];
  const nextClosetSub = getNextClosetSub(activeCloset.key, activeSub.key);
  const valuationOwned = activeStep === 3 ? owned : emptySelectedGuids;
  const chosen = useMemo(
    () =>
      wikiItems.filter(
        (x) => valuationOwned.has(x.guid) && allClosetTypeSet.has(x.type),
      ),
    [valuationOwned],
  );
  const valuationAnalysis = useMemo(
    () =>
      analyzeValuation({
        chosen,
        bindings,
        bindingNote: account.bindingNote,
        domain: valuationDomain,
      }),
    [chosen, bindings, account.bindingNote],
  );
  const valuationEstimate = useMemo(
    () =>
      estimateValuation({
        analysis: valuationAnalysis,
        resources: {
          candles: account.candles,
          hearts: account.hearts,
          ascended: account.ascended,
          passes: account.passes,
        },
      }),
    [
      account.ascended,
      account.candles,
      account.hearts,
      account.passes,
      valuationAnalysis,
    ],
  );
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase("zh-Hant");
    return wikiItems
      .filter(
        (x) =>
          (q
            ? allClosetTypeSet.has(x.type)
            : activeCloset.types.includes(x.type)) &&
          (!q ? matchesSub(x, sub) : true) &&
          matchesSourceFilter(x, sourceFilter) &&
          (sourceFilter !== "seasons" ||
            season === "全部季節" ||
            x.collection === season) &&
          (focusMode !== "ultimate" || isSeasonUltimate(x)) &&
          (focusMode !== "limited" || isPaidItem(x) || isLimitedItem(x)) &&
          (focusMode !== "video" || isProfessionalVideoFocus(x)) &&
          (!q || searchIndex.get(x.guid)?.includes(q)),
      )
      .sort((a, b) =>
        sub === "held"
          ? (heldClosetOrder.get(a.name) ?? 999) -
              (heldClosetOrder.get(b.name) ?? 999)
          : a.type === b.type
          ? a.order - b.order || a.name.localeCompare(b.name)
          : (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99),
      );
  }, [
    sub,
    season,
    activeCloset,
    deferredQuery,
    sourceFilter,
    focusMode,
  ]);
  const visibleItems = filtered.slice(0, visibleCount);
  const resetVisibleItems = () => setVisibleCount(80);
  const selectClosetSub = (
    route: ClosetSubRoute,
    scrollToResults = false,
  ) => {
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
  const goToStep = (step: 1 | 2 | 3) => {
    if (step === activeStep) return;
    setActiveStep(step);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, behavior });
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
  const toggleOwned = useCallback((guid: string) =>
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    }), []);
  const quickPresetState = (items: WikiItem[]) => {
    const selected = items.filter((x) => owned.has(x.guid)).length;
    return {
      selected,
      complete: items.length > 0 && selected === items.length,
      partial: selected > 0 && selected < items.length,
    };
  };
  const toggleQuickPreset = (label: string, items: WikiItem[]) => {
    const ids = [...new Set(items.map((x) => x.guid))],
      complete = ids.length > 0 && ids.every((id) => owned.has(id));
    setOwned((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (complete ? next.delete(id) : next.add(id)));
      return next;
    });
    setNotice(
      complete
        ? `已取消「${label}」${ids.length} 件`
        : `已選取「${label}」${ids.length} 件`,
    );
  };
  const downloadText = (lines: string[], suffix: string) =>
    downloadBlob(
      new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_${suffix}.txt`,
    );
  const saleCopyData = () => {
    const collectibleItems = uniqueByGuid(
      chosen.filter(
        (item) =>
          isLimitedItem(item) ||
          isPaidItem(item) ||
          saleCopyPresetGuids.has(item.guid) ||
          item.collection === "event-sky-anniversary",
      ),
    );
    return {
      seasons: seasons.map(([slug, name]) => ({
        slug,
        name,
        owned: chosen.filter(
          (item) =>
            item.section === "seasons" &&
            item.collection === slug &&
            isGraduationGift(item),
        ).length,
        total: seasonGraduationItems.get(slug)?.length ?? 0,
      })),
      bindingsConfirmed: account.bindingsConfirmed,
      bindings,
      items: collectibleItems.map((item) => ({
        guid: item.guid,
        name: item.name,
        displayName: zhItemName(item),
        section: item.section,
        collection: item.collection,
        group: item.group,
        wiki: item.wiki,
        sourceName:
          isChinaOnlyItem(item)
            ? "國服限定"
            : item.section === "seasons"
            ? seasonZh[item.collection] || item.collection
            : item.section === "events"
              ? eventZh[item.collection] || item.collection
              : item.section === "store"
                ? storeSource(item)
                : sourceKind(item),
        order: item.order,
      })),
    };
  };
  const exportAccount = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    const lines = buildSaleCopy(saleCopyData());
    downloadText(lines, "出售文案");
  };
  const exportJson = () => {
    const backup = createAccountBackup({
      account,
      bindings,
      items: chosen,
      getZhName: zhItemName,
      getSource: source,
    });
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_備份.json`,
    );
  };
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = parseAccountBackup(
        JSON.parse(await file.text()),
        validItemGuids,
      );
      setAccount(imported.account);
      setBindings(imported.bindings);
      setOwned(new Set(imported.owned));
      setNotice("JSON 備份已匯入");
    } catch {
      setNotice("無法匯入：檔案格式不正確");
    }
  };
  const clearAllData = () => {
    if (!window.confirm("確定要清除帳號資料、綁定狀態與已選物品？")) return;
    try {
      localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
    } catch {
      setDraftAvailable(false);
    }
    setAccount(emptyAccount());
    setBindings(emptyBindings());
    setOwned(new Set());
    setNotice("已清除全部資料");
  };
  const shareSummary = async () => {
    const { buildShareSummary } = await import("./sale-copy");
    const summary = buildShareSummary(saleCopyData()).join("\n");
    try {
      if (navigator.share)
        await navigator.share({ title: "光遇帳號摘要", text: summary });
      else {
        await navigator.clipboard.writeText(summary);
        setNotice("帳號摘要已複製");
      }
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        downloadText([summary], "分享摘要");
        setNotice("已改為下載摘要");
      }
    }
  };
  const getShowcaseItems = (preset: ShowcasePreset) => {
    if (preset === "collection") return chosen;
    if (preset === "video") {
      const videoItems = chosen.filter(isProfessionalVideoFocus);
      return videoItems.length
        ? videoItems
        : chosen.filter(isValuationFocus);
    }
    return valuationAnalysis.valuationItems.length
      ? valuationAnalysis.valuationItems
      : chosen;
  };
  const exportShowcaseImage = async () => {
    if (!chosen.length) {
      setNotice("尚未選取物品");
      return;
    }
    const exportItems = getShowcaseItems(showcasePreset);
    if (!exportItems.length) {
      setNotice("這個版型沒有可匯出的物品");
      return;
    }
    setNotice("正在產生圖片…");
    try {
      const { renderShowcaseImage } = await import("./export-showcase");
      const blob = await renderShowcaseImage({
        items: exportItems,
        preset: showcasePreset,
        valuation: {
          midpoint: valuationEstimate?.midpoint ?? null,
          range: valuationEstimate?.range ?? null,
          confidence: valuationEstimate
            ? confidenceNames[valuationEstimate.confidence]
            : "資料不足",
          completeness: valuationAnalysis.completeness,
          itemCount: valuationAnalysis.valuationItems.length,
          highlights: valuationEstimate
            ? valuationEstimate.contributions
                .slice(0, 5)
                .map((row) => localizeValuationLabel(row.label))
            : [],
        },
        isUltimate: isSeasonUltimate,
        isLimited: (item) => isPaidItem(item) || isLimitedItem(item),
        isPendant: isSeasonPendant,
        getClusterName: showcaseClusterName,
        getClusterOrder: showcaseClusterOrder,
        getItemTypeName: (item) => labels[item.type] || item.type,
        getItemTypeOrder: (item) => typeOrder.get(item.type) ?? 999,
      });
      downloadBlob(
        blob,
        `光遇帳號_${safeFileName(account.name)}_${showcasePresetNames[showcasePreset]}.png`,
      );
      setNotice("整理圖片已下載");
    } catch {
      setNotice("圖片產生失敗");
    }
  };
  const changedBindings = bindingKeys.filter((key) => bindings[key] !== "none");
  const bindingSummary = account.bindingsConfirmed
    ? formatMarketBindings(bindings)
    : "尚未確認";
  const hasBindingIssue = changedBindings.some(
    (key) => bindings[key] === "issue",
  );
  const previewItems = orderShowcaseItems(getShowcaseItems(showcasePreset));
  const previewLimit = showcasePreset === "collection" ? 24 : 16;
  return (
    <main className="app-shell">
      <nav className="workflow-steps" aria-label="帳號整理步驟">
        {[
          [1, "帳號資料"],
          [2, "選擇物品"],
          [3, "估價與匯出"],
        ].map(([step, label]) => (
          <button
            type="button"
            className={activeStep === step ? "active" : ""}
            aria-current={activeStep === step ? "step" : undefined}
            key={step}
            onClick={() => goToStep(step as 1 | 2 | 3)}
          >
            <i>{step}</i>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {activeStep !== 2 && (
      <section className="account-panel">
        {activeStep === 1 && <>
        <div className="account-intro">
          <div>
            <span className="step-kicker">步驟 1／3</span>
            <h1>帳號資料</h1>
            <p>先填帳號類型與綁定，其餘可後補。</p>
          </div>
        </div>
        <div className="account-form">
          <div className="form-section-title">
            <b>帳號資訊</b>
          </div>
          <label className="account-name">
            帳號名稱
            <input
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              placeholder="例如：追光大斷禮包號"
            />
          </label>
          <label>
            帳號類型
            <select
              value={account.accountType}
              onChange={(e) =>
                setAccount({ ...account, accountType: e.target.value })
              }
            >
              <option>有翼</option>
              <option>無翼</option>
            </select>
          </label>
          <details className="account-extra">
            <summary>
              <span>
                <b>資源／備註</b>
                <small>白蠟、愛心、副卡與其他說明</small>
              </span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="account-extra-grid">
              <label>
                白蠟
                <input
                  inputMode="numeric"
                  value={account.candles}
                  onChange={(e) =>
                    setAccount({ ...account, candles: e.target.value })
                  }
                  placeholder="0"
                />
              </label>
              <label>
                愛心
                <input
                  inputMode="numeric"
                  value={account.hearts}
                  onChange={(e) =>
                    setAccount({ ...account, hearts: e.target.value })
                  }
                  placeholder="0"
                />
              </label>
              <label>
                昇華蠟
                <input
                  inputMode="numeric"
                  value={account.ascended}
                  onChange={(e) =>
                    setAccount({ ...account, ascended: e.target.value })
                  }
                  placeholder="0"
                />
              </label>
              <label>
                副卡
                <input
                  inputMode="numeric"
                  value={account.passes}
                  onChange={(e) =>
                    setAccount({ ...account, passes: e.target.value })
                  }
                  placeholder="0"
                />
              </label>
              <label className="account-notes">
                其他說明
                <input
                  value={account.notes}
                  onChange={(e) =>
                    setAccount({ ...account, notes: e.target.value })
                  }
                  placeholder="帳號狀態、缺資料或交易前須知"
                />
              </label>
            </div>
          </details>
          <details
            className={`binding-section${hasBindingIssue ? " has-issue" : ""}`}
          >
            <summary>
              <span>
                <b>綁定狀態</b>
                <small>{bindingSummary}</small>
              </span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="binding-content">
            <div className="binding-grid">
              {bindingKeys.map((key) => (
                <label
                  className={`binding-card status-${bindings[key]}`}
                  key={key}
                >
                  <span>{formatMarketPlatform(key)}</span>
                  <select
                    value={bindings[key]}
                    onChange={(e) => {
                      setBindings({
                        ...bindings,
                        [key]: e.target.value as BindingStatus,
                      });
                      setAccount({ ...account, bindingsConfirmed: true });
                    }}
                    aria-label={`${bindingNames[key]}綁定狀態`}
                  >
                    {bindingOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {key === "nintendo" && option.key === "transfer"
                          ? "解"
                          : option.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
              <label className="binding-confirm">
                <input
                  type="checkbox"
                  checked={account.bindingsConfirmed}
                  onChange={(event) =>
                    setAccount({
                      ...account,
                      bindingsConfirmed: event.target.checked,
                    })
                  }
                />
                已確認以上綁定狀態
              </label>
              <label className="account-notes">
                綁定說明
                <input
                  value={account.bindingNote}
                  onChange={(e) =>
                    setAccount({ ...account, bindingNote: e.target.value })
                  }
                  placeholder="例如：ɢᴄ 前號不出、ɢɢ 私用、ғʙ 遺失"
                />
              </label>
            </div>
          </details>
        </div>
        <details className="season-picker">
          <summary>
            <b>季節／畢業禮</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="season-picker-body">
            <div className="season-ultimate-grid">
              {seasonUltimateSlugs.map((slug) => {
                const items = seasonUltimateItems.get(slug) || [],
                  selectedCount = items.filter((item) =>
                    owned.has(item.guid),
                  ).length;
                return (
                  <article
                    className={`season-ultimate-card${selectedCount ? " has-selected" : ""}`}
                    key={slug}
                  >
                    <header>
                      <b>{seasonZh[slug]}</b>
                      <span>
                        {ongoingSeasonSlugs.has(slug)
                          ? `進行中 · ${selectedCount}／${items.length}`
                          : `${selectedCount}／${items.length}`}
                      </span>
                    </header>
                    <div className="season-ultimate-items">
                      {items.map((item) => {
                        const selected = owned.has(item.guid),
                          pendant = isSeasonPendant(item),
                          name = pendant ? "項鍊" : zhItemName(item);
                        return (
                          <button
                            type="button"
                            className={`season-ultimate-item${selected ? " selected" : ""}${pendant ? " pendant" : ""}`}
                            aria-pressed={selected}
                            aria-label={`${seasonZh[slug]}　${name}`}
                            title={`${seasonZh[slug]} · ${zhItemName(item)}`}
                            key={item.guid}
                            onClick={() => toggleOwned(item.guid)}
                          >
                            <span className="season-ultimate-icon">
                              {/* External catalog icons must keep their source URL and referrer policy. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.icon} alt="" loading="lazy" />
                              <i aria-hidden="true">{selected ? "✓" : ""}</i>
                            </span>
                            <small>{name}</small>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
        <details className="quick-select">
          <summary>
            <b>常用套組</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="quick-select-body">
            <section>
              <div className="preset-grid">
                {bundlePresets.map((preset) => {
                  const items = bundlePresetItems.get(preset.key) || [],
                    state = quickPresetState(items);
                  return (
                    <button
                      type="button"
                      className={
                        state.complete
                          ? "selected"
                          : state.partial
                            ? "partial"
                            : ""
                      }
                      aria-pressed={state.complete}
                      key={preset.key}
                      onClick={() => toggleQuickPreset(preset.name, items)}
                    >
                      <i className="preset-check" aria-hidden="true">
                        {state.complete ? "✓" : state.partial ? "–" : ""}
                      </i>
                      <span>
                        <b>{preset.name}</b>
                        <small>
                          {state.complete
                            ? "已選"
                            : state.partial
                              ? `${state.selected}/${items.length}`
                              : `${items.length} 件`}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </details>
        <div className="step-actions">
          <span>
            {draftAvailable
              ? "草稿保留在此裝置 30 天。"
              : "此瀏覽器無法保存草稿。"}
          </span>
          <button type="button" onClick={() => goToStep(2)}>
            下一步：選擇物品
          </button>
        </div>
        </>}
        {activeStep === 3 && <>
        <div className="summary-intro">
          <div>
            <span className="step-kicker">步驟 3／3</span>
            <h1>估價與匯出</h1>
            <p>核對參考價格，再整理圖片或刊登文案。</p>
          </div>
          <button type="button" onClick={() => goToStep(2)}>
            返回衣櫃
          </button>
        </div>
        <section className="showcase-builder" aria-labelledby="showcase-title">
          <div className="showcase-builder-head">
            <div>
              <span className="step-kicker">整理圖片</span>
              <h2 id="showcase-title">預覽後直接下載</h2>
            </div>
            <button
              type="button"
              className="showcase-download"
              onClick={exportShowcaseImage}
              disabled={!previewItems.length}
            >
              下載圖片
            </button>
          </div>
          <div className="showcase-presets" aria-label="整理圖片版型">
            {(Object.entries(showcasePresetNames) as [ShowcasePreset, string][]).map(
              ([key, name]) => {
                const itemCount = getShowcaseItems(key).length;
                return (
                  <button
                    type="button"
                    key={key}
                    className={showcasePreset === key ? "active" : ""}
                    aria-pressed={showcasePreset === key}
                    onClick={() => setShowcasePreset(key)}
                  >
                    <strong>{name}</strong>
                    <small>
                      {itemCount.toLocaleString()} 件 ·{" "}
                      {showcasePresetDescriptions[key]}
                    </small>
                  </button>
                );
              },
            )}
          </div>
          <div className={`showcase-preview preset-${showcasePreset}`}>
            <header>
              <span>{showcasePresetNames[showcasePreset]}</span>
              <b>{previewItems.length} 件</b>
            </header>
            {showcasePreset === "valuation" && (
              <div className="showcase-price">
                <span>參考中位價</span>
                <strong>
                  {valuationEstimate
                    ? formatTwd(valuationEstimate.midpoint)
                    : "NT$ —"}
                </strong>
                <small>
                  {valuationEstimate
                    ? `價格區間 ${formatTwd(valuationEstimate.range.low)}～${formatTwd(valuationEstimate.range.high)}`
                    : "選取估價物品後顯示"}
                </small>
              </div>
            )}
            <div className="showcase-preview-icons">
              {previewItems.slice(0, previewLimit).map((item) => (
                <span key={item.guid} title={zhItemName(item)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.icon}
                    alt={zhItemName(item)}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </span>
              ))}
              {previewItems.length > previewLimit && (
                <i>+{previewItems.length - previewLimit}</i>
              )}
            </div>
            {!previewItems.length && <p>尚未選取此版型需要的物品。</p>}
          </div>
        </section>
        <section className="valuation-report" aria-labelledby="valuation-title">
          <div className="valuation-report-head">
            <h2 id="valuation-title">估價分析</h2>
            <div
              className="completion-ring"
              aria-label={`估價完整度 ${valuationAnalysis.completeness}%`}
              style={
                {
                  "--completion": `${valuationAnalysis.completeness * 3.6}deg`,
                } as React.CSSProperties
              }
            >
              <b>{valuationAnalysis.completeness}%</b>
            </div>
          </div>
          <div className="valuation-summary">
            <article className="valuation-verdict">
              <span>
                參考中位價
                {valuationEstimate
                  ? ` · ${confidenceNames[valuationEstimate.confidence]}`
                  : ""}
              </span>
              <h3 className="model-price">
                {valuationEstimate
                  ? formatTwd(valuationEstimate.midpoint)
                  : "NT$ —"}
              </h3>
              {valuationEstimate && (
                <div className="valuation-range">
                  價格區間 {formatTwd(valuationEstimate.range.low)}～
                  {formatTwd(valuationEstimate.range.high)}
                </div>
              )}
              <p>
                {valuationAnalysis.valuationItems.length
                  ? "以中位價為主，展開可查看各項加減分。"
                  : chosen.length
                    ? "目前選取的物品不在估價範圍內。"
                    : "選取估價物品後顯示參考價格。"}
              </p>
              <button type="button" onClick={() => goToStep(2)}>
                {valuationAnalysis.valuationItems.length
                  ? "繼續核對衣櫃"
                  : "前往選取估價物品"}
              </button>
            </article>
            <div className="valuation-metrics">
              <article>
                <span>畢業禮</span>
                <b>{valuationAnalysis.ultimates.length}</b>
              </article>
              <article>
                <span>季卡項鍊</span>
                <b>{valuationAnalysis.pendants.length}</b>
              </article>
              <article>
                <span>付費物品</span>
                <b>{valuationAnalysis.packages.length}</b>
              </article>
              <article>
                <span>聯動／限定</span>
                <b>{valuationAnalysis.limited.length}</b>
              </article>
            </div>
          </div>
          {valuationEstimate && (
            <div className="valuation-details">
              <details open>
                <summary>
                  <b>加減分明細</b>
                  <span>{valuationEstimate.contributions.length} 項</span>
                </summary>
                <div className="valuation-contributions">
                  {valuationEstimate.contributions.map((row, index) => (
                    <div key={`${row.group}-${row.label}-${index}`}>
                      <span>
                        <i>{
                          {
                            season: "季節",
                            package: "禮包",
                            limited: "限定",
                            binding: "綁定",
                            resource: "資源",
                          }[row.group]
                        }</i>
                        {localizeValuationLabel(row.label)}
                      </span>
                      <b className={row.low < 0 || (row.percent ?? 0) < 0 ? "negative" : ""}>
                        {row.percent !== undefined
                          ? `${row.percent > 0 ? "+" : ""}${row.percent}%`
                          : formatContribution(row.low, row.high)}
                      </b>
                    </div>
                  ))}
                </div>
              </details>
              {valuationEstimate.seasonRows.length > 0 && (
                <details>
                  <summary>
                    <b>帳號季節完成度</b>
                    <span>{valuationEstimate.seasonRows.length} 季</span>
                  </summary>
                  <div className="valuation-season-table-wrap">
                    <table className="valuation-season-table">
                      <thead>
                        <tr>
                          <th>季節</th>
                          <th>完成</th>
                          <th>季節基準</th>
                          <th>單季貢獻</th>
                          <th>信心</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valuationEstimate.seasonRows.map((row) => (
                          <tr key={row.slug}>
                            <th>{seasonZh[row.slug] || row.slug}</th>
                            <td>{Math.round(row.completion * 100)}%</td>
                            <td>{formatTwd(row.low)}～{formatTwd(row.high)}</td>
                            <td>{formatTwd(row.contributionLow)}～{formatTwd(row.contributionHigh)}</td>
                            <td>{confidenceNames[row.confidence]} · {row.sampleCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              <details>
                <summary>
                  <b>查看全部季節價位</b>
                  <span>{seasonPriceBands.length} 季</span>
                </summary>
                <div className="valuation-season-table-wrap">
                  <table className="valuation-season-table">
                    <thead>
                      <tr>
                        <th>季節</th>
                        <th>快售～刊登</th>
                        <th>單季貢獻</th>
                        <th>樣本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonPriceBands.map((row) => (
                        <tr key={row.slug}>
                          <th>{seasonZh[row.slug] || row.slug}</th>
                          <td>{formatTwd(row.low)}～{formatTwd(row.high)}</td>
                          <td>{formatTwd(row.contributionLow)}～{formatTwd(row.contributionHigh)}</td>
                          <td>{confidenceNames[row.confidence]} · {row.sampleCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              {valuationEstimate.warnings.length > 0 && (
                <div className="valuation-warnings" role="status">
                  {valuationEstimate.warnings.map((warning) => (
                    <p key={warning}>• {warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="valuation-method">
            參考中位價與價格區間依季節完成度、去重禮包、限定稀缺性、平台綁定與帳號資源加權；資源採小額封頂，季卡項鍊只代表持有季卡，不代表畢業。
            <br />
            核對資料：{valuationSampleSummary.sourceRows.toLocaleString("zh-TW")} 筆帳號樣本，其中 {valuationSampleSummary.eligibleRows} 筆國際服台幣中高證據樣本納入推斷（資料日期 {valuationSampleSummary.asOf}）。
            <a
              href="https://drive.google.com/drive/folders/1lX7g1HnugqZWgIfL47CTmbp6-uHUfyXm"
              target="_blank"
              rel="noreferrer"
            >
              雲端市場樣本
            </a>
            、
            <a
              href="https://m.kejinshou.com/report/high/d_28268174"
              target="_blank"
              rel="noreferrer"
            >
              中國估價案例
            </a>
            、
            <a
              href="https://skygj.cn/"
              target="_blank"
              rel="noreferrer"
            >
              SKY 估價平台
            </a>
            。另以 {valuationSampleSummary.secondaryMarketRows} 筆中國服資料作趨勢校驗，不直接混入台幣價格；刊登價格不等於成交價，結果僅供市場參考。
          </p>
        </section>
        <div className="account-actions">
          <div className="account-danger">
            <button
              className="clear-owned"
              disabled={!owned.size}
              onClick={() => setOwned(new Set())}
            >
              清除已選物品
            </button>
            <button
              className="clear-owned"
              disabled={!hasAccountData(account, bindings, owned)}
              onClick={clearAllData}
            >
              清除全部資料
            </button>
          </div>
          <details className="more-exports">
            <summary>
              <b>更多匯出方式</b>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="export-tools" aria-label="帳號匯入與匯出">
              <button onClick={exportAccount}>出售文案</button>
              <button onClick={exportJson}>匯出 JSON</button>
              <button onClick={() => importRef.current?.click()}>
                匯入 JSON
              </button>
              <button className="export-account" onClick={shareSummary}>
                分享摘要
              </button>
            </div>
          </details>
          <input
            ref={importRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={importJson}
          />
        </div>
        </>}
      </section>
      )}
      {activeStep === 2 && (
      <section className="catalog" id="top">
        <div className="catalog-intro">
          <div>
            <span className="step-kicker">步驟 2／3</span>
            <h1>選擇物品</h1>
            <p>搜尋或選分類，點一下即可加入。</p>
          </div>
          <button type="button" onClick={() => goToStep(3)}>
            前往估價 · {owned.size} 件
          </button>
        </div>
        <div className="discovery-tools">
          <div className="discovery-primary">
            <label className="catalog-search">
              <span>搜尋物品</span>
              <div>
                <i>⌕</i>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
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
              <small>{activeFilterCount ? "已套用條件" : "更多條件"}</small>
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
                onChange={(e) => {
                  const next = e.target.value;
                  setSourceFilter(next);
                  if (next !== "seasons") setSeason("全部季節");
                  resetVisibleItems();
                }}
                aria-label="來源篩選"
              >
                {sourceFilters.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
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
                  onChange={(e) => {
                    setSeason(e.target.value);
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
          {closetGroups.map((x) => (
            <button
              type="button"
              key={x.key}
              className={closet === x.key ? "selected" : ""}
              aria-pressed={closet === x.key}
              onClick={() => {
                const firstSub = x.subs[0];
                selectClosetSub({
                  closetKey: x.key,
                  closetName: x.name,
                  subKey: firstSub.key,
                  subName: firstSub.name,
                });
              }}
            >
              {x.order && <b>{x.order}</b>}
              <span>{x.name}</span>
            </button>
          ))}
        </div>
        {activeCloset.subs.length > 0 && (
          <div className="closet-subs">
            {activeCloset.subs.map((x, i) => (
              <button
                type="button"
                key={x.key}
                className={sub === x.key ? "selected" : ""}
                aria-pressed={sub === x.key}
                onClick={() => {
                  selectClosetSub({
                    closetKey: activeCloset.key,
                    closetName: activeCloset.name,
                    subKey: x.key,
                    subName: x.name,
                  });
                }}
              >
                <i>{i + 1}</i>
                {x.name}
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
            {visibleItems.map((item) => (
              <CatalogItemCard
                key={item.guid}
                item={item}
                selected={owned.has(item.guid)}
                onToggle={toggleOwned}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <b>找不到符合條件的物品</b>
          </div>
        )}
        {visibleCount < filtered.length && (
          <div className="load-more">
            <span>
              已顯示 {visibleItems.length.toLocaleString()}／
              {filtered.length.toLocaleString()} 件
            </span>
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 80)}
            >
              顯示更多
            </button>
          </div>
        )}
        {!query.trim() && (
          <div className="catalog-sub-next">
            <small>
              {activeCloset.name} · {activeSub.name}
            </small>
            <button
              type="button"
              onClick={() => {
                if (nextClosetSub) selectClosetSub(nextClosetSub, true);
                else goToStep(3);
              }}
            >
              {nextClosetSub
                ? nextClosetSub.closetKey === activeCloset.key
                  ? `下一類：${nextClosetSub.subName}`
                  : `下一衣櫃：${nextClosetSub.closetName} · ${nextClosetSub.subName}`
                : "下一步：估價與匯出"}
            </button>
          </div>
        )}
        <div className="step-actions catalog-next">
          <button type="button" className="secondary" onClick={() => goToStep(1)}>
            返回帳號資料
          </button>
          <button type="button" onClick={() => goToStep(3)}>
            下一步：估價與匯出
          </button>
        </div>
      </section>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <footer>
        <span>
          資料來源：SkyGame-Data 1.3.8、SkyGame-Planner、Sky Wiki／BWiki（核對於
          2026-08-25）
        </span>
      </footer>
    </main>
  );
}
