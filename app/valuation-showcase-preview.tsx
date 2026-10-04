"use client";

import type { ShowcasePreset } from "./organizer-step-state";
import type { ValuationEstimate } from "./valuation-analysis";
import type { WikiItem } from "./wiki-data";
import { referencePriceText, referenceRangeText } from "./valuation-display";

export const showcasePresetNames: Record<ShowcasePreset, string> = {
  valuation: "參考估價",
  video: "快速核對",
  collection: "完整衣櫃",
};

type Props = {
  preset: ShowcasePreset;
  items: readonly WikiItem[];
  limit: number;
  estimate: ValuationEstimate | null | undefined;
  getZhName: (item: WikiItem) => string;
  priceText?: string;
  preliminary?: boolean;
};

export function ShowcasePreview({
  preset,
  items,
  limit,
  estimate,
  getZhName,
  priceText,
  preliminary = false,
}: Props) {
  return (
    <div className={`showcase-preview preset-${preset}`}>
      <header>
        <span>{showcasePresetNames[preset]}</span>
        <b>{items.length} 件</b>
      </header>
      {preset === "valuation" && (
        <div className="showcase-price">
          <span>{preliminary ? "初步推估" : "參考估價"}</span>
          <strong>{priceText ?? referencePriceText(estimate?.midpoint, items.length)}</strong>
          <small>
            {preliminary ? "尚未採用起季、斷季與禮包" : referenceRangeText(estimate?.range)}
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
