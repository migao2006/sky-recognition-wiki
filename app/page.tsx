"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { wikiItems as baseWikiItems, type WikiItem } from "./wiki-data";
import {
  calibrateHighValueEstimate,
  classifyPackageTier,
  classifySeasonGap,
} from "./valuation-calibration";
import {
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
  monotonicCoefficient,
} from "./valuation-items";

const verifiedUltimateItems: WikiItem[] = [
  {
    id: 371,
    order: 3800,
    guid: "2o3CEU9QhM",
    name: "Lightseekers Ultimate Umbrella",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/7/7f/Icon_prop_lightseekers_large_umbrella.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/ee/Lightseekers_ultimate_umbrella_v2.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Lightseekers_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "lightseekers",
  },
  {
    id: 394,
    order: 1500,
    guid: "Hvq52gCeih",
    name: "Sanctuary Ultimate Handpan",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/e4/Icon_instrument_sanctuary_hand_pan.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/c2/Sanctuary-Handpan-ultimate.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sanctuary_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "sanctuary",
  },
  {
    id: 410,
    order: 1700,
    guid: "wGQSuhVWXD",
    name: "Prophecy Ultimate Drum",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/1c/Icon_instrument_prophecy_drum.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/48/Prophecy-ultimate-_drum.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Prophecy_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "prophecy",
  },
  {
    id: 438,
    order: 1900,
    guid: "B59f4_ru60",
    name: "Assembly Ultimate Bugle",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/83/Icon_instrument_assembly_bugle.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/88/Assembly-ultimate-Buggle.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Assembly_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "assembly",
  },
  {
    id: 637,
    order: 3900,
    guid: "W-3Nh_yWGv",
    name: "Moments Ultimate Camera",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/4f/Moments-Guide-Prop-Ultimate-Camera-icon-Credit-Morybel.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/a6/Moments-Guide-Prop-Ultimate-Camera.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Moments_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "moments",
  },
  {
    id: 2341,
    order: 4100,
    guid: "dkfdFCaemY",
    name: "Moomin Ultimate Umbrella",
    type: "Prop",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/dc/Moomin-Ultimate-Umbrella-Prop-icon.png",
    previewUrl:
      "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/43/Moomin-Ultimate-Umbrella-Prop-held.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/The_Moomin_Storybook#Moomin_Ultimate_Umbrella",
    section: "seasons",
    collection: "moomin",
  },
];
const wikiItems: WikiItem[] = [...baseWikiItems, ...verifiedUltimateItems];
const verifiedUltimateZh: Record<string, string> = {
  "Lightseekers Ultimate Umbrella": "追光季畢業禮雨傘",
  "Sanctuary Ultimate Handpan": "聖島季畢業禮手碟",
  "Prophecy Ultimate Drum": "預言季畢業禮鼓",
  "Assembly Ultimate Bugle": "重組季畢業禮號角",
  "Moments Ultimate Camera": "拾光季畢業禮相機",
  "Moomin Ultimate Umbrella": "姆明季畢業禮雨傘",
};

const labels: Record<string, string> = {
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
  Prop: "手持／背負道具",
  Furniture: "家具／擺設",
  Emote: "動作",
  Stance: "站姿",
  Call: "叫聲",
};
const closetGroups = [
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
    types: ["Prop", "Furniture", "Instrument"],
    subs: [
      { key: "held", name: "手持／背負道具", types: ["Prop", "Instrument"] },
      { key: "large", name: "大型擺設", types: ["Furniture"] },
      { key: "small", name: "小型擺設", types: ["Furniture"] },
    ],
  },
];
const largeFurniture =
  /table|chair|bench|sofa|couch|bed|cabinet|shelf|wardrobe|bathtub|kitchen|oven|stove|desk|tent|piano|teaset|washstand|drawers|chandelier|bookcase|swing/i;
const matchesSub = (x: WikiItem, sub: string) =>
  sub === "large"
    ? x.type === "Furniture" && largeFurniture.test(x.name)
    : sub === "small"
      ? x.type === "Furniture" && !largeFurniture.test(x.name)
      : sub === "held"
        ? ["Prop", "Instrument"].includes(x.type)
        : x.type === sub;
const seasonZh: Record<string, string> = {
  gratitude: "感恩季",
  lightseekers: "追光季",
  belonging: "歸屬季",
  rhythm: "音韻季",
  enchantment: "魔法季",
  sanctuary: "聖島季",
  prophecy: "預言季",
  dreams: "夢想季",
  assembly: "重組季",
  "the-little-prince": "小王子季",
  flight: "飛行季",
  abyss: "潛海季",
  performance: "表演季",
  shattering: "破碎季",
  aurora: "極光季",
  remembrance: "緬懷季",
  passage: "夜行季",
  moments: "拾光季",
  revival: "歸巢季",
  "nine-colored-deer": "九色鹿季",
  nesting: "築巢季",
  duets: "協奏季",
  moomin: "姆明季",
  radiance: "染色季",
  "blue-bird": "青鳥季",
  "two-embers-part-1": "暮星季",
  migration: "遷徙季",
  lightmending: "織光季",
  carnival: "狂歡季",
  "dear-van-gogh": "致梵谷季",
};
const eventZh: Record<string, string> = {
  "days-of-bloom": "花憩日",
  "days-of-feast": "宴會節",
  "days-of-fortune": "福瑞日",
  "days-of-healing": "療癒日",
  "days-of-love": "愛之日",
  "days-of-mischief": "惡作劇之日",
  "days-of-moonlight": "月光日",
  "days-of-music": "音樂節",
  "days-of-nature": "自然日",
  "days-of-rainbow": "彩虹日／繽紛飛行日",
  "days-of-style": "時尚日",
  "days-of-summer": "夏日／慵懶日",
  "days-of-sunlight": "陽光日",
  "days-of-treasure": "寶藏日",
  "event-aviary-firework-festival": "雲巢煙火節",
  "event-cinnamoroll": "大耳狗聯動",
  "event-kizuna-ai": "絆愛聯動",
  "event-sky-anniversary": "光遇週年慶",
  "event-sky-creator-awards": "Sky 創作者獎",
  "event-tournament": "錦標賽",
  "personality-quiz-event": "性格測驗活動",
  "workshop-show-and-tell": "工坊展示活動",
};
const realmZh: Record<string, string> = {
  "isle-of-dawn": "晨島",
  "daylight-prairie": "雲野",
  "hidden-forest": "雨林",
  "valley-of-triumph": "霞谷",
  "golden-wasteland": "暮土",
  "vault-of-knowledge": "禁閣",
  "eye-of-eden": "伊甸之眼",
};
const seasons = Object.entries(seasonZh);
const seasonOrder = new Map(seasons.map(([slug], index) => [slug, index]));
const ongoingSeasonSlugs = new Set(["dear-van-gogh"]);
const storeSource = (x: WikiItem) => {
  const url = x.wiki;
  return /Secret_Area|Founder/.test(url)
    ? "辦公室／秘密區域"
    : /PlayStation/.test(url)
      ? "PlayStation 專屬"
      : /Nintendo/.test(url)
        ? "Nintendo Switch 專屬"
        : /Steam/.test(url)
          ? "Steam 專屬"
          : /Nesting_Workshop/.test(url)
            ? "築巢工坊"
            : /Days_of_Music/.test(url)
              ? "音樂節商店"
              : /Aviary/.test(url)
                ? "雲巢商店／活動"
                : /Beta_Cape/.test(url)
                  ? "Beta 限定"
                  : "常駐商店";
};
const sourceKind = (x: WikiItem) => {
  if (x.section === "seasons") return "季節";
  if (x.section === "events") {
    if (["event-cinnamoroll", "event-kizuna-ai"].includes(x.collection))
      return "聯動";
    if (
      [
        "personality-quiz-event",
        "workshop-show-and-tell",
        "event-sky-creator-awards",
      ].includes(x.collection)
    )
      return "特殊活動";
    return "年度活動";
  }
  if (x.section === "realms") return "常駐地圖";
  if (x.section === "store") {
    const store = storeSource(x);
    if (store.includes("專屬")) return "平台限定";
    if (store.includes("限定")) return "限定";
    return "商店";
  }
  return x.section === "base" ? "基礎" : "國服限定";
};
const source = (x: WikiItem) =>
  x.section === "seasons"
    ? `季節 · ${seasonZh[x.collection] || x.collection}`
    : x.section === "events"
      ? `${sourceKind(x)} · ${eventZh[x.collection] || x.collection}`
      : x.section === "realms"
        ? `常駐地圖 · ${realmZh[x.collection] || x.collection}`
        : x.section === "store"
          ? `${sourceKind(x)} · ${storeSource(x)}`
          : x.section === "base"
            ? "基礎 · 初始裝扮與動作"
            : `${sourceKind(x)} · ${x.collection}`;
