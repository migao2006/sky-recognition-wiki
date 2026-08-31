import { readFile } from "node:fs/promises";
import ts from "typescript";

const appSource = (name) =>
  readFile(new URL(`../app/${name}`, import.meta.url), "utf8");
const asModuleUrl = (source, label = "valuation module") => {
  const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
  if (/(?:from\s+|import\s*\()\s*["']\.\//u.test(output))
    throw new Error(`${label} still contains an unresolved relative import.`);
  return `data:text/javascript,${encodeURIComponent(output)}`;
};

export async function loadValuationRuntime() {
  const [
    config,
    calibration,
    marketCollectibles,
    iapCatalog,
    seasonItems,
    valuationItems,
    valuationMarket,
    marketAggregateText,
    bands,
    modelCore,
    analysis,
  ] = await Promise.all([
    appSource("account-config.ts"),
    appSource("valuation-calibration.ts"),
    appSource("market-collectibles.ts"),
    appSource("iap-catalog.json"),
    appSource("season-items.ts"),
    appSource("valuation-items.ts"),
    appSource("valuation-market.ts"),
    appSource("valuation-market-aggregate.json"),
    appSource("valuation-season-bands.ts"),
    appSource("valuation-model-core.js"),
    appSource("valuation-analysis.ts"),
  ]);
  const marketAggregate = JSON.parse(marketAggregateText);
  const marketUrl = asModuleUrl(
    marketCollectibles.replace(
      'import iapCatalog from "./iap-catalog.json";',
      `const iapCatalog = ${iapCatalog};`,
    ),
    "market collectibles",
  );
  const seasonUrl = asModuleUrl(
    seasonItems.replace('import type { WikiItem } from "./wiki-data";', ""),
    "season items",
  );
  const itemsUrl = asModuleUrl(
    valuationItems
      .replace('import type { WikiItem } from "./wiki-data";', "")
      .replace(
        'export {\n  isGraduationGift,\n  isSeasonPendant,\n  isSeasonUltimate,\n} from "./season-items";',
        `export { isGraduationGift, isSeasonPendant, isSeasonUltimate } from ${JSON.stringify(seasonUrl)};`,
      )
      .replace(
        'import { marketCollectibleProfile } from "./market-collectibles";',
        `const { marketCollectibleProfile } = await import(${JSON.stringify(marketUrl)});`,
      )
      .replace(
        'import { isSeasonUltimate } from "./season-items";',
        `const { isSeasonUltimate } = await import(${JSON.stringify(seasonUrl)});`,
      ),
    "valuation items",
  );
  const valuationMarketUrl = asModuleUrl(
    valuationMarket.replace(
      /import marketAggregate[\s\S]*?;\n/,
      `const marketAggregate = ${JSON.stringify(marketAggregate)};\n`,
    ),
    "valuation market",
  );
  const bandsUrl = asModuleUrl(
    bands.replace(
      /import valuationMarketAggregate[\s\S]*?;\n/,
      `const valuationMarketAggregate = ${JSON.stringify(marketAggregate)};\n`,
    ),
    "valuation season bands",
  );
  const modelCoreUrl = asModuleUrl(modelCore, "valuation model core");
  return import(
    asModuleUrl(
      analysis
        .replace(
          /import \{([^;]*?)\} from "\.\/valuation-market";/,
          (_, names) =>
            `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(valuationMarketUrl)});`,
        )
        .replace(
          /import \{([^;]*?)\} from "\.\/account-config";/,
          (_, names) =>
            `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(config))});`,
        )
        .replace(
          /import \{([^;]*?)\} from "\.\/valuation-calibration";/,
          (_, names) =>
            `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(asModuleUrl(calibration))});`,
        )
        .replace(
          /import \{([^;]*?)\} from "\.\/valuation-items";/,
          (_, names) =>
            `const {${names}} = await import(${JSON.stringify(itemsUrl)});`,
        )
        .replace(
          /import \{([^;]*?)\} from "\.\/valuation-season-bands";/,
          (_, names) =>
            `const {${names.replace(/\btype\s+/g, "")}} = await import(${JSON.stringify(bandsUrl)});`,
        )
        .replace(
          /import \{([^;]*?)\} from "\.\/valuation-model-core\.js";/,
          (_, names) =>
            `const {${names}} = await import(${JSON.stringify(modelCoreUrl)});`,
        )
        .replace(
          /export \{ summarizeValuationRange \} from "\.\/valuation-model-core\.js";/,
          `const { summarizeValuationRange } = await import(${JSON.stringify(modelCoreUrl)});\nexport { summarizeValuationRange };`,
        ),
      "valuation analysis",
    ),
  );
}
