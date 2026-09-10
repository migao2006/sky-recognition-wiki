import assert from "node:assert/strict";
import test from "node:test";

test("package totals and over-count phrasing retain exact versus bounded evidence", () => {
  for (const label of ["禮包共80", "禮包共計：80", "礼包总共80", "禮包總共８０"]) {
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, 80, label);
    assert.equal(extractMarketPackageRange(label), null, label);
  }
  for (const label of ["禮包共計80以上", "禮包總共80個以上"]) {
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, null, label);
    assert.deepEqual(extractMarketPackageRange(label), { min: 80, max: null }, label);
  }
  for (const label of ["禮包60多", "禮包60餘", "礼包60余", "60多禮", "60餘個禮包", "60余个礼包", "禮包共計60多"]) {
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, null, label);
    assert.deepEqual(extractMarketPackageRange(label), { min: 61, max: null }, label);
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).startSeasonSlug, "enchantment");
  }
  for (const label of ["不是60多禮", "約禮包60多", "禮包60餘左右", "60多禮｜80禮", "999多禮", "禮包999多", "禮包60多元", "禮包共80元", "礼包共计80rmb", "禮包60-80多", "60到80多禮", "禮包60多-80", "禮包60多到80", "禮包60餘至80", "禮包共80台幣", "禮包共80港幣", "禮包共80人民幣"]) {
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, null, label);
    assert.equal(extractMarketPackageRange(label), null, label);
  }
  for (const label of ["禮包總共80蠟燭", "禮包60餘蠟燭", "禮包共計80愛心", "禮包60多件", "禮包共80份", "60多禮物", "60多禮拜", "60餘禮金", "不是禮包共80", "非禮包總共80", "不算禮包共計80", "沒有禮包共80", "不到禮包共80"]) {
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, null, label);
    assert.equal(extractMarketPackageRange(label), null, label);
  }
});

test("package formatting is accepted without treating approximate quantities as exact", () => {
  for (const label of ["80個禮包", "80个礼包", "禮包：80", "礼包:80", "８０個禮包"]) {
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).paidPackageCount, 80, label);
  }
  assert.equal(extractMarketTitleEvidence("拾光80個禮包號").startSeasonSlug, "moments");
  for (const label of ["約80禮", "近80個禮包", "80禮左右", "80個禮包上下", "非80禮", "禮包：80左右"]) {
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).paidPackageCount, null, label);
    assert.equal(extractMarketPackageRange(label), null, label);
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).startSeasonSlug, "enchantment");
  }
  assert.deepEqual(extractMarketPackageRange("禮包：60+"), { min: 60, max: null });
  assert.deepEqual(extractMarketPackageRange("60～80個禮包"), { min: 60, max: 80 });
  assert.equal(extractMarketTitleEvidence("禮包：60+").paidPackageCount, null);
  assert.equal(extractMarketTitleEvidence("60～80個禮包").paidPackageCount, null);
});

