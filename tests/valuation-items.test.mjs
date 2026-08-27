import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPackageKey,
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
} from "../app/valuation-items.ts";

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
