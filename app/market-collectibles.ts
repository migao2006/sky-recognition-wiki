import iapCatalog from "./iap-catalog.json";
import type { BindingKey } from "./account-config";

export type MarketAvailability = "global" | "china" | "platform";
export type MarketPlatform = BindingKey;
export type MarketSaleSection = "collaboration" | "important" | "special";
export type MarketValuationTier = "high" | "standard";
export type MarketImportance = "important" | "standard";
export type MarketReturning = "returning" | "limited" | "unknown";

export type MarketCollectibleProfile = {
  guid?: string;
  name: string;
  playerName: string;
  aliases: readonly string[];
  packageName?: string;
  series: string;
  availability: MarketAvailability;
  platform?: MarketPlatform;
  paid: boolean;
  valuationMultiplier: number;
  valuationTier: MarketValuationTier;
  saleCopy: boolean;
  saleSection: MarketSaleSection;
  salePriority: number;
  packageKey?: string;
  importance: MarketImportance;
  returning: MarketReturning;
  curated?: boolean;
};

type ProfileSeed = readonly [
  name: string,
  playerName: string,
  packageKey?: string,
  aliases?: readonly string[],
];
type ProfileDefaults = Pick<
  MarketCollectibleProfile,
  | "series"
  | "availability"
  | "paid"
  | "valuationMultiplier"
  | "valuationTier"
  | "saleSection"
  | "salePriority"
> & {
  platform?: MarketPlatform;
  importance?: MarketImportance;
  returning?: MarketReturning;
};

const defineProfiles = (
  defaults: ProfileDefaults,
  items: readonly ProfileSeed[],
): MarketCollectibleProfile[] =>
  items.map(([name, playerName, packageKey, aliases], index) => ({
    ...defaults,
    name,
    playerName,
    aliases: aliases ?? [],
    packageKey,
    salePriority: defaults.salePriority + index,
    saleCopy: true,
    importance: defaults.importance ??
      (defaults.saleSection === "important" ? "important" : "standard"),
    returning: defaults.returning ?? "unknown",
  }));

const permanentCollaboration = (
  series: string,
  items: readonly ProfileSeed[],
  options: Partial<ProfileDefaults> = {},
) =>
  defineProfiles(
    {
      series,
      availability: "global",
      paid: true,
      valuationMultiplier: 1.5,
      valuationTier: "high",
      saleSection: "collaboration",
      salePriority: 20,
      ...options,
    },
    items,
  );

