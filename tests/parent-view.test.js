import test from "node:test";
import assert from "node:assert/strict";
import {
  parentView,
  rewardProductFieldsHtml,
} from "../src/views/parent.js";
import { DEFAULT_PRODUCTS } from "../src/services/reward-rules.js";

test("parent reward editor exposes editable custom reward fields", () => {
  const html = rewardProductFieldsHtml({
    id: "custom_movie",
    title: "周末选一部电影",
    description: "全家一起看",
    kind: "privilege",
    period: "week",
    minuteValue: 0,
    cost: 15,
    limit: 1,
  });
  assert.match(html, /data-product-title/);
  assert.match(html, /周末选一部电影/);
  assert.match(html, /data-product-description/);
  assert.match(html, /data-product-kind/);
  assert.match(html, /data-product-period/);
  assert.match(html, /data-action="remove-reward-product"/);
  assert.match(html, /is-privilege/);
});

test("family agreement remains editable while rewards are paused", () => {
  const html = parentView({
    settings: {
      rewardsEnabled: false,
      themeId: "breeze",
      reminderEnabled: true,
      reminderLeadMinutes: 0,
      baseGameMinutes: 30,
      completionReward: 10,
      reflectionReward: 2,
      dailyRewardCap: 60,
      dailyGameLimit: 60,
      products: DEFAULT_PRODUCTS,
    },
    redemptions: [],
    reflections: [],
  });
  assert.match(html, /奖励暂停中，设置会保留/);
  assert.match(html, /添加奖励/);
  assert.match(html, /parent-settings-form/);
});
