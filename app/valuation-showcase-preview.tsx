"use client";

import type { ShowcasePreset } from "./organizer-step-state";
import type { ValuationEstimate } from "./valuation-analysis";
import type { WikiItem } from "./wiki-data";

export const showcasePresetNames: Record<ShowcasePreset, string> = {
  valuation: "刊登樣本估算",
  video: "快速核對",
  collection: "完整衣櫃",
};

const formatTwd = (value: number) =>
  `NT$ ${Math.abs(value).toLocaleString("zh-TW")}`;

type Props = {
  preset: ShowcasePreset;
  items: readonly WikiItem[];
  limit: number;
  estimate: ValuationEstimate | null | undefined;
  getZhName: (item: WikiItem) => string;
};

export function ShowcasePreview({
  preset,
  items,
  limit,
  estimate,
  getZhName,
}: Props) {
  return (
    <div className={`showcase-preview preset-${preset}`}>
      <header>
        <span>{showcasePresetNames[preset]}</span>
        <b>{items.length} 件</b>
      </header>
      {preset === "valuation" && (
        <div className="showcase-price">
          <span>刊登樣本中位估算</span>
          <strong>{estimate ? formatTwd(estimate.midpoint) : "NT$ —"}</strong>
          <small>
            {estimate
              ? `價格區間 ${formatTwd(estimate.range.low)}～${formatTwd(estimate.range.high)}`
              : "選取估價物品後顯示"}
          </small>
        </div>
      )}
      <div className="showcase-preview-icons">
        {items.slice(0, limit).map((item, index) => (
          <span key={item.guid} title={getZhName(item)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.icon}
              alt={getZhName(item)}
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
            />
          </span>
        ))}
        {items.length > limit && <i>+{items.length - limit}</i>}
      </div>
      {!items.length && <p>尚未選取此版型需要的物品。</p>}
    </div>
  );
}
