import type { WikiItem } from "./wiki-data";
import { canonicalPackageKey, isChinaOnlyItem, isPaidItem, platformBindingForItem } from "./valuation-items";

// A package count alone cannot prove that every package/member is present.
export function packageCoverage(catalog: readonly WikiItem[], owned: ReadonlySet<string>,
  bindings: Record<string, string>, confirmed: boolean) {
  const packages = new Map<string, WikiItem[]>();
  for (const item of catalog) {
    if (!isPaidItem(item) || isChinaOnlyItem(item)) continue;
    const key = canonicalPackageKey(item);
    if (key) packages.set(key, [...(packages.get(key) ?? []), item]);
  }
  const complete = [...packages.values()].filter(items => items.every(item => {
    const platform = platformBindingForItem(item);
    return owned.has(item.guid) && (!platform || !["keep", "issue"].includes(bindings[platform]));
  })).length;
  return { total: packages.size, complete: confirmed ? complete : null,
    full: confirmed && packages.size > 0 && complete === packages.size };
}
