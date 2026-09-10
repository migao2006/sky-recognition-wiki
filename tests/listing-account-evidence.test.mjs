import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCompleteBindings,
  extractPartialBindings,
  extractResourceEvidence,
  splitListingInventoryContext,
} from "../scripts/lib/listing-account-evidence.mjs";

test("separate gifted-account sections do not establish main-account ownership", () => {
  const result = splitListingInventoryContext("追光大傘\r\n✦ 贈號上數據\r\n追光大傘｜白蠟100\r\n無綁\r\n\r\n星夜之傘｜白蠟900");
  assert.equal(result.inventory, "追光大傘\n\n星夜之傘｜白蠟900");
  assert.equal(result.separateAccount, "追光大傘｜白蠟100\n無綁");
  for (const text of ["沒有贈號上數據\n追光大傘", "帳號數據\n追光大傘", "贈送禮包\n星夜之傘"]) {
    assert.equal(splitListingInventoryContext(text).inventory, text);
  }
  assert.equal(splitListingInventoryContext("赠号上数据：\n追光大傘").inventory, "");
});

test("physical badge sections are not in-game inventory evidence", () => {
  for (const title of ["⚝ › 實體徽章", "✦ 實體 STAR 徽章：", "实体徽章:"]) {
    const result = splitListingInventoryContext(`大傘\n${title}\n大傘｜海龜\n公主抱\n\n星夜之傘`);
    assert.equal(result.inventory, "大傘\n\n星夜之傘");
    assert.equal(result.physicalCollectibles, "大傘｜海龜\n公主抱");
    assert.equal(result.separateAccount, "");
  }
  for (const text of ["沒有實體徽章\n大傘", "GG 綁全出\n大傘", "實體徽章另售但有大傘\n海龜斗"]) {
    assert.equal(splitListingInventoryContext(text).inventory, text);
  }
});

test("accepts only explicit complete binding statements", () => {
  assert.equal(extractCompleteBindings("帳號無綁｜可直接改密碼")?.kind, "none");
  assert.equal(extractCompleteBindings("綁全出｜售後不退")?.kind, "all-transfer");
  assert.equal(extractCompleteBindings("GG 出｜NS 不出"), null);
  assert.equal(extractCompleteBindings("無綁｜GG 不出"), null);
  assert.equal(extractCompleteBindings("無綁｜已綁 Google 可出"), null);
  assert.equal(extractCompleteBindings("綁全出｜無綁"), null);
  assert.equal(extractCompleteBindings("不是綁全出"), null);
  assert.equal(extractCompleteBindings("並非綁定全可出"), null);
  assert.equal(extractCompleteBindings("不是 綁全出"), null);
  assert.equal(extractCompleteBindings("非  綁皆出"), null);
  assert.equal(extractCompleteBindings("無綁｜GG綁出"), null);
  assert.equal(extractCompleteBindings("無綁｜Nintendo 綁可出"), null);
  assert.equal(extractCompleteBindings("無綁｜GG：綁出"), null);
  assert.equal(extractCompleteBindings("無綁定問題"), null);
  assert.equal(extractCompleteBindings("GG 無綁"), null);
  assert.equal(extractCompleteBindings("其餘 無綁"), null);
  assert.equal(extractCompleteBindings("帳號無綁｜NS可出"), null);
  assert.equal(extractCompleteBindings("綁全出｜GC不出"), null);
  assert.equal(extractCompleteBindings("帳號無綁｜GG可出/不出"), null);
  assert.equal(extractCompleteBindings("帳號無綁｜GG無綁/已綁"), null);
  assert.equal(extractCompleteBindings("帳號無綁｜GG無綁/有綁"), null);
  assert.equal(extractCompleteBindings(" 無綁 ｜可直接改密碼")?.kind, "none");
  assert.equal(extractCompleteBindings("無綁 可直接改密碼")?.kind, "none");
  for (const text of [
    "綁全出嗎", "綁全出？", "是否綁全出", "請問綁全出嗎？", "不確定綁全出",
    "請問：綁全出", "是否：綁全出", "不確定：綁全出", "綁全出現", "不是 綁全出", "無綁 嗎", "無綁？",
  ]) assert.equal(extractCompleteBindings(text), null, text);
  for (const text of ["表演無斷無翼綁全出", "ɢɢ綁全出", "綁全出重組斷季百蠟", "ɢɢ,ɴs綁全出", "姆明綁全出無翼"]) {
    assert.equal(extractCompleteBindings(text)?.kind, "all-transfer", text);
  }
});

