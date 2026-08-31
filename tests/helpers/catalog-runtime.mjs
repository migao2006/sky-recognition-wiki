import { readFile } from "node:fs/promises";
import { asModuleUrl } from "./transpile.mjs";
import { loadRuntimeCatalog } from "../../scripts/load-runtime-catalog.mjs";

const readAppSource = (file) =>
  readFile(new URL(`../../app/${file}`, import.meta.url), "utf8");

const withoutWikiTypeImport = (source) =>
  source.replace('import type { WikiItem } from "./wiki-data";', "");

export const loadCatalogRuntime = (options) => loadRuntimeCatalog(options);

export const loadShowcaseRuntime = async () => {
  const [rawShowcaseSource, rawOrderSource] = await Promise.all([
    readAppSource("export-showcase.ts"),
    readAppSource("showcase-order.ts"),
  ]);
  const orderModuleUrl = asModuleUrl(withoutWikiTypeImport(rawOrderSource));
  const showcaseSource = rawShowcaseSource
    .replace('import type { WikiItem } from "./wiki-data";', "")
    .replace(
      /import \{[\s\S]*?\} from "\.\/showcase-order";/,
      `import { buildShowcaseGroups } from ${JSON.stringify(orderModuleUrl)};`,
    );
  const [orderModule, showcaseModule] = await Promise.all([
    import(orderModuleUrl),
    import(asModuleUrl(showcaseSource)),
  ]);
  return {
    source: showcaseSource,
    ...orderModule,
    ...showcaseModule,
  };
};
