import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const asModuleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )}`;

const loadCatalogDomain = async () => {
  const [wikiSource, valuationSource, catalogSource] = await Promise.all(
    ["wiki-data.ts", "valuation-items.ts", "catalog-domain.ts"].map((file) =>
      readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
    ),
  );
  const catalogModule = catalogSource
    .replace(
      'import { wikiItems as baseWikiItems } from "./wiki-data";',
      `const { wikiItems: baseWikiItems } = await import(${JSON.stringify(
        asModuleUrl(wikiSource),
      )});`,
    )
    .replace(
      /import \{([\s\S]*?)\} from "\.\/valuation-items";/,
      (_, imports) =>
        `const {${imports}} = await import(${JSON.stringify(
          asModuleUrl(valuationSource),
        )});`,
    );
  return import(asModuleUrl(catalogModule));
};

const { matchesSourceFilter, sourceKind, zhName } = await loadCatalogDomain();

const item = (overrides = {}) => ({
  id: 1,
  order: 1,
  guid: "catalog-test",
  name: "Test Item",
  type: "Cape",
  group: "",
  icon: "",
  wiki: "https://example.com/item",
  section: "base",
  collection: "base",
  ...overrides,
});

test("translates verified and tokenized catalog names", () => {
  assert.equal(
    zhName("Lightseekers Ultimate Umbrella"),
    "追光季畢業禮雨傘",
  );
  assert.equal(zhName("Rainbow Cape"), "彩虹斗篷");
});

test("classifies representative catalog sources", () => {
  assert.equal(
    sourceKind(item({ section: "seasons", collection: "lightseekers" })),
    "季節",
  );
  assert.equal(
    sourceKind(item({ section: "events", collection: "event-cinnamoroll" })),
    "聯動",
  );
  assert.equal(
    sourceKind(item({ section: "store", wiki: "https://example.com/PlayStation" })),
    "平台限定",
  );
});

test("filters catalog items by source category", () => {
  assert.equal(
    matchesSourceFilter(item({ section: "seasons" }), "seasons"),
    true,
  );
  assert.equal(
    matchesSourceFilter(
      item({ section: "events", collection: "event-cinnamoroll" }),
      "collab",
    ),
    true,
  );
  assert.equal(matchesSourceFilter(item({ section: "base" }), "permanent"), true);
  assert.equal(matchesSourceFilter(item({ section: "base" }), "collab"), false);
});