test("retains bounded per-platform binding evidence", () => {
  assert.deepEqual(
    extractPartialBindings("GG,ID遺失｜NS可出｜其餘無綁"),
    { bindings: { nintendo: "transfer" }, conflicts: [] },
  );
  assert.deepEqual(
    extractPartialBindings("Ⱄ綁定║gg gc不出⸝st換綁"),
    { bindings: { google: "keep", gameCenter: "keep" }, conflicts: [] },
  );
  assert.deepEqual(
    extractPartialBindings("Google 遺失｜FB未綁｜PSN:出"),
    { bindings: { google: "issue", facebook: "none", playstation: "transfer" }, conflicts: [] },
  );
  for (const text of ["不是GG可出", "請問 GG可出", "請問：GG可出", "是否 GG可出", "可否 GG可出", "不確定 GG可出", "GG可出嗎", "GG可出 嗎", "GG可出？", "GG可出現", "Apple ID可出", "GG可出但不出"]) {
    assert.deepEqual(extractPartialBindings(text).bindings, {}, text);
  }
});

test("shares grouped statuses only across bounded known-platform lists", () => {
  assert.deepEqual(
    extractPartialBindings("GG、NS不出｜GG,GC可出"),
    { bindings: { nintendo: "keep", gameCenter: "transfer" }, conflicts: ["google"] },
  );
  assert.deepEqual(
    extractPartialBindings("GG Game Center可出"),
    { bindings: { google: "transfer", gameCenter: "transfer" }, conflicts: [] },
  );
  assert.deepEqual(
    extractPartialBindings("GG可出,NS不出"),
    { bindings: { google: "transfer", nintendo: "keep" }, conflicts: [] },
  );
  assert.deepEqual(
    extractPartialBindings("GG、NS可出/不出"),
    { bindings: {}, conflicts: ["google", "nintendo"] },
  );
  assert.deepEqual(
    extractPartialBindings("帳號無綁｜GG、NS可出"),
    { bindings: {}, conflicts: ["google", "nintendo"] },
  );
  assert.equal(extractCompleteBindings("綁全出｜GG、NS不出"), null);
  for (const text of ["ID GG GC可出", "Apple ID GG GC可出", "ST GG GC不出", "ID/GG GC不出", "ST/GG GC不出", "Apple ID/GG GC不出", "GG NS不\n出", "GG NS\n不出"]) {
    assert.deepEqual(extractPartialBindings(text).bindings, {}, text);
  }
  for (const text of ["GG/NS不出", "GG/NS,GC不出", "GG、Apple ID不出", "GG、ST不出", "Apple ID、NS不出", "不是 GG GC可出", "不是GG GC可出", "請問GG GC可出", "GG GC可出嗎"]) {
    assert.deepEqual(extractPartialBindings(text).bindings, {}, text);
  }
  assert.deepEqual(
    extractPartialBindings("GG\nNS不出"),
    { bindings: { nintendo: "keep" }, conflicts: [] },
  );
  assert.deepEqual(
    extractPartialBindings("GG、NS不\n出"),
    { bindings: {}, conflicts: [] },
  );
});

