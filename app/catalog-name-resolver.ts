import type { WikiItem } from "./wiki-data";

export type CatalogNameMatch = {
  term: string;
  normalized: string;
  method: "exact" | "contained";
  candidates: readonly WikiItem[];
};

export type CatalogTextResolution = {
  matched: readonly CatalogNameMatch[];
  groups: readonly CatalogNameMatch[];
  ambiguous: readonly CatalogNameMatch[];
  excluded: readonly CatalogNameMatch[];
  unmatched: readonly string[];
};

// These shared aliases deliberately describe every listed candidate as one
// player-facing set. Other duplicate aliases remain ambiguous and are never
// guessed during valuation reconstruction.
const confirmedGroupTerms = new Set([
  "貓咪耳尾",
  "冥龍耳尾組",
  "海牛耳尾組",
  "爆米花組",
  "週年影院套餐",
  "超凡風旅",
  "姆明耳尾組",
  "姆明飾品套裝",
  "冥龍套裝",
  "活力海牛套裝",
  "星夜披風套裝",
  "林克套組",
  "絆愛三件套",
]);

const genericTerms = new Set([
  "斗篷",
  "髮型",
  "面具",
  "頭飾",
  "配件",
  "服裝",
  "鞋子",
  "項鍊",
  "耳環",
  "耳墜",
  "禮包",
  "全圖",
  "畢業",
  "全畢",
  "有卡",
  "無卡",
]);

export const normalizeCatalogTerm = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant")
    .replace(
      /[\s\u200b-\u200d\ufeff"'’‘`´.,，。:：;；!?！？·・|｜/\\()[\]{}<>《》〈〉「」『』【】_\-—–~～+＋=＝♡♤♧◇✦❖⸝╻┊𓆩𓆪☁]/gu,
      "",
    );

const splitListingText = (text: string) =>
  text
    .split(/[\r\n┊｜|・⸝╻▸›»→、,，。;；]+/u)
    .map((term) => term.trim())
    .filter(Boolean);

const hasNegativeContext = (normalized: string, start: number, end: number) => {
  const before = normalized.slice(Math.max(0, start - 5), start);
  const after = normalized.slice(end, end + 5);
  return (
    /(?:沒有|不含|不帶|未有|未持有|未收|缺少|缺|無|已售|售出|拔掉)$/u.test(
      before,
    ) ||
    /^(?:沒有|不含|不帶|未有|未持有|未收|缺少|已售|售出|拔掉)/u.test(
      after,
    )
  );
};

export const buildCatalogNameResolver = (
  items: readonly WikiItem[],
  searchNames: (item: WikiItem) => readonly string[],
) => {
  const byTerm = new Map<string, WikiItem[]>();
  for (const item of items) {
    for (const name of searchNames(item)) {
      const normalized = normalizeCatalogTerm(name);
      if (normalized.length < 2 || genericTerms.has(normalized)) continue;
      const matches = byTerm.get(normalized) ?? [];
      if (!matches.some((candidate) => candidate.guid === item.guid))
        matches.push(item);
      byTerm.set(normalized, matches);
    }
  }
  const containedTerms = [...byTerm.entries()]
    .filter(([term]) => term.length >= 3)
    .sort(([left], [right]) => right.length - left.length);

  const resolve = (term: string): CatalogNameMatch | null => {
    const normalized = normalizeCatalogTerm(term);
    if (!normalized) return null;
    const exact = byTerm.get(normalized);
    if (exact)
      return { term, normalized, method: "exact", candidates: exact };

    let longest = 0;
    const candidates = new Map<string, WikiItem>();
    for (const [alias, matches] of containedTerms) {
      if (longest && alias.length < longest) break;
      if (!normalized.includes(alias)) continue;
      longest = alias.length;
      matches.forEach((item) => candidates.set(item.guid, item));
    }
    return candidates.size
      ? {
          term,
          normalized,
          method: "contained",
          candidates: [...candidates.values()],
        }
      : null;
  };

  const scan = (text: string): CatalogTextResolution => {
    const matchedByGuid = new Map<string, CatalogNameMatch>();
    const groupsByTerm = new Map<string, CatalogNameMatch>();
    const ambiguousByTerm = new Map<string, CatalogNameMatch>();
    const excludedByTerm = new Map<string, CatalogNameMatch>();
    const unmatched = new Set<string>();
    const accept = (result: CatalogNameMatch, excluded = false) => {
      if (excluded) {
        excludedByTerm.set(result.normalized, result);
        return;
      }
      if (result.candidates.length === 1) {
        const [item] = result.candidates;
        const previous = matchedByGuid.get(item.guid);
        if (!previous || result.method === "exact")
          matchedByGuid.set(item.guid, result);
      } else if (confirmedGroupTerms.has(result.normalized)) {
        groupsByTerm.set(result.normalized, result);
      } else {
        ambiguousByTerm.set(result.normalized, result);
      }
    };
    for (const term of splitListingText(text)) {
      const normalized = normalizeCatalogTerm(term);
      const exact = byTerm.get(normalized);
      if (exact) {
        accept({ term, normalized, method: "exact", candidates: exact });
        continue;
      }
      const occurrences: Array<{
        alias: string;
        start: number;
        end: number;
        candidates: WikiItem[];
      }> = [];
      for (const [alias, candidates] of containedTerms) {
        let start = normalized.indexOf(alias);
        while (start >= 0) {
          occurrences.push({
            alias,
            start,
            end: start + alias.length,
            candidates,
          });
          start = normalized.indexOf(alias, start + 1);
        }
      }
      occurrences.sort(
        (left, right) =>
          left.start - right.start ||
          right.alias.length - left.alias.length ||
          left.alias.localeCompare(right.alias),
      );
      if (!occurrences.length) {
        if (normalized) unmatched.add(normalized);
        continue;
      }
      const acceptedSpans: Array<{ start: number; end: number }> = [];
      for (const occurrence of occurrences) {
        if (
          acceptedSpans.some(
            (span) =>
              occurrence.start < span.end && occurrence.end > span.start,
          )
        )
          continue;
        acceptedSpans.push(occurrence);
        accept(
          {
            term,
            normalized: occurrence.alias,
            method: "contained",
            candidates: occurrence.candidates,
          },
          hasNegativeContext(normalized, occurrence.start, occurrence.end),
        );
      }
    }
    return {
      matched: [...matchedByGuid.values()],
      groups: [...groupsByTerm.values()],
      ambiguous: [...ambiguousByTerm.values()],
      excluded: [...excludedByTerm.values()],
      unmatched: [...unmatched],
    };
  };

  return { resolve, scan };
};
