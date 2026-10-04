"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { buildModelRequest } from "./valuation-tabpfn-features";
import { useTabpfnEstimate } from "./use-tabpfn-estimate";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";
import { DeferredDetails } from "./deferred-details";
import type {
  ShowcasePreset,
  ValuationStepState,
} from "./organizer-step-state";
import { orderShowcaseItems } from "./showcase-order";
import { hasAccountDraftData } from "./use-account-draft";
import type { ValuationRuntimeCapabilities } from "./use-organizer-runtime";
import {
  marketAccountStyleNames,
  marketBreakClassNames,
  marketPackageTierNames,
  marketValidation,
} from "./valuation-profile";
import type { SeasonConfidence, SeasonPriceBand } from "./valuation-season-bands";
import {
  ShowcasePreview,
  showcasePresetNames,
} from "./valuation-showcase-preview";
import { useValuationExportActions } from "./use-valuation-export-actions";
import { formatTwd, referencePriceText, referenceRangeText, estimationMethodName } from "./valuation-display";

type Props = {
  runtime: ValuationRuntimeCapabilities;
  state: ValuationStepState;
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  owned: Set<string>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
  onBack: () => void;
  onClearAll: () => void;
};

const formatContribution = (low: number, high: number) => {
  const signed = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatTwd(Math.abs(value))}`;
  return low === high ? signed(low) : `${signed(low)}～${signed(high)}`;
};
const confidenceNames: Record<SeasonConfidence, string> = {
  high: "高信心",
  medium: "中信心",
  low: "低信心",
  inferred: "推估",
};

export function ValuationStep({
  runtime,
  state,
  account,
  bindings,
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
      runtime.valuationRuntime.analysis.analyzeValuation({
        chosen,
        bindings,
        bindingsConfirmed: account.bindingsConfirmed,
        bindingNote: account.bindingNote,
        domain: runtime.valuationDomain,
      }),
    [
      account.bindingNote,
      account.bindingsConfirmed,
      bindings,
      chosen,
      runtime.valuationDomain,
      runtime.valuationRuntime,
    ],
  );
  const localSummary = useMemo(
    () =>
      runtime.valuationRuntime.analysis.estimateValuation({
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
  const modelRequest = useMemo(() => localSummary
    ? buildModelRequest(valuationAnalysis, localSummary, account, owned) : null,
  [localSummary, valuationAnalysis, account, owned]);
  const remote = useTabpfnEstimate(modelRequest);
  const valuationEstimate = useMemo(() => runtime.valuationRuntime.analysis.estimateValuation({
    analysis: valuationAnalysis, response: remote.response,
  }), [runtime.valuationRuntime, valuationAnalysis, remote.response]);
  const displayedBands = remote.response?.seasonBands ?? runtime.seasonPriceBands;
  const priceText = remote.loading ? "估價中…" : remote.error ? "估價暫時無法使用" : referencePriceText(valuationEstimate?.midpoint, chosen.length);
  const preliminary = !account.wardrobeConfirmed && chosen.length > 0;
  const completeness = Math.max(
    0,
    Math.min(100, Math.round(valuationAnalysis.completeness)),
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
    imageExport,
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
              onClick={shareSummary}
              disabled={!chosen.length && !account.bindingsConfirmed}
            >
              分享摘要
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
          priceText={priceText}
          preliminary={preliminary}
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
            className="completion-badge"
            role="progressbar"
            aria-label="估價資料完整度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completeness}
            aria-valuetext={`資料完整度 ${completeness}%`}
          >
            <span>完整度</span>
            <b>{completeness}%</b>
          </div>
        </div>
        <div className="valuation-summary">
          <article className="valuation-verdict">
            <span>
              {preliminary ? "初步推估" : marketValidation.label}
            </span>
            <h3 className="model-price">
              {priceText}
            </h3>
            {valuationEstimate?.range && (
              <div className="valuation-range">
                {referenceRangeText(valuationEstimate.range)}
              </div>
            )}
            {remote.error && (
              <><p role="status">{remote.error}</p><button type="button" onClick={remote.retry}>重試估價</button></>
            )}
            {preliminary && <>
              <p>尚未採用起季、斷季與禮包。確認完整衣櫃後會重新估價。</p>
              <button type="button" className="secondary" onClick={onBack}>返回確認衣櫃</button>
            </>}
          </article>
          <div className="valuation-metrics">
            <dl>
              <div>
                <dt>畢業禮</dt>
                <dd>{valuationAnalysis.ultimates.length}</dd>
              </div>
              <div>
                <dt>季卡項鍊</dt>
                <dd>{valuationAnalysis.pendants.length}</dd>
              </div>
              <div>
                <dt>付費物品</dt>
                <dd>{valuationAnalysis.packages.length}</dd>
              </div>
              <div>
                <dt>聯動／限定</dt>
                <dd>{valuationAnalysis.limited.length}</dd>
              </div>
            </dl>
          </div>
        </div>
        {valuationEstimate && (
          <div className="valuation-details">
            {valuationEstimate.contributions.length > 0 && <DeferredDetails
              summary={
                <>
                  <b>加減分明細</b>
                  <span>{valuationEstimate.contributions.length} 項</span>
                </>
              }
            >
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
            </DeferredDetails>}
            {valuationEstimate.seasonRows.length > 0 && (
              <DeferredDetails
                summary={
                  <>
                    <b>帳號季節完成度</b>
                    <span>{valuationEstimate.seasonRows.length} 季</span>
                  </>
                }
              >
                <SeasonRows
                  rows={valuationEstimate.seasonRows}
                  seasonZh={runtime.seasonZh}
                  confidenceNames={confidenceNames}
                  includeCompletion
                />
              </DeferredDetails>
            )}
            <DeferredDetails
              summary={
                <>
                  <b>各季參考估價</b>
                  <span>{runtime.seasonPriceBands.length} 季</span>
                </>
              }
            >
              <SeasonRows
                rows={displayedBands}
                seasonZh={runtime.seasonZh}
                confidenceNames={confidenceNames}
              />
            </DeferredDetails>
          </div>
        )}
        <DeferredDetails
          className="valuation-method"
          summary={
            <b>估價依據</b>
          }
        >
          <p>
            {valuationEstimate && (
              <>
                估價分類：
                {valuationAnalysis.startSeasonSlug
                  ? `起始畢業 ${runtime.seasonZh[valuationAnalysis.startSeasonSlug] || valuationAnalysis.startSeasonSlug} · `
                  : "未辨識起始畢業季 · "}
                {valuationAnalysis.seasonCompletion.size ? marketBreakClassNames[
                    valuationEstimate.marketProfile.breakClass
                  ] : ""}{" "}
                · {marketPackageTierNames[valuationEstimate.marketProfile.salePackageTier]} ·{" "}
                {
                  marketAccountStyleNames[
                    valuationEstimate.marketProfile.accountStyle
                  ]
                }
                ；{estimationMethodName(valuationEstimate.evidence.method)}，
                直接起季行情 {valuationEstimate.evidence.directSampleCount} 筆。
                模型版本 {valuationEstimate.evidence.modelRevision}。
                {valuationEstimate.marketProfile.partialSeasons > 0
                  ? `另有 ${valuationEstimate.marketProfile.partialSeasons} 季部分畢業，不視為斷季。`
                  : ""}
                <br />
              </>
            )}
            新模型採可追溯的台幣整號刊登行情，不沿用舊季節底價、禮包上限或固定資源加價。
            <br />
            本版採用 {runtime.valuationSampleSummary.eligibleRows} 筆刊登行情
            （{runtime.valuationSampleSummary.asOf}），由本機百分比模型運算。
            各季參考為無斷、中禮至多禮基準、其餘未知的整號推估，不是單季價格或成交保證。
          </p>
          {valuationEstimate?.warnings.map(warning => <p key={warning}>{warning}</p>)}
        </DeferredDetails>
      </section>
      <div className="account-actions">
        <div className="account-danger">
          <button
            className="clear-owned"
            disabled={!owned.size}
            onClick={() => {
              setOwned(new Set());
            }}
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
      </div>
    </section>
  );
}

type SeasonRow = SeasonPriceBand & { completion?: number };

function SeasonRows({
  rows,
  seasonZh,
  includeCompletion = false,
}: {
  rows: readonly SeasonRow[];
  seasonZh: Record<string, string>;
  confidenceNames: Record<SeasonConfidence, string>;
  includeCompletion?: boolean;
}) {
  return (
    <div className="valuation-season-table-wrap">
      <p>以無斷、中禮至多禮基準、綁定未知的整號為比較條件；不是單季物品售價。</p>
      <table className="valuation-season-table">
        <thead>
          <tr>
            <th>季節</th>
            {includeCompletion && <th>完成</th>}
            <th>起季帳號</th>
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
              <td>{referencePriceText(row.median, 1)}<br />{referenceRangeText(
                row.low != null && row.high != null ? { low: row.low, high: row.high } : null)}</td>
              <td>{estimationMethodName(row.method)} · {row.sampleCount} 筆</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
