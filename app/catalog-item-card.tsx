"use client";

import { memo } from "react";
import { CatalogIcon } from "./catalog-icon";
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
      type="button"
      className={`item-card selectable ${selected ? "owned" : ""}`}
      onClick={() => onToggle(item.guid)}
      aria-pressed={selected}
      aria-label={`${selected ? "取消選取" : "選取"}：${displayName}`}
    >
      <span className="image-wrap">
        <span className="owned-check">{selected ? "✓" : "＋"}</span>
        {ultimate && (
          <span className="discontinued-badge">
            {pendant ? "季卡" : "畢業"}
          </span>
        )}
        <span className="source-badge">{sourceLabel}</span>
        <CatalogIcon src={item.icon} />
      </span>
      <span className="card-body">
        <span className="card-title">{displayName}</span>
      </span>
    </button>
  );
});
