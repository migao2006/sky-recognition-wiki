type BundlePreset = {
  key: string;
  name: string;
} & ({ names: readonly string[] } | { collection: string });

// Keep account-step presets independent from the complete IAP metadata snapshot.
// The detailed profiles only load with the catalog/valuation runtime.
const seriesNames = {
  絆愛: ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"],
  小王子: [
    "Little Prince Asteroid Jacket",
    "Little Prince Scarf Cape",
    "Little Prince Fox",
  ],
  AURORA: [
    "Wings of AURORA",
    "Giving In Cape",
    "To The Love Outfit",
    "AURORA Musical Voyage Sneakers",
    "Voice of AURORA",
    "AURORA Runaway Outfit",
    "AURORA Runaway Hair",
    "Tiara We Can Touch",
    "Cure for Me Mask",
    "Cure for Me Outfit",
  ],
  風之旅人: ["Journey Hair", "Journey Cape", "Journey Mask"],
  Nintendo: [
    "Nintendo Elf Hair",
    "Nintendo Red Switch Cape",
    "Nintendo Blue Switch Cape",
    "Vessel Flute",
  ],
  九色鹿: [
    "Radiance of the Nine-Colored Deer Cape",
    "Gift of the Nine-Colored Deer Antlers",
    "Gift of the Nine-Colored Deer Mask",
  ],
  大耳狗: [
    "Cinnamoroll Plushie",
    "Cinnamoroll Ears",
    "Cinnamoroll Swirled Hair",
    "Cinnamoroll Cloud Cape",
    "Cinnamoroll Bowtie",
    "Cinnamoroll Mini Companion",
  ],
  姆明: [
    "Moominmamma's Masterpiece Cape",
    "Moomintroll Ears",
    "Moomintroll Tail",
    "Hattifattener Shoulder Buddy",
    "Pointed Snufkin Hat",
    "Roving Snufkin Robe",
    "Roving Snufkin Scarf",
  ],
} as const;

const series = (name: keyof typeof seriesNames) => seriesNames[name];

export const bundlePresets: readonly BundlePreset[] = [
  { key: "kizuna", name: "絆愛三件套", names: series("絆愛") },
  { key: "prince", name: "小王子限定三件套", names: series("小王子") },
  {
    key: "aurora",
    name: "AURORA 經典三件套",
    names: series("AURORA").slice(0, 3),
  },
  { key: "aurora-full", name: "AURORA 限定全套", names: series("AURORA") },
  { key: "journey", name: "風之旅人三件套", names: series("風之旅人") },
  {
    key: "nintendo",
    name: "Nintendo 林克三件套",
    names: series("Nintendo").filter((name) => name !== "Vessel Flute"),
  },
  { key: "deer", name: "九色鹿限定三件套", names: series("九色鹿") },
  { key: "cinnamoroll", name: "大耳狗聯動全套", names: series("大耳狗") },
  {
    key: "moomin",
    name: "姆明耳尾兩件套",
    names: series("姆明").filter((name) =>
      ["Moomintroll Ears", "Moomintroll Tail"].includes(name),
    ),
  },
  {
    key: "cat",
    name: "貓咪三件套",
    names: ["Feline Familiar", "Cat Cape", "Cat Mask"],
  },
  {
    key: "mischief-classics",
    name: "惡作劇經典禮包",
    names: [
      "Spooky Bat Cape",
      "Mischief Witch Hat",
      "Mischief Withered Antlers",
      "Cat Cape",
      "Cat Mask",
    ],
  },
  {
    key: "nature-classics",
    name: "自然日經典斗篷",
    names: ["Earth Cape", "Ocean Cape", "Nature Turtle Cape"],
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
  { key: "moth", name: "飛蛾兩件套", names: ["Moth Cape", "Moth Antennae"] },
  { key: "sparrow", name: "麻雀兩件套", names: ["Sparrow Cape", "Sparrow Mask"] },
];
