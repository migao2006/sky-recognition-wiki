import { tsImport } from "tsx/esm/api";

// Loading the real module graph avoids source-string rewrites that could pass
// tests while no longer matching the application's imports. tsImport keeps
// standalone Node maintenance scripts compatible with the pinned Node 22 CI.
export const loadRuntimeCatalog = () =>
  tsImport("../app/catalog-domain.ts", import.meta.url);
