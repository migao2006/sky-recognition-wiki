import type { WikiItem } from "./wiki-data";

export type ShowcaseOrderOptions = {
  items: WikiItem[];
  isUltimate: (item: WikiItem) => boolean;
  isLimited: (item: WikiItem) => boolean;
  isPendant: (item: WikiItem) => boolean;
  getClusterName: (item: WikiItem) => string;
  getClusterOrder: (item: WikiItem) => number;
  getItemTypeName: (item: WikiItem) => string;
  getItemTypeOrder: (item: WikiItem) => number;
};

type ShowcaseGroupKey = "ultimate" | "limited" | "other";

export const buildShowcaseGroups = ({
  items,
  isUltimate,
  isLimited,
  isPendant,
  getClusterName,
  getClusterOrder,
  getItemTypeName,
  getItemTypeOrder,
}: ShowcaseOrderOptions) => {
  const ultimates = items.filter(isUltimate);
  const limited = items.filter((item) => !isUltimate(item) && isLimited(item));
  const featured = new Set([...ultimates, ...limited].map((item) => item.guid));
  const groups = [
    { key: "ultimate" as const, name: "季節畢業", items: ultimates },
    { key: "limited" as const, name: "聯動／禮包／限定", items: limited },
    {
      key: "other" as const,
      name: "其他衣櫃",
      items: items.filter((item) => !featured.has(item.guid)),
    },
  ].filter((group) => group.items.length);

  const compareItems = (
    groupKey: ShowcaseGroupKey,
    a: WikiItem,
    b: WikiItem,
  ) =>
    (groupKey === "ultimate"
      ? Number(isPendant(b)) - Number(isPendant(a))
      : getItemTypeOrder(a) - getItemTypeOrder(b)) ||
    a.order - b.order ||
    a.id - b.id ||
    a.guid.localeCompare(b.guid);

  return groups.map((group) => {
    const clusters = new Map<
      string,
      { name: string; items: WikiItem[]; order: number }
    >();
    group.items.forEach((item) => {
      const clusterName =
        group.key === "other" ? getItemTypeName(item) : getClusterName(item);
      const key =
        group.key === "other"
          ? `type:${item.type}`
          : `${item.section}:${clusterName}`;
      const current = clusters.get(key);
      if (current) current.items.push(item);
      else
        clusters.set(key, {
          name: clusterName,
          items: [item],
          order:
            group.key === "other"
              ? getItemTypeOrder(item)
              : getClusterOrder(item),
        });
    });
    const sortedClusters = [...clusters.values()].sort(
      (a, b) =>
        a.order - b.order || a.name.localeCompare(b.name, "zh-Hant"),
    );
    sortedClusters.forEach((cluster) =>
      cluster.items.sort((a, b) => compareItems(group.key, a, b)),
    );
    return { ...group, clusters: sortedClusters };
  });
};

export const orderShowcaseItems = (options: ShowcaseOrderOptions) =>
  buildShowcaseGroups(options).flatMap((group) =>
    group.clusters.flatMap((cluster) => cluster.items),
  );
