"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ACCOUNT_LEGACY_DRAFT_STORAGE_KEYS,
  ACCOUNT_DRAFT_STORAGE_KEY,
  createAccountDraft,
  parseAccountDraft,
} from "./account-backup";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";

type AccountBindings = Record<BindingKey, BindingStatus>;
type SetOwned = Dispatch<SetStateAction<Set<string>>>;

type HasAccountDraftData = (
  account: AccountInfo,
  bindings: AccountBindings,
  owned: ReadonlySet<string>,
) => boolean;

export const hasAccountDraftData: HasAccountDraftData = (
  account,
  bindings,
  owned,
) =>
  owned.size > 0 ||
  account.accountType !== "有翼" ||
  account.bindingsConfirmed ||
  [
    account.name,
    account.candles,
    account.hearts,
    account.ascended,
    account.passes,
    account.bindingNote,
    account.notes,
  ].some((value) => value.trim()) ||
  Object.values(bindings).some((value) => value !== "none");

type UseAccountDraftOptions = {
  account: AccountInfo;
  bindings: AccountBindings;
  owned: ReadonlySet<string>;
  validGuids: ReadonlySet<string> | undefined;
  setAccount: Dispatch<SetStateAction<AccountInfo>>;
  setBindings: Dispatch<SetStateAction<AccountBindings>>;
  setOwned: SetOwned;
  setNotice: Dispatch<SetStateAction<string>>;
  hasData?: HasAccountDraftData;
};

type UseAccountDraftResult = {
  draftAvailable: boolean;
  draftReady: boolean;
  clearStoredDraft: () => void;
};

const storedDraftKeys = [
  ACCOUNT_DRAFT_STORAGE_KEY,
  ...ACCOUNT_LEGACY_DRAFT_STORAGE_KEYS,
];

const clearStoredDrafts = () => {
  let failure: unknown;
  storedDraftKeys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      failure ??= error;
    }
  });
  if (failure) throw failure;
};

type DraftSnapshot = Pick<
  UseAccountDraftOptions,
  "account" | "bindings" | "owned"
> & {
  hasData: HasAccountDraftData;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const DRAFT_SAVE_DEBOUNCE_MS = 350;
const DRAFT_IDLE_TIMEOUT_MS = 1_000;

/** Keeps the in-progress account form on this device for thirty days. */
export const useAccountDraft = ({
  account,
  bindings,
  owned,
  validGuids,
  setAccount,
  setBindings,
  setOwned,
  setNotice,
  hasData = hasAccountDraftData,
}: UseAccountDraftOptions): UseAccountDraftResult => {
  const [draftReady, setDraftReady] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const skipNextDraftSave = useRef(false);
  const draftReadyRef = useRef(false);
  const draftAvailableRef = useRef(true);
  const snapshotRef = useRef<DraftSnapshot>({
    account,
    bindings,
    owned,
    hasData,
  });
  const saveTimerRef = useRef<number | undefined>(undefined);
  const idleSaveRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    snapshotRef.current = { account, bindings, owned, hasData };
  }, [account, bindings, hasData, owned]);

  const cancelScheduledSave = useCallback(() => {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    if (idleSaveRef.current !== undefined) {
      const idleWindow = window as IdleWindow;
      idleWindow.cancelIdleCallback?.(idleSaveRef.current);
      idleSaveRef.current = undefined;
    }
  }, []);

  const saveCurrentDraft = useCallback(() => {
    if (!draftReadyRef.current || !draftAvailableRef.current) return;
    const snapshot = snapshotRef.current;

    try {
      if (snapshot.hasData(snapshot.account, snapshot.bindings, snapshot.owned)) {
        window.localStorage.setItem(
          ACCOUNT_DRAFT_STORAGE_KEY,
          JSON.stringify(
            createAccountDraft({
              account: snapshot.account,
              bindings: snapshot.bindings,
              owned: snapshot.owned,
            }),
          ),
        );
      } else {
        clearStoredDrafts();
      }
    } catch {
      try {
        clearStoredDrafts();
      } catch {
        // Storage is unavailable; the in-memory session remains usable.
      }
      draftAvailableRef.current = false;
      setDraftAvailable(false);
    }
  }, []);

  const flushScheduledSave = useCallback(() => {
    cancelScheduledSave();
    saveCurrentDraft();
  }, [cancelScheduledSave, saveCurrentDraft]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let restored: ReturnType<typeof parseAccountDraft> | null = null;
      let available = true;

      try {
        for (const draftKey of storedDraftKeys) {
          const stored = window.localStorage.getItem(draftKey);
          if (!stored) continue;
          try {
            restored = parseAccountDraft(JSON.parse(stored), validGuids);
          } catch {
            window.localStorage.removeItem(draftKey);
            continue;
          }
          if (draftKey !== ACCOUNT_DRAFT_STORAGE_KEY) {
            window.localStorage.setItem(
              ACCOUNT_DRAFT_STORAGE_KEY,
              JSON.stringify(
                createAccountDraft({
                  account: restored.account,
                  bindings: restored.bindings,
                  owned: restored.owned,
                }),
              ),
            );
            window.localStorage.removeItem(draftKey);
          }
          break;
        }
      } catch {
        try {
          clearStoredDrafts();
        } catch {
          available = false;
        }
      }

      if (cancelled) return;
      if (restored) {
        const restoredOwned = new Set(restored.owned);
        if (hasData(restored.account, restored.bindings, restoredOwned)) {
          skipNextDraftSave.current = true;
          setAccount(restored.account);
          setBindings(restored.bindings);
          setOwned(restoredOwned);
          setNotice("已恢復此裝置上的草稿");
        } else {
          try {
            clearStoredDrafts();
          } catch {
            available = false;
          }
        }
      }
      setDraftAvailable(available);
      draftAvailableRef.current = available;
      setDraftReady(true);
      draftReadyRef.current = true;
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  // Draft restoration deliberately happens once before the catalog is loaded.
  // The runtime filters restored GUIDs after the catalog becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, setAccount, setBindings, setNotice, setOwned]);

  useEffect(() => {
    if (!draftReady || !draftAvailable) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = undefined;
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleSaveRef.current = idleWindow.requestIdleCallback(
          () => {
            idleSaveRef.current = undefined;
            saveCurrentDraft();
          },
          { timeout: DRAFT_IDLE_TIMEOUT_MS },
        );
      } else {
        saveCurrentDraft();
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return cancelScheduledSave;
  }, [account, bindings, cancelScheduledSave, draftAvailable, draftReady, owned, saveCurrentDraft]);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushScheduledSave();
    };
    window.addEventListener("pagehide", flushScheduledSave);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushScheduledSave);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushScheduledSave]);

  const clearStoredDraft = useCallback(() => {
    cancelScheduledSave();
    try {
      clearStoredDrafts();
    } catch {
      setDraftAvailable(false);
    }
  }, [cancelScheduledSave]);

  return { draftAvailable, draftReady, clearStoredDraft };
};
