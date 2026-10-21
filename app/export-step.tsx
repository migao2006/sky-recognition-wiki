"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import {
  accountResourceAmount,
  bindingKeys,
  bindingNames,
  bindingStatusNames,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { analyzeAccount } from "./account-summary";
import { DeferredDetails } from "./deferred-details";
import type { ExportStepState, ShowcasePreset } from "./organizer-step-state";
import { orderShowcaseItems } from "./showcase-order";
import { ShowcasePreview, showcasePresetNames } from "./showcase-preview";
import { hasAccountDraftData } from "./use-account-draft";
import { useExportActions } from "./use-export-actions";
import type { OrganizerRuntimeCapabilities } from "./use-organizer-runtime";

export function ExportStep({
  runtime,
  state,
  account,
  bindings,
  owned,
  setOwned,
  setNotice,
  onBack,
  onClearAll,
}: {
  runtime: OrganizerRuntimeCapabilities;
  state: ExportStepState;
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  owned: Set<string>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
  onBack: () => void;
  onClearAll: () => void;
}) {
  const { showcasePreset, setShowcasePreset } = state;
  const chosen = useMemo(
    () => runtime.wikiItems.filter(
      (item) => owned.has(item.guid) && runtime.allClosetTypeSet.has(item.type),
    ),
    [owned, runtime],
  );
  const accountSummary = useMemo(
    () => analyzeAccount({ chosen, bindings, domain: runtime.accountSummaryDomain }),
    [bindings, chosen, runtime.accountSummaryDomain],
  );
  const showcaseItems = useMemo(() => {
    const videoItems = chosen.filter(runtime.isProfessionalVideoFocus);
    return {
      highlights: accountSummary.highlightItems.length
        ? accountSummary.highlightItems
        : chosen,
      video: videoItems.length ? videoItems : accountSummary.highlightItems,
      collection: chosen,
    } satisfies Record<ShowcasePreset, typeof chosen>;
  }, [accountSummary.highlightItems, chosen, runtime.isProfessionalVideoFocus]);
  const previewItems = useMemo(
    () => orderShowcaseItems(runtime.showcaseOrderOptions(showcaseItems[showcasePreset])),
    [runtime, showcaseItems, showcasePreset],
  );
  const previewLimit = showcasePreset === "collection" ? 24 : 16;
  const { imageExport, shareSummary, exportShowcaseImage } = useExportActions({
    runtime,
    account,
    bindings,
    chosen,
    showcasePreset,
    showcaseItems,
    accountSummary,
    setNotice,
  });
  const resources = [
    ["白蠟", accountResourceAmount(account.candles, "candles")],
    ["愛心", accountResourceAmount(account.hearts, "hearts")],
    ["昇華蠟", accountResourceAmount(account.ascended, "ascended")],
    ["副卡", accountResourceAmount(account.passes, "passes")],
  ].filter((entry) => Number(entry[1]) > 0);
  const bindingRows = bindingKeys.filter(
    (key) => account.bindingsConfirmed || bindings[key] !== "none",
  );

  return (
    <section className="account-panel">
      <div className="summary-intro">
        <h1>整理與匯出</h1>
        <button type="button" onClick={onBack}>返回衣櫃</button>
      </div>
      <section className="showcase-builder" aria-labelledby="showcase-title">
        <div className="showcase-builder-head">
          <div>
            <h2 id="showcase-title">整理圖片</h2>
            <p>選擇版型後即可分享摘要或下載圖片。</p>
          </div>
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
          {(Object.entries(showcasePresetNames) as [ShowcasePreset, string][]).map(
            ([key, name]) => (
              <button
                type="button"
                key={key}
                className={showcasePreset === key ? "active" : ""}
                aria-pressed={showcasePreset === key}
                onClick={() => setShowcasePreset(key)}
                disabled={Boolean(imageExport)}
              >
                <strong>{name}</strong>
                <small>{showcaseItems[key].length.toLocaleString()} 件</small>
              </button>
            ),
          )}
        </div>
        <ShowcasePreview
          preset={showcasePreset}
          items={previewItems}
          limit={previewLimit}
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

      <section className="output-report" aria-labelledby="output-title">
        <div className="output-report-head">
          <div>
            <h2 id="output-title">帳號摘要</h2>
            <p>{account.wardrobeConfirmed ? "衣櫃已確認" : "目前依已選物品整理"}</p>
          </div>
          <span className="output-total">已選 {chosen.length.toLocaleString()} 件</span>
        </div>
        <dl className="output-metrics">
          <div><dt>畢業禮</dt><dd>{accountSummary.ultimates.length}</dd></div>
          <div><dt>季卡項鍊</dt><dd>{accountSummary.pendants.length}</dd></div>
          <div><dt>付費物品</dt><dd>{accountSummary.packages.length}</dd></div>
          <div><dt>聯動／限定</dt><dd>{accountSummary.limited.length}</dd></div>
        </dl>
        <div className="output-details">
          {accountSummary.seasonCompletion.size > 0 && (
            <DeferredDetails
              summary={<><b>季節完成進度</b><span>{accountSummary.seasonCompletion.size} 季</span></>}
            >
              <div className="season-progress-list">
                {[...accountSummary.seasonCompletion].map(([slug, row]) => (
                  <div key={slug}>
                    <span>{runtime.seasonZh[slug] || slug}</span>
                    <b>{row.selected >= row.expected && row.expected > 0
                      ? "畢"
                      : `${row.selected}/${row.expected}`}</b>
                  </div>
                ))}
              </div>
            </DeferredDetails>
          )}
          {(bindingRows.length > 0 || resources.length > 0) && (
            <DeferredDetails summary={<><b>綁定與資源</b><span>帳號資料</span></>}>
              <div className="account-facts">
                {bindingRows.map((key) => (
                  <span key={key}>{bindingNames[key]}｜{bindingStatusNames[bindings[key]]}</span>
                ))}
                {resources.map(([name, amount]) => (
                  <span key={String(name)}>{name}｜{Number(amount).toLocaleString()}</span>
                ))}
              </div>
            </DeferredDetails>
          )}
        </div>
      </section>

      <div className="account-actions">
        <div className="account-danger">
          <button className="clear-owned" disabled={!owned.size} onClick={() => setOwned(new Set())}>
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
