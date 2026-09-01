import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const [marketModule, valuationItems] = await Promise.all([
  tsImport("../app/market-collectibles.ts", import.meta.url),
  tsImport("../app/valuation-items.ts", import.meta.url),
]);
const marketGuidByName = new Map(
  marketModule.importantMarketCollectibles.flatMap((profile) =>
    [profile.name, ...profile.aliases].map((name) => [name, profile.guid]),
  ),
);
const {
  canonicalPackageKey,
  isChinaOnlyItem,
  isGraduationGift,
  isPaidItem,
  limitedItemKind,
  isSeasonPendant,
  isSeasonUltimate,
} = valuationItems;

const item = (overrides = {}) => ({
  id: 1,
  order: 1,
  guid: "test",
  name: "Test Item",
  type: "Cape",
  group: "",
  icon: "",
  previewUrl: "",
  wiki: "https://example.com/item",
  section: "events",
  collection: "test",
  ...overrides,
  guid: marketGuidByName.get(overrides.name) ?? overrides.guid ?? "test",
});

test("season pendant is not counted as a graduation gift", () => {
  const pendant = item({
    name: "Rhythm Ultimate Pendant",
    type: "Necklace",
    group: "Ultimate",
    section: "seasons",
  });
  assert.equal(isSeasonUltimate(pendant), true);
  assert.equal(isSeasonPendant(pendant), true);
  assert.equal(isGraduationGift(pendant), false);
});

test("a real ultimate reward is counted as a graduation gift", () => {
  const gift = item({
    name: "Owl Hair",
    type: "Hair",
    group: "Ultimate",
    section: "seasons",
  });
  assert.equal(isSeasonPendant(gift), false);
  assert.equal(isGraduationGift(gift), true);
});

test("ordinary workshop furniture is not treated as paid", () => {
  const furniture = item({
    name: "Stone Kitchen Cabinet",
    type: "Furniture",
    wiki: "https://example.com/Nesting_Workshop#Stone_Kitchen_Cabinet",
  });
  assert.equal(isPaidItem(furniture), false);
});

test("recognizes NetEase catalog entries as China-only", () => {
  const clover = item({
    guid: "-0MdVdgbqv",
    name: "Spring Clover Sprout",
    group: "Limited",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/NetEase/Tree_Planting_Day#Spring_Clover_Sprout",
    section: "store",
    collection: "store",
  });
  assert.equal(isChinaOnlyItem(clover), true);
});

test("explicit packs and verified standalone IAPs are treated as paid", () => {
  assert.equal(
    isPaidItem(
      item({
        name: "Days of Love Swing",
        type: "Furniture",
        wiki: "https://example.com/Days_of_Love_Swing_Pack",
      }),
    ),
    true,
  );
  assert.equal(isPaidItem(item({ name: "Spooky Bat Cape" })), true);
  const campingMask = item({
    name: "Feathery Lash Mask",
    type: "Mask",
    wiki: "https://example.com/Summer_Camping#Feathery_Lash_Mask",
    collection: "summer-camping",
  });
  assert.equal(isPaidItem(campingMask), true);
  assert.equal(limitedItemKind(campingMask), "annual");
  assert.equal(isPaidItem(item({ name: "Days of Healing Poppy" })), true);
  assert.equal(isPaidItem(item({ name: "AURORA Runaway Hair" })), false);
  assert.equal(isPaidItem(item({ name: "Skyfest Wireframe Cape" })), false);
});

test("paid instruments retain their market classification", () => {
  assert.equal(
    isPaidItem(item({ name: "Triumph Violin", type: "Instrument" })),
    true,
  );
  assert.equal(
    isPaidItem(item({ name: "Transverse Flute", type: "Instrument" })),
    false,
  );
});

test("paid held props retain their market classification", () => {
  assert.equal(
    isPaidItem(item({ name: "Bloom Lilypad Umbrella", type: "HeldProp" })),
    true,
  );
  assert.equal(
    isPaidItem(item({ name: "Tournament Torch", type: "HeldProp" })),
    false,
  );
  const cinemaWiki =
    "https://sky-children-of-the-light.fandom.com/wiki/Sky_Anniversary/2025#Anniversary_Cinema_Set";
  const popcorn = item({ name: "Anniversary Popcorn Prop", wiki: cinemaWiki });
  const glasses = item({
    name: "Anniversary Cinema 3D Glasses",
    wiki: cinemaWiki,
  });
  assert.equal(isPaidItem(glasses), true);
  assert.equal(canonicalPackageKey(popcorn), canonicalPackageKey(glasses));
});

test("canonicalizes real pack anchors without merging separate sets", () => {
  const journey = item({
    name: "Journey Cape",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_for_PlayStation#Journey_Pack",
  });
  const journeyMask = item({
    name: "Journey Mask",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_for_PlayStation#Journey_Pack",
  });
  const transcendent = item({
    name: "Transcendent Journey Mask",
    wiki: "https://sky-children-of-the-light.fandom.com/wiki/Sky_for_PlayStation#Transcendent_Journey_Pack",
  });
  assert.equal(canonicalPackageKey(journey), canonicalPackageKey(journeyMask));
  assert.notEqual(canonicalPackageKey(journey), canonicalPackageKey(transcendent));
});

test("deduplicates verified multi-item collaboration packs", () => {
  const ears = item({ name: "Cinnamoroll Ears" });
  const hair = item({ name: "Cinnamoroll Swirled Hair" });
  const cape = item({ name: "Cinnamoroll Cloud Cape" });
  const bowtie = item({ name: "Cinnamoroll Bowtie" });
  assert.equal(canonicalPackageKey(ears), canonicalPackageKey(hair));
  assert.equal(canonicalPackageKey(cape), canonicalPackageKey(bowtie));
  assert.notEqual(canonicalPackageKey(ears), canonicalPackageKey(cape));

  const kizuna = ["Kizuna AI Cape", "Kizuna AI Hair", "Kizuna AI Bow"].map(
    (name) => canonicalPackageKey(item({ name })),
  );
  const deer = [
    "Gift of the Nine-Colored Deer Antlers",
    "Gift of the Nine-Colored Deer Mask",
  ].map((name) => canonicalPackageKey(item({ name })));
  const nintendo = [
    "Nintendo Elf Hair",
    "Nintendo Red Switch Cape",
    "Nintendo Blue Switch Cape",
    "Vessel Flute",
  ].map((name) => canonicalPackageKey(item({ name })));
  assert.equal(new Set(kizuna).size, 1);
  assert.equal(new Set(deer).size, 1);
  assert.equal(new Set(nintendo).size, 1);

  assert.equal(
    canonicalPackageKey(item({ name: "Cat Cape" })),
    canonicalPackageKey(item({ name: "Cat Mask" })),
  );

  for (const names of [
    ["Transcendent Journey Hair", "Transcendent Journey Mask", "Transcendent Journey Cape"],
    ["Charming Creature Outfit", "Charming Creature Head Accessory"],
    ["Fortune Fish Accessory", "Fortune Fish Hood", "Fortune Fish Cape"],
    ["Moth Cape", "Moth Antennae"],
  ]) {
    const keys = names.map((name) => canonicalPackageKey(item({ name })));
    assert.equal(new Set(keys).size, 1, names.join(", "));
  }
});
