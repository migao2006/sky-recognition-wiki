export type MarketAvailability = "global" | "china" | "platform";
export type MarketPlatform =
  | "google"
  | "nintendo"
  | "gameCenter"
  | "facebook"
  | "steam"
  | "twitch"
  | "playstation";
export type MarketSaleSection = "collaboration" | "important" | "special";
export type MarketValuationTier = "high" | "standard";

export type MarketCollectibleProfile = {
  name: string;
  playerName: string;
  aliases: readonly string[];
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
> & { platform?: MarketPlatform };

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
    ["Kizuna AI Cape", "絆愛斗篷", "kizuna-ai-pack"],
    ["Kizuna AI Hair", "絆愛髮型", "kizuna-ai-pack"],
    ["Kizuna AI Bow", "絆愛蝴蝶結", "kizuna-ai-pack"],
  ]),
  ...permanentCollaboration("小王子", [
    ["Little Prince Asteroid Jacket", "小王子星球夾克"],
    ["Little Prince Scarf Cape", "小王子圍巾"],
    ["Little Prince Fox", "小王子狐狸"],
  ]),
  ...permanentCollaboration("AURORA", [
    ["Wings of AURORA", "AURORA 之翼"],
    ["Giving In Cape", "臣服斗篷"],
    ["To The Love Outfit", "致愛服裝"],
    ["AURORA Musical Voyage Sneakers", "音樂旅程鞋"],
    ["Voice of AURORA", "AURORA 之聲"],
  ]),
  ...permanentCollaboration(
    "AURORA",
    [
      ["AURORA Runaway Outfit", "逃跑服裝"],
      ["AURORA Runaway Hair", "逃跑髮型"],
      ["Tiara We Can Touch", "觸碰之冠", undefined, ["金星月頭飾"]],
      ["Cure for Me Mask", "Cure for Me 面具"],
      ["Cure for Me Outfit", "Cure for Me 服裝"],
    ],
    { paid: false },
  ),
  ...permanentCollaboration("九色鹿", [
    ["Radiance of the Nine-Colored Deer Cape", "九色鹿斗篷"],
    ["Gift of the Nine-Colored Deer Antlers", "鹿角", "nine-colored-deer-gift-pack"],
    ["Gift of the Nine-Colored Deer Mask", "九色鹿面具", "nine-colored-deer-gift-pack"],
  ]),
  ...permanentCollaboration("大耳狗", [
    ["Cinnamoroll Plushie", "大耳狗玩偶"],
    ["Cinnamoroll Ears", "大耳狗耳朵", "cinnamoroll-hair-combo"],
    ["Cinnamoroll Swirled Hair", "大耳狗捲捲髮型", "cinnamoroll-hair-combo"],
    ["Cinnamoroll Cloud Cape", "大耳狗雲朵斗篷", "cinnamoroll-cape-combo"],
    ["Cinnamoroll Bowtie", "大耳狗領結", "cinnamoroll-cape-combo"],
    ["Cinnamoroll Mini Companion", "大耳狗迷你夥伴"],
  ]),
  ...permanentCollaboration("姆明", [
    ["Moominmamma's Masterpiece Cape", "姆明媽媽傑作斗篷"],
    ["Moomintroll Ears", "姆明耳朵", "moomintroll-accessory-set"],
    ["Moomintroll Tail", "姆明尾巴", "moomintroll-accessory-set"],
    ["Hattifattener Shoulder Buddy", "哈梯法特肩飾"],
    ["Pointed Snufkin Hat", "史力奇尖帽"],
    ["Roving Snufkin Robe", "史力奇長袍", "roving-snufkin-robe-set"],
    ["Roving Snufkin Scarf", "史力奇圍巾", "roving-snufkin-robe-set"],
  ]),
  ...permanentCollaboration(
    "Nintendo",
    [
      ["Nintendo Elf Hair", "Nintendo 精靈髮型", "nintendo-pack", ["林克髮型"]],
      ["Nintendo Red Switch Cape", "Nintendo 紅斗篷", "nintendo-pack"],
      ["Nintendo Blue Switch Cape", "Nintendo 藍斗篷", "nintendo-pack"],
      ["Vessel Flute", "陶笛", "nintendo-pack"],
    ],
    { availability: "platform", platform: "nintendo", valuationMultiplier: 1.25 },
  ),
  ...permanentCollaboration("風之旅人", [
    ["Journey Hair", "風之旅人髮型", "journey-pack"],
    ["Journey Cape", "風之旅人斗篷", "journey-pack"],
    ["Journey Mask", "風之旅人面具", "journey-pack"],
  ]),
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
    ["Days of Healing Poppy", "小白花", "days-of-healing-pack"],
    ["Spooky Bat Cape", "蝙蝠斗篷"],
    ["Mischief Witch Hat", "巫師帽"],
    ["Mischief Withered Antlers", "枯枝角"],
    ["Cat Cape", "貓咪斗篷", "cat-costume-pack"],
    ["Cat Mask", "貓咪面具", "cat-costume-pack"],
    ["Rainbow Headphones", "彩虹耳機"],
    ["Rainbow Earrings", "彩虹耳環"],
    ["Snowflake Cape", "雪花斗篷"],
    ["Days of Feast Horns", "宴會鹿角"],
    ["Earth Cape", "綠芽斗篷"],
    ["Ocean Cape", "海洋斗篷"],
    ["Nature Turtle Cape", "海龜斗篷"],
    ["Lantern", "燈籠"],
    ["Summer Parasol", "陽傘"],
    ["Days of Love Swing", "雙人鞦韆"],
    ["Days of Love Seesaw", "雙人翹翹板"],
    ["Days of Love Gondola", "愛之小船"],
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
    ["Mischief Witch Hair", "女巫髮型"],
    ["Mischief Withered Cape", "枯萎斗篷"],
    ["Winter Feast Snowglobe", "宴會雪景球"],
    ["Fledgling Harp", "雛鳥豎琴"],
    ["Rhythm Guitar", "節奏吉他"],
    ["Triumph Handpan", "凱旋手碟"],
    ["Blue Electric Guitar", "藍色電吉他"],
    ["Triumph Violin", "凱旋小提琴"],
    ["Fledgling Upright Piano", "新手鋼琴"],
    ["Days of Fortune Enchanted Umbrella", "福瑞魔法傘"],
    ["Days of Fortune Hand Fan", "幸運扇子"],
    ["Days of Love Serendipitous Scepter", "邂逅權杖"],
    ["Bloom Lilypad Umbrella", "睡蓮傘"],
    ["Bloom Sunflower Umbrella", "向日葵傘"],
    ["Mischief Withered Broom", "枯萎掃帚"],
    ["Fortune Plush Mount", "福瑞絨偶坐騎"],
    ["Anniversary Popcorn Prop", "週年爆米花", "anniversary-cinema-set"],
    ["Anniversary Cinema 3D Glasses", "週年電影院 3D 眼鏡", "anniversary-cinema-set"],
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

export const importantMarketCollectibles: readonly MarketCollectibleProfile[] = [
  ...collaborationProfiles,
  ...importantPackageProfiles,
  ...importantLimitedProfiles,
  ...standardPaidProfiles,
  ...legacyProfiles,
];

const profileByName = new Map(
  importantMarketCollectibles.map((profile) => [profile.name, profile]),
);

export const marketCollectibleProfile = (name: string) =>
  profileByName.get(name) ?? null;

export const marketProfileNamesForSeries = (series: string) =>
  importantMarketCollectibles
    .filter((profile) => profile.series === series)
    .map((profile) => profile.name);
