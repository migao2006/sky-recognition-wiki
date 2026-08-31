"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ACCOUNT_BACKUP_MAX_BYTES,
  createAccountBackup,
  parseAccountBackup,
} from "./account-backup";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";
import type { ShowcasePreset } from "./organizer-step-state";
import { isChinaOnlyItem, isGraduationGift, isPaidItem } from "./valuation-items";
import type { ValuationAnalysis, ValuationEstimate } from "./valuation-analysis";
import type { SeasonConfidence } from "./valuation-season-bands";
import { showcasePresetNames } from "./valuation-showcase-preview";
import type { OrganizerRuntime } from "./use-organizer-runtime";
import type { WikiItem } from "./wiki-data";

type ImageExportStatus = {
  phase: "loading-icons" | "rendering";
  completed: number;
  total: number;
};

type Props = {
  runtime: OrganizerRuntime;
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  chosen: WikiItem[];
  showcasePreset: ShowcasePreset;
  showcaseItems: Record<ShowcasePreset, WikiItem[]>;
  valuationAnalysis: ValuationAnalysis;
  valuationEstimate: ValuationEstimate | null | undefined;
  confidenceNames: Record<SeasonConfidence, string>;
  localizeValuationLabel: (label: string) => string;
  setAccount: Dispatch<SetStateAction<AccountInfo>>;
  setBindings: Dispatch<SetStateAction<Record<BindingKey, BindingStatus>>>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
};

const safeFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名";

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  setAccount,
  setBindings,
  setOwned,
  setNotice,
}: Props) => {
  const importRef = useRef<HTMLInputElement>(null);
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
    return {
      seasons: runtime.seasons.map(([slug, name]) => ({
        name,
        owned: chosen.filter(
          (item) =>
            item.section === "seasons" &&
            item.collection === slug &&
            isGraduationGift(item),
        ).length,
        total: runtime.seasonGraduationItems.get(slug)?.length ?? 0,
      })),
      bindingsConfirmed: account.bindingsConfirmed,
      bindings,
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
  const exportAccount = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    downloadText(buildSaleCopy(saleCopyData()), "出售文案");
  };
  const copySaleCopy = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    const text = buildSaleCopy(saleCopyData()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("出售文案已複製");
    } catch {
      downloadText([text], "出售文案");
      setNotice("無法複製，已改為下載文案");
    }
  };
  const exportJson = () => {
    const backup = createAccountBackup({
      account,
      bindings,
      items: chosen,
      getZhName: runtime.zhItemName,
      getSource: runtime.source,
    });
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_備份.json`,
    );
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > ACCOUNT_BACKUP_MAX_BYTES) {
      setNotice("無法匯入：備份不可超過 5 MB");
      return;
    }
    try {
      const imported = parseAccountBackup(
        JSON.parse(await file.text()),
        runtime.validItemGuids,
      );
      setAccount(imported.account);
      setBindings(imported.bindings);
      setOwned(new Set(imported.owned));
      setNotice(
        `已匯入 ${imported.imported} 件、遷移 ${imported.migrated} 件、略過 ${imported.ignored} 件`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === "Unsupported account backup version"
          ? "無法匯入：備份版本較新或不支援"
          : "無法匯入：檔案格式不正確",
      );
    }
  };
  const shareSummary = async () => {
    const { buildSaleCopy } = await import("./sale-copy");
    const summary = buildSaleCopy(saleCopyData()).join("\n");
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
    importRef,
    imageExport,
    exportAccount,
    copySaleCopy,
    exportJson,
    importJson,
    shareSummary,
    exportShowcaseImage,
  };
};
