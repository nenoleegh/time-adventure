import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  THEME_OPTIONS,
} from "../src/config/themes.js";

test("theme catalog has unique lively options", () => {
  assert.equal(THEME_OPTIONS.length, 6);
  assert.equal(new Set(THEME_OPTIONS.map((theme) => theme.id)).size, 6);
  assert.equal(DEFAULT_THEME_ID, "breeze");
  assert.ok(THEME_OPTIONS.some((theme) => theme.id === "starlight"));
  assert.ok(THEME_OPTIONS.some((theme) => theme.id === "pixel"));
  assert.ok(THEME_OPTIONS.every((theme) => theme.tag && theme.colors.length === 3));
  const berry = THEME_OPTIONS.find((theme) => theme.id === "berry");
  const pixel = THEME_OPTIONS.find((theme) => theme.id === "pixel");
  const breeze = THEME_OPTIONS.find((theme) => theme.id === "breeze");
  const forest = THEME_OPTIONS.find((theme) => theme.id === "forest");
  assert.notDeepEqual(berry.colors, pixel.colors);
  assert.notDeepEqual(breeze.colors, forest.colors);
  assert.equal(forest.tag, "手帐");
  assert.equal(pixel.tag, "方块");
});

test("unknown saved themes fall back safely", () => {
  assert.equal(normalizeThemeId("berry"), "berry");
  assert.equal(normalizeThemeId("missing-theme"), "breeze");
});
