"use client";

import { useCallback, useState } from "react";
import {
  bindingKeys,
  bindingNames,
  bindingOptions,
  type AccountInfo,
  type BindingKey,
  type BindingStatus,
} from "./account-config";
import { bundlePresets } from "./bundle-presets";
import { formatMarketBindings, formatMarketPlatform } from "./market-copy";
import { isSeasonPendant } from "./season-items";
import type { OrganizerRuntime } from "./use-organizer-runtime";

type AccountStepProps = {
  account: AccountInfo;
  setAccount: React.Dispatch<React.SetStateAction<AccountInfo>>;
  bindings: Record<BindingKey, BindingStatus>;
  setBindings: React.Dispatch<
    React.SetStateAction<Record<BindingKey, BindingStatus>>
  >;
  owned: ReadonlySet<string>;
  setOwned: React.Dispatch<React.SetStateAction<Set<string>>>;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  draftAvailable: boolean;
  runtime: OrganizerRuntime;
  onNext: () => void;
};

export function AccountStep({
  account,
  setAccount,
  bindings,
  setBindings,
  owned,
  setOwned,
  setNotice,
  draftAvailable,
  runtime,
  onNext,
}: AccountStepProps) {
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const {
    catalogDomain,
    catalogLoadError,
    loadCatalog,
    bundlePresetItems,
    ongoingSeasonSlugs,
    seasonUltimateItems,
    seasonUltimateSlugs,
    seasonZh,
    zhItemName,
  } = runtime;
  const safelyLoadCatalog = useCallback(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]);
  const toggleOwned = useCallback(
    (guid: string) =>
      setOwned((previous) => {
        const next = new Set(previous);
        if (next.has(guid)) next.delete(guid);
        else next.add(guid);
        return next;
      }),
    [setOwned],
  );
  const quickPresetState = (items: (typeof runtime.wikiItems)[number][]) => {
    const selected = items.filter((item) => owned.has(item.guid)).length;
    return {
      selected,
      complete: items.length > 0 && selected === items.length,
      partial: selected > 0 && selected < items.length,
    };
  };
  const toggleQuickPreset = (
    label: string,
    items: (typeof runtime.wikiItems)[number][],
  ) => {
    const ids = [...new Set(items.map((item) => item.guid))];
    const complete = ids.length > 0 && ids.every((id) => owned.has(id));
    setOwned((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => (complete ? next.delete(id) : next.add(id)));
      return next;
    });
    setNotice(
      complete
        ? `已取消「${label}」${ids.length} 件`
        : `已選取「${label}」${ids.length} 件`,
    );
  };
  const changedBindings = bindingKeys.filter((key) => bindings[key] !== "none");
  const bindingSummary = account.bindingsConfirmed
    ? formatMarketBindings(bindings)
    : "尚未確認";
  const hasBindingIssue = changedBindings.some(
    (key) => bindings[key] === "issue",
  );
  const loadCatalogWhenOpened = (open: boolean) => {
    if (open) safelyLoadCatalog();
  };

  return (
    <section className="account-panel">
      <div className="account-intro">
        <h1>帳號資料</h1>
      </div>
      <div className="account-form">
        <label className="account-name">
          帳號名稱
          <input
            value={account.name}
            onChange={(event) =>
              setAccount({ ...account, name: event.target.value })
            }
            placeholder="例如：追光大斷禮包號"
          />
        </label>
        <label>
          帳號類型
          <select
            value={account.accountType}
            onChange={(event) =>
              setAccount({ ...account, accountType: event.target.value })
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
            </span>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="account-extra-grid">
            <label>
              白蠟
              <input
                inputMode="numeric"
                value={account.candles}
                onChange={(event) =>
                  setAccount({ ...account, candles: event.target.value })
                }
                placeholder="0"
              />
            </label>
            <label>
              愛心
              <input
                inputMode="numeric"
                value={account.hearts}
                onChange={(event) =>
                  setAccount({ ...account, hearts: event.target.value })
                }
                placeholder="0"
              />
            </label>
            <label>
              昇華蠟
              <input
                inputMode="numeric"
                value={account.ascended}
                onChange={(event) =>
                  setAccount({ ...account, ascended: event.target.value })
                }
                placeholder="0"
              />
            </label>
            <label>
              副卡
              <input
                inputMode="numeric"
                value={account.passes}
                onChange={(event) =>
                  setAccount({ ...account, passes: event.target.value })
                }
                placeholder="0"
              />
            </label>
            <label className="account-notes">
              其他說明
              <input
                value={account.notes}
                onChange={(event) =>
                  setAccount({ ...account, notes: event.target.value })
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
                    onChange={(event) => {
                      setBindings({
                        ...bindings,
                        [key]: event.target.value as BindingStatus,
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
                onChange={(event) =>
                  setAccount({ ...account, bindingNote: event.target.value })
                }
                placeholder="例如：ɢᴄ 前號不出、ɢɢ 私用、ғʙ 遺失"
              />
            </label>
          </div>
        </details>
      </div>
      <details
        className="season-picker"
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setSeasonPickerOpen(open);
          loadCatalogWhenOpened(open);
        }}
      >
        <summary>
          <b>季節／畢業禮</b>
          <i aria-hidden="true">⌄</i>
        </summary>
        {seasonPickerOpen && (
          <div className="season-picker-body">
            {!catalogDomain && (
              <div className="runtime-loading">
                <b>{catalogLoadError ? "衣櫃載入失敗" : "正在載入衣櫃…"}</b>
                {catalogLoadError && (
                  <button type="button" onClick={safelyLoadCatalog}>
                    重新載入
                  </button>
                )}
              </div>
            )}
            <div className="season-ultimate-grid">
              {seasonUltimateSlugs.map((slug) => {
                const items = seasonUltimateItems.get(slug) || [];
                const selectedCount = items.filter((item) =>
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
                        const selected = owned.has(item.guid);
                        const pendant = isSeasonPendant(item);
                        const name = pendant ? "項鍊" : zhItemName(item);
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
                              <img
                                src={item.icon}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                                referrerPolicy="no-referrer"
                              />
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
        )}
      </details>
      <details
        className="quick-select"
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setQuickSelectOpen(open);
          loadCatalogWhenOpened(open);
        }}
      >
        <summary>
          <b>常用套組</b>
          <i aria-hidden="true">⌄</i>
        </summary>
        {quickSelectOpen && (
          <div className="quick-select-body">
            {!catalogDomain && (
              <div className="runtime-loading">
                <b>{catalogLoadError ? "衣櫃載入失敗" : "正在載入衣櫃…"}</b>
                {catalogLoadError && (
                  <button type="button" onClick={safelyLoadCatalog}>
                    重新載入
                  </button>
                )}
              </div>
            )}
            {catalogDomain && (
              <div className="preset-grid">
                {bundlePresets.map((preset) => {
                  const items = bundlePresetItems.get(preset.key) || [];
                  const state = quickPresetState(items);
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
            )}
          </div>
        )}
      </details>
      <div className="step-actions">
        <span>
          {draftAvailable ? "草稿保存 30 天" : "草稿未保存"}
        </span>
        <button type="button" onClick={onNext}>
          下一步：選擇物品
        </button>
      </div>
    </section>
  );
}
