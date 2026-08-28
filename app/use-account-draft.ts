"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  ACCOUNT_DRAFT_STORAGE_KEY,
  createAccountDraft,
  parseAccountDraft,
} from "./account-backup";
import type { AccountInfo, BindingKey, BindingStatus } from "./account-config";

type AccountBindings = Record<BindingKey, BindingStatus>;
type SetOwned = Dispatch<SetStateAction<Set<string>>>;

export type HasAccountDraftData = (
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
  validGuids: MutableRefObject<ReadonlySet<string> | undefined>;
  setAccount: Dispatch<SetStateAction<AccountInfo>>;
  setBindings: Dispatch<SetStateAction<AccountBindings>>;
  setOwned: SetOwned;
  setNotice: Dispatch<SetStateAction<string>>;
  hasData?: HasAccountDraftData;
};

type UseAccountDraftResult = {
  draftAvailable: boolean;
  clearStoredDraft: () => void;
};

const removeStoredDraft = () =>
  window.localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);

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

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let restored: ReturnType<typeof parseAccountDraft> | null = null;
      let available = true;

      try {
        const stored = window.localStorage.getItem(ACCOUNT_DRAFT_STORAGE_KEY);
        if (stored) {
          restored = parseAccountDraft(JSON.parse(stored), validGuids.current);
        }
      } catch {
        try {
          removeStoredDraft();
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
            removeStoredDraft();
          } catch {
            available = false;
          }
        }
      }
      setDraftAvailable(available);
      setDraftReady(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasData, setAccount, setBindings, setNotice, setOwned, validGuids]);

  useEffect(() => {
    if (!draftReady || !draftAvailable) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        if (hasData(account, bindings, owned)) {
          window.localStorage.setItem(
            ACCOUNT_DRAFT_STORAGE_KEY,
            JSON.stringify(createAccountDraft({ account, bindings, owned })),
          );
        } else {
          removeStoredDraft();
        }
      } catch {
        try {
          removeStoredDraft();
        } catch {
          // Storage is unavailable; the in-memory session remains usable.
        }
        setDraftAvailable(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [account, bindings, draftAvailable, draftReady, hasData, owned]);

  const clearStoredDraft = useCallback(() => {
    try {
      removeStoredDraft();
    } catch {
      setDraftAvailable(false);
    }
  }, []);

  return { draftAvailable, clearStoredDraft };
};
