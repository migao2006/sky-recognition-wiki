import type { WikiItem } from "./wiki-data";
export const labels: Record<string, string> = {
  Hair: "髮型",
  HairAccessory: "髮飾",
  HeadAccessory: "頭部配件",
  Mask: "面具",
  FaceAccessory: "臉部配件",
  Necklace: "頸部配件",
  Cape: "斗篷",
  Outfit: "一般服裝",
  OutfitShoes: "連身服裝",
  Shoes: "鞋子",
  Instrument: "樂器",
  HeldProp: "手持道具",
  LargeProp: "大型可放置道具",
  SmallProp: "小型可放置道具",
  Emote: "動作",
  Stance: "站姿",
  Call: "叫聲",
};
const heldClosetNames = [
  "Harp", "Fledgling Harp", "Contrabass", "Piano Keyboard", "Horn",
  "Small Bell", "Large Bell", "Flute", "Panflute", "Guitar",
  "Rhythm Guitar", "Ukulele", "Xylophone", "Winter Piano",
  "Sanctuary Handpan", "Triumph Handpan", "Prophecy Drum", "Lute", "Bugle",
  "Kalimba", "Electric Guitar", "Blue Electric Guitar", "Dark Horn",
  "Voice of AURORA", "Manta Ocarina", "Cello", "Duets Cello", "Harmonica",
  "Cymbals", "Vessel Flute", "Drum", "Triumph Violin", "Triumph Saxophone",
  "Fortune Drum", "Fireworks Staff", "Blue Umbrella", "Festival Scepter",
  "Lightseekers Ultimate Umbrella", "Moments Ultimate Camera", "Camera",
  "Moomin Ultimate Umbrella", "Starry Night's Canopy", "Manatee Staff", "Manatee Toy", "Sentry Spear",
  "Sentry Shield", "Transverse Flute", "Days of Fortune Enchanted Umbrella",
  "Days of Fortune Hand Fan", "Days of Love Serendipitous Scepter",
  "Bloom Lilypad Umbrella", "Bloom Sunflower Umbrella", "SkyFest Jenova Fan",
  "Anniversary Clapboard", "Tournament Torch", "Tournament Ice Snowboard",
  "Lantern", "Summer Parasol", "Mischief Withered Broom", "Treasure Shovel",
  "Fortune Plush Mount", "Company-Issued Laptop", "Anniversary Popcorn Prop",
  "Winter Feast Snowboard",
] as const;
export const heldClosetOrder = new Map<string, number>(
  heldClosetNames.map((name, index) => [name, index]),
);

export const closetGroups = [
  {
    key: "outfit",
    order: "01",
    name: "服裝衣櫃",
    types: ["Outfit", "Shoes", "OutfitShoes"],
    subs: [
      { key: "Outfit", name: "一般服裝", types: ["Outfit"] },
      { key: "Shoes", name: "鞋子", types: ["Shoes"] },
      { key: "OutfitShoes", name: "連身服裝", types: ["OutfitShoes"] },
    ],
  },
  {
    key: "face",
    order: "02",
    name: "臉部衣櫃",
    types: ["Mask", "FaceAccessory", "Necklace"],
    subs: [
      { key: "Mask", name: "面具", types: ["Mask"] },
      { key: "FaceAccessory", name: "臉部配件", types: ["FaceAccessory"] },
      { key: "Necklace", name: "頸部配件", types: ["Necklace"] },
    ],
  },
  {
    key: "head",
    order: "03",
    name: "頭部衣櫃",
    types: ["Hair", "HairAccessory", "HeadAccessory"],
    subs: [
      { key: "Hair", name: "髮型", types: ["Hair"] },
      { key: "HairAccessory", name: "髮飾", types: ["HairAccessory"] },
      { key: "HeadAccessory", name: "頭部配件", types: ["HeadAccessory"] },
    ],
  },
  {
    key: "cape",
    order: "04",
    name: "斗篷衣櫃",
    types: ["Cape"],
    subs: [{ key: "Cape", name: "斗篷", types: ["Cape"] }],
  },
  {
    key: "props",
    order: "05",
    name: "道具衣櫃",
    types: ["Instrument", "HeldProp", "LargeProp", "SmallProp"],
    subs: [
      { key: "held", name: "手持道具", types: ["Instrument", "HeldProp"] },
      { key: "large", name: "大型可放置道具", types: ["LargeProp", "Instrument"] },
      { key: "small", name: "小型可放置道具", types: ["SmallProp", "Instrument"] },
    ],
  },
];
export type ClosetSubRoute = {
  closetKey: string;
  closetName: string;
  subKey: string;
  subName: string;
};
export const closetSubSequence: ClosetSubRoute[] = closetGroups.flatMap(
  (group) =>
    group.subs.map((sub) => ({
      closetKey: group.key,
      closetName: group.name,
      subKey: sub.key,
      subName: sub.name,
    })),
);
export const getNextClosetSub = (closetKey: string, subKey: string) => {
  const index = closetSubSequence.findIndex(
    (route) => route.closetKey === closetKey && route.subKey === subKey,
  );
  return index >= 0 ? closetSubSequence[index + 1] || null : null;
};
const largeInstrumentGuids = new Set([
  "WMNr4yo_35",
  "WuZeLoUATs",
  "O9jSph-v7e",
  "10Ol7H9jKg",
]);
export const matchesSub = (x: WikiItem, sub: string) => {
  if (sub === "held")
    return (
      (x.type === "Instrument" && !largeInstrumentGuids.has(x.guid)) ||
      x.type === "HeldProp"
    );
  if (sub === "large")
    return largeInstrumentGuids.has(x.guid) || x.type === "LargeProp";
  if (sub === "small")
    return x.type === "SmallProp";
  return x.type === sub;
};

const allClosetTypes = [...new Set(closetGroups.flatMap((x) => x.types))];
export const allClosetTypeSet = new Set(allClosetTypes);
