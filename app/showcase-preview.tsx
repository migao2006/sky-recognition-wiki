"use client";

import type { ShowcasePreset } from "./organizer-step-state";
import type { WikiItem } from "./wiki-data";

export const showcasePresetNames: Record<ShowcasePreset, string> = {
  highlights: "重點收藏",
  video: "快速核對",
  collection: "完整衣櫃",
};

export function ShowcasePreview({
  preset,
  items,
  limit,
  getZhName,
}: {
  preset: ShowcasePreset;
  items: readonly WikiItem[];
  limit: number;
  getZhName: (item: WikiItem) => string;
}) {
  return (
    <div className={`showcase-preview preset-${preset}`}>
      <header>
        <span>{showcasePresetNames[preset]}</span>
        <b>{items.length} 件</b>
      </header>
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