const collaborationProfiles = [
  ...permanentCollaboration("絆愛", [
    ["Kizuna AI Cape", "絆愛斗篷", "kizuna-ai-pack", ["絆愛三件套"]],
    ["Kizuna AI Hair", "絆愛髮型", "kizuna-ai-pack", ["絆愛三件套"]],
    ["Kizuna AI Bow", "絆愛蝴蝶結", "kizuna-ai-pack", ["絆愛三件套"]],
  ]),
  ...permanentCollaboration("小王子", [
    ["Little Prince Asteroid Jacket", "王子星球斗", undefined, ["小王子星球夾克", "王子星球夾克"]],
    ["Little Prince Scarf Cape", "王子圍巾斗", undefined, ["小王子圍巾"]],
    ["Little Prince Fox", "王子小狐狸", undefined, ["小王子狐狸"]],
  ]),
  ...permanentCollaboration("AURORA", [
    ["Wings of AURORA", "極光金翅膀", undefined, ["AURORA 之翼", "極光翅膀"]],
    ["Giving In Cape", "極光臣服斗", undefined, ["臣服斗篷"]],
    ["To The Love Outfit", "極光摯愛裙", undefined, ["致愛服裝"]],
    ["AURORA Musical Voyage Sneakers", "極光小白鞋", undefined, ["音樂旅程鞋"]],
    ["Voice of AURORA", "AURORA 之聲"],
  ]),
  ...permanentCollaboration(
    "AURORA",
    [
      ["AURORA Runaway Outfit", "極光奔離褲", undefined, ["逃跑服裝"]],
      ["AURORA Runaway Hair", "極光短髮型", undefined, ["逃跑髮型", "歐若拉逃跑髮型"]],
      ["Tiara We Can Touch", "金星月頭飾", undefined, ["觸碰之冠"]],
      ["Cure for Me Mask", "Cure for Me 面具"],
      ["Cure for Me Outfit", "Cure for Me 服裝"],
    ],
    { paid: false },
  ),
  ...permanentCollaboration("九色鹿", [
    ["Radiance of the Nine-Colored Deer Cape", "九色鹿斗篷", undefined, ["染色之九色鹿斗篷"]],
    ["Gift of the Nine-Colored Deer Antlers", "九色鹿頭角", "nine-colored-deer-gift-pack", ["鹿角", "九色鹿鹿角", "禮物之九色鹿鹿角"]],
    ["Gift of the Nine-Colored Deer Mask", "九色鹿面具", "nine-colored-deer-gift-pack"],
  ]),
  ...permanentCollaboration("大耳狗", [
    ["Cinnamoroll Plushie", "大耳狗娃娃", undefined, ["大耳狗玩偶"]],
    ["Cinnamoroll Ears", "大耳狗耳朵", "cinnamoroll-hair-combo"],
    ["Cinnamoroll Swirled Hair", "大耳狗捲髮", "cinnamoroll-hair-combo", ["大耳狗捲捲髮型"]],
    ["Cinnamoroll Cloud Cape", "大耳狗斗篷", "cinnamoroll-cape-combo", ["大耳狗雲朵斗篷"]],
    ["Cinnamoroll Bowtie", "大耳狗領結", "cinnamoroll-cape-combo", ["大耳狗頭飾"]],
    ["Cinnamoroll Mini Companion", "大耳狗小夥伴", undefined, ["大耳狗迷你夥伴"]],
  ]),
  ...permanentCollaboration("姆明", [
    ["Moominmamma's Masterpiece Cape", "姆明媽媽斗篷", undefined, ["姆明媽媽傑作斗篷", "姆明媽媽手作斗篷"]],
    ["Moomintroll Ears", "姆明耳朵", "moomintroll-accessory-set", ["姆明耳尾組"]],
    ["Moomintroll Tail", "姆明尾巴", "moomintroll-accessory-set", ["姆明耳尾組"]],
    ["Hattifattener Shoulder Buddy", "哈梯法特肩飾"],
    ["Pointed Snufkin Hat", "史力奇尖帽"],
    ["Roving Snufkin Robe", "史力奇長袍", "roving-snufkin-robe-set"],
    ["Roving Snufkin Scarf", "史力奇圍巾", "roving-snufkin-robe-set"],
  ]),
  ...permanentCollaboration(
    "Nintendo",
    [
      ["Nintendo Elf Hair", "林克髮型", "nintendo-pack", ["Nintendo 精靈髮型", "林克套組"]],
      ["Nintendo Red Switch Cape", "Nintendo 紅斗", "nintendo-pack", ["Nintendo 紅斗篷", "林克套組"]],
      ["Nintendo Blue Switch Cape", "Nintendo 藍斗", "nintendo-pack", ["Nintendo 藍斗篷", "林克套組"]],
      ["Vessel Flute", "陶笛", "nintendo-pack"],
    ],
    { availability: "platform", platform: "nintendo", valuationMultiplier: 1.25 },
  ),
  ...permanentCollaboration("風之旅人", [
    ["Journey Hair", "風之旅人髮型", "journey-pack"],
    ["Journey Cape", "風之旅人斗篷", "journey-pack"],
    ["Journey Mask", "風之旅人面具", "journey-pack"],
  ]),
  ...permanentCollaboration(
    "PlayStation",
    [
      ["Transcendent Journey Hair", "超凡風旅髮型", "transcendent-journey-pack", ["超越之旅髮型", "超凡旅人髮型", "超凡風旅"]],
      ["Transcendent Journey Mask", "超凡風旅面具", "transcendent-journey-pack", ["超越之旅面具", "超凡旅人面具", "超凡風旅"]],
      ["Transcendent Journey Cape", "超凡風旅斗篷", "transcendent-journey-pack", ["超越之旅斗篷", "超凡旅人斗篷", "超凡風旅"]],
    ],
    { availability: "platform", platform: "playstation", valuationMultiplier: 1.25 },
  ),
];

