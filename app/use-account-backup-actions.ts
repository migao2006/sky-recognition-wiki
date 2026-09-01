"use client";

import {
  useEffect,
  useRef,
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
import { downloadBlob } from "./browser-download";
import { safeFileName } from "./file-name";
import { hasAccountDraftData } from "./use-account-draft";
import type { AccountRuntime } from "./use-organizer-runtime";

type Props = {
  runtime: AccountRuntime;
  account: AccountInfo;
  bindings: Record<BindingKey, BindingStatus>;
  owned: ReadonlySet<string>;
  setAccount: Dispatch<SetStateAction<AccountInfo>>;
  setBindings: Dispatch<SetStateAction<Record<BindingKey, BindingStatus>>>;
  setOwned: Dispatch<SetStateAction<Set<string>>>;
  setNotice: Dispatch<SetStateAction<string>>;
};

export const useAccountBackupActions = ({
  runtime,
  account,
  bindings,
  owned,
  setAccount,
  setBindings,
  setOwned,
  setNotice,
}: Props) => {
  const importRef = useRef<HTMLInputElement>(null);
  const importGenerationRef = useRef(0);
  const latestDataRef = useRef({ account, bindings, owned });
  useEffect(() => {
    latestDataRef.current = { account, bindings, owned };
  }, [account, bindings, owned]);
  const loadCatalog = async () => runtime.catalogDomain ?? runtime.loadCatalog();

  const exportJson = async () => {
    try {
      const catalog = await loadCatalog();
      const backup = createAccountBackup({
        account,
        bindings,
        items: catalog.wikiItems.filter((item) => owned.has(item.guid)),
        getZhName: catalog.zhItemName,
        getSource: catalog.source,
      });
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
        `光遇帳號_${safeFileName(account.name)}_備份.json`,
      );
    } catch {
      setNotice("無法載入衣櫃資料，請稍後再試");
    }
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const generation = ++importGenerationRef.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > ACCOUNT_BACKUP_MAX_BYTES) {
      setNotice("無法匯入：備份不可超過 5 MB");
      return;
    }
    let catalog: Awaited<ReturnType<typeof loadCatalog>>;
    try {
      catalog = await loadCatalog();
    } catch {
      setNotice("無法載入衣櫃資料，請稍後再試");
      return;
    }
    try {
      const text = await file.text();
      if (generation !== importGenerationRef.current) return;
      const imported = parseAccountBackup(
        JSON.parse(text),
        new Set(catalog.wikiItems.map((item) => item.guid)),
      );
      if (generation !== importGenerationRef.current) return;
      const unknownNames = imported.unknownGuids
        .slice(0, 5)
        .map((item) => item.name || item.guid)
        .join("、");
      const summary = [
        `可匯入 ${imported.imported + imported.migrated} 件`,
        imported.unknownGuids.length
          ? `未知 ${imported.unknownGuids.length} 件${unknownNames ? `（${unknownNames}）` : ""}`
          : "",
        imported.duplicates.length
          ? `重複 ${imported.duplicates.length} 件`
          : "",
        imported.invalidEntries ? `無效 ${imported.invalidEntries} 筆` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const current = latestDataRef.current;
      if (
        (hasAccountDraftData(
          current.account,
          current.bindings,
          current.owned,
        ) ||
          imported.unknownGuids.length > 0) &&
        !window.confirm(`${summary}\n\n匯入會取代目前資料，確定繼續？`)
      ) {
        setNotice("已取消匯入，原有資料未變更");
        return;
      }
      if (generation !== importGenerationRef.current) return;
      setAccount(imported.account);
      setBindings(imported.bindings);
      setOwned(new Set(imported.owned));
      setNotice(
        `已匯入 ${imported.imported} 件、遷移 ${imported.migrated} 件、略過 ${imported.ignored} 件`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error &&
          error.message === "Unsupported account backup version"
          ? "無法匯入：備份版本較新或不支援"
          : "無法匯入：檔案格式不正確",
      );
    }
  };

  return { importRef, exportJson, importJson };
};