test("uncertain binding qualifiers preserve other explicitly known platforms", () => {
  for (const claim of ["GG可出 不確定", "GG GC可出 待確認", "可能GG GC可出", "大概 GG可出", "應該 GG GC可出", "據說 GG可出"]) {
    assert.deepEqual(extractPartialBindings(`${claim}｜NS不出`),
      { bindings: { nintendo: "keep" }, conflicts: [] }, claim);
  }
  for (const claim of ["綁全出 待確認", "綁全出（不確定）", "無綁 不確定", "可能綁全出", "應該綁全出", "據說綁全出"]) {
    assert.equal(extractCompleteBindings(claim), null, claim);
  }
  assert.deepEqual(extractPartialBindings("GG GC可出\n不確定價格"),
    { bindings: { google: "transfer", gameCenter: "transfer" }, conflicts: [] });
  assert.deepEqual(extractPartialBindings("GG可出｜NS可出 不確定"),
    { bindings: { google: "transfer" }, conflicts: [] });
  assert.equal(extractCompleteBindings("綁全出\n待確認價格")?.kind, "all-transfer");
  assert.deepEqual(extractPartialBindings("價格大概\nGG GC可出"),
    { bindings: { google: "transfer", gameCenter: "transfer" }, conflicts: [] });
  assert.equal(extractCompleteBindings("價格大概\n綁全出")?.kind, "all-transfer");
  for (const suffix of ["待確認價格", "不確定售價", "待核實資源"]) {
    assert.deepEqual(extractPartialBindings(`GG GC可出 ${suffix}`),
      { bindings: { google: "transfer", gameCenter: "transfer" }, conflicts: [] });
    assert.equal(extractCompleteBindings(`綁全出 ${suffix}`)?.kind, "all-transfer");
  }
});

test("drops conflicting partial platform claims without deriving other bindings", () => {
  assert.deepEqual(extractPartialBindings("不是綁全出｜GG不出"), { bindings: { google: "keep" }, conflicts: [] });
  assert.deepEqual(
    extractPartialBindings("GG可出｜GG不出｜Twitch異常"),
    { bindings: { twitch: "issue" }, conflicts: ["google"] },
  );
  assert.deepEqual(
    extractPartialBindings("NS可出/不出"),
    { bindings: {}, conflicts: ["nintendo"] },
  );
  for (const text of ["GG無綁/已綁", "GG無綁/有綁", "GG可出/不可出", "GG可出/不能出", "GG可出/無法解"]) {
    assert.deepEqual(extractPartialBindings(text), { bindings: {}, conflicts: ["google"] }, text);
  }
  assert.deepEqual(
    extractPartialBindings("帳號無綁｜GG可出"),
    { bindings: {}, conflicts: ["google"] },
  );
});

test("requires all four labeled resources and ignores item names", () => {
  const complete = extractResourceEvidence(
    "白蠟 1,000｜愛心 100｜昇華蠟 90｜副卡 2",
  );
  assert.deepEqual(complete.resources, {
    candles: 1000,
    hearts: 100,
    ascended: 90,
    passes: 2,
  });
  assert.equal(complete.complete, true);
  const partial = extractResourceEvidence("愛心眼鏡｜白蠟 30");
  assert.deepEqual(partial.resources, { candles: 30 });
  assert.equal(partial.complete, false);
  assert.deepEqual(
    extractResourceEvidence("白蠟 30｜白蠟 50").resources,
    {},
  );
});

test("accepts labeled suffixes and fullwidth numbers without inventing approximate counts", () => {
  assert.deepEqual(extractResourceEvidence("１，０００白蠟｜１００愛心｜９０昇華蠟｜２副卡").resources,
    { candles: 1000, hearts: 100, ascended: 90, passes: 2 });
  assert.deepEqual(extractResourceEvidence("白蠟 1000｜1000白蠟").resources, { candles: 1000 });
  assert.deepEqual(extractResourceEvidence("白蠟 1000｜2000白蠟").resources, {});
  for (const text of ["白蠟 1.5", "白蠟 100+", "白蠟 100-200", "白蠟 1,00", "1,00白蠟", "100愛心眼鏡", "1000𖠜｜100ෆ｜90✦"]) {
    assert.deepEqual(extractResourceEvidence(text).resources, {}, text);
  }
});

