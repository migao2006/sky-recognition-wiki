import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("website keeps only the fresh valuation model", async () => {
  const root = fileURLToPath(new URL("../app/", import.meta.url));
  const pending = [path.join(root, "page.tsx")], visited = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    if (file.endsWith(".json")) continue;
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
    const imports = [];
    const visit = node => {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const specifier of imports.filter(value => value.startsWith("."))) {
      const base = path.resolve(path.dirname(file), specifier);
      for (const candidate of [base, base + ".ts", base + ".tsx", base + ".js", base + ".json"]) {
        if (await access(candidate).then(() => true, () => false)) { pending.push(candidate); break; }
      }
    }
  }
  assert.ok(visited.has(path.join(root, "valuation-analysis.ts")));
  assert.ok(visited.has(path.join(root, "valuation-fresh-core.js")));
  for (const removed of ["valuation-market-aggregate.json", "valuation-model-core.js", "valuation-season-band-core.js"]) {
    assert.equal(await access(path.join(root, removed)).then(() => true, () => false), false, removed);
  }
});
