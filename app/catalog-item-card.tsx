"use client";

import { memo } from "react";
import type { WikiItem } from "./wiki-data";

export const CatalogItemCard = memo(function CatalogItemCard({
  item,
  selected,
  onToggle,
  displayName,
  sourceLabel,
  ultimate,
  pendant,
}: {
  item: WikiItem;
  selected: boolean;
  onToggle: (guid: string) => void;
  displayName: string;
  sourceLabel: string;
  ultimate: boolean;
  pendant: boolean;
}) {
  return (
    <button
      className={`item-card selectable ${selected ? "owned" : ""}`}
      onClick={() => onToggle(item.guid)}
      aria-pressed={selected}
      aria-label={`${selected ? "取消選取" : "選取"}：${displayName}`}
    >
      <div className="image-wrap">
        <span className="owned-check">{selected ? "✓" : "＋"}</span>
        {ultimate && (
          <span className="discontinued-badge">
            {pendant ? "季卡" : "畢業"}
          </span>
        )}
        <span className="source-badge">{sourceLabel}</span>
        {/* External catalog icons must keep their source URL and referrer policy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.icon}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="card-body">
        <h2>{displayName}</h2>
      </div>
    </button>
  );
});
