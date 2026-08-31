import assert from "node:assert/strict";
import test from "node:test";
import { calculateValuationModel } from "../app/valuation-model-core.js";

const base = {
  baseLow: 10000,
  baseHigh: 20000,
  breakMultiplier: 0.9,
  partialDiscountLow: 500,
  partialDiscountHigh: 1000,
  packageLow: 300,
  packageHigh: 600,
  limitedLow: 200,
  limitedHigh: 400,
  resourceLow: 100,
  resourceHigh: 200,
  accountStyleMultiplier: 0.9,
  bindingRisk: 0.9,
  transferHighMultiplier: 1.03,
  confidence: "low",
};

test("full valuation core is deterministic and keeps its rounded range ordered", () => {
  const first = calculateValuationModel(base);
  assert.deepEqual(calculateValuationModel({ ...base }), first);
  assert.ok(first.low >= 300);
  assert.ok(first.low <= first.midpoint && first.midpoint <= first.high);
});

test("binding risk is applied after the same transfer-aware market summary", () => {
  const transferable = calculateValuationModel({ ...base, bindingRisk: 1 });
  const restricted = calculateValuationModel(base);
  assert.ok(restricted.midpoint < transferable.midpoint);
  assert.ok(restricted.high < transferable.high);
});
