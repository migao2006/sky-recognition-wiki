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
      setDraftReady(true);
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

    const timer = window.setTimeout(() => {
      try {
        if (hasData(account, bindings, owned)) {
          window.localStorage.setItem(
            ACCOUNT_DRAFT_STORAGE_KEY,
            JSON.stringify(createAccountDraft({ account, bindings, owned })),
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
        setDraftAvailable(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [account, bindings, draftAvailable, draftReady, hasData, owned]);

  const clearStoredDraft = useCallback(() => {
    try {
      clearStoredDrafts();
    } catch {
      setDraftAvailable(false);
    }
  }, []);

  return { draftAvailable, clearStoredDraft };
};
