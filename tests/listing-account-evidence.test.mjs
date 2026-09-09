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
