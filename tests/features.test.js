import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFeatureSettings,
  FEATURES,
} from "../src/config/features.js";

test("reward module is disabled for the current product iteration", () => {
  assert.equal(FEATURES.rewards, false);
  assert.equal(FEATURES.pets, true);
});

test("parent settings can enable and pause rewards at runtime", () => {
  applyFeatureSettings({ rewardsEnabled: true });
  assert.equal(FEATURES.rewards, true);
  applyFeatureSettings({ rewardsEnabled: false });
  assert.equal(FEATURES.rewards, false);
});
