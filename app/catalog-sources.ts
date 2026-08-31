import type { WikiItem } from "./wiki-data";
import { marketCollectibleProfile } from "./market-collectibles";
export const seasonZh: Record<string, string> = {
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
// 玩家交易文案常用縮寫只用於搜尋；畫面與匯出仍使用 seasonZh 的標準名稱。
export const seasonSearchAliases: Record<string, readonly string[]> = {
  belonging: ["歸"],
  rhythm: ["音韻"],
  enchantment: ["魔"],
  remembrance: ["緬", "緬懷"],
  passage: ["夜", "夜行"],
  moments: ["時光", "拾光"],
  "nine-colored-deer": ["彩鹿"],
  migration: ["遷徒", "遷徙"],
};
export const eventZh: Record<string, string> = {
  "days-of-bloom": "花憩日",
  "days-of-feast": "宴會節",
  "days-of-fireworks": "煙火節",
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
  "summer-camping": "夏日露營",
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
export const realmZh: Record<string, string> = {
  "isle-of-dawn": "晨島",
  "daylight-prairie": "雲野",
  "hidden-forest": "雨林",
  "valley-of-triumph": "霞谷",
  "golden-wasteland": "暮土",
  "vault-of-knowledge": "禁閣",
  "eye-of-eden": "伊甸之眼",
};
export const seasons = Object.entries(seasonZh);
export const seasonOrder = new Map(seasons.map(([slug], index) => [slug, index]));
export const ongoingSeasonSlugs = new Set(["dear-van-gogh"]);
export const storeSource = (x: WikiItem) => {
  const url = x.wiki;
  const verified = marketCollectibleProfile(x.name, x.guid);
  return verified?.availability === "global" &&
    verified.saleSection === "collaboration"
    ? `${verified.series}聯動`
    : x.collection === "nintendo"
    ? "Nintendo Switch 專屬"
    : /Secret_Area|Founder/.test(url)
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
export const sourceKind = (x: WikiItem) => {
  const verified = marketCollectibleProfile(x.name, x.guid);
  if (
    verified?.availability === "global" &&
    verified.saleSection === "collaboration"
  )
    return "聯動";
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
  if (x.section === "other" && /Sky_for_Steam|Steam/i.test(x.wiki))
    return "平台限定";
  if (x.section === "store") {
    const store = storeSource(x);
    if (store.includes("專屬")) return "平台限定";
    if (store.includes("限定")) return "限定";
    return "商店";
  }
  return x.section === "base" ? "基礎" : "國服限定";
};
export const sourceCollectionName = (x: WikiItem) =>
  x.section === "seasons"
    ? seasonZh[x.collection] || x.collection
    : x.section === "events"
      ? eventZh[x.collection] || x.collection
      : x.section === "realms"
        ? realmZh[x.collection] || "常駐地圖"
        : x.section === "store"
          ? storeSource(x)
          : sourceKind(x);
const eventOrder = new Map(
  Object.keys(eventZh).map((collection, index) => [collection, index]),
);
const realmOrder = new Map(
  Object.keys(realmZh).map((collection, index) => [collection, index]),
);
export const showcaseClusterOrder = (item: WikiItem) => {
  const kind = sourceKind(item);
  if (item.section === "seasons")
    return 1000 + (seasonOrder.get(item.collection) ?? 999);
  if (kind === "聯動")
    return 2000 + (eventOrder.get(item.collection) ?? 999);
  if (kind === "平台限定") return 3000;
  if (item.section === "events")
    return 4000 + (eventOrder.get(item.collection) ?? 999);
  if (item.section === "store") return 5000;
  if (item.section === "realms")
    return 6000 + (realmOrder.get(item.collection) ?? 999);
  if (item.section === "base") return 7000;
  return 8000;
};
export const source = (x: WikiItem) =>
  x.section === "base"
    ? "基礎 · 初始裝扮與動作"
    : x.section === "realms" || x.section === "other"
      ? `${sourceKind(x)} · ${realmZh[x.collection] || x.collection}`
      : `${sourceKind(x)} · ${sourceCollectionName(x)}`;
