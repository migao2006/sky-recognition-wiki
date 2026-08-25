import assert from "node:assert/strict";
import test from "node:test";
import {
  isGraduationGift,
  isPaidItem,
  isSeasonPendant,
  isSeasonUltimate,
  monotonicCoefficient,
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

test("valuable-item coefficients cannot become negative", () => {
  assert.equal(monotonicCoefficient(-0.25), 0);
  assert.equal(monotonicCoefficient(0.25), 0.25);
});