const importantPackageProfiles = defineProfiles(
  {
    series: "重要禮包",
    availability: "global",
    paid: true,
    valuationMultiplier: 0.9,
    valuationTier: "high",
    saleSection: "important",
    salePriority: 10,
  },
  [
    ["Days of Healing Poppy", "治癒小白花", "days-of-healing-pack", ["小白花"]],
    ["Spooky Bat Cape", "蝙蝠斗篷"],
    ["Mischief Witch Hat", "巫師帽"],
    ["Mischief Withered Antlers", "枯枝角"],
    ["Cat Cape", "貓咪斗篷", "cat-costume-pack"],
    ["Cat Mask", "貓咪面具", "cat-costume-pack"],
    ["Rainbow Headphones", "彩虹耳機"],
    ["Rainbow Earrings", "彩虹耳釘", undefined, ["彩虹耳環"]],
    ["Snowflake Cape", "雪花斗篷"],
    ["Days of Feast Horns", "聖誕鹿角", undefined, ["宴會鹿角", "日之宴會角"]],
    ["Earth Cape", "綠芽斗篷"],
    ["Ocean Cape", "海洋斗篷"],
    ["Starry Night's Canopy", "星夜之傘", "iap:h09-v8Mh-Q"],
    ["Nature Turtle Cape", "海龜斗篷"],
    ["Moonlight Lantern", "夏日燈籠", undefined, ["月光燈籠", "燈籠", "Lantern"]],
    ["Days of Summer Umbrella", "夏日陽傘", undefined, ["陽傘", "夏日傘", "Summer Parasol"]],
    ["Days of Love Swing", "雙人鞦韆"],
    ["Days of Love Seesaw", "小蹺蹺板", undefined, ["雙人翹翹板"]],
    ["Days of Love Gondola", "貢多拉船", undefined, ["愛之小船"]],
    ["Moth Cape", "萌新斗篷", "moth-appreciation-pack"],
    ["Moth Antennae", "萌新觸角", "moth-appreciation-pack"],
    ["Sparrow Mask", "麻雀面具", "sparrow-appreciation-pack"],
    ["Sparrow Cape", "麻雀斗篷", "sparrow-appreciation-pack"],
    ["Orange Cape", "新手橘斗", "starter-pack", ["首發橘斗篷"]],
  ],
);

const importantLimitedProfiles = defineProfiles(
  {
    series: "重要限定",
    availability: "global",
    paid: false,
    valuationMultiplier: 0.9,
    valuationTier: "high",
    saleSection: "important",
    salePriority: 50,
  },
  [
    ["Skyfest Wireframe Cape", "SkyFest 線框斗篷"],
    ["TGC Wireframe Cape", "TGC 線框斗篷"],
  ],
);

