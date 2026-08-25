export type BindingKey =
  | "google"
  | "nintendo"
  | "gameCenter"
  | "facebook"
  | "steam"
  | "twitch";

export type BindingStatus = "none" | "transfer" | "keep" | "issue";

export type AccountInfo = {
  name: string;
  accountType: string;
  candles: string;
  hearts: string;
  ascended: string;
  passes: string;
  bindingNote: string;
  notes: string;
};

export const bindingNames: Record<BindingKey, string> = {
  google: "Google（GG）",
  nintendo: "Nintendo（NS）",
  gameCenter: "Game Center（GC）",
  facebook: "Facebook（FB）",
  steam: "Steam",
  twitch: "Twitch（TWI）",
};

export const bindingKeys = Object.keys(bindingNames) as BindingKey[];

export const bindingOptions: { key: BindingStatus; name: string }[] = [
  { key: "none", name: "未綁定" },
  { key: "transfer", name: "可出" },
  { key: "keep", name: "不出" },
  { key: "issue", name: "遺失／異常" },
];

export const bindingStatusName = Object.fromEntries(
  bindingOptions.map((option) => [option.key, option.name]),
) as Record<BindingStatus, string>;

export const shortBindingName = (key: BindingKey) =>
  bindingNames[key].replace(/（.*?）/g, "");

export const emptyBindings = () =>
  Object.fromEntries(bindingKeys.map((key) => [key, "none"])) as Record<
    BindingKey,
    BindingStatus
  >;

export const bundlePresets = [
  {
    key: "kizuna",
    name: "絆愛三件套",
    names: ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"],
  },
  {
    key: "prince",
    name: "小王子限定三件套",
    names: [
      "Little Prince Asteroid Jacket",
      "Little Prince Scarf Cape",
      "Little Prince Fox",
    ],
  },
  {
    key: "aurora",
    name: "極光限定三件套",
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
    name: "九色鹿限定三件套",
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
  {
    key: "moomin",
    name: "姆明限定七件",
    names: [
      "Moominmamma's Masterpiece Cape",
      "Pointed Snufkin Hat",
      "Roving Snufkin Scarf",
      "Roving Snufkin Robe",
      "Moomintroll Tail",
      "Moomintroll Ears",
      "Hattifattener Shoulder Buddy",
    ],
  },
  {
    key: "aurora-runaway",
    name: "極光 Runaway 兩件套",
    names: ["AURORA Runaway Outfit", "AURORA Runaway Hair"],
  },
  {
    key: "aurora-cure",
    name: "極光 Cure for Me 兩件套",
    names: ["Cure for Me Mask", "Cure for Me Outfit"],
  },
  {
    key: "transcendent-journey",
    name: "超凡風之旅人三件套",
    names: [
      "Transcendent Journey Cape",
      "Transcendent Journey Hair",
      "Transcendent Journey Mask",
    ],
  },
  {
    key: "wonderland-pinafore",
    name: "仙境報春花兩件套",
    names: [
      "Wonderland Primrose Pinafore Bow",
      "Wonderland Primrose Pinafore Dress",
    ],
  },
  {
    key: "fortune-snake",
    name: "福瑞蛇四件套",
    names: [
      "Fortune Snake Mask",
      "Fortune Snake Outfit",
      "Fortune Snake Cloak",
      "Fortune Snake Hair",
    ],
  },
  {
    key: "mischief-goth",
    name: "惡作劇哥德三件套",
    names: [
      "Mischief Goth Cape",
      "Mischief Goth Boots",
      "Mischief Goth Garment",
    ],
  },
  {
    key: "cat",
    name: "貓咪三件套",
    names: ["Feline Familiar", "Cat Cape", "Cat Mask"],
  },
] as const;
