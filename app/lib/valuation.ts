export type CatalogItem = {
  id: string;
  numericId: number;
  nameEn: string;
  nameZh: string;
  type: string;
  group: string;
  sourceKind: string;
  sourceKey: string;
  sourceZh: string;
  baseValue: number;
  core: boolean;
  confidence: string;
  originalPriceUsd: number | null;
};

export type ItemState = "owned" | "missing" | "unknown";

export type ValuationInputs = {
  states: Record<string, ItemState>;
  completeInventory: boolean;
  binding: string;
  ownership: string;
  accountType: string;
  whiteCandles: number;
  hearts: number;
  redCandles: number;
  mapComplete: boolean;
  tierTwoCapes: boolean;
};

export type Contribution = {
  key: string;
  label: string;
  amount: number;
  kind: "base" | "item" | "collection" | "resource";
};

export type ValuationResult = {
  contentValue: number;
  normal: number;
  listing: number;
  urgent: number;
  lower: number;
  upper: number;
  bindingMultiplier: number;
  ownershipMultiplier: number;
  accountMultiplier: number;
  confidenceScore: number;
  confidenceLabel: "低" | "中";
  selectedCount: number;
  knownCoverage: number;
  contributions: Array<Contribution & { percentage: number }>;
  warnings: string[];
};

const bindingMultipliers: Record<string, number> = {
  full: 1.05,
  primary: 1,
  lowRisk: 0.95,
  oneMajor: 0.88,
  twoMajor: 0.8,
  unknown: 0.7,
  highRisk: 0.58,
};

const ownershipMultipliers: Record<string, number> = {
  firstProof: 1.05,
  first: 1,
  second: 0.97,
  threeFour: 0.9,
  fivePlus: 0.8,
  unknown: 0.75,
};

const accountMultipliers: Record<string, number> = {
  winged: 1,
  wingless: 0.95,
  crashWingless: 0.88,
  unknown: 0.9,
};

const saturationBySource: Record<string, number> = {
  seasons: 3000,
  events: 2000,
  store: 5000,
  realms: 1500,
  other: 2000,
};

const earlySeasons = new Set([
  "gratitude",
  "lightseekers",
  "belonging",
  "rhythm",
  "enchantment",
  "sanctuary",
  "prophecy",
  "dreams",
  "assembly",
]);

const ids = {
  whiteBird: "wXiFi4y6YU",
  rhythmPendant: "Xbz7dLYzOi",
  anubis: "GYWFafVVd_",
  kizuna: ["FLMn1Hib7k", "daH57TClK7", "u7q3xg2y55"],
  littlePrince: ["yjuL6T_ZOo", "nrNcYrcZXy", "mABAiqym_P"],
};

function safeNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isOwned(inputs: ValuationInputs, id: string) {
  return inputs.states[id] === "owned";
}

