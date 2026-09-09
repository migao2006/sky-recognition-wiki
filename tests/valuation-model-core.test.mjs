import assert from "node:assert/strict";
import test from "node:test";
import { bindingRiskForCounts, calculateValuationModel } from "../app/valuation-model-core.js";

test("reducing any of seven binding restrictions never lowers risk or estimated prices", () => {
  for (let issues = 0; issues <= 7; issues++) {
    for (let keeps = 0; keeps <= 7 - issues; keeps++) {
      const risk = bindingRiskForCounts(issues, keeps);
      assert.ok(risk >= 0.7 && risk <= 1);
      const before = calculateValuationModel({ ...base, bindingRisk: risk });
      const improvements = [];
      if (issues) improvements.push([issues - 1, keeps + 1], [issues - 1, keeps]);
      if (keeps) improvements.push([issues, keeps - 1]);
      for (const [nextIssues, nextKeeps] of improvements) {
        const nextRisk = bindingRiskForCounts(nextIssues, nextKeeps);
        assert.ok(nextRisk >= risk);
        const after = calculateValuationModel({ ...base, bindingRisk: nextRisk });
        for (const key of ["low", "midpoint", "high"]) assert.ok(after[key] >= before[key]);
      }
    }
  }
  assert.equal(bindingRiskForCounts(4, 0), bindingRiskForCounts(3, 1));
});

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

test("narrow low-price bands contain their midpoint before and after binding adjustments", () => {
  for (let low = 300; low <= 3000; low += 100) {
    for (let width = 0; width <= 500; width += 100) {
      for (const confidence of ["high", "medium", "low", "inferred"]) {
        for (const bindingRisk of [1, 0.96, 0.7]) {
          const result = calculateValuationModel({ baseLow: low, baseHigh: low + width, confidence, bindingRisk });
          assert.ok(result.low <= result.midpoint && result.midpoint <= result.high, JSON.stringify({ low, width, confidence, bindingRisk, result }));
        }
      }
    }
  }
  assert.deepEqual(calculateValuationModel({ baseLow: 300, baseHigh: 300 }), { low: 300, high: 300, midpoint: 300 });
  assert.deepEqual(calculateValuationModel({ baseLow: 700, baseHigh: 700 }), { low: 700, high: 700, midpoint: 700 });
});
