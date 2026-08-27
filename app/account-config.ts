export type BindingKey =
  | "google"
  | "nintendo"
  | "gameCenter"
  | "facebook"
  | "steam"
  | "twitch"
  | "playstation";

export type BindingStatus = "none" | "transfer" | "keep" | "issue";

export type AccountInfo = {
  name: string;
  accountType: string;
  bindingsConfirmed: boolean;
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
  playstation: "PlayStation Network（PSN）",
};

export const bindingKeys = Object.keys(bindingNames) as BindingKey[];

export const bindingOptions: { key: BindingStatus; name: string }[] = [
  { key: "none", name: "無綁" },
  { key: "transfer", name: "出" },
  { key: "keep", name: "不出" },
  { key: "issue", name: "遺失／異常" },
];

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
    name: "Nintendo 林克三件套",
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
    name: "姆明耳尾兩件套",
    names: ["Moomintroll Ears", "Moomintroll Tail"],
  },
  {
    key: "cat",
    name: "貓咪三件套",
    names: ["Feline Familiar", "Cat Cape", "Cat Mask"],
  },
  {
    key: "feline-ears-tail",
    name: "貓咪耳尾兩件套",
    names: ["Mischief Feline Ears", "Mischief Feline Tail"],
  },
  {
    key: "manatee-ears-tail",
    name: "海牛耳尾兩件套",
    names: ["Spirited Manatee Ears", "Spirited Manatee Tail"],
  },
  {
    key: "dark-dragon-horns-tail",
    name: "冥龍角尾兩件套",
    names: ["Vestige of Dark Dragon Horns", "Vestige of Dark Dragon Tail"],
  },
  {
    key: "moth",
    name: "飛蛾兩件套",
    names: ["Moth Cape", "Moth Antennae"],
  },
  {
    key: "sparrow",
    name: "麻雀兩件套",
    names: ["Sparrow Cape", "Sparrow Mask"],
  },
] as const;
