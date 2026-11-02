import test from "node:test";
import assert from "node:assert/strict";
import { petView } from "../src/views/pet.js";
import { createEggProfile } from "../src/services/pet-rules.js";

function hatchedProfile(now) {
  return {
    ...createEggProfile(now),
    stage: "baby",
    name: "泡泡",
    eggTaps: 3,
    status: "healthy",
    hatchedAt: now.toISOString(),
    lastEffectiveCareAt: now.toISOString(),
    needsUpdatedAt: now.toISOString(),
  };
}

function petState(profile) {
  return {
    petProfile: profile,
    petCareLog: [],
    petAction: "",
    petIdleAction: "walk",
    petMessage: "",
  };
}

test("pet view enters a non-interactive sleeping state at night", () => {
  const profile = hatchedProfile(new Date(2026, 10, 1, 20, 0));
  const html = petView(petState(profile), new Date(2026, 10, 1, 22, 0));
  assert.match(html, /睡觉中/);
  assert.match(html, /pet-sleeping/);
  assert.match(html, /animations\/sleep\.png/);
  assert.match(html, /22:00–06:30/);
  assert.doesNotMatch(html, /data-action="pet-care"/);
});

test("pet view resumes care controls at 06:30", () => {
  const profile = hatchedProfile(new Date(2026, 10, 1, 20, 0));
  const html = petView(petState(profile), new Date(2026, 10, 2, 6, 30));
  assert.doesNotMatch(html, /睡觉中/);
  assert.doesNotMatch(html, /pet-sleeping/);
  assert.match(html, /data-action="pet-care"/);
});
