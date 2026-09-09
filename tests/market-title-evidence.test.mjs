import assert from "node:assert/strict";
import test from "node:test";

test("package formatting is accepted without treating approximate quantities as exact", () => {
  for (const label of ["80個禮包", "80个礼包", "禮包：80", "礼包:80", "８０個禮包"]) {
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).paidPackageCount, 80, label);
  }
  assert.equal(extractMarketTitleEvidence("拾光80個禮包號").startSeasonSlug, "moments");
  for (const label of ["約80禮", "近80個禮包", "80禮左右", "80個禮包上下", "不到80禮", "非80禮", "禮包：80左右", "不滿80禮包"]) {
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).paidPackageCount, null, label);
    assert.equal(extractMarketPackageRange(label), null, label);
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).startSeasonSlug, "enchantment");
  }
  assert.deepEqual(extractMarketPackageRange("禮包：60+"), { min: 60, max: null });
  assert.deepEqual(extractMarketPackageRange("60～80個禮包"), { min: 60, max: 80 });
  assert.equal(extractMarketTitleEvidence("禮包：60+").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("60～80個禮包").paidPackageCount, null);
});

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
import { extractMarketTitleEvidence, extractMarketPackageRange, marketHeadlineFor } from "../scripts/lib/market-title-evidence.mjs";

test("alternate season names provide the same account evidence without changing market identity", () => {
  // Taiwan player usage: dcard.tw/f/sky/p/256115646 (Duets),
  // dcard.tw/f/sky/p/257795105 (Radiance); other aliases also used by source audit.
  for (const [canonical, aliases] of [
    ["破碎", ["破曉", "破晓"]],
    ["極光", ["歐若拉", "欧若拉", "AURORA"]],
    ["緬懷", ["追憶", "追忆"]],
    ["協奏", ["二重奏"]],
    ["染色", ["彩染"]],
  ]) {
    for (const alias of aliases) {
      assert.deepEqual(extractMarketTitleEvidence(`${alias}起微斷少禮號`),
        extractMarketTitleEvidence(`${canonical}起微斷少禮號`), alias);
      for (const suffix of ["季卡禮包號", "斗篷禮包號", "面具禮包號"])
        assert.equal(extractMarketTitleEvidence(`${alias}${suffix}`).startSeasonSlug, null);
    }
  }
  assert.equal(extractMarketTitleEvidence("二重奏彩染少禮號").startSeasonSlug, null);
});

test("accepts season-count, package-account and transferable wingless headings", () => {
  for (const [title, slug] of [
    ["預言八季禮包號", "prophecy"], ["預言12季禮包號", "prophecy"],
    ["音韻七季禮包號", "rhythm"], ["協奏兩季禮包號", "duets"],
    ["狂歡禮包號", "carnival"], ["織光禮包無翼", "lightmending"],
    ["姆明綁全出無翼", "moomin"], ["極光綁全出禮包無翼", "aurora"],
    ["遷途禮包簡", "migration"], ["遷徒微斷號", "migration"],
  ]) {
    const result = extractMarketTitleEvidence(title);
    assert.equal(result.startSeasonSlug, slug, title);
    assert.equal(result.paidPackageCount, null, title);
  }
  for (const title of ["狂歡禮包", "預言季卡禮包號", "姆明斗篷禮包號", "王子飞行白梟", "緬懷狂歡禮包號", "王子三件套禮包號", "王子圍巾斗禮包號", "姆明耳尾禮包號", "極光金翅膀禮包號", "預言阿努面具禮包號", "姆明耳尾綁全出無翼"]) {
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
  }
});

test("transferable-binding text does not hide an adjacent simple-account claim", () => {
  // Existing reviewed Drive heading: 音韻綁全出簡.
  for (const title of ["音韻綁全出簡", "音韵季绑全出简号", "音韻綁全出簡帳"]) {
    assert.deepEqual(extractMarketTitleEvidence(title), {
      startSeasonSlug: "rhythm",
      breakClass: null,
      paidPackageCount: null,
      salePackageTier: null,
      accountStyle: "simple",
      wingless: false,
    });
  }
  for (const title of ["音韻季卡綁全出簡", "音韻吉他綁全出簡", "王子圍巾綁全出簡", "音韻綁全出簡｜追光簡", "音韻綁全出非簡號"])
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
});

test("blank metadata and document page markers do not hide the real heading", () => {
  assert.equal(marketHeadlineFor({ title: "  ", listing_title: "N/A", listing_text: "\uFEFF分頁 1\n\n預言八季禮包號\n綁定資料" }), "預言八季禮包號");
  assert.equal(marketHeadlineFor({ title: "狂歡禮包號", listing_text: "其他資料" }), "狂歡禮包號");
  assert.equal(marketHeadlineFor({}), "");
});

test("item names before simple-account suffixes are not start-season claims", () => {
  for (const title of ["王子三件套禮包簡", "姆明耳尾禮包簡", "極光金翅膀禮包簡", "遷途武士褲禮包簡"]) {
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
  }
});

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
  // Taiwan season reference: https://forum.gamer.com.tw/C.php?bsn=33024&snA=705
  for (const [slug, aliases] of [
    ["flight", ["飛翔季", "飞翔季"]],
    ["moments", ["時光季", "时光季"]],
    ["revival", ["雲巢季", "云巢季"]],
  ]) {
    for (const alias of aliases) {
      assert.equal(extractMarketTitleEvidence(`${alias}起微斷少禮號`).startSeasonSlug, slug);
      assert.equal(extractMarketTitleEvidence(`${alias}卡多禮號`).startSeasonSlug, null);
      assert.equal(extractMarketTitleEvidence(`${alias}斗篷少禮號`).startSeasonSlug, null);
    }
  }
  assert.equal(extractMarketTitleEvidence("雲巢家具多禮號").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("美好時光少禮號").startSeasonSlug, null);
  assert.equal(extractMarketTitleEvidence("時光季微斷｜飛翔季無斷號").startSeasonSlug, null);
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
