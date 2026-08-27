import ts from "typescript";

export const asModuleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )}`;
