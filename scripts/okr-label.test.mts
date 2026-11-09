// Run: node --test scripts/okr-label.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isKrLabel, krFromLabels } from "../lib/okr/label.ts";

test("reads a KR id from labels, ignoring other labels", () => {
  assert.deepEqual(krFromLabels(["brand-hub", "kr-0a1b2c3d", "brand-review"]), { krId: "kr-0a1b2c3d" });
});
test("kr-none counts as tagged", () => {
  assert.deepEqual(krFromLabels(["kr-none"]), { none: true });
});
test("a real KR wins over kr-none", () => {
  assert.deepEqual(krFromLabels(["kr-none", "kr-0a1b2c3d"]), { krId: "kr-0a1b2c3d" });
});
test("untagged and look-alikes are not tags", () => {
  assert.deepEqual(krFromLabels(undefined), {});
  assert.deepEqual(krFromLabels(["kr-xyz", "kr-0a1b2c3", "krm-0a1b2c3d"]), {});
  assert.equal(isKrLabel("kr-nope"), false);
});
test("matching is case-insensitive", () => {
  assert.deepEqual(krFromLabels(["KR-0A1B2C3D"]), { krId: "kr-0a1b2c3d" });
});
