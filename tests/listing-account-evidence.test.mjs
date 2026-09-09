import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCompleteBindings,
  extractResourceEvidence,
} from "../scripts/lib/listing-account-evidence.mjs";

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