export function calculateValuation(
  catalog: CatalogItem[],
  inputs: ValuationInputs,
): ValuationResult {
  const contributions: Contribution[] = [
    { key: "base", label: "基礎帳號", amount: 1000, kind: "base" },
  ];
  const owned = catalog.filter((item) => isOwned(inputs, item.id));
  const coreItems = owned.filter((item) => item.core);
  const ordinaryItems = owned.filter((item) => !item.core);

  for (const item of coreItems) {
    contributions.push({
      key: item.id,
      label: item.nameZh || item.nameEn,
      amount: item.baseValue,
      kind: "item",
    });
  }

  const groups = new Map<string, CatalogItem[]>();
  for (const item of ordinaryItems) {
    const groupKey = `${item.sourceKind}:${item.sourceKey}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  for (const items of groups.values()) {
    const raw = items.reduce((sum, item) => sum + item.baseValue, 0);
    const cap = saturationBySource[items[0]?.sourceKind] ?? 2000;
    const adjusted = cap * Math.log(1 + raw / cap);
    for (const item of items) {
      contributions.push({
        key: item.id,
        label: item.nameZh || item.nameEn,
        amount: raw ? adjusted * (item.baseValue / raw) : 0,
        kind: "item",
      });
    }
  }

  const knownStates = catalog.filter((item) => {
    const state = inputs.states[item.id] ?? "unknown";
    return inputs.completeInventory || state !== "unknown";
  }).length;
  const knownCoverage = catalog.length ? knownStates / catalog.length : 0;

  const seasonCatalog = new Map<string, CatalogItem[]>();
  for (const item of catalog.filter((item) => item.sourceKind === "seasons")) {
    seasonCatalog.set(item.sourceKey, [
      ...(seasonCatalog.get(item.sourceKey) ?? []),
      item,
    ]);
  }
  for (const [seasonKey, seasonItems] of seasonCatalog) {
    const ownedCount = seasonItems.filter((item) => isOwned(inputs, item.id)).length;
    const knownCount = seasonItems.filter((item) => {
      const state = inputs.states[item.id] ?? "unknown";
      return inputs.completeInventory || state !== "unknown";
    }).length;
    const coverage = seasonItems.length ? knownCount / seasonItems.length : 0;
    const ratio = seasonItems.length ? ownedCount / seasonItems.length : 0;
    if (coverage >= 0.7 && ratio >= 0.65) {
      const cap = earlySeasons.has(seasonKey) ? 500 : 220;
      contributions.push({
        key: `season:${seasonKey}`,
        label: `${seasonItems[0]?.sourceZh ?? seasonKey}完整度`,
        amount: cap * ratio ** 2,
        kind: "collection",
      });
    }
  }

  if (
    isOwned(inputs, ids.whiteBird) &&
    isOwned(inputs, ids.rhythmPendant) &&
    isOwned(inputs, ids.anubis)
  ) {
    contributions.push({
      key: "combo:bird-pendant-anubis",
      label: "白鳥＋耳墜＋阿努組合",
      amount: 2500,
      kind: "collection",
    });
  } else if (
    isOwned(inputs, ids.whiteBird) &&
    isOwned(inputs, ids.rhythmPendant)
  ) {
    contributions.push({
      key: "combo:bird-pendant",
      label: "白鳥＋耳墜組合",
      amount: 1500,
      kind: "collection",
    });
  }
  if (ids.kizuna.every((id) => isOwned(inputs, id))) {
    contributions.push({
      key: "combo:kizuna",
      label: "絆愛三件套完整",
      amount: 500,
      kind: "collection",
    });
  }
  if (ids.littlePrince.every((id) => isOwned(inputs, id))) {
    contributions.push({
      key: "combo:little-prince",
      label: "小王子代表套組",
      amount: 700,
      kind: "collection",
    });
  }

  const resourceValue = Math.min(
    safeNumber(inputs.whiteCandles) * 0.5 +
      safeNumber(inputs.hearts) * 2 +
      safeNumber(inputs.redCandles) * 2,
    3000,
  );
  const completionValue = (inputs.mapComplete ? 300 : 0) + (inputs.tierTwoCapes ? 300 : 0);
  if (resourceValue + completionValue > 0) {
    contributions.push({
      key: "resources",
      label: "資源與常駐完成度",
      amount: resourceValue + completionValue,
      kind: "resource",
    });
  }

  const contentValue = contributions.reduce(
    (sum, contribution) => sum + contribution.amount,
    0,
  );
  const bindingMultiplier = bindingMultipliers[inputs.binding] ?? 0.7;
  const ownershipMultiplier = ownershipMultipliers[inputs.ownership] ?? 0.75;
  const accountMultiplier = accountMultipliers[inputs.accountType] ?? 0.9;
  const normal = contentValue * bindingMultiplier * ownershipMultiplier * accountMultiplier;
  const listing = normal * 1.08;
  const urgent = normal * 0.85;

  let confidenceScore = 25;
  if (inputs.completeInventory) confidenceScore += 20;
  confidenceScore += Math.min(20, knownCoverage * 20);
  if (inputs.binding !== "unknown") confidenceScore += 10;
  if (inputs.ownership !== "unknown") confidenceScore += 10;
  if (owned.length >= 10) confidenceScore += 5;
  confidenceScore = Math.min(69, Math.round(confidenceScore));
  const confidenceLabel = confidenceScore >= 45 ? "中" : "低";
  const intervalWidth = confidenceLabel === "中" ? 0.24 : 0.38;

  const warnings = [
    "目前核心物價格仍為人工暫定，尚未由足量已驗證成交資料校準。",
  ];
  if (!inputs.completeInventory && knownCoverage < 0.7) {
    warnings.push("你選擇的是部分衣櫃，系統不會把未確認物品視為缺少，也不計季節完整獎勵。");
  }
  if (inputs.binding === "unknown") warnings.push("綁定狀況不明，已套用較保守的風險係數。");
  if (inputs.ownership === "unknown") warnings.push("帳號任數不明，已套用較保守的來源係數。");

  return {
    contentValue,
    normal,
    listing,
    urgent,
    lower: normal * (1 - intervalWidth),
    upper: normal * (1 + intervalWidth),
    bindingMultiplier,
    ownershipMultiplier,
    accountMultiplier,
    confidenceScore,
    confidenceLabel,
    selectedCount: owned.length,
    knownCoverage,
    contributions: contributions
      .map((contribution) => ({
        ...contribution,
        percentage: contentValue ? (contribution.amount / contentValue) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    warnings,
  };
}

export function formatTwd(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}