test("package lower bounds retain their plus sign before a measure word", () => {
  for (const label of ["60+個禮包", "60+个礼包", "６０＋ 個禮包"]) {
    assert.deepEqual(extractMarketPackageRange(label), { min: 60, max: null }, label);
    assert.equal(extractMarketTitleEvidence(`魔法起${label}`).paidPackageCount, null, label);
  }
  assert.deepEqual(extractMarketPackageRange("１００＋个礼包"), { min: 100, max: null });
  for (const label of ["約60+個禮包", "60+個禮包左右", "未滿100+個禮包", "60+個禮包 90個禮包", "60+個禮包 100+個禮包"]) {
    assert.equal(extractMarketPackageRange(label), null, label);
    assert.equal(extractMarketTitleEvidence(label).paidPackageCount, null, label);
  }
  assert.equal(extractMarketTitleEvidence("60個禮包+900蠟").paidPackageCount, 60);
  assert.equal(extractMarketPackageRange("60個禮包+900蠟"), null);
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

test("prefix package ranges stay bounded evidence rather than exact counts", () => {
  for (const title of ["禮包：60～80", "礼包60-80", "禮包 60 至 80 個", "禮包60到80禮包", "禮包６０～８０"]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 60, max: 80 }, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  for (const title of ["禮包80-60", "禮包60-1000", "約禮包60-80", "禮包60-80左右", "禮包60-80｜90禮包", "禮包60-80｜禮包100-120"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
});

test("verbal lower bounds preserve unknown upper limits and respect negation", () => {
  for (const title of ["60禮以上", "60個禮包以上", "至少60禮包", "最少60个礼包", "禮包至少60", "礼包最少60", "６０ 禮包以上"]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 60, max: null }, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  for (const title of ["不是至少60禮包", "沒有60禮以上", "約60禮以上", "至少60禮包左右", "60～80禮以上", "禮包60～80以上", "至少1000禮包", "至少60禮包｜80禮包"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
});

test("explicit package upper limits retain zero-to-bound evidence, never exact counts", () => {
  for (const title of ["禮包80個以下", "禮包80以下", "礼包：８０个以内", "禮包 80 以內"]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 0, max: 80 }, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  for (const title of ["不是禮包80個以下", "約禮包80個以下", "禮包80個以下左右", "禮包80以下｜90禮", "禮包80元以下", "禮包80件以下", "禮包80-90以下", "禮包1000個以下"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  for (const title of ["最多50禮+900蠟", "千翼+最多50禮"]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 0, max: 50 }, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
  }
  for (const title of ["不是，不到80禮", "沒有：最多80禮", "並非「80禮以下」", "約：最多80禮", "最多80禮盒", "最多80禮服", "最多80禮券", "最多80禮品", "最多80禮炮", "60+80禮以下", "至少20但最多10禮", "超過20但最多10禮", "不到20但最多10禮", "最多10禮但至少20", "估計最多80禮", "應該不到80禮", "不是【最多80禮】"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
  }
  for (const [title, max] of [["不到80禮", 79], ["不滿80禮包", 79], ["不到60禮包", 59], ["未满８０个礼包", 79], ["少於15禮", 14], ["最多50禮", 50], ["至多80個禮包", 80], ["不超過80禮包", 80], ["80禮以下", 80], ["80个礼包以内", 80], ["最多0禮", 0]]) {
    assert.deepEqual(extractMarketPackageRange(title), { min: 0, max }, title);
    assert.equal(extractMarketTitleEvidence(title).paidPackageCount, null, title);
    assert.equal(extractMarketTitleEvidence(`魔法起${title}`).startSeasonSlug, "enchantment");
  }
  for (const title of ["不到0禮", "最多1000禮", "最多80禮物", "最多80禮金", "最多80元", "不是不到80禮", "約最多80禮", "80禮以下左右", "最多80禮以上", "60～80禮以下", "最多80禮｜90禮", "不到80禮｜至少60禮", "最多80禮包左右", "未滿80+禮", "60+禮｜80禮以下", "60多個禮包｜最多80禮", "不一定最多80禮", "大概最多80禮"]) {
    assert.equal(extractMarketPackageRange(title), null, title);
  }
});

test("explicit single-season completion needs no extra account or start suffix", () => {
  for (const title of ["姆明毕业礼多礼号", "不是姆明毕业多礼号", "姆明毕业面具少礼号", "姆明畢業進度中禮號", "姆明畢業？多禮號"]) {
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
    assert.notEqual(extractMarketTitleEvidence(title).salePackageTier, null, title);
  }
  for (const [title, slug] of [["光遇姆明季毕业", "moomin"], ["安卓开服号，圣岛季毕业，多复刻，价格可议", "sanctuary"], ["童真面具狂欢毕业永久无翼", "carnival"], ["14号身高欧若拉毕业有绊爱", "aurora"], ["姆明已畢業", "moomin"], ["姆明畢", "moomin"]]) {
    const result = extractMarketTitleEvidence(title);
    assert.equal(result.startSeasonSlug, slug, title);
    assert.equal(result.breakClass, null, title);
    assert.equal(result.paidPackageCount, null, title);
  }
  for (const title of ["有姆明毕业礼可看截图", "迁徙毕业面具", "姆明畢業斗篷", "姆明毕业发型", "姆明畢業進度", "姆明可畢業", "姆明未畢業", "非姆明畢業", "沒有姆明畢業", "代姆明畢業", "預計姆明畢業", "姆明畢業？", "姆明畢業了？", "姆明季卡畢業號", "預言季聖島季畢業"]) {
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
  }
});

test("explicit graduation lists use the earliest listed season without filling gaps", () => {
  for (const title of [
    "【毕业季节】：表演季，破晓季，欧若拉季，追忆季，夜行季，狂欢季【毕业物品】：白枭发",
    "[畢業季節]:狂歡／表演季／極光季",
    "【毕业季节】：狂欢季，表演季，",
  ]) {
    const result = extractMarketTitleEvidence(title);
    assert.equal(result.startSeasonSlug, "performance");
    assert.equal(result.breakClass, null);
    assert.equal(result.paidPackageCount, null);
  }
  for (const title of ["【毕业季节】：", "【毕业季节】：表演季卡，狂欢季", "【未毕业季节】：表演季，狂欢季", "【毕业地图】：表演季，狂欢季", "【毕业季节】：表演面具，狂欢季", "【毕业季节】：表演季，未知季", "【毕业季节】：表演季【毕业季节】：狂欢季"])
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
});

test("explicit English completed-season ranges provide only starting-season evidence", () => {
  for (const [title, start] of [
    ["SCOTL-P03: Completed 7 seasons from Passage to Two Embers.", "passage"],
    ["SCOTL-P04: Completed 4 seasons from Duets to Blue Bird.", "duets"],
    ["SCOTL-P11: Completed 14 seasons from Performance to Carnival.", "performance"],
    ["Completed 2 seasons from Season of the Little Prince to Flight", "the-little-prince"],
  ]) {
    assert.deepEqual(extractMarketTitleEvidence(title), {
      startSeasonSlug: start, breakClass: null, paidPackageCount: null,
      salePackageTier: null, accountStyle: null, wingless: false,
    });
  }
  for (const title of [
    "Not completed 4 seasons from Duets to Blue Bird.",
    "Will have completed 4 seasons from Duets to Blue Bird.",
    "Completed season passes from Duets to Blue Bird.",
    "Completed 0 seasons from Duets to Blue Bird.",
    "Completed 4 seasons from Duets cape to Blue Bird.",
    "Completed 4 seasons from Carnival to Duets.",
    "Completed 99 seasons from Duets to Blue Bird.",
    "Completed 4 seasons from Two Embers to Carnival.",
    "SCOTL-P10: Completed 23 seasons from Rhymth to Carnival. Rhythm 50% (only mask)",
    "Completed 4 seasons from Duets to Blue Bird. Not actually completed.",
    "Completed 4 seasons from Duets to Blue Bird. Completed 7 seasons from Passage to Carnival.",
    "Passage to Two Embers account", "Flight cape", "Duets instrument account",
  ]) assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null, title);
});

test("Two Embers part-one full names preserve account versus season-pass context", () => {
  for (const name of ["雙星季：暮星篇", "双星季:暮星篇", "雙星季暮星篇", "暮星篇"]) {
    assert.equal(extractMarketTitleEvidence(`${name}起少禮號`).startSeasonSlug, "two-embers-part-1");
    for (const suffix of ["季卡少禮號", "斗篷少禮號", "面具少禮號"])
      assert.equal(extractMarketTitleEvidence(`${name}${suffix}`).startSeasonSlug, null);
  }
  for (const title of ["雙星動畫", "雙星第二篇起少禮號", "雙星季第二部起少禮號", "雙星季：暮星篇起｜遷徙起少禮號"])
    assert.equal(extractMarketTitleEvidence(title).startSeasonSlug, null);
});

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
