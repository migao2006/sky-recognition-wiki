"use client";

import { useEffect, useRef } from "react";

/** Each new file invalidates previous work; leaving the step invalidates all work. */
export function useImportGeneration() {
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  return generation;
}
