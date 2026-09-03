import assert from "node:assert/strict";
import test from "node:test";
import { shouldIdlePreload } from "../app/idle-preload.ts";

test("preloads heavy steps only on unconstrained connections", () => {
  assert.equal(shouldIdlePreload(), true);
  assert.equal(shouldIdlePreload({ effectiveType: "4g" }), true);
  assert.equal(shouldIdlePreload({ effectiveType: "3g" }), false);
  assert.equal(shouldIdlePreload({ effectiveType: "2g" }), false);
  assert.equal(shouldIdlePreload({ effectiveType: "slow-2g" }), false);
  assert.equal(
    shouldIdlePreload({ effectiveType: "4g", saveData: true }),
    false,
  );
});
