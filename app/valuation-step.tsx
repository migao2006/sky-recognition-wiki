"use client";

import {
  useMemo,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";
import type {
  ShowcasePreset,
  ValuationStepState,
} from "./organizer-step-state";
import { orderShowcaseItems } from "./showcase-order";
import { hasAccountDraftData } from "./use-account-draft";
import type { OrganizerRuntime } from "./use-organizer-runtime";
import type { ValuationAnalysis } from "./valuation-analysis";
import {
  marketAccountStyleNames,
  marketBreakClassNames,
  marketValidation,
} from "./valuation-market";
import type { SeasonConfidence } from "./valuation-season-bands";
import {
  ShowcasePreview,
  showcasePresetNames,
} from "./valuation-showcase-preview";
import { useValuationExportActions } from "./use-valuation-export-actions";

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

const formatTwd = (value: number) =>
  `NT$ ${Math.abs(value).toLocaleString("zh-TW")}`;
const formatContribution = (low: number, high: number) => {
  const signed = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatTwd(value)}`;
  return low === high ? signed(low) : `${signed(low)}～${signed(high)}`;
};
const confidenceNames: Record<SeasonConfidence, string> = {
  high: "高信心",
  medium: "中信心",
  low: "低信心",
  inferred: "推估",
};
const packageTierNames = {
  few: "少禮",
  medium: "中禮",
  many: "多禮",
  hundred: "百禮",
} as const;
const emptyValuationAnalysis: ValuationAnalysis = {
  valuationItems: [],
  ultimates: [],
  pendants: [],
  packages: [],
  limited: [],
  startSeasonSlug: null,
  conservativeAddOnCaps: true,
  seasonCompletion: new Map(),
  completeness: 0,
  issueCount: 0,
  keepCount: 0,
  bindings: {},
  getZhName: (item) => item.name,
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
        bindingsConfirmed: account.bindingsConfirmed,
        bindingNote: account.bindingNote,
        domain: runtime.valuationDomain,
      }) ?? emptyValuationAnalysis,
    [
      account.bindingNote,
      account.bindingsConfirmed,
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
  const showcaseItems = useMemo(() => {
    const videoItems = chosen.filter(runtime.isProfessionalVideoFocus);
    return {
      valuation: valuationAnalysis.valuationItems.length
        ? valuationAnalysis.valuationItems
        : chosen,
      video: videoItems.length
        ? videoItems
        : chosen.filter(runtime.isValuationFocus),
      collection: chosen,
    } satisfies Record<ShowcasePreset, typeof chosen>;
  }, [chosen, runtime.isProfessionalVideoFocus, runtime.isValuationFocus, valuationAnalysis.valuationItems]);
  const { showcaseOrderOptions } = runtime;
  const previewItems = useMemo(
    () => orderShowcaseItems(showcaseOrderOptions(showcaseItems[showcasePreset])),
    [showcaseItems, showcaseOrderOptions, showcasePreset],
  );
  const previewLimit = showcasePreset === "collection" ? 24 : 16;
  const {
    importRef,
    imageExport,
    exportAccount,
    copySaleCopy,
    exportJson,
    importJson,
    shareSummary,
    exportShowcaseImage,
  } = useValuationExportActions({
    runtime,
    account,
    bindings,
    chosen,
    showcasePreset,
    showcaseItems,
    valuationAnalysis,
    valuationEstimate,
    confidenceNames,
    localizeValuationLabel,
    setAccount,
    setBindings,
    setOwned,
    setNotice,
  });

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
              disabled={!previewItems.length || Boolean(imageExport)}
            >
              {imageExport ? "產生中…" : "下載圖片"}
            </button>
          </div>
        </div>
        <div className="showcase-presets" aria-label="整理圖片版型">
          {(
            Object.entries(showcasePresetNames) as [ShowcasePreset, string][]
          ).map(([key, name]) => {
            const itemCount = showcaseItems[key].length;
            return (
              <button
                type="button"
                key={key}
                className={showcasePreset === key ? "active" : ""}
                aria-pressed={showcasePreset === key}
                onClick={() => setShowcasePreset(key)}
                disabled={Boolean(imageExport)}
              >
                <strong>{name}</strong>
                <small>{itemCount.toLocaleString()} 件</small>
              </button>
            );
          })}
        </div>
        <ShowcasePreview
          preset={showcasePreset}
          items={previewItems}
          limit={previewLimit}
          estimate={valuationEstimate}
          getZhName={runtime.zhItemName}
        />
        {imageExport && (
          <p className="showcase-export-status" role="status">
            {imageExport.phase === "loading-icons"
              ? `正在載入圖示 ${imageExport.completed}／${imageExport.total}`
              : `正在輸出第 ${imageExport.completed + 1}／${imageExport.total} 張圖片`}
          </p>
        )}
      </section>
      <section className="valuation-report" aria-labelledby="valuation-title">
        <div className="valuation-report-head">
          <h2 id="valuation-title">估價分析</h2>
          <div
            className="completion-ring"
            aria-label={`資料完整度 ${valuationAnalysis.completeness}%`}
            style={
              {
                "--completion": `${valuationAnalysis.completeness * 3.6}deg`,
              } as CSSProperties
            }
          >
            <b>{valuationAnalysis.completeness}%</b>
          </div>
        </div>
        <div className="valuation-summary">
          <article className="valuation-verdict">
            <span>
              {marketValidation.label}
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
                            market: "市場",
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
            {valuationEstimate && (
              <>
                估價分類：
                {valuationAnalysis.startSeasonSlug
                  ? `起始畢業 ${runtime.seasonZh[valuationAnalysis.startSeasonSlug] || valuationAnalysis.startSeasonSlug} · `
                  : "未辨識起始畢業季 · "}
                {
                  marketBreakClassNames[
                    valuationEstimate.marketProfile.breakClass
                  ]
                }{" "}
                · {packageTierNames[valuationEstimate.marketProfile.packageTier]} ·{" "}
                {
                  marketAccountStyleNames[
                    valuationEstimate.marketProfile.accountStyle
                  ]
                }
                ；同起始畢業季樣本 {valuationEstimate.marketProfile.effectiveSample} 筆。
                {valuationEstimate.marketProfile.partialSeasons > 0
                  ? `另有 ${valuationEstimate.marketProfile.partialSeasons} 季部分畢業，不視為斷季。`
                  : ""}
                <br />
              </>
            )}
            依季節完成度、禮包、限定、綁定與資源加權；價格以近期台幣刊登樣本推估，實際交易條件可能不同。
            <br />
            資源採小額封頂，季卡項鍊不代表畢業；國服資料不混入台幣價格，結果僅供參考。
            <br />
            資料：
            {runtime.valuationSampleSummary.sourceRows.toLocaleString(
              "zh-TW",
            )}{" "}
            筆帳號樣本，其中 {runtime.valuationSampleSummary.eligibleRows}{" "}
            筆台幣刊登樣本納入推斷（
            {runtime.valuationSampleSummary.asOf}）。
            本次納入 {runtime.valuationSampleSummary.driveEligibleRows} 筆雲端市場文案、
            {runtime.valuationSampleSummary.facebookEligibleRows} 筆社團刊登價與
            {runtime.valuationSampleSummary.marketplaceEligibleRows} 筆公開交易平台刊登；
            公開平台、社團刊登與資料完整度採不同權重。
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
