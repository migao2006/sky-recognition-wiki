import assert from "node:assert/strict";
import test from "node:test";

test("package bounds reject negations, approximations and conflicting exact counts", () => {
  for (const title of ["不到百禮", "百禮以下", "百禮左右", "二百禮", "100+禮 80禮", "60～80禮 100禮", "未滿100+禮", "不破百禮", "最多百禮", "至多百禮", "未達百禮", "不超過百禮"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  assert.deepEqual(extractMarketPackageRange("破百禮"), { min: 101, max: null });
  for (const title of ["不死鳥百禮", "不刀百禮", "不議價百禮"]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 100, max: null });
  }
  assert.equal(extractMarketTitleEvidence("魔法無斷80禮+千蠟").paidPackageCount, 80);
  assert.equal(extractMarketTitleEvidence("魔法無斷80禮百蠟").paidPackageCount, 80);
});
import { extractMarketTitleEvidence, extractMarketPackageRange } from "../scripts/lib/market-title-evidence.mjs";

test("retains package intervals without turning lower bounds into exact counts", () => {
  for (const text of ["魔法無斷60+禮包", "魔法無斷禮包60+", "魔法無斷百禮", "魔法無斷60～80禮"]) {
    assert.equal(extractMarketTitleEvidence(text).paidPackageCount, null);
  }
  assert.deepEqual(extractMarketPackageRange("60+禮包"), { min: 60, max: null });
  assert.deepEqual(extractMarketPackageRange("禮包60+"), { min: 60, max: null });
  assert.deepEqual(extractMarketPackageRange("60～80禮"), { min: 60, max: 80 });
  assert.deepEqual(extractMarketPackageRange("魔法無斷百禮"), { min: 100, max: null });
  assert.equal(extractMarketPackageRange("近百禮"), null);
  assert.equal(extractMarketPackageRange("百蠟"), null);
  assert.equal(extractMarketPackageRange("60+禮 90+禮"), null);
});

test("extracts explicit account-level title evidence without inventing a wardrobe", () => {
  assert.deepEqual(extractMarketTitleEvidence("拾光微斷多禮號"), {
    startSeasonSlug: "moments",
    breakClass: "slight",
    paidPackageCount: null,
    salePackageTier: "many",
    accountStyle: null,
    wingless: false,
  });
  assert.deepEqual(extractMarketTitleEvidence("魔法季起無斷80禮"), {
    startSeasonSlug: "enchantment",
    breakClass: "none",
    paidPackageCount: 80,
    salePackageTier: null,
    accountStyle: null,
    wingless: false,
  });
  assert.deepEqual(extractMarketTitleEvidence("表演大斷簡號 無翼"), {
    startSeasonSlug: "performance",
    breakClass: "big",
    paidPackageCount: null,
    salePackageTier: null,
    accountStyle: "simple",
    wingless: true,
  });
});

test("recognizes common season aliases only when the title makes an account claim", () => {
  assert.equal(extractMarketTitleEvidence("風行季起無斷多禮號").startSeasonSlug, "flight");
  assert.equal(extractMarketTitleEvidence("集結中斷普號").startSeasonSlug, "assembly");
  assert.equal(extractMarketTitleEvidence("極光季起無斷").startSeasonSlug, "aurora");
  assert.equal(extractMarketTitleEvidence("梵高季起微斷").startSeasonSlug, "dear-van-gogh");
  assert.equal(extractMarketTitleEvidence("歸屬季卡 80禮").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("追光斗篷｜歸屬面具 80禮").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("追光微斷｜歸屬無斷號").startSeasonSlug, null);
});

test("keeps seller package tiers separate from exact package counts", () => {
  assert.deepEqual(extractMarketTitleEvidence("拾光微斷少禮號"), {
    startSeasonSlug: "moments",
    breakClass: "slight",
    paidPackageCount: null,
    salePackageTier: "few",
    accountStyle: null,
    wingless: false,
  });
  assert.equal(extractMarketTitleEvidence("魔法季起無斷禮包90").paidPackageCount, 90);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷禮包90").salePackageTier, null);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷80禮包").paidPackageCount, 80);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷1800禮").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷 5200 元").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷 5200 元").salePackageTier, null);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷 80禮 90禮").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("魔法季起無斷少禮多禮號").salePackageTier, null);
});

test("rejects ambiguous and negated title claims", () => {
  assert.equal(extractMarketTitleEvidence("不是無斷的拾光號").breakClass, null);
  assert.equal(extractMarketTitleEvidence("非無翼拾光微斷號").wingless, false);
  assert.equal(extractMarketTitleEvidence("拾光微斷中斷號").breakClass, null);
  assert.equal(extractMarketTitleEvidence("表演季卡大斷簡號").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("一般物品：表演面具 大斷簡號").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("非簡號 魔法季起無斷").accountStyle, null);
  assert.equal(extractMarketTitleEvidence("非魔法起季 無斷80禮號").startSeasonSlug, null);
});

test("accepts a single season plus seller package shorthand, but not an item name", () => {
  assert.equal(extractMarketTitleEvidence("拾光少禮號").startSeasonSlug, "moments");
  assert.equal(extractMarketTitleEvidence("拾光斗篷少禮號").startSeasonSlug, null);
});

test("extracts only the explicit title shorthand used in existing Drive listings", () => {
  assert.deepEqual(extractMarketTitleEvidence("狂歡簡, 極限身高可14.28"), {
    startSeasonSlug: "carnival",
    breakClass: null,
    paidPackageCount: null,
    salePackageTier: null,
    accountStyle: "simple",
    wingless: false,
  });
  assert.deepEqual(extractMarketTitleEvidence("千蠟表演斷季無翼"), {
    startSeasonSlug: "performance",
    breakClass: null,
    paidPackageCount: null,
    salePackageTier: null,
    accountStyle: null,
    wingless: true,
  });
  assert.equal(extractMarketTitleEvidence("王子斷季百蠟").startSeasonSlug, "the-little-prince");
  assert.equal(extractMarketTitleEvidence("飛行偽無斷綁全出").startSeasonSlug, "flight");
  assert.equal(extractMarketTitleEvidence("飛行偽無斷綁全出").breakClass, "slight");
  assert.equal(extractMarketTitleEvidence("深淵偽無斷").startSeasonSlug, "abyss");
  assert.equal(extractMarketTitleEvidence("深淵偽無斷").breakClass, "slight");
  assert.equal(extractMarketTitleEvidence("青鳥無斷綁全出").startSeasonSlug, "blue-bird");
  assert.equal(extractMarketTitleEvidence("青鳥無斷綁全出").breakClass, "none");
  assert.equal(extractMarketTitleEvidence("音韻斷季70+禮").startSeasonSlug, "rhythm");
  assert.equal(extractMarketTitleEvidence("音韻斷季70+禮").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("協奏小斷禮包號").startSeasonSlug, "duets");
  assert.equal(extractMarketTitleEvidence("協奏小斷禮包號").breakClass, "slight");
});

test("does not promote ambiguous seasons or standalone item names into a start season", () => {
  assert.equal(extractMarketTitleEvidence("夢想半重組斷季").startSeasonSlug, null);
  for (const title of ["耳墜", "白鳥", "阿努", "白鳥髮型", "阿努面具"]) {
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null);
  }
});
