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
