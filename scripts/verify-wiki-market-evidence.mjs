#!/usr/bin/env node
/**
 * Cross-check collected Chinese Wiki evidence against runtime SkyGame-Data
 * identities. The verifier is report-only: it never writes catalog names,
 * packages, prices, or valuation rules.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import * as OpenCC from "opencc-js";
import { loadRuntimeCatalog } from "./load-runtime-catalog.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EVIDENCE_PATH = resolve(ROOT, "work", "wiki-market-evidence", "report.json");
const OUTPUT_PATH = resolve(
  ROOT,
  "work",
  "wiki-market-evidence",
  "verification.json",
);
const iapCatalog = JSON.parse(
  await readFile(resolve(ROOT, "app", "iap-catalog.json"), "utf8"),
);
const evidence = JSON.parse(await readFile(EVIDENCE_PATH, "utf8"));
const catalog = await loadRuntimeCatalog();
const toTaiwan = OpenCC.Converter({ from: "cn", to: "tw" });
const resolver = catalog.buildCatalogNameResolver(
  catalog.wikiItems,
  catalog.zhItemSearchNames,
);
const iapByGuid = new Map(iapCatalog.items.map((item) => [item.guid, item]));

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const normalizedAsset = (value) =>
  decode(value)
    .normalize("NFKC")
    .replace(/ /g, "_")
    .toLocaleLowerCase("en-US");
const iconByAsset = new Map();
for (const item of catalog.wikiItems) {
  let asset;
  try {
    asset = normalizedAsset(basename(new URL(item.icon).pathname));
  } catch {
    continue;
  }
  const candidates = iconByAsset.get(asset) ?? [];
  candidates.push(item);
  iconByAsset.set(asset, candidates);
}

const typeMap = new Map([
  ["髮型", new Set(["Hair"])],
  ["發型", new Set(["Hair"])],
  ["髮飾", new Set(["HairAccessory", "HeadAccessory"])],
  ["發飾", new Set(["HairAccessory", "HeadAccessory"])],
  ["頭飾", new Set(["HairAccessory", "HeadAccessory"])],
  ["面飾", new Set(["FaceAccessory"])],
  ["面具", new Set(["Mask", "FaceAccessory"])],
  ["頸飾", new Set(["Necklace"])],
  ["耳飾", new Set(["Necklace", "HairAccessory", "HeadAccessory"])],
  ["斗篷", new Set(["Cape"])],
  ["褲子", new Set(["Outfit"])],
  ["服裝", new Set(["Outfit"])],
  ["鞋子", new Set(["Shoes"])],
  ["樂器", new Set(["Instrument", "LargeProp", "SmallProp"])],
  ["背飾", new Set(["Instrument", "LargeProp", "SmallProp"])],
  ["小型家具", new Set(["SmallProp"])],
  ["大型家具", new Set(["LargeProp"])],
  ["共享空間物品", new Set(["LargeProp", "SmallProp"])],
]);

const parseBwikiImage = (filename) => {
  const match = filename.match(
    /^UI-([^-]+)-(.+?)(?:-無框|-无框)?\.(?:png|webp|jpe?g)$/iu,
  );
  if (!match) return null;
  return {
    typeLabel: toTaiwan(match[1]),
    term: toTaiwan(match[2]),
  };
};
const candidateSummary = (item) => ({
  guid: item.guid,
  englishName: item.name,
  type: item.type,
  zhName: catalog.zhItemName(item),
  iap: iapByGuid.has(item.guid),
});
const uniqueItems = (items) => [
  ...new Map(items.map((item) => [item.guid, item])).values(),
];
const pricePattern = /￥|¥|NT\$|USD|價格|价格|售價|售价/u;
const packagePattern = /禮包|礼包|套裝禮包|套装礼包/u;

const matches = [];
const pages = [];
for (const source of evidence.sources ?? []) {
  for (const page of source.pages ?? []) {
    const pageMatches = [];
    for (const image of page.images ?? []) {
      const iconCandidates = iconByAsset.get(normalizedAsset(image)) ?? [];
      if (iconCandidates.length) {
        const status =
          iconCandidates.length === 1
            ? page.region === "global"
              ? "verified-global-icon"
              : "china-reference-icon"
            : "ambiguous-icon";
        pageMatches.push({
          source: page.source,
          region: page.region,
          pageTitle: page.title,
          revisionId: page.revisionId,
          pageUrl: page.url,
          image,
          sourceTerm: null,
          convertedTerm: null,
          sourceType: null,
          method: "exact-icon-basename",
          status,
          candidates: iconCandidates.map(candidateSummary),
        });
        continue;
      }
      if (page.region !== "china") continue;
      const parsed = parseBwikiImage(image);
      if (!parsed) continue;
      const resolved = resolver.resolve(parsed.term);
      if (!resolved) {
        pageMatches.push({
          source: page.source,
          region: page.region,
          pageTitle: page.title,
          revisionId: page.revisionId,
          pageUrl: page.url,
          image,
          sourceTerm: parsed.term,
          convertedTerm: parsed.term,
          sourceType: parsed.typeLabel,
          method: "traditional-player-name",
          status: "unmatched-name",
          candidates: [],
        });
        continue;
      }
      const allowedTypes = typeMap.get(parsed.typeLabel);
      const typeMatched = allowedTypes
        ? resolved.candidates.filter((item) => allowedTypes.has(item.type))
        : [...resolved.candidates];
      const candidates = uniqueItems(typeMatched);
      const status =
        candidates.length === 1
          ? "china-reference-name-type"
          : candidates.length > 1
            ? "ambiguous-name-type"
            : "type-mismatch";
      pageMatches.push({
        source: page.source,
        region: page.region,
        pageTitle: page.title,
        revisionId: page.revisionId,
        pageUrl: page.url,
        image,
        sourceTerm: matchTerm(image),
        convertedTerm: parsed.term,
        sourceType: parsed.typeLabel,
        method: resolved.method,
        status,
        candidates: candidates.map(candidateSummary),
      });
    }
    const deduplicated = [
      ...new Map(
        pageMatches.map((match) => [
          `${match.image}|${match.status}|${match.candidates.map((item) => item.guid).join(",")}`,
          match,
        ]),
      ).values(),
    ];
    matches.push(...deduplicated);
    const matchedGuids = uniqueItems(
      deduplicated.flatMap((match) =>
        match.candidates.length === 1
          ? catalog.wikiItems.filter((item) => item.guid === match.candidates[0].guid)
          : [],
      ),
    ).map((item) => item.guid);
    pages.push({
      source: page.source,
      region: page.region,
      title: page.title,
      revisionId: page.revisionId,
      url: page.url,
      isPackagePage: packagePattern.test(page.title),
      matchedGuids,
      priceEvidence: (page.evidenceLines ?? [])
        .filter((line) => pricePattern.test(line))
        .slice(0, 8),
      candidateImages: deduplicated.length,
    });
  }
}

function matchTerm(filename) {
  const parsed = filename.match(
    /^UI-[^-]+-(.+?)(?:-無框|-无框)?\.(?:png|webp|jpe?g)$/iu,
  );
  return parsed?.[1] ?? null;
}

const counts = Object.fromEntries(
  [
    "verified-global-icon",
    "china-reference-icon",
    "china-reference-name-type",
    "ambiguous-icon",
    "ambiguous-name-type",
    "type-mismatch",
    "unmatched-name",
  ].map((status) => [status, matches.filter((match) => match.status === status).length]),
);
const uniqueCount = (values) => new Set(values.filter(Boolean)).size;
const pageKey = (source, title) => `${source}\u0000${title}`;
const pagesByKey = new Map(
  pages.map((page) => [pageKey(page.source, page.title), page]),
);
const globalPaidCandidates = matches
  .filter(
    (match) => {
      const page = pagesByKey.get(pageKey(match.source, match.pageTitle));
      return (
        match.status === "verified-global-icon" &&
        match.candidates.length === 1 &&
        !match.candidates[0].iap &&
        page?.isPackagePage &&
        page.priceEvidence.length > 0 &&
        page.matchedGuids.length <= 4
      );
    },
  )
  .map((match) => ({
    pageTitle: match.pageTitle,
    pageUrl: match.pageUrl,
    image: match.image,
    candidate: match.candidates[0],
  }));
const uniqueGlobalPaidCandidates = [
  ...new Map(
    globalPaidCandidates.map((candidate) => [
      `${candidate.pageUrl}|${candidate.candidate.guid}`,
      candidate,
    ]),
  ).values(),
];
const unmatchedChinaTerms = [
  ...new Map(
    matches
      .filter((match) => match.status === "unmatched-name")
      .map((match) => [
        `${match.sourceType}|${match.convertedTerm}`,
        {
          sourceType: match.sourceType,
          term: match.convertedTerm,
          examplePageTitle: match.pageTitle,
          examplePageUrl: match.pageUrl,
        },
      ]),
  ).values(),
];
const typeMismatchTerms = [
  ...new Map(
    matches
      .filter((match) => match.status === "type-mismatch")
      .map((match) => [
        `${match.sourceType}|${match.convertedTerm}`,
        {
          sourceType: match.sourceType,
          term: match.convertedTerm,
          examplePageTitle: match.pageTitle,
          examplePageUrl: match.pageUrl,
        },
      ]),
  ).values(),
];
const uniqueGlobalItems = uniqueItems(
  matches
    .filter((match) => match.status === "verified-global-icon")
    .flatMap((match) =>
      match.candidates.flatMap((candidate) =>
        catalog.wikiItems.filter((item) => item.guid === candidate.guid),
      ),
    ),
);
const uniqueChinaReferenceItems = uniqueItems(
  matches
    .filter((match) =>
      ["china-reference-icon", "china-reference-name-type"].includes(
        match.status,
      ),
    )
    .flatMap((match) =>
      match.candidates.flatMap((candidate) =>
        catalog.wikiItems.filter((item) => item.guid === candidate.guid),
      ),
    ),
);
const report = {
  generatedAt: new Date().toISOString(),
  input: {
    path: EVIDENCE_PATH,
    generatedAt: evidence.generatedAt,
    pages: evidence.totals?.pages,
  },
  policy: [
    "Only exact catalog icon basenames count as verified global identities.",
    "BWiki names are converted to Traditional Chinese, resolved through existing player aliases, and checked against the wardrobe type.",
    "Every BWiki result remains China-reference-only even when it resolves to a shared GUID.",
    "A possible missing global IAP is queued only from a package-titled page with price evidence, an exact icon match, and at most four matched GUIDs.",
    "No result is written into catalog, IAP, sale-copy, or valuation data.",
  ],
  totals: {
    pages: pages.length,
    packagePages: pages.filter((page) => page.isPackagePage).length,
    packagePagesWithMatches: pages.filter(
      (page) => page.isPackagePage && page.matchedGuids.length,
    ).length,
    candidateAssets: matches.length,
    uniqueCandidateAssets: uniqueCount(
      matches.map((match) => `${match.source}|${match.image}`),
    ),
    ...counts,
    uniqueVerifiedGlobalGuids: uniqueGlobalItems.length,
    verifiedGlobalIapGuids: uniqueGlobalItems.filter((item) =>
      iapByGuid.has(item.guid),
    ).length,
    uniqueChinaReferenceGuids: uniqueChinaReferenceItems.length,
    chinaReferenceIapGuids: uniqueChinaReferenceItems.filter((item) =>
      iapByGuid.has(item.guid),
    ).length,
    uniqueUnmatchedChinaTerms: unmatchedChinaTerms.length,
    uniqueTypeMismatchTerms: typeMismatchTerms.length,
    globalPaidReviewCandidates: uniqueGlobalPaidCandidates.length,
  },
  pages,
  matches,
  reviewQueues: {
    globalPaidCandidates: uniqueGlobalPaidCandidates,
    unmatchedChinaTerms,
    typeMismatchTerms,
  },
};
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ report: OUTPUT_PATH, ...report.totals }, null, 2)}\n`,
);