const standardPaidProfiles = defineProfiles(
  {
    series: "其他付費",
    availability: "global",
    paid: true,
    valuationMultiplier: 0.9,
    valuationTier: "standard",
    saleSection: "special",
    salePriority: 100,
  },
  [
    ["Feathery Lash Mask", "羽睫面具"],
    ["Mischief Witch Hair", "巫師髮型", undefined, ["女巫髮型"]],
    ["Mischief Withered Cape", "枯萎斗篷"],
    ["Winter Feast Snowglobe", "宴會雪景球"],
    ["Fledgling Harp", "雛鳥豎琴"],
    ["Rhythm Guitar", "音韻吉他", undefined, ["節奏吉他"]],
    ["Triumph Handpan", "凱旋手碟"],
    ["Blue Electric Guitar", "藍色電吉他"],
    ["Triumph Violin", "凱旋小提琴"],
    ["Fledgling Upright Piano", "直立鋼琴", undefined, ["新手鋼琴"]],
    ["Fortune Enchanted Umbrella", "福瑞魔法傘", undefined, ["Days of Fortune Enchanted Umbrella"]],
    ["Fortune Hand Fan", "福瑞手持扇", undefined, ["幸運扇子", "Days of Fortune Hand Fan"]],
    ["Days of Love Serendipitous Scepter", "愛之權杖", undefined, ["邂逅權杖"]],
    ["Bloom Lilypad Umbrella", "荷葉綠傘", undefined, ["睡蓮傘"]],
    ["Bloom Sunflower Umbrella", "向日葵傘"],
    ["Mischief Withered Broom", "枯萎樹枝", undefined, ["枯萎掃帚"]],
    ["Fortune Plush Mount", "福瑞絨偶坐騎"],
    ["Anniversary Popcorn", "週年爆米花", "anniversary-cinema-set", ["爆米花組", "週年爆米花道具", "Anniversary Popcorn Prop"]],
    ["Anniversary Cinema 3D Glasses", "週年電影院 3D 眼鏡", "anniversary-cinema-set", ["爆米花組"]],
    ["Feast Hat", "聖誕毛帽", "feast-hat-pack", ["宴會毛帽"]],
    ["Fortune Fish Accessory", "福瑞魚頭飾", "fortune-fish-pack"],
    ["Fortune Fish Hood", "福瑞魚頭套", "fortune-fish-pack"],
    ["Fortune Fish Cape", "福瑞魚斗篷", "fortune-fish-pack"],
    ["Fortune Bun Hair", "福瑞包子頭", "fortune-bun-pack"],
    ["Fortune Blushing Mask", "福瑞腮紅面具", "fortune-bun-pack"],
    ["Fortune Cape", "福瑞斗篷", "fortune-bun-pack"],
    ["Dark Rainbow Earrings", "暗彩虹耳環", "dark-rainbow-pack"],
    ["Double Rainbow Flower", "彩虹雙花", "double-rainbow-pack", ["雙彩虹花飾", "雙人彩虹花朵"]],
    ["Rainbow Hair Flower", "彩虹單花", "rainbow-flower-pack", ["彩虹花飾", "彩虹髮型花朵"]],
    ["Rainbow Beanie Hat", "彩虹毛帽", undefined, ["彩虹帽"]],
    ["Nature Turtle Buddy", "海龜肩飾", "nature-turtle-pack"],
    ["Nature Glasses", "自然日眼鏡", "nature-glasses-pack"],
    ["Nature Wave Cape", "海浪斗篷", "nature-wave-pack", ["自然浪花斗篷"]],
    ["Ocean Veil", "海洋面紗", "ocean-veil-pack"],
    ["Charming Creature Outfit", "迷人小生物服裝", "charming-creature-pack"],
    ["Charming Creature Head Accessory", "迷人小生物頭飾", "charming-creature-pack"],
    ["FlOw Cape", "FlOw 斗篷", undefined, ["花憩風之旅人斗篷"]],
  ],
);

const legacyProfiles = defineProfiles(
  {
    series: "常駐特殊",
    availability: "global",
    paid: true,
    valuationMultiplier: 0.75,
    valuationTier: "standard",
    saleSection: "special",
    salePriority: 200,
  },
  [
    ["Founder's Cape", "創辦人斗篷"],
    ["Beta Cape", "Beta 斗篷"],
  ],
);

const collaborationSeries = new Set([
  "絆愛",
  "小王子",
  "AURORA",
  "九色鹿",
  "大耳狗",
  "姆明",
  "Nintendo",
  "風之旅人",
  "PlayStation",
]);

type IapCatalogRow = {
  guid: string;
  name: string;
  playerName: string;
  aliases: readonly string[];
  packageKey: string;
  packageName: string;
  paid: boolean;
  series: string;
  availability: MarketAvailability;
  platform?: MarketPlatform;
  importance: MarketImportance;
  returning: MarketReturning;
};

