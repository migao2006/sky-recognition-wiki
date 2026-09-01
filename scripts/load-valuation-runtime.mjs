import { tsImport } from "tsx/esm/api";

// See load-runtime-catalog.mjs. Tests and maintenance scripts exercise the
// same TypeScript dependency graph that the browser bundle uses.
export const loadValuationRuntime = () =>
  tsImport("../app/valuation-analysis.ts", import.meta.url);