test("expands exact thousand and ten-thousand resource notation", () => {
  assert.deepEqual(extractResourceEvidence("１．５萬白蠟｜愛心 2千｜昇華蠟 0.0003万").resources,
    { candles: 15000, hearts: 2000, ascended: 3 });
  assert.deepEqual(extractResourceEvidence("白蠟 1.5萬｜15000白蠟").resources, { candles: 15000 });
  assert.deepEqual(extractResourceEvidence("白蠟 1.5萬｜14000白蠟").resources, {});
  for (const text of ["白蠟 約1.5萬", "白蠟 1.5萬以上", "白蠟 1.5萬+", "白蠟 1.5萬～2萬", "愛心 0.00001萬", "愛心 0.999999999999999999", "白蠟 101萬", "副卡 2千"]) {
    assert.deepEqual(extractResourceEvidence(text).resources, {}, text);
  }
});

test("retains bounded, lower-bound and approximate resources separately from exact inputs", () => {
  const evidence = extractResourceEvidence("約 1,000 白蠟｜愛心 100+｜20～30紅蠟｜副卡 2");
  assert.deepEqual(evidence.resources, { passes: 2 });
  assert.deepEqual(evidence.ranges, { hearts: { min: 100, max: null }, ascended: { min: 20, max: 30 } });
  assert.deepEqual(evidence.approximations, { candles: 1000 });
  assert.equal(evidence.complete, false);
  assert.deepEqual(extractResourceEvidence("白蠟 1.5萬～2萬｜愛心 100以下").ranges,
    { candles: { min: 15000, max: 20000 }, hearts: { min: 0, max: 100 } });
  assert.deepEqual(extractResourceEvidence("白蠟 1000左右").approximations, { candles: 1000 });
  assert.deepEqual(extractResourceEvidence("1000白蠟 左右").approximations, { candles: 1000 });
  assert.deepEqual(extractResourceEvidence("1000白蠟以上").ranges, { candles: { min: 1000, max: null } });
  assert.deepEqual(extractResourceEvidence("1000白蠟 多禮").resources, { candles: 1000 });
  assert.deepEqual(extractResourceEvidence("1000+白蠟｜白蠟1000+").ranges, { candles: { min: 1000, max: null } });
  for (const text of ["約 100白蠟", "目前約 100白蠟", "不到 100白蠟", "不是 100白蠟", "100白蠟 左右", "100- 200白蠟", "白蠟100｜白蠟約200", "白蠟100｜白蠟100+", "白蠟200-100", "1,00白蠟", "白蠟約1萬+", "100白蠟多"]) {
    assert.deepEqual(extractResourceEvidence(text).resources, {}, text);
  }
  assert.deepEqual(extractResourceEvidence("白蠟 10萬～101萬").ranges, {});
});

test("does not truncate incomplete ranges or detach explicit negation", () => {
  for (const text of ["白蠟 100 至 約200", "白蠟 100 -", "白蠟 100 – 200", "白蠟 100 — 200", "100 – 200白蠟"]) {
    const result = extractResourceEvidence(`${text}｜愛心20｜紅蠟30｜副卡1`);
    assert.equal(result.resources.candles, undefined, text);
    assert.equal(result.complete, false, text);
    assert.deepEqual(result.resources, { hearts: 20, ascended: 30, passes: 1 });
  }
  const negated = extractResourceEvidence("沒有 100白蠟｜没有 20愛心｜沒有 30紅蠟｜沒有 1副卡");
  assert.deepEqual(negated.resources, {});
  assert.equal(negated.complete, false);
});
