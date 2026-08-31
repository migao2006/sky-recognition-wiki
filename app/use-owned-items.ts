"use client";

import { useCallback, useState } from "react";

export type OwnedItems = Set<string>;

/** Keeps every single-item selection on the same optimistic state update. */
export const useOwnedItems = () => {
  const [owned, setOwned] = useState<OwnedItems>(new Set());
  const toggleOwned = useCallback((guid: string) => {
    setOwned((previous) => {
      const next = new Set(previous);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  }, []);

  return { owned, setOwned, toggleOwned };
};
