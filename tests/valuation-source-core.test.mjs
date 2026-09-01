import assert from "node:assert/strict";
import test from "node:test";
import {
  breakClassFor,
  packageTierFor,
} from "../scripts/lib/valuation-source-core.mjs";

test("classifies normalized break fields consistently for audit and validation", () => {
  assert.equal(breakClassFor({ computed_break_class: "big" }), "big");
  assert.equal(
    breakClassFor({ missing_season_count: 0, completion_ratio: 1 }),
    "none",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 2, completion_ratio: 0.8 }),
    "slight",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 5, completion_ratio: 0.4 }),
    "medium",
  );
  assert.equal(
    breakClassFor({ missing_season_count: 6, completion_ratio: 0.4 }),
    "big",
  );
  assert.equal(
    breakClassFor({ missing_season_count: "unknown", completion_ratio: 1 }),
    null,
  );
  assert.equal(breakClassFor({ seller_break_label: "微斷" }), null);
});

test("classifies normalized paid-package counts consistently for audit and validation", () => {
  assert.equal(packageTierFor({ computed_package_tier: "many" }), "many");
  assert.equal(packageTierFor({ paid_package_count: 14 }), "few");
  assert.equal(packageTierFor({ paid_package_count: 15 }), "medium");
  assert.equal(packageTierFor({ paid_package_count: 40 }), "many");
  assert.equal(packageTierFor({ paid_package_count: 100 }), "hundred");
  assert.equal(packageTierFor({ paid_package_count: -1 }), null);
});
