"use client";
import {
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
  bindingStatusName,
  bundlePresets,
  emptyBindings,
  shortBindingName,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { createAccountBackup, parseAccountBackup } from "./account-backup";
import type { WikiItem } from "./wiki-data";
import {
  allClosetTypeSet,
  closetGroups,
  eventZh,
  graduationSeasonSlugs,
  isLimitedItem,
  isValuationFocus,
  labels,
  matchesSourceFilter,
  matchesSub,
  ongoingSeasonSlugs,
  realmZh,
  searchIndex,
  seasonGraduationItems,
  seasonOrder,
  seasonUltimateItems,
  seasonUltimateSlugs,
  seasonZh,
  seasons,
  sortSeasonSlugs,
  source,
  sourceFilters,
  sourceKind,
  storeSource,
  typeOrder,
  uniqueByGuid,
  wikiItems,
  zhName,
} from "./catalog-domain";
import {
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "./valuation-items";
import {
  analyzeValuation,
  estimateValuation,
  type ValuationDomain,
  type ValuationModel,
} from "./valuation-analysis";

const safeFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名";
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
const valuationTag = (x: WikiItem) =>
  isSeasonPendant(x)
    ? "｜季卡項鍊"
    : isGraduationGift(x)
      ? "｜畢業禮／絕版"
      : "";
const itemLine = (x: WikiItem, index: number) =>
  `${index + 1}. ${zhName(x.name)} / ${x.name}｜${labels[x.type] || x.type}｜ID ${x.id}｜來源：${source(x)}${valuationTag(x)}`;
const valuationDomain: ValuationDomain = {
  isValuationFocus,
  isLimitedItem,
  sourceKind,
  getZhName: zhName,
  getSource: source,
  ongoingSeasonSlugs,
  graduationSeasonSlugs,
  seasonGraduationItems,
  sortSeasonSlugs,
};

export default function AccountOrganizer() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [visibleCount, setVisibleCount] = useState(80);
  const [closet, setCloset] = useState("outfit"),
    [sub, setSub] = useState("all"),
    [season, setSeason] = useState("全部季節"),
    [onlyDiscontinued, setOnlyDiscontinued] = useState(false);
  const [query, setQuery] = useState(""),
    [sourceFilter, setSourceFilter] = useState("all"),
    [valuationMode, setValuationMode] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchPending = query !== deferredQuery;
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<AccountInfo>({
    name: "",
    accountType: "有翼",
    candles: "",
    hearts: "",
    ascended: "",
    passes: "",
    bindingNote: "",
    notes: "",
  });
  const [bindings, setBindings] =
    useState<Record<BindingKey, BindingStatus>>(emptyBindings);
  const [notice, setNotice] = useState("");
  const [valuationModel, setValuationModel] = useState<ValuationModel | null>(
    null,
  );
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let active = true;
    fetch("/data/valuation-model-v1.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.feature_names) setValuationModel(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const activeCloset =
    closetGroups.find((x) => x.key === closet) || closetGroups[0];
  const chosen = useMemo(
    () =>
      wikiItems.filter(
        (x) => owned.has(x.guid) && allClosetTypeSet.has(x.type),
      ),
    [owned],
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
  const modelEstimate = useMemo(
    () =>
      estimateValuation({
        model: valuationModel,
        analysis: valuationAnalysis,
        accountType: account.accountType,
        domain: valuationDomain,
      }),
    [valuationModel, account.accountType, valuationAnalysis],
  );
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase("zh-Hant");
    return wikiItems
      .filter(
        (x) =>
          (q
            ? allClosetTypeSet.has(x.type)
            : activeCloset.types.includes(x.type)) &&
          (!q && sub !== "all" ? matchesSub(x, sub) : true) &&
          matchesSourceFilter(x, sourceFilter) &&
          (sourceFilter !== "seasons" ||
            season === "全部季節" ||
            x.collection === season) &&
          (!onlyDiscontinued || isSeasonUltimate(x)) &&
          (!valuationMode || isValuationFocus(x)) &&
          (!q || searchIndex.get(x.guid)?.includes(q)),
      )
      .sort((a, b) =>
        a.type === b.type
          ? a.order - b.order || a.name.localeCompare(b.name)
          : (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99),
      );
  }, [
    sub,
    season,
    onlyDiscontinued,
    activeCloset,
    deferredQuery,
    sourceFilter,
    valuationMode,
  ]);
  const visibleItems = filtered.slice(0, visibleCount);
  const resetVisibleItems = () => setVisibleCount(80);
  const goToStep = (step: 1 | 2 | 3) => {
    if (step === activeStep) return;
    setActiveStep(step);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, behavior });
  };
  const resetFilters = () => {
    setQuery("");
    setSourceFilter("all");
    setSeason("全部季節");
    setOnlyDiscontinued(false);
    setValuationMode(false);
    setSub("all");
    resetVisibleItems();
  };
  const toggleOwned = (x: WikiItem) =>
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(x.guid)) next.delete(x.guid);
      else next.add(x.guid);
      return next;
    });
  const bundleItems = (preset: (typeof bundlePresets)[number]) =>
    wikiItems.filter(
      (x) =>
        allClosetTypeSet.has(x.type) &&
        ("collection" in preset
          ? x.collection === preset.collection
          : preset.names.includes(x.name as never)),
    );
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
  const bindingLines = () =>
    bindingKeys.map(
      (key) => `${bindingNames[key]}：${bindingStatusName[bindings[key]]}`,
    );
  const bindingGroup = (status: BindingStatus, excludeNintendo = false) =>
    bindingKeys
      .filter(
        (key) =>
          (!excludeNintendo || key !== "nintendo") && bindings[key] === status,
      )
      .map(shortBindingName)
      .join("、") || "無";
  const accountHeader = (count = chosen.length) => [
    "光遇帳號衣櫃整理",
    "================",
    `帳號名稱：${account.name || "未填寫"}`,
    `帳號類型：${account.accountType}`,
    "【登入綁定】",
    ...bindingLines(),
    `綁定補充：${account.bindingNote || "無"}`,
    "【帳號資源】",
    `白蠟燭：${account.candles || 0}`,
    `愛心：${account.hearts || 0}`,
    `昇華蠟燭：${account.ascended || 0}`,
    `季卡副卡：${account.passes || 0}`,
    `其他備註：${account.notes || "無"}`,
    `物品總數：${count}`,
    "",
  ];
  const downloadText = (lines: string[], suffix: string) =>
    downloadBlob(
      new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_${suffix}.txt`,
    );
  const exportAccount = async () => {
    const seasonSlugs = sortSeasonSlugs([
      ...new Set(
        chosen.filter((x) => x.section === "seasons").map((x) => x.collection),
      ),
    ]);
    const graduationStatus = seasonSlugs
      .map((slug) => {
        const total = seasonGraduationItems.get(slug)?.length ?? 0,
          ownedCount = chosen.filter(
            (x) =>
              x.section === "seasons" &&
              x.collection === slug &&
              isGraduationGift(x),
          ).length;
        if (!ownedCount) return "";
        return `${seasonZh[slug] || slug}${total && ownedCount === total ? "（全畢）" : `（畢業禮 ${ownedCount}/${total || "?"}）`}`;
      })
      .filter(Boolean);
    const uniqueItems = chosen.filter(isLimitedItem),
      uniqueIds = new Set(uniqueItems.map((x) => x.guid)),
      packages = chosen.filter(isPaidItem),
      otherPackages = packages.filter((x) => !uniqueIds.has(x.guid));
    const { buildSaleCopy } = await import("./sale-copy");
    const lines = buildSaleCopy({
      accountName: account.name,
      accountType: account.accountType,
      selectedCount: chosen.length,
      earliestSeason: valuationAnalysis.startSeasonSlug
        ? seasonZh[valuationAnalysis.startSeasonSlug] ||
          valuationAnalysis.startSeasonSlug
        : "",
      seasonNames: seasonSlugs.map((slug) => seasonZh[slug] || slug),
      graduationStatus,
      bindingDetails: bindingLines(),
      transferable: bindingGroup("transfer", true),
      swappable: bindings.nintendo === "transfer" ? "Nintendo（NS）" : "無",
      kept: bindingGroup("keep"),
      issues: bindingGroup("issue"),
      resources: {
        candles: account.candles,
        hearts: account.hearts,
        ascended: account.ascended,
        passes: account.passes,
      },
      ultimates: chosen.filter(isGraduationGift).map((x) => zhName(x.name)),
      uniqueEvents: uniqueItems.map((x) => zhName(x.name)),
      otherPackages: otherPackages.map((x) => zhName(x.name)),
      packageItemCount: packages.length,
      notes: [account.bindingNote, account.notes].filter(Boolean).join("；"),
    });
    downloadText(lines, "出售文案");
  };
  const exportJson = () => {
    const backup = createAccountBackup({
      account,
      bindings,
      items: chosen,
      getZhName: zhName,
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
        new Set(wikiItems.map((item) => item.guid)),
      );
      setAccount(imported.account);
      setBindings(imported.bindings);
      setOwned(new Set(imported.owned));
      setNotice("JSON 備份已匯入");
    } catch {
      setNotice("無法匯入：檔案格式不正確");
    }
  };
  const exportValuable = () => {
    const items = chosen.filter((x) => isPaidItem(x) || isGraduationGift(x));
    const lines = accountHeader(items.length);
    lines.push("【只列禮包與畢業禮】");
    items.forEach((x, i) => lines.push(itemLine(x, i)));
    if (!items.length) lines.push("尚未選取禮包或畢業禮。");
    downloadText(lines, "禮包與畢業禮");
  };
  const exportBySeason = () => {
    const lines = accountHeader();
    const groups = new Map<string, WikiItem[]>();
    chosen.forEach((x) => {
      const key =
        x.section === "seasons"
          ? seasonZh[x.collection] || x.collection
          : source(x);
      groups.set(key, [...(groups.get(key) || []), x]);
    });
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
      .forEach(([name, items]) => {
        lines.push(`【${name}】共 ${items.length} 件`);
        items.forEach((x, i) => lines.push(itemLine(x, i)));
        lines.push("");
      });
    if (!chosen.length) lines.push("尚未選取任何衣櫃物品。");
    downloadText(lines, "依季節整理");
  };
  const shareSummary = async () => {
    const { ultimates, packages, collabs } = valuationAnalysis;
    const highlights = uniqueByGuid([...ultimates, ...packages, ...collabs])
      .slice(0, 12)
      .map((x) => zhName(x.name));
    const summary = [
      `【光遇帳號摘要｜${account.name || "未命名"}】`,
      `${account.accountType}｜可出：${bindingGroup("transfer")}｜不出：${bindingGroup("keep")}`,
      `資源：${account.candles || 0} 白蠟｜${account.hearts || 0} 愛心｜${account.ascended || 0} 昇華蠟｜${account.passes || 0} 副卡`,
      `衣櫃已登錄 ${chosen.length} 件｜畢業禮 ${ultimates.length}｜禮包 ${packages.length}｜聯動 ${collabs.length}`,
      highlights.length
        ? `重點物品：${highlights.join("、")}`
        : "重點物品：尚未登錄",
      account.bindingNote ? `綁定補充：${account.bindingNote}` : "",
      `資料來源：SkyGame-Data、SkyGame-Planner、BWiki 中文清單`,
      account.notes ? `備註：${account.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
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
  const exportShowcaseImage = async () => {
    setNotice("正在產生圖片…");
    try {
      const { renderShowcaseImage } = await import("./export-showcase");
      const blob = await renderShowcaseImage({
        items: chosen,
        accountName: account.name,
        accountType: account.accountType,
        transferBindings: bindingGroup("transfer"),
        keptBindings: bindingGroup("keep"),
        resources: `資源：${account.candles || 0} 白蠟・${account.hearts || 0} 愛心・${account.ascended || 0} 昇華蠟・${account.passes || 0} 副卡`,
        isUltimate: isGraduationGift,
        isLimited: (item) => isPaidItem(item) || isLimitedItem(item),
        getClusterName: (item) =>
          item.section === "seasons"
            ? seasonZh[item.collection] || item.collection
            : item.section === "events"
              ? eventZh[item.collection] || item.collection
              : item.section === "realms"
                ? realmZh[item.collection] || "常駐地圖"
                : item.section === "store"
                  ? storeSource(item)
                  : sourceKind(item),
        getClusterOrder: (item) =>
          item.section === "seasons"
            ? (seasonOrder.get(item.collection) ?? 999)
            : 1000,
      });
      downloadBlob(blob, `光遇帳號_${safeFileName(account.name)}_圖片衣櫃.png`);
      setNotice("圖片清單已下載");
    } catch {
      setNotice("圖片產生失敗");
    }
  };
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
      <section className="account-panel" hidden={activeStep === 2}>
        <div className="account-intro" hidden={activeStep !== 1}>
          <div>
            <span className="step-kicker">步驟 1／3</span>
            <h1>整理帳號資料</h1>
            <p>先填基本資料；不確定的欄位可以留白，稍後再補。</p>
          </div>
          <div className="account-progress">
            <b>{owned.size}</b>
            <span>已選物品</span>
          </div>
        </div>
        <div className="account-form" hidden={activeStep !== 1}>
          <div className="form-section-title">
            <b>交易資訊</b>
          </div>
          <label className="account-name">
            帳號名稱
            <input
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              placeholder="例如：白鳥簡號"
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
          <div className="form-section-title">
            <b>帳號資源</b>
          </div>
          <label>
            白蠟燭
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
            昇華蠟燭
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
            季卡副卡
            <input
              inputMode="numeric"
              value={account.passes}
              onChange={(e) =>
                setAccount({ ...account, passes: e.target.value })
              }
              placeholder="0"
            />
          </label>
          <div className="binding-section">
            <div className="form-section-title">
              <b>登入綁定</b>
            </div>
            <div className="binding-grid">
              {bindingKeys.map((key) => (
                <label
                  className={`binding-card status-${bindings[key]}`}
                  key={key}
                >
                  <span>{bindingNames[key]}</span>
                  <select
                    value={bindings[key]}
                    onChange={(e) =>
                      setBindings({
                        ...bindings,
                        [key]: e.target.value as BindingStatus,
                      })
                    }
                    aria-label={`${bindingNames[key]}綁定狀態`}
                  >
                    {bindingOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <label className="account-notes">
            綁定補充
            <input
              value={account.bindingNote}
              onChange={(e) =>
                setAccount({ ...account, bindingNote: e.target.value })
              }
              placeholder="例如：GC 前號不出、GG 私用、FB 遺失"
            />
          </label>
          <label className="account-notes">
            其他備註
            <input
              value={account.notes}
              onChange={(e) =>
                setAccount({ ...account, notes: e.target.value })
              }
              placeholder="帳號狀態、缺少資料等"
            />
          </label>
        </div>
        <details className="season-picker" hidden={activeStep !== 1}>
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
                          name = pendant ? "項鍊" : zhName(item.name);
                        return (
                          <button
                            type="button"
                            className={`season-ultimate-item${selected ? " selected" : ""}${pendant ? " pendant" : ""}`}
                            aria-pressed={selected}
                            aria-label={`${seasonZh[slug]}　${name}`}
                            title={`${seasonZh[slug]} · ${zhName(item.name)}`}
                            key={item.guid}
                            onClick={() => toggleOwned(item)}
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
        <details className="quick-select" hidden={activeStep !== 1}>
          <summary>
            <b>常用套組</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="quick-select-body">
            <section>
              <div className="preset-grid">
                {bundlePresets.map((preset) => {
                  const items = bundleItems(preset),
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
        <div className="step-actions" hidden={activeStep !== 1}>
          <span>基本資料會保留在這次整理流程中。</span>
          <button type="button" onClick={() => goToStep(2)}>
            下一步：選擇物品
          </button>
        </div>
        <div className="summary-intro" hidden={activeStep !== 3}>
          <div>
            <span className="step-kicker">步驟 3／3</span>
            <h1>估價與匯出</h1>
            <p>確認估價依據，並輸出適合備份、分享或刊登的格式。</p>
          </div>
          <button type="button" onClick={() => goToStep(2)}>
            返回衣櫃
          </button>
        </div>
        <section
          className="valuation-report"
          aria-labelledby="valuation-title"
          hidden={activeStep !== 3}
        >
          <div className="valuation-report-head">
            <h2 id="valuation-title">估價分析</h2>
            <div
              className="completion-ring"
              aria-label={`估價依據完整度 ${valuationAnalysis.completeness}%`}
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
              <span>目前估價結論</span>
              <h3 className="model-price">
                {modelEstimate !== null
                  ? `NT$ ${modelEstimate.toLocaleString("zh-TW")}`
                  : "NT$ —"}
              </h3>
              <p>
                {valuationAnalysis.valuationItems.length
                  ? modelEstimate !== null
                    ? "依起季完整度、畢業禮、付費禮包、限定物品與綁定狀態計算。"
                    : "模型載入中，請稍候。"
                  : chosen.length
                    ? "目前選取的是一般物品，不列入估價。"
                    : "選取估價物品後，這裡會直接顯示台幣估價。"}
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
          <p className="valuation-method">
            估價只列：起季與斷季、畢業禮、付費物品、絕版／聯動、熱門復刻與綁定狀態；季卡項鍊只證明有卡，不代表畢業。一般家具、常駐物品、魔法與普通資源不列入重點。
            <br />
            核對資料：1,022 筆帳號樣本、
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
            。刊價不等同成交價，結果僅供議價參考。
          </p>
        </section>
        <div className="account-actions" hidden={activeStep !== 3}>
          <div className="account-danger">
            <button
              className="clear-owned"
              disabled={!owned.size}
              onClick={() => setOwned(new Set())}
            >
              清除已選
            </button>
          </div>
          <div className="export-tools" aria-label="帳號匯入與匯出">
            <button onClick={exportAccount}>文字檔</button>
            <button onClick={exportJson}>JSON 備份</button>
            <button onClick={() => importRef.current?.click()}>
              匯入 JSON
            </button>
            <button onClick={exportShowcaseImage}>圖片清單</button>
            <button onClick={exportValuable}>禮包＋畢業禮</button>
            <button onClick={exportBySeason}>按季節整理</button>
            <button className="export-account" onClick={shareSummary}>
              分享摘要
            </button>
          </div>
          <input
            ref={importRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={importJson}
          />
        </div>
      </section>
      <section className="catalog" id="top" hidden={activeStep !== 2}>
        <div className="catalog-intro">
          <div>
            <span className="step-kicker">步驟 2／3</span>
            <h1>選擇帳號物品</h1>
            <p>用搜尋最快；也可以依來源、季節與衣櫃分類逐項核對。</p>
          </div>
          <button type="button" onClick={() => goToStep(3)}>
            查看估價 · {owned.size} 件
          </button>
        </div>
        <div className="discovery-tools">
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
                placeholder="中文名、英文名、簡稱、季節、ID…"
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
            className={
              valuationMode ? "valuation-toggle active" : "valuation-toggle"
            }
            onClick={() => {
              setValuationMode((x) => !x);
              resetVisibleItems();
            }}
            aria-pressed={valuationMode}
          >
            <b>✦ 估價物品</b>
          </button>
        </div>
        <div className="closet-nav" aria-label="衣櫃順序">
          {closetGroups.map((x) => (
            <button
              key={x.key}
              className={closet === x.key ? "selected" : ""}
              onClick={() => {
                setCloset(x.key);
                setSub("all");
                resetVisibleItems();
              }}
            >
              {x.order && <b>{x.order}</b>}
              <span>{x.name}</span>
            </button>
          ))}
        </div>
        {activeCloset.subs.length > 0 && (
          <div className="closet-subs">
            <button
              className={sub === "all" ? "selected" : ""}
              onClick={() => {
                setSub("all");
                resetVisibleItems();
              }}
            >
              全部
            </button>
            {activeCloset.subs.map((x, i) => (
              <button
                key={x.key}
                className={sub === x.key ? "selected" : ""}
                onClick={() => {
                  setSub(x.key);
                  resetVisibleItems();
                }}
              >
                <i>{i + 1}</i>
                {x.name}
              </button>
            ))}
            <button
              className={
                onlyDiscontinued
                  ? "selected discontinued-filter"
                  : "discontinued-filter"
              }
              onClick={() => {
                setOnlyDiscontinued((x) => !x);
                resetVisibleItems();
              }}
            >
              絕版
            </button>
          </div>
        )}
        <div className="result-head">
          <h2>
            {deferredQuery
              ? `「${deferredQuery.trim()}」搜尋結果`
              : season !== "全部季節"
                ? seasonZh[season]
                : valuationMode
                  ? "估價物品"
                  : activeCloset.name}{" "}
            · {filtered.length.toLocaleString()} 件
          </h2>
          <div className="result-actions">
            {searchPending && <small role="status">搜尋更新中…</small>}
            {(query ||
              sourceFilter !== "all" ||
              season !== "全部季節" ||
              valuationMode ||
              onlyDiscontinued) && (
              <button className="reset-filters" onClick={resetFilters}>
                清除篩選
              </button>
            )}
          </div>
        </div>
        {filtered.length ? (
          <div className="grid" aria-busy={searchPending}>
            {visibleItems.map((x) => {
              const has = owned.has(x.guid);
              return (
                <button
                  className={`item-card selectable ${has ? "owned" : ""}`}
                  key={x.guid}
                  onClick={() => toggleOwned(x)}
                  aria-pressed={has}
                >
                  <div className="image-wrap">
                    <span className="owned-check">{has ? "✓" : "＋"}</span>
                    {isSeasonUltimate(x) && (
                      <span className="discontinued-badge">
                        {isSeasonPendant(x) ? "季卡" : "畢業"}
                      </span>
                    )}
                    <span className="source-badge">{sourceKind(x)}</span>
                    {/* External catalog icons must keep their source URL and referrer policy. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={x.icon}
                      alt={x.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="card-body">
                    <div>
                      <span className={`type type-${x.type}`}>
                        {labels[x.type] || x.type}
                      </span>
                    </div>
                    <h2>{zhName(x.name)}</h2>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <b>找不到符合的物品</b>
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
        <div className="step-actions catalog-next">
          <button type="button" className="secondary" onClick={() => goToStep(1)}>
            返回帳號資料
          </button>
          <button type="button" onClick={() => goToStep(3)}>
            下一步：估價與匯出
          </button>
        </div>
      </section>
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
