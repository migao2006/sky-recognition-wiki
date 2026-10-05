import assert from "node:assert/strict";
import test from "node:test";
import { facebookPostHash } from "../scripts/lib/facebook-market-csv.mjs";

test("Facebook post hashes are stable and do not expose the source id", () => {
  const value = facebookPostHash("1434339381961150");
  assert.equal(value, facebookPostHash("1434339381961150"));
  assert.equal(value.length, 64);
  assert.ok(!value.includes("1434339381961150"));
});