const generatedIapProfiles: MarketCollectibleProfile[] = (
  iapCatalog.items as IapCatalogRow[]
).map((item, index) => {
  const collaboration = collaborationSeries.has(item.series);
  return {
    ...item,
    valuationMultiplier:
      item.availability === "platform" ? 1.25 : collaboration ? 1.5 : 0.9,
    valuationTier: collaboration ? "high" : "standard",
    saleCopy: true,
    saleSection: collaboration ? "collaboration" : "special",
    salePriority: 1_000 + index,
  };
});

const curatedProfiles: readonly MarketCollectibleProfile[] = [
  ...collaborationProfiles,
  ...importantPackageProfiles,
  ...importantLimitedProfiles,
  ...standardPaidProfiles,
  ...legacyProfiles,
];

const profileByGuid = new Map(
  generatedIapProfiles.map((profile) => [profile.guid, profile]),
);
const profileByName = new Map(
  generatedIapProfiles.map((profile) => [profile.name, profile]),
);
const profileByAlias = new Map<string, MarketCollectibleProfile>();
const bundleSearchAliases = new Set([
  "絆愛三件套",
  "姆明耳尾組",
  "林克套組",
  "超凡風旅",
  "爆米花組",
]);

const curatedPackageNames: Record<string, string> = {
  "iap:h09-v8Mh-Q": "星夜之傘",
  "days-of-healing-pack": "療癒罌粟花禮包",
  "cat-costume-pack": "貓咪套組",
  "cinnamoroll-hair-combo": "大耳狗髮型套組",
  "cinnamoroll-cape-combo": "大耳狗斗篷套組",
  "moomintroll-accessory-set": "姆明耳尾套組",
  "roving-snufkin-robe-set": "史力奇長袍套組",
  "nintendo-pack": "Nintendo 套組",
  "journey-pack": "風之旅人套組",
  "transcendent-journey-pack": "超越之旅套組",
  "moth-appreciation-pack": "飛蛾套組",
  "sparrow-appreciation-pack": "麻雀套組",
  "anniversary-cinema-set": "週年電影院套組",
  "fortune-fish-pack": "福瑞魚套組",
  "fortune-bun-pack": "福瑞套組",
  "nature-turtle-pack": "自然海龜套組",
  "charming-creature-pack": "迷人小生物套組",
};

for (const curated of curatedProfiles) {
  const generated = profileByName.get(curated.name);
  const merged: MarketCollectibleProfile = {
    ...generated,
    ...curated,
    guid: generated?.guid,
    packageKey: curated.packageKey ?? generated?.packageKey,
    packageName:
      (curated.packageKey ? curatedPackageNames[curated.packageKey] : undefined) ??
      generated?.packageName,
    aliases: Array.from(
      new Set([...(generated?.aliases ?? []), ...curated.aliases]),
    ),
    importance:
      curated.saleSection === "important" ? "important" : curated.importance,
    returning: generated?.returning ?? curated.returning,
    curated: true,
  };
  profileByName.set(merged.name, merged);
  if (merged.guid) profileByGuid.set(merged.guid, merged);
}

for (const profile of profileByName.values()) {
  for (const alias of profile.aliases) {
    // 套組俗稱只讓衣櫃搜尋到所有成員，不能被解析成其中一件物品。
    if (!bundleSearchAliases.has(alias)) profileByAlias.set(alias, profile);
  }
}

export const importantMarketCollectibles: readonly MarketCollectibleProfile[] = [
  ...profileByName.values(),
];

export const marketCollectibleProfile = (name: string, guid?: string) => {
  if (guid) {
    const exact = profileByGuid.get(guid);
    if (exact) return exact;
    const unbound = profileByName.get(name);
    // 有官方 GUID 的 profile 不得用英文同名套到另一件物品。
    return unbound && !unbound.guid ? unbound : null;
  }
  return profileByName.get(name) ?? profileByAlias.get(name) ?? null;
};

export const marketProfileNamesForSeries = (series: string) =>
  [...profileByName.values()]
    .filter((profile) => profile.series === series)
    .map((profile) => profile.name);
