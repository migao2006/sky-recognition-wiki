import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleUrl = (source) =>
  `data:text/javascript,${encodeURIComponent(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )}`;

const [marketSource, saleSource] = await Promise.all(
  ["market-copy.ts", "sale-copy.ts"].map((file) =>
    readFile(new URL(`../app/${file}`, import.meta.url), "utf8"),
  ),
);
const marketUrl = moduleUrl(marketSource);
const saleUrl = moduleUrl(
  saleSource.replace(
    /import \{ formatMarketBindings \} from "\.\/market-copy";/,
    `const { formatMarketBindings } = await import(${JSON.stringify(marketUrl)});`,
  ),
);
const { buildSaleCopy, buildShareSummary } = await import(saleUrl);
const { formatMarketBindings } = await import(marketUrl);

const input = (overrides = {}) => ({
  accountName: "追光大斷禮包號",
  accountType: "有翼",
  selectedCount: 42,
  earliestGraduationSeason: "追光季",
  seasonNames: ["追光季", "音韻季"],
  graduationStatus: ["追光季畢"],
  bindings: { google: "transfer", nintendo: "keep", steam: "issue" },
  resources: { candles: "1537", hearts: "31", ascended: "35", passes: "1" },
  uniqueEvents: ["AURORA 之翼", "AURORA 之翼"],
  otherPackages: ["大耳狗耳飾"],
  highlights: ["追光斗篷", "AURORA 之翼"],
  notes: "綁定以驗號影片為準",
  ...overrides,
});

test("builds a compact market listing in the fixed section order", () => {
  const copy = buildSaleCopy(input()).join("\n");
  assert.match(copy, /^▍⬪ 追光大斷禮包號$/m);
  assert.match(copy, /最早畢業季：追光季/);
  assert.match(copy, /季節物品：追光季⸝音韻季/);
  assert.equal(copy.includes("起季"), false);
  assert.match(copy, /♡ › 綁定\nɢɢ 出 ┊ ɴs 不出 ┊ sᴛᴇᴀᴍ 遺失／異常/);
  assert.match(copy, /◇ › 限定／聯動\nAURORA 之翼/);
  assert.match(copy, /⭔ › 資源\n1537𖠜｜31ෆ｜35✦｜1副卡/);
  assert.ok(copy.indexOf("♤ › 季節") < copy.indexOf("♡ › 綁定"));
  assert.ok(copy.indexOf("♡ › 綁定") < copy.indexOf("◇ › 限定／聯動"));
  assert.ok(copy.endsWith("─── ☁ 文案為輔 · 影片為主 ☁ ───"));
  for (const forbidden of ["請填寫", "售價", "包仲", "資料來源"]) {
    assert.equal(copy.includes(forbidden), false);
  }
});

test("omits unavailable and zero-value sections without inventing claims", () => {
  const copy = buildSaleCopy(
    input({
      accountName: "",
      earliestGraduationSeason: "",
      seasonNames: [],
      graduationStatus: [],
      bindings: {},
      resources: { candles: "0", hearts: "", ascended: "0", passes: "" },
      uniqueEvents: [],
      otherPackages: [],
      highlights: [],
      notes: "",
    }),
  ).join("\n");
  assert.match(copy, /^▍⬪ 有翼號$/m);
  assert.match(copy, /♡ › 綁定\n無綁/);
  for (const heading of ["♤ › 季節", "◇ › 限定／聯動", "ᴏᴛʜᴇʀs ╻", "⭔ › 資源", "⚝ › 備註"]) {
    assert.equal(copy.includes(heading), false);
  }
});

test("share summary keeps only buyer-facing facts", () => {
  const summary = buildShareSummary(input()).join("\n");
  assert.match(summary, /^▍⬪ 追光大斷禮包號/m);
  assert.match(summary, /♤ › 最早畢業季 追光季 ┊ 畢業 追光季畢/);
  assert.match(summary, /♡ › ɢɢ 出 ┊ ɴs 不出 ┊ sᴛᴇᴀᴍ 遺失／異常/);
  assert.match(summary, /◇ › 追光斗篷⸝AURORA 之翼/);
  assert.match(summary, /衣櫃 42 件/);
  assert.equal(summary.includes("季節物品：追光季⸝音韻季"), false);
});

test("uses the market-specific Nintendo transfer word", () => {
  assert.equal(
    formatMarketBindings({ google: "transfer", nintendo: "transfer" }),
    "ɢɢ 出 ┊ ɴs 解",
  );
});
