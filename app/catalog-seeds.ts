import { wikiItems as baseWikiItems } from "./wiki-data";
import type { WikiItem } from "./wiki-data";
const verifiedUltimateItems: WikiItem[] = [
  {
    id: 371,
    order: 3800,
    guid: "2o3CEU9QhM",
    name: "Lightseekers Ultimate Umbrella",
    type: "HeldProp",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/7/7f/Icon_prop_lightseekers_large_umbrella.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Lightseekers_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "lightseekers",
  },
  {
    id: 637,
    order: 3900,
    guid: "W-3Nh_yWGv",
    name: "Moments Ultimate Camera",
    type: "HeldProp",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/4f/Moments-Guide-Prop-Ultimate-Camera-icon-Credit-Morybel.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Moments_Guide#Ultimate_Gifts",
    section: "seasons",
    collection: "moments",
  },
  {
    id: 2341,
    order: 4100,
    guid: "dkfdFCaemY",
    name: "Moomin Ultimate Umbrella",
    type: "HeldProp",
    group: "Ultimate",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/dc/Moomin-Ultimate-Umbrella-Prop-icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/The_Moomin_Storybook#Moomin_Ultimate_Umbrella",
    section: "seasons",
    collection: "moomin",
  },
];
// Upstream overlay: SkyGame-Data v1.3.10 (base snapshot remains compact).
const skyGameDataUpdates: WikiItem[] = [
  {
    id: 3277,
    order: 10975,
    guid: "7a1iYLeV94",
    name: "Feathery Lash Mask",
    type: "Mask",
    group: "",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/c0/Feathery-Lash-Mask-icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Summer_Camping/2026#Feathery_Lash_Mask",
    section: "events",
    collection: "summer-camping",
  },
  {
    id: 3278,
    order: 5320,
    guid: "0ymZWXcz6Z",
    name: "Yellow Tent Wall",
    type: "Furniture",
    group: "",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/2e/Spring-Camping-Shared-Space-Prop-4-Icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Summer_Camping/2024#Yellow_Tent_Wall",
    section: "events",
    collection: "summer-camping",
  },
  {
    id: 3279,
    order: 5380,
    guid: "PR2IFFsW_m",
    name: "Yellow Tent Top",
    type: "Furniture",
    group: "",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/0e/Spring-Camping-Shared-Space-Prop-2-Icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Summer_Camping/2024#Yellow_Tent_Top",
    section: "events",
    collection: "summer-camping",
  },
  {
    id: 3280,
    order: 5360,
    guid: "8KuMwTpL5V",
    name: "Yellow Tent Window",
    type: "Furniture",
    group: "",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3f/Spring-Camping-Shared-Space-Prop-1-Icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Summer_Camping/2024#Yellow_Tent_Window",
    section: "events",
    collection: "summer-camping",
  },
  {
    id: 3281,
    order: 5340,
    guid: "jIwqjwvKnG",
    name: "Yellow Tent Door",
    type: "Furniture",
    group: "",
    icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3e/Spring-Camping-Shared-Space-Prop-3-Icon.png",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Summer_Camping/2024#Yellow_Tent_Door",
    section: "events",
    collection: "summer-camping",
  },
];
type InstrumentSeed = {
  name: string;
  zh: string;
  icon: string;
  section: string;
  collection: string;
  group?: string;
  guid?: string;
};

