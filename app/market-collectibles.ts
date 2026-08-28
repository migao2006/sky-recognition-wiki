import type { BindingKey } from "./account-config";

export type MarketAvailability = "global" | "china" | "platform";

export type MarketCollectibleProfile = {
  name: string;
  playerName: string;
  series: string;
  availability: MarketAvailability;
  platform?: BindingKey;
  valuationMultiplier: number;
  saleCopy: boolean;
  saleSection: "collaboration" | "special";
  packageKey?: string;
};

const profiles = [
  ["Kizuna AI Cape", "絆愛斗篷", "絆愛", "global", 1.5, "kizuna-ai-pack"],
  ["Kizuna AI Hair", "絆愛髮型", "絆愛", "global", 1.5, "kizuna-ai-pack"],
  ["Kizuna AI Bow", "絆愛蝴蝶結", "絆愛", "global", 1.5, "kizuna-ai-pack"],
  ["Little Prince Asteroid Jacket", "小王子星球夾克", "小王子", "global", 1.5],
  ["Little Prince Scarf Cape", "小王子圍巾", "小王子", "global", 1.5],
  ["Little Prince Fox", "小王子狐狸", "小王子", "global", 1.5],
  ["Wings of AURORA", "AURORA 之翼", "AURORA", "global", 1.5],
  ["Giving In Cape", "臣服斗篷", "AURORA", "global", 1.5],
  ["To The Love Outfit", "致愛服裝", "AURORA", "global", 1.5],
  ["Radiance of the Nine-Colored Deer Cape", "九色鹿斗篷", "九色鹿", "global", 1.5],
  ["Gift of the Nine-Colored Deer Antlers", "鹿角", "九色鹿", "global", 1.5, "nine-colored-deer-gift-pack"],
  ["Gift of the Nine-Colored Deer Mask", "九色鹿面具", "九色鹿", "global", 1.5, "nine-colored-deer-gift-pack"],
  ["Cinnamoroll Plushie", "大耳狗玩偶", "大耳狗", "global", 1.5],
  ["Cinnamoroll Ears", "大耳狗耳朵", "大耳狗", "global", 1.5, "cinnamoroll-hair-combo"],
  ["Cinnamoroll Swirled Hair", "大耳狗捲捲髮型", "大耳狗", "global", 1.5, "cinnamoroll-hair-combo"],
  ["Cinnamoroll Cloud Cape", "大耳狗雲朵斗篷", "大耳狗", "global", 1.5, "cinnamoroll-cape-combo"],
  ["Cinnamoroll Bowtie", "大耳狗領結", "大耳狗", "global", 1.5, "cinnamoroll-cape-combo"],
  ["Cinnamoroll Mini Companion", "大耳狗迷你夥伴", "大耳狗", "global", 1.5],
  ["Moominmamma's Masterpiece Cape", "姆明媽媽傑作斗篷", "姆明", "global", 1.5],
  ["Moomintroll Ears", "姆明耳朵", "姆明", "global", 1.5],
  ["Moomintroll Tail", "姆明尾巴", "姆明", "global", 1.5],
  ["Hattifattener Shoulder Buddy", "哈梯法特肩飾", "姆明", "global", 1.5],
  ["Pointed Snufkin Hat", "史力奇尖帽", "姆明", "global", 1.5],
  ["Roving Snufkin Robe", "史力奇長袍", "姆明", "global", 1.5],
  ["Roving Snufkin Scarf", "史力奇圍巾", "姆明", "global", 1.5],
  ["Nintendo Elf Hair", "Nintendo 精靈髮型", "Nintendo", "platform", 1.25, "nintendo-pack", "nintendo"],
  ["Nintendo Red Switch Cape", "Nintendo Switch 紅斗篷", "Nintendo", "platform", 1.25, "nintendo-pack", "nintendo"],
  ["Nintendo Blue Switch Cape", "Nintendo Switch 藍斗篷", "Nintendo", "platform", 1.25, "nintendo-pack", "nintendo"],
  ["Vessel Flute", "陶笛", "Nintendo", "platform", 1.25, "nintendo-pack", "nintendo"],
  ["Journey Hair", "風之旅人髮型", "風之旅人", "global", 1.5, "journey-pack"],
  ["Journey Cape", "風之旅人斗篷", "風之旅人", "global", 1.5, "journey-pack"],
  ["Journey Mask", "風之旅人面具", "風之旅人", "global", 1.5, "journey-pack"],
  ["Founder's Cape", "創辦人斗篷", "辦公室", "global", 0.75],
  ["Beta Cape", "Beta 斗篷", "Beta", "global", 0.75],
] as const;

export const importantMarketCollectibles: readonly MarketCollectibleProfile[] =
  profiles.map(
    ([
      name,
      playerName,
      series,
      availability,
      valuationMultiplier,
      packageKey,
      platform,
    ]) => ({
      name,
      playerName,
      series,
      availability,
      platform,
      valuationMultiplier,
      saleCopy: true,
      saleSection:
        series === "辦公室" || series === "Beta"
          ? "special"
          : "collaboration",
      packageKey,
    }),
  );

const profileByName = new Map(
  importantMarketCollectibles.map((profile) => [profile.name, profile]),
);

export const marketCollectibleProfile = (name: string) =>
  profileByName.get(name) ?? null;
