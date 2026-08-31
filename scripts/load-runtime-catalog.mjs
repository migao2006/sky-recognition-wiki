import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const jsonImports = [
  ["iapCatalog", "iap-catalog.json"],
  ["playerHairNames", "player-hair-names.json"],
  ["playerZhNames", "player-zh-names.json"],
  ["wikiZhNames", "wiki-zh-names.json"],
];

export async function loadRuntimeCatalog({ stubJsonFiles = [] } = {}) {
  const stubs = new Set(stubJsonFiles);
  const directory = await mkdtemp(join(tmpdir(), "sky-runtime-catalog-"));
  try {
    for (const name of [
      "wiki-data",
      "season-items",
      "market-collectibles",
      "valuation-items",
      "catalog-legacy-guids",
      "catalog-seeds",
      "catalog-taxonomy",
      "catalog-sources",
      "catalog-zh",
      "catalog-derived",
      "catalog-domain",
    ]) {
      let source = await readFile(join(ROOT, "app", `${name}.ts`), "utf8");
      for (const [variable, file] of jsonImports) {
        const statement = `import ${variable} from "./${file}";`;
        if (!source.includes(statement)) continue;
        const json = stubs.has(file)
          ? '{"items":{}}'
          : await readFile(join(ROOT, "app", file), "utf8");
        source = source.replace(statement, `const ${variable} = ${json};`);
      }
      const output = ts
        .transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        })
        .outputText.replace(
          /from "(\.\/[^".]+)"/g,
          'from "$1.js"',
        );
      await writeFile(join(directory, `${name}.js`), output, "utf8");
    }
    return await import(
      `${pathToFileURL(join(directory, "catalog-domain.js")).href}?v=${Date.now()}`
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