const instrumentSeeds: readonly InstrumentSeed[] = [
  { name: "Harp", zh: "豎琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/c0/LaughingLightCatcher-2.png", section: "realms", collection: "daylight-prairie" },
  { name: "Fledgling Harp", zh: "雛鳥豎琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/ae/SOPerformance-Fledgling-harp-icon-Morybel-0146.png", section: "store", collection: "harmony-hall" },
  { name: "Contrabass", zh: "低音提琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/64/FrightenedRefugee-3.png", section: "realms", collection: "golden-wasteland" },
  { name: "Piano Keyboard", zh: "鋼琴鍵盤", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/b0/CheerfulSpectator-Piano-Credit-Ed.png", section: "realms", collection: "valley-of-triumph" },
  { name: "Horn", zh: "號角", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/82/LookoutScout-2.png", section: "realms", collection: "golden-wasteland" },
  { name: "Small Bell", zh: "小鈴鐺", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/67/Mimi-4117_02_leaping_dancer_instrument.png", section: "seasons", collection: "gratitude" },
  { name: "Large Bell", zh: "大鈴鐺", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/10/Mimi-4117_02_greeting_shaman_instrument.png", section: "seasons", collection: "gratitude" },
  { name: "Flute", zh: "笛子", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/01/Mimi-4117_03_doublefive_light_catcher_instrument.png", section: "seasons", collection: "lightseekers" },
  { name: "Panflute", zh: "排笛", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/ea/Mimi-4117_03_twirling_champion_instrument.png", section: "seasons", collection: "lightseekers" },
  { name: "Guitar", zh: "吉他", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/cd/Mimi-4117_04_pleaful_parent_instrument.png", section: "seasons", collection: "belonging" },
  { name: "Rhythm Guitar", zh: "節奏吉他", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/4c/SOPerformance-Rhythm-Guitar-icon-Morybel-0146.png", section: "store", collection: "harmony-hall" },
  { name: "Ukulele", zh: "烏克麗麗", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/5d/Mimi-4117_04_hairtousle_teen_instrument.png", section: "seasons", collection: "belonging" },
  { name: "Xylophone", zh: "木琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/5f/Mimi-4117_05_thoughtful_director_instrument.png", section: "seasons", collection: "rhythm" },
  { name: "Winter Piano", zh: "冬季鋼琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/84/Mimi-4117_05_respectful_pianist_instrument.png", section: "seasons", collection: "rhythm" },
  { name: "Sanctuary Handpan", zh: "聖島季畢業禮手碟", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/e4/Icon_instrument_sanctuary_hand_pan.png", section: "seasons", collection: "sanctuary", group: "Ultimate", guid: "Hvq52gCeih" },
  { name: "Triumph Handpan", zh: "凱旋手碟", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/42/SOPerformance-Triumph-Handpan-icon-Morybel-0146.png", section: "store", collection: "harmony-hall" },
  { name: "Prophecy Drum", zh: "預言季畢業禮鼓", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/1c/Icon_instrument_prophecy_drum.png", section: "seasons", collection: "prophecy", group: "Ultimate", guid: "wGQSuhVWXD" },
  { name: "Lute", zh: "魯特琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/a8/Icon_instrument_dreams_lute.png", section: "seasons", collection: "dreams" },
  { name: "Bugle", zh: "重組季畢業禮號角", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/83/Icon_instrument_assembly_bugle.png", section: "seasons", collection: "assembly", group: "Ultimate", guid: "B59f4_ru60" },
  { name: "Kalimba", zh: "拇指琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/d9/Icon_season_of_flight_instrument_kalimba.png", section: "seasons", collection: "flight" },
  { name: "Electric Guitar", zh: "電吉他", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/9/9b/Morybel-0146-SoPerformance_-_Mellow_Musician-electrice-guitar-icon.png", section: "seasons", collection: "performance" },
  { name: "Blue Electric Guitar", zh: "藍色電吉他", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/01/Days-of-Sky-2022-instrument-blue-electric-guitar-icon-Morybel-0146.png", section: "store", collection: "office" },
  { name: "Voice of AURORA", zh: "AURORA 之聲", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/09/Aurora-Voice-of-Aurora-Icon-Morybel-0146-.png", section: "events", collection: "event-aurora", group: "Limited" },
  { name: "Manta Ocarina", zh: "遙鯤陶笛", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/8e/Passage-Overactive-Overachiever-Instrument-icon-Morybel-0146.png", section: "seasons", collection: "passage" },
  { name: "Cello", zh: "大提琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/4a/Musicians-Legacy-Cello-Prop-icon.png", section: "seasons", collection: "duets" },
  { name: "Duets Cello", zh: "協奏大提琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/03/Compassionate-Cellist-Duets-Cello-icon.png", section: "seasons", collection: "duets" },
  { name: "Harmonica", zh: "口琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/0b/Spirit-of-Adventure-Harmonica-icon.png", section: "seasons", collection: "moomin" },
  { name: "Cymbals", zh: "鈸", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/be/Radiance-Greeting-Shaman-instrument-Cymbals-icon.png", section: "seasons", collection: "radiance" },
  { name: "Vessel Flute", zh: "陶笛", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/59/Icon_instrument_vessel_flute.png", section: "store", collection: "nintendo", group: "Limited" },
  { name: "Drum", zh: "鼓", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/89/BlushingProspector-3.png", section: "realms", collection: "hidden-forest" },
  { name: "Triumph Violin", zh: "凱旋小提琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3c/Triumph-Violon-Instrument-icon-Morybel-0146.png", section: "store", collection: "harmony-hall" },
  { name: "Triumph Saxophone", zh: "凱旋薩克斯風", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/0/05/Triumph-Saxophone-instrument-icon-Morybel-0146.png", section: "store", collection: "harmony-hall" },
  { name: "Fortune Drum", zh: "福瑞鼓", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/28/Days-of-Fortune-Drum-icon.png", section: "events", collection: "days-of-fortune" },
  { name: "Grand Piano", zh: "平台鋼琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/f/f1/Musicians-Legacy-Grand-Piano-Prop-icon.png", section: "seasons", collection: "duets", group: "SeasonPass", guid: "WuZeLoUATs" },
  { name: "Duets Grand Piano", zh: "協奏季畢業禮鋼琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/57/Duets-Ultimate-Grand-Piano-Prop-icon.png", section: "seasons", collection: "duets", group: "Ultimate", guid: "O9jSph-v7e" },
  { name: "Fledgling Upright Piano", zh: "雛鳥直立鋼琴", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/b2/Fledgling-upright-Piano-instrument-icon.png", section: "store", collection: "harmony-hall", guid: "10Ol7H9jKg" },
  { name: "Jam Station", zh: "即興演奏台", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/33/Jam-Station-instrument-icon.png", section: "store", collection: "harmony-hall", guid: "WMNr4yo_35" },
  { name: "Transverse Flute", zh: "橫笛", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/6b/Lightmending-Light-Catcher-Instrument-icon.png", section: "seasons", collection: "lightmending" },
];

const replacedInstrumentNames = new Set([
  ...instrumentSeeds.map((item) => item.name),
  "Sanctuary Ultimate Handpan",
  "Prophecy Ultimate Drum",
  "Assembly Ultimate Bugle",
  "The Musicians' Legacy Piano",
  "Duets Ultimate Instrument",
]);
const instrumentItems: WikiItem[] = instrumentSeeds.map((item, index) => ({
  id: 5000 + index,
  order: index + 1,
  guid:
    item.guid ??
    `instrument-${item.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name: item.name,
  type: "Instrument",
  group: item.group ?? "",
  icon: item.icon,
  wiki: `https://sky-children-of-the-light.fandom.com/wiki/Instruments#${item.name.replaceAll(" ", "_")}`,
  section: item.section,
  collection: item.collection,
}));

type HeldPropSeed = {
  name: string;
  zh: string;
  icon: string;
  wiki: string;
  section: string;
  collection: string;
  group?: string;
};

const heldPropSeeds: readonly HeldPropSeed[] = [
  { name: "Dark Horn", zh: "黑暗號角", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/14/SOShattering-Dark-Horn-Icon-Morybel-0146.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Ancient_Darkness#Prop", section: "seasons", collection: "shattering", group: "SeasonPass" },
  { name: "Fireworks Staff", zh: "煙花杖", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/c3/SalutingCaptain-3.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Saluting_Captain#Prop", section: "realms", collection: "golden-wasteland" },
  { name: "Blue Umbrella", zh: "追光季藍傘", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/d5/Mimi-4117_03_laidback_pioneer_item.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Laidback_Pioneer#Prop", section: "seasons", collection: "lightseekers", group: "SeasonPass" },
  { name: "Festival Scepter", zh: "慶典權杖", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/38/Festival-Scepter-prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fireworks#Festival_Scepter", section: "events", collection: "days-of-fireworks" },
  { name: "Camera", zh: "相機", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/23/Moments-Guide-Prop-Camera-icon-Credit-Morybel.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Moments_Guide#Camera_Prop", section: "seasons", collection: "moments" },
  { name: "Manatee Staff", zh: "海牛手杖", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/ef/Stern-Shepherd-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Stern_Shepherd#Prop", section: "seasons", collection: "two-embers-part-1", group: "SeasonPass" },
  { name: "Manatee Toy", zh: "海牛公仔", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/40/Tender-Toymaker-Manatee-Figurine-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Tender_Toymaker#Prop", section: "seasons", collection: "two-embers-part-1" },
  { name: "Sentry Spear", zh: "哨兵長矛", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/4d/Scarred-Sentry-Spear-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Scarred_Sentry#Prop", section: "seasons", collection: "two-embers-part-1", group: "SeasonPass" },
  { name: "Sentry Shield", zh: "哨兵盾牌", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/bf/Scarred-Sentry-Shield-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Scarred_Sentry#Prop", section: "seasons", collection: "two-embers-part-1" },
  { name: "Days of Fortune Enchanted Umbrella", zh: "福瑞魔法傘", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/50/Prosperous-Party-Parasol-icon-Morybel-0146.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune#Enchanted_Umbrella", section: "events", collection: "days-of-fortune" },
  { name: "Days of Fortune Hand Fan", zh: "福瑞手持扇", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/f/f2/Days-of-Fortune-Hand-Fan-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune#Fortune_Hand_Fan", section: "events", collection: "days-of-fortune" },
  { name: "Days of Love Serendipitous Scepter", zh: "愛之日邂逅權杖", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/32/Days-of-Love-Wand-Icon-Morybel-0146.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Love#Serendipitous_Scepter", section: "events", collection: "days-of-love" },
  { name: "Bloom Lilypad Umbrella", zh: "花憩節睡蓮傘", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/9/93/Bloom-Lilypad-Umbrella-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Bloom#Bloom_Lilypad_Umbrella", section: "events", collection: "days-of-bloom" },
  { name: "Bloom Sunflower Umbrella", zh: "花憩節向日葵傘", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3b/Bloom-Sunflower-Umbrella-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Bloom#Bloom_Sunflower_Umbrella", section: "events", collection: "days-of-bloom" },
  { name: "SkyFest Jenova Fan", zh: "SkyFest Jenova 紀念扇", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/9/92/SkyFest-Jenova-Fan-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_Anniversary/2024#SkyFest_Jenova_Fan", section: "events", collection: "event-sky-anniversary" },
  { name: "Anniversary Clapboard", zh: "週年慶場記板", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/2e/SkyFest-Movie-Clapboard-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_Anniversary#Anniversary_Clapboard", section: "events", collection: "event-sky-anniversary" },
  { name: "Tournament Torch", zh: "錦標賽火炬", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/f/fe/Tournament-Torch-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Tournament_of_Triumph#Tournament_Torch", section: "events", collection: "event-tournament" },
  { name: "Tournament Ice Snowboard", zh: "錦標賽冰雪板", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/a5/Tournament-Snowboard-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Tournament_of_Triumph#Tournament_Snowboard", section: "events", collection: "event-tournament" },
  { name: "Lantern", zh: "月光燈籠", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/47/Icon_prop_days_of_summer_lantern.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Moonlight#Moonlight_Lantern_Pack", section: "events", collection: "days-of-moonlight" },
  { name: "Summer Parasol", zh: "夏日陽傘", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/aa/Icon_prop_summer_umbrella.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Sunlight#Summer_Parasol", section: "events", collection: "days-of-sunlight" },
  { name: "Mischief Withered Broom", zh: "惡作劇枯萎掃帚", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/21/Mischief-Withered-Broom-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Mischief#Mischief_Withered_Broom", section: "events", collection: "days-of-mischief" },
  { name: "Treasure Shovel", zh: "尋寶鏟", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/52/Days-of-Treasure-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Treasure#Treasure_Shovel", section: "events", collection: "days-of-treasure" },
  { name: "Fortune Plush Mount", zh: "福瑞絨偶坐騎", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/14/Fortune-Plush-Mount-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Fortune#Fortune_Plush_Mount", section: "events", collection: "days-of-fortune" },
  { name: "Company-Issued Laptop", zh: "公司配發筆電", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/44/Anniversary-Company-Issued-Laptop-Prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_Anniversary#Company-Issued_Laptop", section: "events", collection: "event-sky-anniversary" },
  { name: "Anniversary Popcorn Prop", zh: "週年爆米花道具", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/40/SkyFest-popcorn-prop-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_Anniversary/2025#Anniversary_Cinema_Set", section: "events", collection: "event-sky-anniversary" },
  { name: "Winter Feast Snowboard", zh: "冬宴滑雪板", icon: "https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/d8/Winter-Feast-Snowboard-icon.png", wiki: "https://sky-children-of-the-light.fandom.com/wiki/Days_of_Feast#Winter_Feast_Snowboard", section: "events", collection: "days-of-feast" },
];

const heldPropItems: WikiItem[] = heldPropSeeds.map((item, index) => ({
  ...item,
  id: 5100 + index,
  order: index + 1,
  guid: `held-${item.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  type: "HeldProp",
  group: item.group ?? "",
}));

const normalizePlaceableProp = (item: WikiItem): WikiItem => {
  if (item.type === "Prop") return { ...item, type: "SmallProp" };
  if (item.type === "Furniture")
    return {
      ...item,
      type: item.guid === "sZRjoCGw_u" ? "SmallProp" : "LargeProp",
    };
  return item;
};

export const wikiItems: WikiItem[] = [
  ...baseWikiItems
    .filter((item) => !replacedInstrumentNames.has(item.name))
    .map(normalizePlaceableProp),
  ...skyGameDataUpdates.map(normalizePlaceableProp),
  ...verifiedUltimateItems.filter(
    (item) => !replacedInstrumentNames.has(item.name),
  ),
  ...instrumentItems,
  ...heldPropItems,
];
export const verifiedInstrumentZh = Object.fromEntries(
  instrumentSeeds.map((item) => [item.name, item.zh]),
);
export const verifiedHeldPropZh = Object.fromEntries(
  heldPropSeeds.map((item) => [item.name, item.zh]),
);
export const verifiedUltimateZh: Record<string, string> = {
  "Lightseekers Ultimate Umbrella": "追光季畢業禮雨傘",
  "Moments Ultimate Camera": "拾光季畢業禮相機",
  "Moomin Ultimate Umbrella": "姆明季畢業禮雨傘",
};
