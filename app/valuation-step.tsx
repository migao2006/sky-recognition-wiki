"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createAccountBackup, parseAccountBackup } from "./account-backup";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";
import { orderShowcaseItems } from "./showcase-order";
import { hasAccountDraftData } from "./use-account-draft";
import type { OrganizerRuntime } from "./use-organizer-runtime";
import {
  isChinaOnlyItem,
  isGraduationGift,
  isPaidItem,
} from "./valuation-items";
import type { ValuationAnalysis } from "./valuation-analysis";
import type { SeasonConfidence } from "./valuation-season-bands";

type ShowcasePreset = "valuation" | "video" | "collection";

export const useValuationStepState = () => {
  const [showcasePreset, setShowcasePreset] =
    useState<ShowcasePreset>("valuation");
  return { showcasePreset, setShowcasePreset };
};

export type ValuationStepState = ReturnType<typeof useValuationStepState>;

type Props = {
  runtime: OrganizerRuntime;
  state: ValuationStepState;
  account: AccountInfo;
  setAccount: Dispatch<SetStateAction<AccountInfo>>;
  bindings: Record<BindingKey, BindingStatus>;
  setBindings: Dispatch<SetStateAction<Record<BindingKey, BindingStatus>>>;
  owned: Set<string>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
  onBack: () => void;
  onClearAll: () => void;
};

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
const showcasePresetNames: Record<ShowcasePreset, string> = {
  valuation: "專業估價",
  video: "快速核對",
  collection: "完整衣櫃",
};
const emptyValuationAnalysis: ValuationAnalysis = {
  valuationItems: [],
  ultimates: [],
  pendants: [],
  packages: [],
  limited: [],
  startSeasonSlug: null,
  seasonCompletion: new Map(),
  completeness: 0,
  issueCount: 0,
  keepCount: 0,
  bindings: {},
  getZhName: (item) => item.name,
};
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function ValuationStep({
  runtime,
  state,
  account,
  setAccount,
  bindings,
  setBindings,
  owned,
  setOwned,
  setNotice,
  onBack,
  onClearAll,
}: Props) {
  const { showcasePreset, setShowcasePreset } = state;
  const importRef = useRef<HTMLInputElement>(null);
  const chosen = useMemo(
    () =>
      runtime.wikiItems.filter(
        (item) =>
          owned.has(item.guid) && runtime.allClosetTypeSet.has(item.type),
      ),
    [owned, runtime.allClosetTypeSet, runtime.wikiItems],
  );
  const valuationAnalysis = useMemo(
    () =>
      runtime.valuationRuntime?.analysis.analyzeValuation({
        chosen,
        bindings,
        bindingNote: account.bindingNote,
        domain: runtime.valuationDomain,
      }) ?? emptyValuationAnalysis,
    [
      account.bindingNote,
      bindings,
      chosen,
      runtime.valuationDomain,
      runtime.valuationRuntime,
    ],
  );
  const valuationEstimate = useMemo(
    () =>
      runtime.valuationRuntime?.analysis.estimateValuation({
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
      runtime.valuationRuntime,
      valuationAnalysis,
    ],
  );
  const localizeValuationLabel = (label: string) => {
    const match = Object.entries(runtime.seasonZh).find(([slug]) =>
      label.includes(slug),
    );
    return match ? label.replace(match[0], match[1]) : label;
  };
  const downloadText = (lines: string[], suffix: string) =>
    downloadBlob(
      new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_${suffix}.txt`,
    );
  const saleCopyData = () => {
    const collectibleItems = runtime.uniqueByGuid(
      chosen.filter(
        (item) =>
          runtime.isLimitedItem(item) ||
          isPaidItem(item) ||
          runtime.saleCopyPresetGuids.has(item.guid) ||
          item.collection === "event-sky-anniversary",
      ),
    );
    return {
      seasons: runtime.seasons.map(([slug, name]) => ({
        name,
        owned: chosen.filter(
          (item) =>
            item.section === "seasons" &&
            item.collection === slug &&
            isGraduationGift(item),
        ).length,
        total: runtime.seasonGraduationItems.get(slug)?.length ?? 0,
      })),
      bindingsConfirmed: account.bindingsConfirmed,
      bindings,
      items: collectibleItems.map((item) => ({
        guid: item.guid,
        name: item.name,
        displayName: runtime.zhItemName(item),
        section: item.section,
        collection: item.collection,
        group: item.group,
        wiki: item.wiki,
        sourceName: isChinaOnlyItem(item)
          ? "國服限定"
          : runtime.sourceCollectionName(item),
        order: item.order,
      })),
    };
  };
  const exportAccount = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    downloadText(buildSaleCopy(saleCopyData()), "出售文案");
  };
  const copySaleCopy = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    const text = buildSaleCopy(saleCopyData()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("出售文案已複製");
    } catch {
      downloadText([text], "出售文案");
      setNotice("無法複製，已改為下載文案");
    }
  };
  const exportJson = () => {
    const backup = createAccountBackup({
      account,
      bindings,
      items: chosen,
      getZhName: runtime.zhItemName,
      getSource: runtime.source,
    });
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_備份.json`,
    );
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = parseAccountBackup(
        JSON.parse(await file.text()),
        runtime.validItemGuids,
      );
      setAccount(imported.account);
      setBindings(imported.bindings);
      setOwned(new Set(imported.owned));
      setNotice("JSON 備份已匯入");
    } catch {
      setNotice("無法匯入：檔案格式不正確");
    }
  };
  const shareSummary = async () => {
    const { buildShareSummary } = await import("./sale-copy");
    const summary = buildShareSummary(saleCopyData()).join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "光遇帳號摘要", text: summary });
      } else {
        await navigator.clipboard.writeText(summary);
        setNotice("帳號摘要已複製");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        downloadText([summary], "分享摘要");
        setNotice("已改為下載摘要");
      }
    }
  };
  const getShowcaseItems = (preset: ShowcasePreset) => {
    if (preset === "collection") return chosen;
    if (preset === "video") {
      const videoItems = chosen.filter(runtime.isProfessionalVideoFocus);
      return videoItems.length
        ? videoItems
        : chosen.filter(runtime.isValuationFocus);
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
        ...runtime.showcaseOrderOptions(exportItems),
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
  const previewItems = orderShowcaseItems(
    runtime.showcaseOrderOptions(getShowcaseItems(showcasePreset)),
  );
  const previewLimit = showcasePreset === "collection" ? 24 : 16;

  return (
    <section className="account-panel">
      <div className="summary-intro">
        <h1>估價與匯出</h1>
        <button type="button" onClick={onBack}>
          返回衣櫃
        </button>
      </div>
      <section className="showcase-builder" aria-labelledby="showcase-title">
        <div className="showcase-builder-head">
          <h2 id="showcase-title">整理圖片</h2>
          <div className="showcase-primary-actions">
            <button
              type="button"
              onClick={copySaleCopy}
              disabled={!chosen.length && !account.bindingsConfirmed}
            >
              複製出售文案
            </button>
            <button
              type="button"
              className="showcase-download"
              onClick={exportShowcaseImage}
              disabled={!previewItems.length}
            >
              下載圖片
            </button>
          </div>
        </div>
        <div className="showcase-presets" aria-label="整理圖片版型">
          {(
            Object.entries(showcasePresetNames) as [ShowcasePreset, string][]
          ).map(([key, name]) => {
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
                <small>{itemCount.toLocaleString()} 件</small>
              </button>
            );
          })}
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
              <span key={item.guid} title={runtime.zhItemName(item)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.icon}
                  alt={runtime.zhItemName(item)}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
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
            {!valuationAnalysis.valuationItems.length && (
              <p>
                {chosen.length
                  ? "目前選取的物品不在估價範圍內。"
                  : "選取物品後顯示價格。"}
              </p>
            )}
            <button type="button" onClick={onBack}>
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
            <details>
              <summary>
                <b>加減分明細</b>
                <span>{valuationEstimate.contributions.length} 項</span>
              </summary>
              <div className="valuation-contributions">
                {valuationEstimate.contributions.map((row, index) => (
                  <div key={`${row.group}-${row.label}-${index}`}>
                    <span>
                      <i>
                        {
                          {
                            season: "季節",
                            package: "禮包",
                            limited: "限定",
                            binding: "綁定",
                            resource: "資源",
                          }[row.group]
                        }
                      </i>
                      {localizeValuationLabel(row.label)}
                    </span>
                    <b
                      className={
                        row.low < 0 || (row.percent ?? 0) < 0 ? "negative" : ""
                      }
                    >
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
                <SeasonRows
                  rows={valuationEstimate.seasonRows}
                  seasonZh={runtime.seasonZh}
                  confidenceNames={confidenceNames}
                  includeCompletion
                />
              </details>
            )}
            <details>
              <summary>
                <b>查看全部季節價位</b>
                <span>{runtime.seasonPriceBands.length} 季</span>
              </summary>
              <SeasonRows
                rows={runtime.seasonPriceBands}
                seasonZh={runtime.seasonZh}
                confidenceNames={confidenceNames}
              />
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
        <details className="valuation-method">
          <summary>
            <b>估價依據</b>
          </summary>
          <p>
            依季節完成度、禮包、限定、綁定與資源加權；刊登價不等於成交價。
            <br />
            資源採小額封頂，季卡項鍊不代表畢業；國服資料不混入台幣價格，結果僅供參考。
            <br />
            資料：
            {runtime.valuationSampleSummary.sourceRows.toLocaleString(
              "zh-TW",
            )}{" "}
            筆帳號樣本，其中 {runtime.valuationSampleSummary.eligibleRows}{" "}
            筆台幣樣本納入推斷（
            {runtime.valuationSampleSummary.asOf}）。
            本次社團搜尋新增 {runtime.valuationSampleSummary.facebookEligibleRows}{" "}
            筆有效刊登價；無日期或資訊較少的貼文已降低權重。
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
            <a href="https://skygj.cn/" target="_blank" rel="noreferrer">
              SKY 估價平台
            </a>
            ；另以 {runtime.valuationSampleSummary.secondaryMarketRows}{" "}
            筆國服資料校驗趨勢。
          </p>
        </details>
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
            disabled={!hasAccountDraftData(account, bindings, owned)}
            onClick={onClearAll}
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
    </section>
  );
}

type SeasonRow = {
  slug: string;
  low: number;
  median: number;
  high: number;
  contributionLow: number;
  contributionHigh: number;
  confidence: SeasonConfidence;
  sampleCount: number;
  effectiveWeight: number;
  evidenceBreakdown: {
    directSale: number;
    professionalEstimate: number;
    commentSignal: number;
  };
  completion?: number;
};

function SeasonRows({
  rows,
  seasonZh,
  confidenceNames: names,
  includeCompletion = false,
}: {
  rows: readonly SeasonRow[];
  seasonZh: Record<string, string>;
  confidenceNames: Record<SeasonConfidence, string>;
  includeCompletion?: boolean;
}) {
  return (
    <div className="valuation-season-table-wrap">
      <table className="valuation-season-table">
        <thead>
          <tr>
            <th>季節</th>
            {includeCompletion && <th>完成</th>}
            <th>起季帳號</th>
            <th>單季加價</th>
            <th>證據</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug}>
              <th>{seasonZh[row.slug] || row.slug}</th>
              {includeCompletion && (
                <td>{Math.round((row.completion ?? 0) * 100)}%</td>
              )}
              <td>
                {formatTwd(row.low)}～{formatTwd(row.high)}
                <small>中位 {formatTwd(row.median)}</small>
              </td>
              <td>
                {formatTwd(row.contributionLow)}～
                {formatTwd(row.contributionHigh)}
              </td>
              <td>
                刊登 {row.evidenceBreakdown.directSale} · {names[row.confidence]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
