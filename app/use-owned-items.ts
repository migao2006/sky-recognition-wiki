"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

type OwnedItems = Set<string>;

/** Keeps every single-item selection on the same optimistic state update. */
export const useOwnedItems = (onChange: () => void, validGuids?: ReadonlySet<string>) => {
  const [owned, setOwned] = useState<OwnedItems>(new Set());
  // Direct setOwned is reserved for restoring/replacing an account snapshot.
  const updateOwned = useCallback<Dispatch<SetStateAction<OwnedItems>>>((update) => {
    setOwned(update);
    onChange();
  }, [onChange]);
  useEffect(() => {
    if (!validGuids || ![...owned].some((guid) => !validGuids.has(guid))) return;
    const timer = window.setTimeout(() => {
      updateOwned((previous) => new Set([...previous].filter((guid) => validGuids.has(guid))));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [owned, updateOwned, validGuids]);
  const toggleOwned = useCallback((guid: string) => {
    updateOwned((previous) => {
      const next = new Set(previous);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  }, [updateOwned]);

  return { owned, setOwned, updateOwned, toggleOwned };
};
