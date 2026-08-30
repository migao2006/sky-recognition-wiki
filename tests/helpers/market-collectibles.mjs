import { readFile } from "node:fs/promises";
import { asModuleUrl } from "./transpile.mjs";

export async function marketCollectiblesModuleUrl() {
  const [source, catalog] = await Promise.all([
    readFile(new URL("../../app/market-collectibles.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/iap-catalog.json", import.meta.url), "utf8"),
  ]);
  return asModuleUrl(
    source.replace(
      'import iapCatalog from "./iap-catalog.json";',
      `const iapCatalog = ${catalog};`,
    ),
  );
}
