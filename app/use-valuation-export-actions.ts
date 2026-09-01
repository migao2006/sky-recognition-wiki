"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";
import { downloadBlob } from "./browser-download";
import { safeFileName } from "./file-name";
import type { ShowcasePreset } from "./organizer-step-state";
import { isChinaOnlyItem, isGraduationGift, isPaidItem } from "./valuation-items";
import type { ValuationAnalysis, ValuationEstimate } from "./valuation-analysis";
import {
  marketBreakClassNames,
  marketPackageTierNames,
} from "./valuation-market";
import type { SeasonConfidence } from "./valuation-season-bands";
import { showcasePresetNames } from "./valuation-showcase-preview";
import type { ValuationRuntimeCapabilities } from "./use-organizer-runtime";
import type { WikiItem } from "./wiki-data";

type ImageExportStatus = {
  phase: "loading-icons" | "rendering";
  completed: number;
  total: number;
};

type Props = {
  runtime: ValuationRuntimeCapabilities;
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  chosen: WikiItem[];
  showcasePreset: ShowcasePreset;
  showcaseItems: Record<ShowcasePreset, WikiItem[]>;
  valuationAnalysis: ValuationAnalysis;
  valuationEstimate: ValuationEstimate | null | undefined;
  confidenceNames: Record<SeasonConfidence, string>;
  localizeValuationLabel: (label: string) => string;
  setNotice: Dispatch<SetStateAction<string>>;
};

export const useValuationExportActions = ({
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
}: Props) => {
  const exportInFlightRef = useRef(false);
  const [imageExport, setImageExport] = useState<ImageExportStatus | null>(
    null,
  );
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
    const seasons = runtime.seasons.map(([slug, name]) => ({
      name,
      owned: chosen.filter(
        (item) =>
          item.section === "seasons" &&
          item.collection === slug &&
          isGraduationGift(item),
      ).length,
      total: runtime.seasonGraduationItems.get(slug)?.length ?? 0,
    }));
    return {
      seasons,
      bindingsConfirmed: account.bindingsConfirmed,
      bindings,
      summary: valuationEstimate
        ? {
            seasonName: valuationAnalysis.startSeasonSlug
              ? runtime.seasonZh[valuationAnalysis.startSeasonSlug] ||
                valuationAnalysis.startSeasonSlug
              : "畢業未明",
            breakLabel: valuationAnalysis.startSeasonSlug
              ? marketBreakClassNames[
                  valuationEstimate.marketProfile.breakClass
                ]
              : "",
            packageLabel:
              marketPackageTierNames[
                valuationEstimate.marketProfile.salePackageTier
              ],
          }
        : undefined,
      resources: {
        candles: account.candles,
        hearts: account.hearts,
        ascended: account.ascended,
        passes: account.passes,
      },
      bindingNote: account.bindingNote,
      notes: account.notes,
      items: collectibleItems.map((item) => ({
        guid: item.guid,
        name: item.name,
        displayName: runtime.zhItemName(item),
        saleName: runtime.saleItemName(item),
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
  const shareSummary = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    const summary = buildSaleCopy(saleCopyData()).join("\n");
    if (!summary.trim()) {
      setNotice("尚無可分享的摘要");
      return;
    }
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
  const exportShowcaseImage = async () => {
    if (exportInFlightRef.current) return;
    if (!chosen.length) {
      setNotice("尚未選取物品");
      return;
    }
    const exportItems = showcaseItems[showcasePreset];
    if (!exportItems.length) {
      setNotice("這個版型沒有可匯出的物品");
      return;
    }
    exportInFlightRef.current = true;
    setImageExport({ phase: "loading-icons", completed: 0, total: exportItems.length });
    setNotice("正在產生圖片…");
    try {
      const { renderShowcaseImage } = await import("./export-showcase");
      const result = await renderShowcaseImage({
        ...runtime.showcaseOrderOptions(exportItems),
        preset: showcasePreset,
        onProgress: setImageExport,
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
      const filePrefix = `光遇帳號_${safeFileName(account.name)}_${showcasePresetNames[showcasePreset]}`;
      result.images.forEach((blob, index) =>
        downloadBlob(
          blob,
          result.images.length === 1
            ? `${filePrefix}.png`
            : `${filePrefix}_${index + 1}-${result.images.length}.png`,
        ),
      );
      setNotice(
        result.failedIconCount
          ? `已下載 ${result.images.length} 張圖片；${result.failedIconCount} 件圖示載入失敗，請重新匯出確認。`
          : `整理圖片已下載（${result.loadedIconCount} 件圖示）`,
      );
    } catch {
      setNotice("圖片產生失敗");
    } finally {
      exportInFlightRef.current = false;
      setImageExport(null);
    }
  };

  return {
    imageExport,
    shareSummary,
    exportShowcaseImage,
  };
};