const exactZh: Record<string, string> = {
  "Little Prince Ultimate Rose": "小王子畢業玫瑰",
  "Sword Outfit": "劍士服",
  "Anubis Mask": "阿努比斯面具",
  "Owl Hair": "白鳥髮型",
  "Penguin Hair": "白梟髮型",
  "Rhythm Ultimate Hair": "白鳥髮型",
  "Performance Ultimate Hair": "白梟髮型",
  "Wasteland Elder Hair": "龍骨髮型",
  "Forest Elder Hair": "雨林長老髮型（雨媽）",
  "Valley Elder Hair 1": "霞谷長老髮型 1",
  "Valley Elder Hair 2": "霞谷長老髮型 2",
  "Vault Elder Hair": "禁閣長老髮型",
  "Prairie Elder Hair": "雲野長老髮型",
  "Isle Elder Hair": "晨島長老髮型",
  "Grand Piano": "高音鋼琴",
  "Manta Cape": "遙鯤斗篷",
  "Chibi Mask": "矮人面具",
  "Faceless Mask": "無臉面具",
  "Rainbow Cape": "彩虹斗篷",
  "White Cape": "白斗篷",
  "Black Cape": "黑斗篷",
  "Red Cape": "紅斗篷",
  "Blue Cape": "藍斗篷",
  "Pink Cape": "粉紅斗篷",
  "Green Cape": "綠斗篷",
  "Yellow Cape": "黃斗篷",
};
const words: Record<string, string> = {
  Ultimate: "畢業禮",
  Elder: "長老",
  Seasonal: "季節",
  Little: "小",
  Prince: "王子",
  Nine: "九",
  Colored: "色",
  Deer: "鹿",
  Anubis: "阿努比斯",
  Aurora: "極光",
  Moomin: "姆明",
  Cinnamoroll: "大耳狗",
  Journey: "旅人",
  Kizuna: "絆愛",
  Rainbow: "彩虹",
  Bloom: "花憩",
  Fortune: "福瑞",
  Nature: "自然",
  Mischief: "惡作劇",
  Feast: "宴會",
  Love: "愛之日",
  Sunlight: "陽光",
  Moonlight: "月光",
  Music: "音樂",
  Style: "時尚",
  Anniversary: "週年",
  Tournament: "錦標賽",
  Winter: "冬日",
  Ocean: "海洋",
  Earth: "地球",
  Skyfest: "天空慶典",
  Hair: "髮型",
  Hairstyle: "髮型",
  Cape: "斗篷",
  Mask: "面具",
  Outfit: "服裝",
  Shoes: "鞋子",
  Slippers: "拖鞋",
  Boots: "靴子",
  Hat: "帽子",
  Hood: "兜帽",
  Crown: "皇冠",
  Tiara: "頭冠",
  Headband: "頭帶",
  Hairpin: "髮夾",
  Accessory: "配件",
  Necklace: "項鍊",
  Pendant: "吊墜",
  Scarf: "圍巾",
  Shawl: "披肩",
  Bowtie: "領結",
  Earrings: "耳環",
  Glasses: "眼鏡",
  Sunglasses: "太陽眼鏡",
  Goggles: "護目鏡",
  Piano: "鋼琴",
  Guitar: "吉他",
  Harp: "豎琴",
  Flute: "笛子",
  Drum: "鼓",
  Umbrella: "雨傘",
  Lantern: "燈籠",
  Surfboard: "衝浪板",
  Table: "桌子",
  Chair: "椅子",
  Tent: "帳篷",
  Prop: "道具",
  Plush: "玩偶",
  Plushie: "玩偶",
  Doll: "娃娃",
  Flower: "花朵",
  Rose: "玫瑰",
  Star: "星星",
  Moon: "月亮",
  Sun: "太陽",
  Cloud: "雲朵",
  Manta: "遙鯤",
  Bird: "鳥",
  Butterfly: "蝴蝶",
  Rabbit: "兔子",
  Fox: "狐狸",
  Cat: "貓咪",
  Dragon: "龍",
  Turtle: "海龜",
  Fish: "魚",
  Horse: "馬",
  White: "白色",
  Black: "黑色",
  Red: "紅色",
  Blue: "藍色",
  Green: "綠色",
  Yellow: "黃色",
  Pink: "粉紅色",
  Purple: "紫色",
  Orange: "橘色",
  Golden: "金色",
  Dark: "深色",
  Light: "淺色",
  Small: "小型",
  Large: "大型",
  HairAccessory: "髮飾",
  HeadAccessory: "頭飾",
  FaceAccessory: "臉部配件",
};
const seasonWords: Record<string, string> = {
  of: "之",
  Of: "之",
  The: "",
  the: "",
  a: "",
  Stone: "石頭",
  Dance: "舞蹈",
  Whisperer: "語者",
  Spin: "旋轉",
  Nesting: "築巢",
  Carnival: "狂歡",
  Lightmending: "織光",
  Radiance: "染色",
  Prophet: "先知",
  Dancer: "舞者",
  Memory: "回憶",
  Crab: "螃蟹",
  Rug: "地毯",
  Painting: "畫作",
  Clap: "鼓掌",
  Migrating: "遷徙",
  Face: "臉部",
  Parent: "家長",
  Sparkler: "煙火棒",
  Performer: "表演者",
  Assembly: "重組",
  Walk: "走路",
  Trick: "戲法",
  Jellyfish: "水母",
  Stance: "站姿",
  Balance: "平衡",
  Pleading: "祈求",
  Anxious: "焦慮",
  Remembrance: "緬懷",
  Juggler: "雜耍者",
  Call: "叫聲",
  Flight: "飛行",
  Flourishing: "蓬勃",
  Beginnings: "初始",
  Jolly: "歡樂",
  Tiptoeing: "踮腳",
  Marching: "行進",
  Grateful: "感恩",
  Passage: "夜行",
  Duet: "協奏",
  Duets: "協奏",
  Actor: "演員",
  Handshake: "握手",
  Scholar: "學者",
  Scarred: "傷痕",
  Cousin: "表親",
  Wise: "智慧",
  Provoking: "挑釁",
  Leaping: "跳躍",
  Wall: "牆面",
  Warrior: "戰士",
  Collector: "收藏家",
  Troupe: "劇團",
  Boogie: "舞步",
  Performance: "表演",
  Starry: "星光",
  Kiss: "親吻",
  Director: "導演",
  Pioneer: "先驅",
  Champion: "冠軍",
  Catcher: "捕捉者",
  Migration: "遷徙",
  Jelly: "果凍",
  Two: "雙",
  Poster: "海報",
  Manatee: "海牛",
  Vestige: "遺跡",
  Sentry: "哨兵",
  Grandparent: "祖父母",
  Inspiration: "靈感",
  Inclusion: "包容",
  Spirit: "先祖",
  Comfort: "安慰",
  Kindness: "善意",
  Medium: "中型",
  Plant: "植物",
  Nightbird: "夜鳥",
  Hacky: "踢球",
  Bearhug: "熊抱",
  Fire: "火焰",
  Piggyback: "背背",
  Abyss: "潛海",
  Neckpiece: "頸飾",
  Bask: "曬太陽",
  Slow: "緩慢",
  Frustration: "沮喪",
};
const seasonWordsMore: Record<string, string> = {
  s: "",
  an: "",
  in: "於",
  with: "搭配",
  Cellist: "大提琴手",
  Pianist: "鋼琴家",
  Night: "夜晚",
  Draw: "繪畫",
  Dear: "致",
  Van: "梵",
  Gogh: "谷",
  Self: "自我",
  Bow: "鞠躬",
  Challenge: "挑戰",
  Stunt: "特技",
  Approve: "讚許",
  Take: "記",
  Notes: "筆記",
  Break: "休息",
  Ball: "球",
  Cute: "可愛",
  Revolving: "旋轉",
  Secret: "秘密",
  Whispering: "低語",
  Run: "奔跑",
  Flag: "旗幟",
  Signal: "信號",
  Dizzy: "暈眩",
  Embers: "餘燼",
  Part: "篇",
  Resourceful: "足智多謀",
  Recluse: "隱士",
  Surprised: "驚訝",
  Costumed: "盛裝",
  Confetti: "彩紙",
  Cough: "咳嗽",
  Heart: "愛心",
  Gesture: "手勢",
  Hype: "歡呼",
  Cartwheel: "側翻",
  Read: "閱讀",
  Rack: "架子",
  Loft: "閣樓",
  Atrium: "中庭",
  Solarium: "日光室",
  Nook: "角落",
  Princess: "公主",
  Float: "漂浮",
  Flex: "伸展",
  Whistle: "口哨",
  Blindfold: "眼罩",
  Pose: "姿勢",
  Reassuring: "安撫",
  Ranger: "巡守者",
  Pull: "引體",
  up: "向上",
  Moping: "悶悶不樂",
  Somersault: "翻筋斗",
  sack: "袋",
  Rustic: "鄉村",
  Joyful: "喜悅",
  Dutch: "荷蘭",
  Bounce: "彈跳",
  Pad: "墊子",
  Puzzle: "拼圖",
  Athletic: "運動",
  Head: "頭部",
  Bellmaker: "製鈴者",
  Tail: "尾巴",
  Stern: "嚴肅",
  Shepherd: "牧羊人",
  Royal: "皇家",
  Hairtousle: "揉髮",
  Teen: "少年",
  Greeting: "問候",
  Shaman: "薩滿",
  Adventure: "冒險",
  Sense: "感知",
  Snufkin: "史力奇",
  Circle: "圓形",
  Bathtub: "浴缸",
  Kitchen: "廚房",
  Solid: "實心",
  Shelf: "層架",
  Dining: "餐廳",
  Side: "側邊",
  Feudal: "封建",
  Lord: "領主",
  Hunter: "獵人",
  Herb: "藥草",
  Gatherer: "採集者",
  Remnant: "殘跡",
  Forgotten: "遺忘",
  Haven: "避風港",
  Echo: "回聲",
  Abandoned: "廢棄",
  Refuge: "庇護所",
  Lost: "失落",
  Village: "村莊",
  Deserted: "荒廢",
  Oasis: "綠洲",
  Ascetic: "苦行",
  Monk: "僧侶",
  Geologist: "地質學家",
  Melancholy: "憂鬱",
  Mope: "消沉",
  Tumbling: "翻滾",
  Troublemaker: "搗蛋鬼",
  Oddball: "怪人",
  Outcast: "流放者",
  Revival: "歸巢",
  Moments: "拾光",
  Mantle: "披肩",
  Wheatfield: "麥田",
  Vase: "花瓶",
  Artistic: "藝術",
  Level: "等級",
  Candle: "蠟燭",
  Charmer: "引蝶人",
  Spirited: "活潑",
  Ears: "耳朵",
  Helmet: "頭盔",
  Tree: "樹木",
  Tender: "溫柔",
  Toymaker: "玩具匠",
  Figurine: "雕像",
  Woodcutting: "伐木",
  Pleaful: "懇求",
  Nostalgic: "懷舊",
  Divining: "占卜",
  Storybook: "故事書",
  Roving: "漫遊",
  Moomintroll: "姆明",
  Instrument: "樂器",
  Cube: "方塊",
  Box: "盒子",
  Stand: "立架",
  Striped: "條紋",
  Sofa: "沙發",
  Pillow: "枕頭",
  Bench: "長椅",
  Tall: "高型",
  Bed: "床",
  Hanging: "懸掛",
  Gift: "禮物",
  Mural: "壁畫",
  Cradle: "搖籃",
  Carry: "抱起",
  Hug: "擁抱",
  Overactive: "過度活躍",
  Overachiever: "力求完美",
  Visage: "面容",
  Windmill: "風車",
  House: "房屋",
  Flowers: "花朵",
  Sunflowers: "向日葵",
  Sunflower: "向日葵",
  Teaset: "茶具",
  Crows: "烏鴉",
  Almond: "杏仁",
  Blossoms: "花朵",
  Bedroom: "臥室",
  Arles: "亞爾",
  Portrait: "肖像",
  Grey: "灰色",
  Felt: "氈帽",
  Bulb: "燈泡",
  Field: "田野",
  Platform: "平台",
  Neck: "頸部",
  Rhythm: "音韻",
  Holder: "架",
  Bell: "鈴鐺",
  Lighthorn: "號角",
  Projector: "投影機",
  Memories: "回憶",
  Movie: "電影",
  Horns: "角",
  Toy: "玩具",
  Mini: "迷你",
  Cloak: "披風",
  Darkness: "黑暗",
  Blossom: "花朵",
  Memento: "紀念物",
  Tea: "茶",
  Cracked: "裂紋",
  Perch: "棲木",
  Despondent: "沮喪",
  Moominmamma: "姆明媽媽",
  Masterpiece: "傑作",
  Clock: "時鐘",
  Chandelier: "吊燈",
  Tie: "領帶",
  Pointed: "尖頭",
  Robe: "長袍",
  Hattifattener: "哈蒂法特納",
  Shoulder: "肩部",
  Buddy: "夥伴",
  Compassionate: "慈愛",
  Musicians: "音樂家",
  Legacy: "傳承",
  Wide: "寬型",
  Stove: "爐子",
  Cabinet: "櫥櫃",
  Towel: "毛巾",
  Mug: "馬克杯",
  Argyle: "菱格紋",
  Mirror: "鏡子",
  Empty: "空",
  Player: "播放器",
  Diamonds: "菱形",
  Washstand: "盥洗台",
  Closed: "封閉",
  Pot: "鍋子",
  Coffee: "咖啡",
  Drawers: "抽屜櫃",
  Long: "長型",
  Half: "半型",
  Sconce: "壁燈",
  Square: "方形",
  Corner: "轉角",
  Classic: "經典",
  Round: "圓形",
  Loveseat: "雙人沙發",
  Decor: "裝飾",
  Folded: "摺疊",
  Cloth: "布料",
  Console: "玄關桌",
  Armchair: "扶手椅",
  Colors: "彩色",
  Desk: "書桌",
  Monotone: "單色",
  Single: "單人",
  Oven: "烤箱",
  Stool: "凳子",
  Paintings: "畫作",
  Floor: "落地",
  Branch: "樹枝",
  Lamp: "燈具",
  Planter: "花盆",
  Spice: "香料",
  Couch: "長沙發",
  Antlers: "鹿角",
  Hopeful: "充滿希望",
  Steward: "管家",
  Ribbon: "緞帶",
  Tattoo: "彩繪",
  Wheat: "小麥",
  Stalk: "莖飾",
  Raccoon: "浣熊",
  Sack: "布袋",
  Monkey: "猴子",
  Boar: "野豬",
  Serow: "鬣羚",
};
const catalogWords: Record<string, string> = {
  Days: "日",
  Sky: "光遇",
  Kite: "風箏",
  Sticker: "貼紙",
  Treasure: "寶藏",
  AURORA: "歐若拉",
  Sandcastle: "沙堡",
  Wonderland: "仙境",
  Valley: "霞谷",
  Wasteland: "暮土",
  Forest: "雨林",
  Prairie: "雲野",
  Isle: "晨島",
  Ice: "冰雪",
  Base: "初始",
  Seeker: "追尋者",
  Lightseeker: "追光者",
  Wave: "海浪",
  Hermit: "隱士",
  Miner: "礦工",
  Soldier: "士兵",
  Scout: "童子軍",
  Adventurer: "冒險家",
  Tunic: "短袍",
  Dress: "洋裝",
  Shaped: "造型",
  Dye: "染料",
  Jar: "罐子",
  Snake: "蛇",
  Frantic: "慌張",
  Cozy: "暖心",
  Peeking: "偷看",
  Postman: "郵差",
  Festival: "節慶",
  Shell: "貝殼",
  Witch: "巫師",
  Year: "年",
  Child: "孩童",
  Mindful: "細心",
  Forgetful: "健忘",
  Storyteller: "說書人",
  Angler: "垂釣者",
  Stretching: "伸展",
  Chuckling: "竊笑",
  Air: "空氣",
  Water: "水",
  Chill: "悠閒",
  Sunbather: "日光浴者",
  Thrillseeker: "尋刺激者",
  Playfighting: "嬉鬧",
  Herbalist: "草藥師",
  Cap: "帽子",
  Moth: "萌新",
  Oreo: "奧利奧",
  Tufted: "絨毛",
  Companion: "夥伴",
  Monocle: "單片眼鏡",
  Fluffy: "蓬鬆",
  Withered: "枯萎",
  Goth: "哥德",
  Feline: "貓咪",
  Transcendent: "超凡",
  Petal: "花瓣",
  Dapper: "紳士",
  Nintendo: "任天堂",
  AI: "AI",
  Muralist: "壁畫家",
  Wounded: "受傷",
  Brewer: "釀造師",
  Bereft: "悲傷",
  Veteran: "老兵",
  Seed: "種子",
  Hope: "希望",
  Running: "奔跑",
  Wayfarer: "旅人",
  Modest: "謙遜",
  Mellow: "溫和",
  Musician: "音樂家",
  Stagehand: "舞台工作者",
  Cackling: "大笑",
  Cannoneer: "炮手",
  Bumbling: "笨拙",
  Boatswain: "水手長",
  Ceasing: "停止",
  Commodore: "艦長",
  Talented: "有才華",
  Builder: "建造者",
  Tinkering: "修補",
  Chimesmith: "風鈴匠",
  Lively: "活潑",
  Navigator: "領航員",
  Scaredy: "膽小",
  Cadet: "學員",
  Scolding: "責備",
  Student: "學生",
  Baffled: "茫然",
  Botanist: "植物學家",
  Spinning: "旋轉",
  Mentor: "導師",
  Dancing: "跳舞",
  Hiking: "健行",
  Grouch: "壞脾氣",
  Indifferent: "冷漠",
  Alchemist: "煉金術士",
  Saluting: "敬禮",
  Shattering: "破碎",
  Dreams: "夢想",
  Enchantment: "魔法",
  Praying: "祈禱",
  Acolyte: "侍者",
  Stealthy: "隱密",
  Survivor: "倖存者",
  Courageous: "勇敢",
  Proud: "自豪",
  Victor: "冠軍",
  Dismayed: "沮喪",
  Pouty: "嬌嗔",
  Porter: "搬運工",
  HidenSeek: "躲貓貓",
  Sporty: "運動風",
  Diver: "潛水員",
  Swag: "潮流",
  Paintbrush: "畫筆",
  Beret: "貝雷帽",
  Banner: "旗幟",
  Bandana: "頭巾",
  Charming: "迷人",
  Creature: "生物",
  Sleek: "俐落",
  Skating: "滑冰",
  Leg: "腿部",
  Snowkid: "雪孩",
  Slide: "滑梯",
  Vertical: "直立",
  Block: "方塊",
  Crabkin: "螃蟹親族",
  Garland: "花環",
  Gate: "大門",
  Tower: "高塔",
  Balloon: "氣球",
  Suit: "西裝",
  Wireframe: "線框",
  Curtain: "窗簾",
  Wrap: "披巾",
  Smock: "工作服",
  Sea: "海洋",
  Foam: "泡沫",
  Bounty: "豐饒",
  Amethyst: "紫水晶",
  Teacup: "茶杯",
  Cafe: "咖啡館",
  Primrose: "報春花",
  Pinafore: "圍裙洋裝",
  Band: "樂隊",
  Cauldron: "大釜",
  Spider: "蜘蛛",
  Bun: "髮髻",
  Necktie: "領帶",
  Color: "彩色",
  Arum: "海芋",
  Sparrow: "麻雀",
  Switch: "Switch",
  Musical: "音樂",
  Campfire: "營火",
  Summer: "夏日",
  Double: "雙人",
  Bunny: "兔兔",
  Set: "套組",
  Snowflake: "雪花",
  Crabula: "蟹伯爵",
  Jumper: "毛衣",
  Pumpkin: "南瓜",
  Spooky: "詭夜",
  Sonorous: "洪亮",
  Seashell: "海螺",
  Blushing: "害羞",
  Runaway: "逃跑",
  Sneezing: "打噴嚏",
  Geographer: "地理學家",
  Slouching: "垂頭",
  Lamplighter: "掌燈人",
  Gloating: "得意",
  Narcissist: "自戀者",
  Beckoning: "招手",
  Ruler: "統治者",
  Daydream: "白日夢",
  Forester: "森林人",
  Rallying: "鼓舞",
  Timid: "膽小",
  Bookworm: "書蟲",
  Snoozing: "瞌睡",
  Carpenter: "木匠",
  Scarecrow: "稻草人",
  Farmer: "農夫",
  Walker: "行者",
  Nodding: "點頭",
  Thoughtful: "沉思",
  Respectful: "致敬",
  Admiring: "崇敬",
  Greeter: "迎賓者",
  Kid: "孩童",
  Shushing: "噓聲",
  Twirling: "迴旋",
  Laidback: "隨性",
  Doublefive: "擊掌",
  Protector: "護衛",
  Guru: "高人",
  Sassy: "刁蠻",
  Drifter: "浪者",
  Cure: "療癒",
  for: "給",
  Me: "我",
  Guide: "嚮導",
  Prophecy: "預言",
  Sanctuary: "聖島",
  Belonging: "歸屬",
  Gratitude: "感恩",
  Polite: "禮貌",
  Meditating: "禪修",
  Monastic: "院士",
  Levitating: "漂浮",
  Adept: "高手",
  Fainting: "昏厥",
  Bowing: "鞠躬",
  Medalist: "季軍",
  Backflipping: "空翻",
  Handstanding: "倒立",
  Confident: "自信",
  Sightseer: "觀光客",
  Apologetic: "歉意",
  Lumberjack: "伐木工",
  Shivering: "顫抖",
  Trailblazer: "拓荒者",
  Waving: "揮手",
  Rejecting: "回絕",
  Voyager: "行者",
  Ushering: "引路",
  Stargazer: "觀星者",
  Pointing: "指路",
  Candlemaker: "蠟燭匠",
  Snorkel: "呼吸管",
  Surfer: "衝浪者",
  Flippers: "蛙鞋",
  Wetsuit: "潛水服",
  Hoodie: "連帽上衣",
  Whale: "鯨魚",
  Tied: "綁帶",
  Jumpsuit: "連身衣",
  Naptime: "午睡",
  Galley: "船艙",
  Coin: "硬幣",
  Mate: "夥伴",
  Garb: "服飾",
  Spring: "春日",
  Clover: "幸運草",
  Sprout: "嫩芽",
  Veil: "面紗",
  Shiny: "閃亮",
  Clamshell: "蛤蜊殼",
  Underwater: "水下",
  Ladder: "梯子",
  Studs: "耳釘",
  Sundress: "夏日洋裝",
  Carousel: "旋轉木馬",
  Token: "代幣",
  Ribboned: "緞帶",
  Ponytail: "馬尾",
  Pleated: "百褶",
  Podium: "頒獎台",
  Crystalline: "水晶",
  Wind: "風",
  Curved: "彎曲",
  Straight: "筆直",
  Gear: "齒輪",
  Spectacles: "眼鏡",
  Pinned: "別針",
  Warmer: "保暖",
  Convex: "凸面",
  Concave: "凹面",
  Horizontal: "橫向",
  Pillbox: "筒帽",
  Coat: "大衣",
  Pompoms: "毛球",
  Cage: "籠子",
  Chest: "寶箱",
  Sapling: "樹苗",
  Cobweb: "蜘蛛網",
  Leaf: "葉子",
  Beak: "鳥喙",
  Puzzlewright: "拼圖工匠",
  Brimmed: "寬簷",
  Basin: "水盆",
  Sand: "沙",
  Bonnet: "軟帽",
  Tuxedo: "燕尾服",
  Gown: "禮服",
  Arch: "拱門",
  Carpet: "地毯",
  Cinema: "電影院",
  Seats: "座椅",
  Decorative: "裝飾",
  Stick: "手杖",
  Left: "左側",
  Dressing: "梳妝",
  Paint: "彩繪",
  Waves: "波浪",
  Braided: "編髮",
  Embroidered: "刺繡",
  Cavalier: "騎士",
  Braids: "辮子",
  Violet: "紫羅蘭",
  Crystal: "水晶",
  Tipped: "尖端",
  Tails: "尾巴",
  Flags: "旗幟",
  Hare: "野兔",
  Stacked: "堆疊",
  Bath: "浴室",
  Corridor: "走廊",
  Hanger: "衣架",
  Jam: "果醬",
  Station: "車站",
  Fledgling: "雛鳥",
  Upright: "直立",
  Uniform: "制服",
  Raven: "烏鴉",
  Feathered: "羽毛",
  Fascinator: "小禮帽",
  Updo: "盤髮",
  Frock: "洋裝",
  Beach: "海灘",
  Shorts: "短褲",
  Helios: "太陽神",
  Hoops: "圓環",
  Woven: "編織",
  Curls: "捲髮",
  Shirt: "襯衫",
  Loafers: "樂福鞋",
};
const catalogWordsMore: Record<string, string> = {
  and: "與",
  FlOw: "風之旅人",
  A: "甲",
  B: "乙",
  Lot: "場地",
  TGC: "TGC",
  Bubble: "泡泡",
  Machine: "機",
  Glam: "華麗",
  Cut: "短髮",
  Touched: "輕拂",
  Swirled: "捲捲",
  Spiky: "尖刺",
  Sprig: "嫩枝",
  Meteor: "流星",
  Bangles: "手環",
  Stole: "披肩",
  Vestment: "禮服",
  Quilted: "絎縫",
  Course: "賽道",
  Creation: "創作",
  Pinecone: "松果",
  Clip: "髮夾",
  Antennae: "觸角",
  Elf: "精靈",
  Beta: "Beta",
  Founder: "創辦人",
  Chunky: "厚底",
  Sandals: "涼鞋",
  Snack: "點心",
  Kit: "套組",
  Deck: "躺椅",
  Chairs: "椅子",
  Healing: "療癒",
  Poppy: "罌粟花",
  Skyball: "天空球",
  Ancestor: "先祖",
  Snowglobe: "雪景球",
  Garment: "服裝",
  Gossamer: "薄紗",
  Familiar: "使魔",
  Quiff: "飛機頭",
  Web: "蛛網",
  Hungry: "飢餓",
  Bat: "蝙蝠",
  Runway: "伸展台",
  Makeup: "彩妝",
  Top: "高頂",
  Silk: "絲質",
  Ballet: "芭蕾",
  Flame: "火焰",
  Jeans: "牛仔褲",
  Party: "派對",
  Lights: "燈飾",
  Launcher: "發射器",
  Fence: "圍欄",
  Balloons: "氣球",
  Pennants: "三角旗",
  Trousers: "長褲",
  Headphones: "耳機",
  Beanie: "毛帽",
  Braid: "辮子",
  School: "校園",
  Coral: "珊瑚",
  Picnic: "野餐",
  Basket: "提籃",
  Gardening: "園藝",
  Fountain: "噴泉",
  Classy: "優雅",
  Cravat: "領巾",
  Flowery: "花卉",
  Archway: "拱門",
  Gondola: "小船",
  Seesaw: "蹺蹺板",
  Swing: "鞦韆",
  Tiger: "老虎",
  Wool: "羊毛",
  Lion: "獅子",
  Headdress: "頭飾",
  Bull: "牛",
  Voyage: "旅程",
  Sneakers: "運動鞋",
  Wings: "翅膀",
  Giving: "奉獻",
  In: "之中",
  To: "致",
  We: "我們",
  Can: "可以",
  Touch: "觸碰",
  Asteroid: "小行星",
  Jacket: "外套",
  Tiki: "火把",
  Torch: "火炬",
  Hammock: "吊床",
  Earmuffs: "耳罩",
  Pinwheel: "風車",
  Potted: "盆栽",
  Kettle: "茶壺",
  Chimes: "風鈴",
  Sash: "肩帶",
  Krill: "冥龍",
  Sword: "劍士",
  Bookcase: "書櫃",
  Brazier: "火盆",
  Tassels: "流蘇",
  Fireplace: "壁爐",
  Lightseekers: "追光季",
  Vault: "禁閣",
  Lookout: "望遠",
  Captain: "艦長",
  Frightened: "驚恐",
  Refugee: "難民",
  Cheerful: "歡呼",
  Spectator: "觀眾",
  Tearful: "悲傷",
  Prospector: "勘探者",
  Exhausted: "疲憊",
  Dock: "碼頭",
  Worker: "工人",
  Laughing: "歡笑",
  Slumbering: "犯困",
  Shipwright: "船匠",
  Applauding: "鼓掌",
  SCA: "Sky 創作者獎",
  T: "T恤",
  C: "C型",
  "3D": "3D",
  "(Crab)": "螃蟹",
};
const verifiedZh: Record<string, string> = {
  "Rustic Memory Cape": "鄉野的回憶斗篷",
  "Rustic Memory Shoes": "鄉野的回憶鞋子",
  "Dutch Memory Outfit": "荷蘭的回憶服裝",
  "Dutch Memory Cape": "荷蘭的回憶斗篷",
  "Dutch Memory Hair": "荷蘭的回憶髮型",
  "Artistic Memory Cape": "藝術的回憶斗篷",
  "Artistic Memory Hair Accessory": "藝術的回憶髮飾",
  "Dear Van Gogh Ultimate Cape": "致梵谷季畢業禮斗篷",
  "Dear Van Gogh Ultimate Hair": "致梵谷季畢業禮髮型",
  "Carnival Stunt Actor Hair Accessory": "狂歡特技演員髮飾",
  "Carnival Stunt Actor Hair": "狂歡特技演員髮型",
  "Carnival Stunt Actor Outfit": "狂歡特技演員服裝",
  "Carnival Stunt Actor Cape": "狂歡特技演員斗篷",
  "Carnival Ultimate Cape": "狂歡季畢業禮斗篷",
  "Carnival Ultimate Hair": "狂歡季畢業禮髮型",
  "Lightmending Champion Outfit": "織光冠軍服裝",
  "Lightmending Champion Mask": "織光冠軍面具",
  "Lightmending Ultimate Cape": "織光季畢業禮斗篷",
  "Lightmending Ultimate Hair": "織光季畢業禮髮型",
  "Lightmending Ultimate Mask": "織光季畢業禮面具",
  "Migrating Bird Whisperer Cape": "遷徙鳥語者斗篷",
  "Migrating Bird Whisperer Outfit": "遷徙鳥語者服裝",
  "Migration Ultimate Face Accessory": "遷徙季畢業禮臉部配件",
  "Migration Ultimate Outfit": "遷徙季畢業禮服裝",
  "Migration Ultimate Shoes": "遷徙季畢業禮鞋子",
  "Manatee Plush": "海牛玩偶",
  "Tender Toymaker Hair": "溫柔的玩具匠髮型",
  "Tender Toymaker Outfit": "溫柔的玩具匠服裝",
  "Moominmamma's Masterpiece Cape": "姆明媽媽手作斗篷",
  "Moomin Storybook Outfit": "姆明故事書服裝",
  "Moomin Ultimate Outfit": "姆明季畢業禮服裝",
  "The Cellist's Beginnings Outfit": "大提琴手的開始服裝",
  "The Cellist's Beginnings Hair": "大提琴手的開始髮型",
  "The Pianist's Beginnings Outfit": "鋼琴家的開始服裝",
  "The Pianist's Beginnings Hair": "鋼琴家的開始髮型",
  "Nesting Ultimate Outfit": "築巢季畢業禮服裝",
  "Nine-Colored Deer Ultimate Cape": "九色鹿季畢業禮斗篷",
  "Nine-Colored Deer Ultimate Outfit": "九色鹿季畢業禮服裝",
  "Nine-Colored Deer Ultimate Hair": "九色鹿季畢業禮髮型",
  "Princess Cape": "公主斗篷",
  "Princess Outfit": "公主服裝",
  "Princess Hair": "公主髮型",
  "Princess Mask": "公主面具",
  "Nightbird Whisperer Shoes": "夜行鳥語者鞋子",
  "Nightbird Whisperer Outfit": "夜行鳥語者服裝",
  "Nightbird Whisperer Hair": "夜行鳥語者髮型",
  "Tumbling Troublemaker Cape": "翻滾搗蛋鬼斗篷",
  "Tumbling Troublemaker Hair": "翻滾搗蛋鬼髮型",
  "Little Prince Scarf Cape": "小王子圍巾",
  "Star Collector Cape": "星光收藏家斗篷",
  "Star Collector Neckpiece": "星光收藏家頸飾",
  "Confetti Cousin Hair": "彩紙表親髮型",
  "Confetti Cousin Cape": "彩紙表親斗篷",
  "Crab Whisperer Cape": "蟹語者斗篷",
  "Crab Whisperer Hair": "蟹語者髮型",
  "Crab Whisperer Mask": "蟹語者面具",
  "Leaping Dancer Mask": "跳躍舞者面具",
  "Revival Ultimate Cape": "歸巢季畢業禮斗篷",
  "Revival Ultimate Hair": "歸巢季畢業禮髮型",
  "Passage Ultimate Cape": "夜行季畢業禮斗篷",
  "Passage Ultimate Mask": "夜行季畢業禮面具",
  "Performance Ultimate Cape": "表演季畢業禮斗篷",
  "Performance Ultimate Mask": "表演季畢業禮面具",
  "Abyss Ultimate Mask": "潛海季畢業禮面具",
  "Abyss Ultimate Cape": "潛海季畢業禮斗篷",
  "Flight Ultimate Outfit": "飛行季畢業禮服裝",
  "Little Prince Ultimate Outfit": "小王子季畢業禮服裝",
  "Little Prince Ultimate Hair": "小王子季畢業禮髮型",
  "Rhythm Ultimate Mask": "音韻季畢業禮面具",
};
const communityZh: Record<string, string> = {
  "Cinnamoroll Plushie": "大耳狗玩偶",
  "Cinnamoroll Ears": "大耳狗耳朵",
  "Cinnamoroll Swirled Hair": "大耳狗捲捲髮型",
  "Cinnamoroll Cloud Cape": "大耳狗雲朵斗篷",
  "Cinnamoroll Bowtie": "大耳狗領結",
  "Cinnamoroll Mini Companion": "大耳狗迷你夥伴",
  "Kizuna AI Cape": "絆愛斗篷",
  "Kizuna AI Bow": "絆愛蝴蝶結",
  "Kizuna AI Hair": "絆愛髮型",
  "Journey Hair": "風之旅人髮型",
  "Journey Cape": "風之旅人斗篷",
  "Journey Mask": "風之旅人面具",
  "Nintendo Elf Hair": "Nintendo 精靈髮型",
  "Nintendo Red Switch Cape": "Nintendo Switch 紅斗篷",
  "Nintendo Blue Switch Cape": "Nintendo Switch 藍斗篷",
  "Beta Cape": "Beta 斗篷",
  "Founder's Cape": "創辦人斗篷",
  "Moth Cape": "萌新斗篷",
  "Sparrow Cape": "麻雀斗篷",
  "Cat Cape": "貓咪斗篷",
  "Spooky Bat Cape": "蝙蝠斗篷",
  "Dark Rainbow Cape": "暗彩虹斗篷",
  "Ocean Cape": "海洋斗篷",
  "Earth Cape": "地球斗篷",
  "Nature Turtle Cape": "自然日海龜斗篷",
  "Snowflake Cape": "雪花斗篷",
  "Wings of AURORA": "AURORA 之翼",
  "Giving In Cape": "臣服斗篷",
  "To The Love Outfit": "致愛服裝",
  "Tiara We Can Touch": "觸碰之冠",
  "SCA Cap": "Sky 創作者獎帽子",
  "FlOw Cape": "風之旅人斗篷",
};
const zhName = (name: string) => {
  if (verifiedUltimateZh[name]) return verifiedUltimateZh[name];
  if (verifiedZh[name]) return verifiedZh[name];
  if (exactZh[name]) return exactZh[name];
  if (communityZh[name]) return communityZh[name];
  const translated = name
    .replace(/[’']s\b/g, "")
    .replace(/[’']/g, "")
    .replace(/[-–]/g, " ")
    .split(/\s+/)
    .map(
      (x) =>
        catalogWordsMore[x] ??
        catalogWords[x] ??
        seasonWordsMore[x] ??
        seasonWords[x] ??
        words[x] ??
        x,
    )
    .join("");
  return translated || name;
};
const valuationKey = (x: WikiItem) => {
  if (isSeasonPendant(x)) return "pendant";
  if (isGraduationGift(x)) return "discontinued";
  if (x.section === "seasons") return "season";
  const kind = sourceKind(x);
  if (kind === "聯動") return "collab";
  if (kind === "年度活動" || kind === "特殊活動") return "annual";
  if (kind === "平台限定") return "platform";
  return kind === "國服限定" ? "china" : "permanent";
};
const valuationClass = (x: WikiItem) =>
  ({
    discontinued: "絕版核心 · 季節畢業禮",
    pendant: "季卡項鍊 · 非畢業禮",
    season: "季節物品 · 可能復刻",
    collab: "聯動限定 · 返場不確定",
    annual: "年度／特殊活動 · 通常可返場",
    platform: "平台專屬物品",
    china: "國服限定物品",
    permanent: "常駐／一般取得",
  })[valuationKey(x)];
const sourceFilters = [
  { key: "all", name: "全部來源" },
  { key: "seasons", name: "季節" },
  { key: "annual", name: "年度／特殊活動" },
  { key: "collab", name: "聯動" },
  { key: "package", name: "付費物品" },
  { key: "platform", name: "平台限定" },
  { key: "permanent", name: "常駐" },
  { key: "other", name: "國服／其他限定" },
];
const allClosetTypes = [...new Set(closetGroups.flatMap((x) => x.types))];
const allClosetTypeSet = new Set(allClosetTypes);
const typeOrder = new Map(allClosetTypes.map((type, index) => [type, index]));
const limitedSourceKinds = new Set(["聯動", "平台限定", "限定"]);
const isLimitedItem = (x: WikiItem) =>
  x.group === "Limited" || limitedSourceKinds.has(sourceKind(x));
const uniqueByGuid = (items: WikiItem[]) => {
  const unique = new Map<string, WikiItem>();
  items.forEach((item) => unique.set(item.guid, item));
  return [...unique.values()];
};
const sortSeasonSlugs = (slugs: string[]) =>
  [...slugs].sort(
    (a, b) => (seasonOrder.get(a) ?? 999) - (seasonOrder.get(b) ?? 999),
  );
const seasonUltimateSlugs = seasons
  .map(([slug]) => slug)
  .filter((slug) =>
    wikiItems.some(
      (x) =>
        x.section === "seasons" &&
        x.collection === slug &&
        isSeasonUltimate(x) &&
        allClosetTypeSet.has(x.type),
    ),
  );
const ultimateItemsForSeason = (slug: string) =>
  wikiItems
    .filter(
      (x) =>
        x.section === "seasons" &&
        x.collection === slug &&
        isSeasonUltimate(x) &&
        allClosetTypeSet.has(x.type),
    )
    .sort(
      (a, b) =>
        Number(isSeasonPendant(b)) - Number(isSeasonPendant(a)) || a.id - b.id,
    );
const seasonUltimateItems = new Map(
  seasonUltimateSlugs.map((slug) => [slug, ultimateItemsForSeason(slug)]),
);
const seasonGraduationItems = new Map(
  seasonUltimateSlugs.map((slug) => [
    slug,
    (seasonUltimateItems.get(slug) || []).filter(isGraduationGift),
  ]),
);
const graduationSeasonSlugs = seasonUltimateSlugs.filter(
  (slug) =>
    !ongoingSeasonSlugs.has(slug) &&
    (seasonGraduationItems.get(slug)?.length ?? 0) > 0,
);
const matchesSourceFilter = (x: WikiItem, key: string) => {
  if (key === "all") return true;
  const kind = sourceKind(x);
  if (key === "seasons") return x.section === "seasons";
  if (key === "annual") return ["年度活動", "特殊活動"].includes(kind);
  if (key === "collab") return kind === "聯動";
  if (key === "package") return isPaidItem(x);
  if (key === "platform") return kind === "平台限定";
  if (key === "permanent")
    return (
      ["realms", "base"].includes(x.section) ||
      (x.section === "store" && !isPaidItem(x) && kind !== "平台限定")
    );
  return key === "other" && ["國服限定", "限定"].includes(kind);
};
const marketHighlightNames = new Set([
  "Prophet of Fire Outfit",
  "Peeking Postman Cape",
  "Festival Spin Dancer Outfit",
  "Respectful Pianist Hair",
  "Daydream Forester Hair",
]);
const isValuationFocus = (x: WikiItem) =>
  isSeasonUltimate(x) ||
  isLimitedItem(x) ||
  isPaidItem(x) ||
  marketHighlightNames.has(x.name);
const searchIndex = new Map(
  wikiItems
    .filter((x) => allClosetTypeSet.has(x.type))
    .map((x) => [
      x.guid,
      [
        zhName(x.name),
        x.name,
        labels[x.type] || x.type,
        source(x),
        sourceKind(x),
        valuationClass(x),
        String(x.id),
        seasonZh[x.collection] || "",
        eventZh[x.collection] || "",
        realmZh[x.collection] || "",
      ]
        .join(" ")
        .toLocaleLowerCase("zh-Hant"),
    ]),
);
type BindingKey =
  | "google"
  | "nintendo"
  | "gameCenter"
  | "facebook"
  | "steam"
  | "twitch";
type BindingStatus = "none" | "transfer" | "keep" | "issue";
type AccountInfo = {
  name: string;
  accountType: string;
  candles: string;
  hearts: string;
  ascended: string;
  passes: string;
  bindingNote: string;
  notes: string;
};
const bindingNames: Record<BindingKey, string> = {
  google: "Google（GG）",
  nintendo: "Nintendo（NS）",
  gameCenter: "Game Center（GC）",
  facebook: "Facebook（FB）",
  steam: "Steam",
  twitch: "Twitch（TWI）",
};
const bindingKeys = Object.keys(bindingNames) as BindingKey[];
const bindingOptions: { key: BindingStatus; name: string }[] = [
  { key: "none", name: "未綁定" },
  { key: "transfer", name: "可出" },
  { key: "keep", name: "不出" },
  { key: "issue", name: "遺失／異常" },
];
const bindingStatusName = Object.fromEntries(
  bindingOptions.map((x) => [x.key, x.name]),
) as Record<BindingStatus, string>;
const shortBindingName = (key: BindingKey) =>
  bindingNames[key].replace(/（.*?）/g, "");
const emptyBindings = () =>
  Object.fromEntries(bindingKeys.map((key) => [key, "none"])) as Record<
    BindingKey,
    BindingStatus
  >;
const bundlePresets = [
  {
    key: "kizuna",
    name: "絆愛三件套",
    names: ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"],
  },
  {
    key: "prince",
    name: "小王子限定三件",
    names: [
      "Little Prince Asteroid Jacket",
      "Little Prince Scarf Cape",
      "Little Prince Fox",
    ],
  },
  {
    key: "aurora",
    name: "極光限定三件",
    names: ["Wings of AURORA", "Giving In Cape", "To The Love Outfit"],
  },
  {
    key: "journey",
    name: "風之旅人三件套",
    names: ["Journey Cape", "Journey Hair", "Journey Mask"],
  },
  {
    key: "nintendo",
    name: "Nintendo 三件套",
    names: [
      "Nintendo Elf Hair",
      "Nintendo Red Switch Cape",
      "Nintendo Blue Switch Cape",
    ],
  },
  {
    key: "deer",
    name: "九色鹿限定三件",
    names: [
      "Radiance of the Nine-Colored Deer Cape",
      "Gift of the Nine-Colored Deer Antlers",
      "Gift of the Nine-Colored Deer Mask",
    ],
  },
  {
    key: "cinnamoroll",
    name: "大耳狗聯動全套",
    collection: "event-cinnamoroll",
  },
] as const;
const safeFileName = (name: string) =>
  name.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名";
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const valuationTag = (x: WikiItem) =>
  isSeasonPendant(x)
    ? "｜季卡項鍊"
    : isGraduationGift(x)
      ? "｜畢業禮／絕版"
      : "";
const itemLine = (x: WikiItem, index: number) =>
  `${index + 1}. ${zhName(x.name)} / ${x.name}｜${labels[x.type] || x.type}｜ID ${x.id}｜來源：${source(x)}${valuationTag(x)}`;
type ValuationModel = {
  feature_names: string[];
  keyword_patterns: Record<string, string>;
  scaler_mean: number[];
  scaler_scale: number[];
  coefficients: number[];
  intercept: number;
  clamp_twd: [number, number];
};

export default function AccountOrganizer() {
  const [closet, setCloset] = useState("outfit"),
    [sub, setSub] = useState("all"),
    [season, setSeason] = useState("全部季節"),
    [onlyDiscontinued, setOnlyDiscontinued] = useState(false);
  const [query, setQuery] = useState(""),
    [sourceFilter, setSourceFilter] = useState("all"),
    [valuationMode, setValuationMode] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<AccountInfo>({
    name: "",
    accountType: "有翼",
    candles: "",
    hearts: "",
    ascended: "",
    passes: "",
    bindingNote: "",
    notes: "",
  });
  const [bindings, setBindings] =
    useState<Record<BindingKey, BindingStatus>>(emptyBindings);
  const [notice, setNotice] = useState("");
  const [valuationModel, setValuationModel] = useState<ValuationModel | null>(
    null,
  );
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    let active = true;
    fetch("/data/valuation-model-v1.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.feature_names) setValuationModel(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const activeCloset =
    closetGroups.find((x) => x.key === closet) || closetGroups[0];
  const chosen = useMemo(
    () =>
      wikiItems.filter(
        (x) => owned.has(x.guid) && allClosetTypeSet.has(x.type),
      ),
    [owned],
  );
  const valuationAnalysis = useMemo(() => {
    const valuationItems = chosen.filter(isValuationFocus),
      ultimates = chosen.filter(isGraduationGift),
      pendants = chosen.filter(isSeasonPendant),
      packages = chosen.filter(isPaidItem),
      collabs = chosen.filter((x) => sourceKind(x) === "聯動"),
      limited = chosen.filter(isLimitedItem),
      ultimateSeasonSlugs = sortSeasonSlugs([
        ...new Set(
          chosen
            .filter(isSeasonUltimate)
            .filter((x) => !ongoingSeasonSlugs.has(x.collection))
            .map((x) => x.collection),
        ),
      ]),
      startSeasonSlug = ultimateSeasonSlugs[0] || null,
      earliestGraduationIndex = startSeasonSlug
        ? graduationSeasonSlugs.indexOf(startSeasonSlug)
        : -1,
      expectedGraduationSlugs =
        earliestGraduationIndex >= 0
          ? graduationSeasonSlugs.slice(earliestGraduationIndex)
          : [],
      selectedUltimateCount = new Map(
        expectedGraduationSlugs.map((slug) => [
          slug,
          ultimates.filter((x) => x.collection === slug).length,
        ]),
      ),
      pendantSeasonSlugs = new Set(pendants.map((x) => x.collection)),
      expectedUltimateCount = new Map(
        expectedGraduationSlugs.map((slug) => [
          slug,
          seasonGraduationItems.get(slug)?.length ?? 0,
        ]),
      ),
      missingSeasonSlugs = expectedGraduationSlugs.filter(
        (slug) =>
          !selectedUltimateCount.get(slug) && !pendantSeasonSlugs.has(slug),
      ),
      partialSeasonSlugs = expectedGraduationSlugs.filter(
        (slug) =>
          ((selectedUltimateCount.get(slug) || 0) > 0 ||
            pendantSeasonSlugs.has(slug)) &&
          (selectedUltimateCount.get(slug) || 0) <
            (expectedUltimateCount.get(slug) || 0),
      ),
      gapTier = classifySeasonGap({
        hasSeasonData: ultimateSeasonSlugs.length > 0,
        missingSeasons: missingSeasonSlugs.length,
        partialSeasons: partialSeasonSlugs.length,
      }),
      packageTier = classifyPackageTier(packages.length),
      startEvidenceConfidence = Math.min(
        1,
        Math.max(0, ultimateSeasonSlugs.length - 1) / 8,
      ),
      bindingReviewed =
        bindingKeys.some((key) => bindings[key] !== "none") ||
        Boolean(account.bindingNote.trim()),
      checks = [
        Boolean(startSeasonSlug),
        valuationItems.length > 0,
        packages.length > 0 || limited.length > 0,
        bindingReviewed,
      ],
      completeness = Math.round(
        (checks.filter(Boolean).length / checks.length) * 100,
      ),
      issueCount = bindingKeys.filter(
        (key) => bindings[key] === "issue",
      ).length,
      keepCount = bindingKeys.filter((key) => bindings[key] === "keep").length;
    return {
      valuationItems,
      ultimates,
      pendants,
      packages,
      collabs,
      limited,
      ultimateSeasonSlugs,
      startSeasonSlug,
      startEvidenceConfidence,
      missingSeasonSlugs,
      partialSeasonSlugs,
      gapTier,
      packageTier,
      completeness,
      issueCount,
      keepCount,
    };
  }, [chosen, bindings, account]);
  const modelEstimate = useMemo(() => {
    if (!valuationModel || !valuationAnalysis.valuationItems.length)
      return null;
    const derived = [
      ...valuationAnalysis.valuationItems.flatMap((x) => [
        zhName(x.name),
        x.name,
        source(x),
      ]),
      account.accountType,
      valuationAnalysis.packageTier.label,
      valuationAnalysis.gapTier.label,
    ]
      .filter(Boolean)
      .join(" ");
    const values = valuationModel.feature_names.map((name, index) => {
      if (name === "binding_risk") return valuationModel.scaler_mean[index];
      try {
        return new RegExp(valuationModel.keyword_patterns[name], "i").test(
          derived,
        )
          ? 1
          : 0;
      } catch {
        return 0;
      }
    });
    const logPrice =
        valuationModel.intercept +
        values.reduce(
          (sum, value, index) =>
            sum +
            ((value - valuationModel.scaler_mean[index]) /
              (valuationModel.scaler_scale[index] || 1)) *
              monotonicCoefficient(valuationModel.coefficients[index]),
          0,
        ),
      raw = Math.expm1(logPrice),
      tailAnchor = 40000,
      tailAdjusted =
        raw > tailAnchor ? tailAnchor + Math.sqrt(raw - tailAnchor) * 180 : raw,
      marketCalibrated = calibrateHighValueEstimate({
        statisticalEstimate: tailAdjusted,
        earliestSeasonSlug: valuationAnalysis.startSeasonSlug,
        startEvidenceConfidence: valuationAnalysis.startEvidenceConfidence,
        ultimateCount: valuationAnalysis.ultimates.length,
        collaborationCount: valuationAnalysis.collabs.length,
        gapTier: valuationAnalysis.gapTier,
        packageTier: valuationAnalysis.packageTier,
        missingSeasonSlugs: valuationAnalysis.missingSeasonSlugs,
        partialSeasonSlugs: valuationAnalysis.partialSeasonSlugs,
      }),
      riskMultiplier =
        Math.pow(0.86, valuationAnalysis.issueCount) *
        Math.pow(0.95, valuationAnalysis.keepCount),
      adjusted = Math.max(
        valuationModel.clamp_twd[0],
        marketCalibrated * riskMultiplier,
      );
    return Math.round(adjusted / 100) * 100;
  }, [
    valuationModel,
    account.accountType,
    valuationAnalysis,
  ]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("zh-Hant");
    return wikiItems
      .filter(
        (x) =>
          (q
            ? allClosetTypeSet.has(x.type)
            : activeCloset.types.includes(x.type)) &&
          (!q && sub !== "all" ? matchesSub(x, sub) : true) &&
          matchesSourceFilter(x, sourceFilter) &&
          (sourceFilter !== "seasons" ||
            season === "全部季節" ||
            x.collection === season) &&
          (!onlyDiscontinued || isSeasonUltimate(x)) &&
          (!valuationMode || isValuationFocus(x)) &&
          (!q || searchIndex.get(x.guid)?.includes(q)),
      )
      .sort((a, b) =>
        a.type === b.type
          ? a.order - b.order || a.name.localeCompare(b.name)
          : (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99),
      );
  }, [
    sub,
    season,
    onlyDiscontinued,
    activeCloset,
    query,
    sourceFilter,
    valuationMode,
  ]);
  const resetFilters = () => {
    setQuery("");
    setSourceFilter("all");
    setSeason("全部季節");
    setOnlyDiscontinued(false);
    setValuationMode(false);
    setSub("all");
  };
  const toggleOwned = (x: WikiItem) =>
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(x.guid)) next.delete(x.guid);
      else next.add(x.guid);
      return next;
    });
  const bundleItems = (preset: (typeof bundlePresets)[number]) =>
    wikiItems.filter(
      (x) =>
        allClosetTypeSet.has(x.type) &&
        ("collection" in preset
          ? x.collection === preset.collection
          : preset.names.includes(x.name as never)),
    );
  const quickPresetState = (items: WikiItem[]) => {
    const selected = items.filter((x) => owned.has(x.guid)).length;
    return {
      selected,
      complete: items.length > 0 && selected === items.length,
      partial: selected > 0 && selected < items.length,
    };
  };
  const toggleQuickPreset = (label: string, items: WikiItem[]) => {
    const ids = [...new Set(items.map((x) => x.guid))],
      complete = ids.length > 0 && ids.every((id) => owned.has(id));
    setOwned((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (complete ? next.delete(id) : next.add(id)));
      return next;
    });
    setNotice(
      complete
        ? `已取消「${label}」${ids.length} 件`
        : `已選取「${label}」${ids.length} 件`,
    );
  };
  const bindingLines = () =>
    bindingKeys.map(
      (key) => `${bindingNames[key]}：${bindingStatusName[bindings[key]]}`,
    );
  const bindingGroup = (status: BindingStatus, excludeNintendo = false) =>
    bindingKeys
      .filter(
        (key) =>
          (!excludeNintendo || key !== "nintendo") && bindings[key] === status,
      )
      .map(shortBindingName)
      .join("、") || "無";
  const accountHeader = (count = chosen.length) => [
    "光遇帳號衣櫃整理",
    "================",
    `帳號名稱：${account.name || "未填寫"}`,
    `帳號類型：${account.accountType}`,
    "【登入綁定】",
    ...bindingLines(),
    `綁定補充：${account.bindingNote || "無"}`,
    "【帳號資源】",
    `白蠟燭：${account.candles || 0}`,
    `愛心：${account.hearts || 0}`,
    `昇華蠟燭：${account.ascended || 0}`,
    `季卡副卡：${account.passes || 0}`,
    `其他備註：${account.notes || "無"}`,
    `物品總數：${count}`,
    "",
  ];
  const downloadText = (lines: string[], suffix: string) =>
    downloadBlob(
      new Blob(["\uFEFF" + lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_${suffix}.txt`,
    );
  const exportAccount = async () => {
    const seasonSlugs = sortSeasonSlugs([
      ...new Set(
        chosen.filter((x) => x.section === "seasons").map((x) => x.collection),
      ),
    ]);
    const graduationStatus = seasonSlugs
      .map((slug) => {
        const total = seasonGraduationItems.get(slug)?.length ?? 0,
          ownedCount = chosen.filter(
            (x) =>
              x.section === "seasons" &&
              x.collection === slug &&
              isGraduationGift(x),
          ).length;
        if (!ownedCount) return "";
        return `${seasonZh[slug] || slug}${total && ownedCount === total ? "（全畢）" : `（畢業禮 ${ownedCount}/${total || "?"}）`}`;
      })
      .filter(Boolean);
    const uniqueItems = chosen.filter(isLimitedItem),
      uniqueIds = new Set(uniqueItems.map((x) => x.guid)),
      packages = chosen.filter(isPaidItem),
      otherPackages = packages.filter((x) => !uniqueIds.has(x.guid));
    const { buildSaleCopy } = await import("./sale-copy");
    const lines = buildSaleCopy({
      accountName: account.name,
      accountType: account.accountType,
      selectedCount: chosen.length,
      earliestSeason: valuationAnalysis.startSeasonSlug
        ? seasonZh[valuationAnalysis.startSeasonSlug] ||
          valuationAnalysis.startSeasonSlug
        : "",
      seasonNames: seasonSlugs.map((slug) => seasonZh[slug] || slug),
      graduationStatus,
      bindingDetails: bindingLines(),
      transferable: bindingGroup("transfer", true),
      swappable: bindings.nintendo === "transfer" ? "Nintendo（NS）" : "無",
      kept: bindingGroup("keep"),
      issues: bindingGroup("issue"),
      resources: {
        candles: account.candles,
        hearts: account.hearts,
        ascended: account.ascended,
        passes: account.passes,
      },
      ultimates: chosen.filter(isGraduationGift).map((x) => zhName(x.name)),
      uniqueEvents: uniqueItems.map((x) => zhName(x.name)),
      otherPackages: otherPackages.map((x) => zhName(x.name)),
      packageItemCount: packages.length,
      notes: [account.bindingNote, account.notes].filter(Boolean).join("；"),
    });
    downloadText(lines, "出售文案");
  };
  const exportJson = () => {
    const backup = {
      format: "sky-recognition-wiki",
      version: 2,
      exportedAt: new Date().toISOString(),
      account,
      bindings,
      owned: chosen.map((x) => x.guid),
      items: chosen.map((x) => ({
        guid: x.guid,
        id: x.id,
        name: x.name,
        zhName: zhName(x.name),
        type: x.type,
        source: source(x),
        sourceUrl: x.wiki,
      })),
    };
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `光遇帳號_${safeFileName(account.name)}_備份.json`,
    );
  };
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (
        data?.format !== "sky-recognition-wiki" ||
        !Array.isArray(data.owned) ||
        !data.account
      )
        throw new Error("invalid");
      const valid = new Set(wikiItems.map((x) => x.guid)),
        nextBindings = emptyBindings();
      bindingKeys.forEach((key) => {
        const value =
          data.bindings?.[key] ??
          (key === "twitch" ? data.bindings?.twitter : undefined);
        if (bindingOptions.some((x) => x.key === value))
          nextBindings[key] = value;
      });
      const importedType = String(data.account.accountType || "有翼");
      setAccount({
        name: String(data.account.name || ""),
        accountType: importedType.includes("無翼") ? "無翼" : "有翼",
        candles: String(data.account.candles || ""),
        hearts: String(data.account.hearts || ""),
        ascended: String(data.account.ascended || ""),
        passes: String(data.account.passes || ""),
        bindingNote: String(data.account.bindingNote || ""),
        notes: String(data.account.notes || ""),
      });
      setBindings(nextBindings);
      setOwned(
        new Set(
          data.owned.filter(
            (guid: unknown) => typeof guid === "string" && valid.has(guid),
          ),
        ),
      );
      setNotice("JSON 備份已匯入");
    } catch {
      setNotice("無法匯入：檔案格式不正確");
    }
  };
  const exportValuable = () => {
    const items = chosen.filter((x) => isPaidItem(x) || isGraduationGift(x));
    const lines = accountHeader(items.length);
    lines.push("【只列禮包與畢業禮】");
    items.forEach((x, i) => lines.push(itemLine(x, i)));
    if (!items.length) lines.push("尚未選取禮包或畢業禮。");
    downloadText(lines, "禮包與畢業禮");
  };
  const exportBySeason = () => {
    const lines = accountHeader();
    const groups = new Map<string, WikiItem[]>();
    chosen.forEach((x) => {
      const key =
        x.section === "seasons"
          ? seasonZh[x.collection] || x.collection
          : source(x);
      groups.set(key, [...(groups.get(key) || []), x]);
    });
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
      .forEach(([name, items]) => {
        lines.push(`【${name}】共 ${items.length} 件`);
        items.forEach((x, i) => lines.push(itemLine(x, i)));
        lines.push("");
      });
    if (!chosen.length) lines.push("尚未選取任何衣櫃物品。");
    downloadText(lines, "依季節整理");
  };
  const shareSummary = async () => {
    const { ultimates, packages, collabs } = valuationAnalysis;
    const highlights = uniqueByGuid([...ultimates, ...packages, ...collabs])
      .slice(0, 12)
      .map((x) => zhName(x.name));
    const summary = [
      `【光遇帳號摘要｜${account.name || "未命名"}】`,
      `${account.accountType}｜可出：${bindingGroup("transfer")}｜不出：${bindingGroup("keep")}`,
      `資源：${account.candles || 0} 白蠟｜${account.hearts || 0} 愛心｜${account.ascended || 0} 昇華蠟｜${account.passes || 0} 副卡`,
      `衣櫃已登錄 ${chosen.length} 件｜畢業禮 ${ultimates.length}｜禮包 ${packages.length}｜聯動 ${collabs.length}`,
      highlights.length
        ? `重點物品：${highlights.join("、")}`
        : "重點物品：尚未登錄",
      account.bindingNote ? `綁定補充：${account.bindingNote}` : "",
      `資料來源：SkyGame-Data、SkyGame-Planner、BWiki 中文清單`,
      account.notes ? `備註：${account.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share)
        await navigator.share({ title: "光遇帳號摘要", text: summary });
      else {
        await navigator.clipboard.writeText(summary);
        setNotice("帳號摘要已複製");
      }
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        downloadText([summary], "分享摘要");
        setNotice("已改為下載摘要");
      }
    }
  };
  const exportShowcaseImage = async () => {
    setNotice("正在產生圖片…");
    try {
      const { renderShowcaseImage } = await import("./export-showcase");
      const blob = await renderShowcaseImage({
        items: chosen,
        accountName: account.name,
        accountType: account.accountType,
        transferBindings: bindingGroup("transfer"),
        keptBindings: bindingGroup("keep"),
        resources: `資源：${account.candles || 0} 白蠟・${account.hearts || 0} 愛心・${account.ascended || 0} 昇華蠟・${account.passes || 0} 副卡`,
        isUltimate: isGraduationGift,
        isLimited: (item) => isPaidItem(item) || isLimitedItem(item),
        getClusterName: (item) =>
          item.section === "seasons"
            ? seasonZh[item.collection] || item.collection
            : item.section === "events"
              ? eventZh[item.collection] || item.collection
              : item.section === "realms"
                ? realmZh[item.collection] || "常駐地圖"
                : item.section === "store"
                  ? storeSource(item)
                  : sourceKind(item),
        getClusterOrder: (item) =>
          item.section === "seasons"
            ? (seasonOrder.get(item.collection) ?? 999)
            : 1000,
      });
      downloadBlob(blob, `光遇帳號_${safeFileName(account.name)}_圖片衣櫃.png`);
      setNotice("圖片清單已下載");
    } catch {
      setNotice("圖片產生失敗");
    }
  };
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-star">✦</span>
          <b>光遇帳號整理</b>
        </div>
        <div className="header-mode">
          <span>已選 {owned.size} 件</span>
        </div>
      </header>
      <section className="account-panel">
        <div className="account-intro">
          <h1>整理帳號資料</h1>
          <div className="account-progress">
            <b>{owned.size}</b>
            <span>已選物品</span>
          </div>
        </div>
        <div className="account-form">
          <div className="form-section-title">
            <b>交易資訊</b>
          </div>
          <label className="account-name">
            帳號名稱
            <input
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              placeholder="例如：白鳥簡號"
            />
          </label>
          <label>
            帳號類型
            <select
              value={account.accountType}
              onChange={(e) =>
                setAccount({ ...account, accountType: e.target.value })
              }
            >
              <option>有翼</option>
              <option>無翼</option>
            </select>
          </label>
          <div className="form-section-title">
            <b>帳號資源</b>
          </div>
          <label>
            白蠟燭
            <input
              inputMode="numeric"
              value={account.candles}
              onChange={(e) =>
                setAccount({ ...account, candles: e.target.value })
              }
              placeholder="0"
            />
          </label>
          <label>
            愛心
            <input
              inputMode="numeric"
              value={account.hearts}
              onChange={(e) =>
                setAccount({ ...account, hearts: e.target.value })
              }
              placeholder="0"
            />
          </label>
          <label>
            昇華蠟燭
            <input
              inputMode="numeric"
              value={account.ascended}
              onChange={(e) =>
                setAccount({ ...account, ascended: e.target.value })
              }
              placeholder="0"
            />
          </label>
          <label>
            季卡副卡
            <input
              inputMode="numeric"
              value={account.passes}
              onChange={(e) =>
                setAccount({ ...account, passes: e.target.value })
              }
              placeholder="0"
            />
          </label>
          <div className="binding-section">
            <div className="form-section-title">
              <b>登入綁定</b>
            </div>
            <div className="binding-grid">
              {bindingKeys.map((key) => (
                <label
                  className={`binding-card status-${bindings[key]}`}
                  key={key}
                >
                  <span>{bindingNames[key]}</span>
                  <select
                    value={bindings[key]}
                    onChange={(e) =>
                      setBindings({
                        ...bindings,
                        [key]: e.target.value as BindingStatus,
                      })
                    }
                    aria-label={`${bindingNames[key]}綁定狀態`}
                  >
                    {bindingOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <label className="account-notes">
            綁定補充
            <input
              value={account.bindingNote}
              onChange={(e) =>
                setAccount({ ...account, bindingNote: e.target.value })
              }
              placeholder="例如：GC 前號不出、GG 私用、FB 遺失"
            />
          </label>
          <label className="account-notes">
            其他備註
            <input
              value={account.notes}
              onChange={(e) =>
                setAccount({ ...account, notes: e.target.value })
              }
              placeholder="帳號狀態、缺少資料等"
            />
          </label>
        </div>
        <details className="season-picker">
          <summary>
            <b>季節／畢業禮</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="season-picker-body">
            <div className="season-ultimate-grid">
              {seasonUltimateSlugs.map((slug) => {
                const items = seasonUltimateItems.get(slug) || [],
                  selectedCount = items.filter((item) =>
                    owned.has(item.guid),
                  ).length;
                return (
                  <article
                    className={`season-ultimate-card${selectedCount ? " has-selected" : ""}`}
                    key={slug}
                  >
                    <header>
                      <b>{seasonZh[slug]}</b>
                      <span>
                        {ongoingSeasonSlugs.has(slug)
                          ? `進行中 · ${selectedCount}／${items.length}`
                          : `${selectedCount}／${items.length}`}
                      </span>
                    </header>
                    <div className="season-ultimate-items">
                      {items.map((item) => {
                        const selected = owned.has(item.guid),
                          pendant = isSeasonPendant(item),
                          name = pendant ? "項鍊" : zhName(item.name);
                        return (
                          <button
                            type="button"
                            className={`season-ultimate-item${selected ? " selected" : ""}${pendant ? " pendant" : ""}`}
                            aria-pressed={selected}
                            aria-label={`${seasonZh[slug]}　${name}`}
                            title={`${seasonZh[slug]} · ${zhName(item.name)}`}
                            key={item.guid}
                            onClick={() => toggleOwned(item)}
                          >
                            <span className="season-ultimate-icon">
                              {/* External catalog icons must keep their source URL and referrer policy. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.icon} alt="" loading="lazy" />
                              <i aria-hidden="true">{selected ? "✓" : ""}</i>
                            </span>
                            <small>{name}</small>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
        <details className="quick-select">
          <summary>
            <b>常用套組</b>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="quick-select-body">
            <section>
              <div className="preset-grid">
                {bundlePresets.map((preset) => {
                  const items = bundleItems(preset),
                    state = quickPresetState(items);
                  return (
                    <button
                      type="button"
                      className={
                        state.complete
                          ? "selected"
                          : state.partial
                            ? "partial"
                            : ""
                      }
                      aria-pressed={state.complete}
                      key={preset.key}
                      onClick={() => toggleQuickPreset(preset.name, items)}
                    >
                      <i className="preset-check" aria-hidden="true">
                        {state.complete ? "✓" : state.partial ? "–" : ""}
                      </i>
                      <span>
                        <b>{preset.name}</b>
                        <small>
                          {state.complete
                            ? "已選"
                            : state.partial
                              ? `${state.selected}/${items.length}`
                              : `${items.length} 件`}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </details>
        <section className="valuation-report" aria-labelledby="valuation-title">
          <div className="valuation-report-head">
            <h2 id="valuation-title">估價分析</h2>
            <div
              className="completion-ring"
              aria-label={`估價依據完整度 ${valuationAnalysis.completeness}%`}
              style={
                {
                  "--completion": `${valuationAnalysis.completeness * 3.6}deg`,
                } as React.CSSProperties
              }
            >
              <b>{valuationAnalysis.completeness}%</b>
            </div>
          </div>
          <div className="valuation-summary">
            <article className="valuation-verdict">
              <span>目前估價結論</span>
              <h3 className="model-price">
                {modelEstimate !== null
                  ? `NT$ ${modelEstimate.toLocaleString("zh-TW")}`
                  : "NT$ —"}
              </h3>
              <p>
                {valuationAnalysis.valuationItems.length
                  ? modelEstimate !== null
                    ? "依起季完整度、畢業禮、付費禮包、限定物品與綁定狀態計算。"
                    : "模型載入中，請稍候。"
                  : chosen.length
                    ? "目前選取的是一般物品，不列入估價。"
                    : "選取估價物品後，這裡會直接顯示台幣估價。"}
              </p>
              <a href="#top">
                {valuationAnalysis.valuationItems.length
                  ? "繼續核對衣櫃"
                  : "前往選取估價物品"}
              </a>
            </article>
            <div className="valuation-metrics">
              <article>
                <span>畢業禮</span>
                <b>{valuationAnalysis.ultimates.length}</b>
              </article>
              <article>
                <span>季卡項鍊</span>
                <b>{valuationAnalysis.pendants.length}</b>
              </article>
              <article>
                <span>付費物品</span>
                <b>{valuationAnalysis.packages.length}</b>
              </article>
              <article>
                <span>聯動／限定</span>
                <b>{valuationAnalysis.limited.length}</b>
              </article>
            </div>
          </div>
          <p className="valuation-method">
            估價只列：起季與斷季、畢業禮、付費物品、絕版／聯動、熱門復刻與綁定狀態；季卡項鍊只證明有卡，不代表畢業。一般家具、常駐物品、魔法與普通資源不列入重點。
            <br />
            核對資料：1,022 筆帳號樣本、
            <a
              href="https://drive.google.com/drive/folders/1lX7g1HnugqZWgIfL47CTmbp6-uHUfyXm"
              target="_blank"
              rel="noreferrer"
            >
              雲端市場樣本
            </a>
            、
            <a
              href="https://m.kejinshou.com/report/high/d_28268174"
              target="_blank"
              rel="noreferrer"
            >
              中國估價案例
            </a>
            、
            <a
              href="https://skygj.cn/"
              target="_blank"
              rel="noreferrer"
            >
              SKY 估價平台
            </a>
            。刊價不等同成交價，結果僅供議價參考。
          </p>
        </section>
        <div className="account-actions">
          <div className="account-danger">
            <button
              className="clear-owned"
              disabled={!owned.size}
              onClick={() => setOwned(new Set())}
            >
              清除已選
            </button>
          </div>
          <div className="export-tools" aria-label="帳號匯入與匯出">
            <button onClick={exportAccount}>文字檔</button>
            <button onClick={exportJson}>JSON 備份</button>
            <button onClick={() => importRef.current?.click()}>
              匯入 JSON
            </button>
            <button onClick={exportShowcaseImage}>圖片清單</button>
            <button onClick={exportValuable}>禮包＋畢業禮</button>
            <button onClick={exportBySeason}>按季節整理</button>
            <button className="export-account" onClick={shareSummary}>
              分享摘要
            </button>
          </div>
          <input
            ref={importRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={importJson}
          />
        </div>
      </section>
      <section className="catalog" id="top">
        <div className="discovery-tools">
          <label className="catalog-search">
            <span>搜尋物品</span>
            <div>
              <i>⌕</i>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="中文名、英文名、簡稱、季節、ID…"
                aria-label="搜尋全部衣櫃物品"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="清除搜尋"
                >
                  ×
                </button>
              )}
            </div>
          </label>
          <label className="source-select">
            <span>來源</span>
            <select
              value={sourceFilter}
              onChange={(e) => {
                const next = e.target.value;
                setSourceFilter(next);
                if (next !== "seasons") setSeason("全部季節");
              }}
              aria-label="來源篩選"
            >
              {sourceFilters.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {sourceFilter === "seasons" && (
            <label className="source-select season-select">
              <span>季節</span>
              <select
                aria-label="季節篩選"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                <option value="全部季節">全部季節</option>
                {seasons.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className={
              valuationMode ? "valuation-toggle active" : "valuation-toggle"
            }
            onClick={() => setValuationMode((x) => !x)}
            aria-pressed={valuationMode}
          >
            <b>✦ 估價物品</b>
          </button>
        </div>
        <div className="closet-nav" aria-label="衣櫃順序">
          {closetGroups.map((x) => (
            <button
              key={x.key}
              className={closet === x.key ? "selected" : ""}
              onClick={() => {
                setCloset(x.key);
                setSub("all");
              }}
            >
              {x.order && <b>{x.order}</b>}
              <span>{x.name}</span>
            </button>
          ))}
        </div>
        {activeCloset.subs.length > 0 && (
          <div className="closet-subs">
            <button
              className={sub === "all" ? "selected" : ""}
              onClick={() => setSub("all")}
            >
              全部
            </button>
            {activeCloset.subs.map((x, i) => (
              <button
                key={x.key}
                className={sub === x.key ? "selected" : ""}
                onClick={() => setSub(x.key)}
              >
                <i>{i + 1}</i>
                {x.name}
              </button>
            ))}
            <button
              className={
                onlyDiscontinued
                  ? "selected discontinued-filter"
                  : "discontinued-filter"
              }
              onClick={() => setOnlyDiscontinued((x) => !x)}
            >
              絕版
            </button>
          </div>
        )}
        <div className="result-head">
          <h1>
            {query
              ? `「${query.trim()}」搜尋結果`
              : season !== "全部季節"
                ? seasonZh[season]
                : valuationMode
                  ? "估價物品"
                  : activeCloset.name}{" "}
            · {filtered.length.toLocaleString()} 件
          </h1>
          <div className="result-actions">
            {(query ||
              sourceFilter !== "all" ||
              season !== "全部季節" ||
              valuationMode ||
              onlyDiscontinued) && (
              <button className="reset-filters" onClick={resetFilters}>
                清除篩選
              </button>
            )}
          </div>
        </div>
        {filtered.length ? (
          <div className="grid">
            {filtered.map((x) => {
              const has = owned.has(x.guid);
              return (
                <button
                  className={`item-card selectable ${has ? "owned" : ""}`}
                  key={x.guid}
                  onClick={() => toggleOwned(x)}
                  aria-pressed={has}
                >
                  <div className="image-wrap">
                    <span className="owned-check">{has ? "✓" : "＋"}</span>
                    {isSeasonUltimate(x) && (
                      <span className="discontinued-badge">
                        {isSeasonPendant(x) ? "季卡" : "畢業"}
                      </span>
                    )}
                    <span className="source-badge">{sourceKind(x)}</span>
                    {/* External catalog icons must keep their source URL and referrer policy. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={x.icon}
                      alt={x.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="card-body">
                    <div>
                      <span className={`type type-${x.type}`}>
                        {labels[x.type] || x.type}
                      </span>
                    </div>
                    <h2>{zhName(x.name)}</h2>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <b>找不到符合的物品</b>
          </div>
        )}
      </section>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <footer>
        <span>
          資料來源：SkyGame-Data 1.3.8、SkyGame-Planner、Sky Wiki／BWiki（核對於
          2026-08-25）
        </span>
      </footer>
    </main>
  );
}
