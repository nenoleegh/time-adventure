import test from "node:test";
import assert from "node:assert/strict";
import {
  parentView,
  REWARD_PRODUCT_TEMPLATES,
  rewardProductFieldsHtml,
} from "../src/views/parent.js";
import {
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  validateRewardSettings,
} from "../src/services/reward-rules.js";

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

test("reward templates cover common family rewards and prefill editable fields", () => {
  assert.deepEqual(
    REWARD_PRODUCT_TEMPLATES.map((template) => template.key),
    ["game", "tv", "sport", "shopping"],
  );
  const html = parentView({
    settings: {
      rewardsEnabled: true,
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
  for (const template of REWARD_PRODUCT_TEMPLATES) {
    assert.match(html, new RegExp(`data-template="${template.key}"`));
  }
  assert.match(html, /data-action="add-reward-template"/);
  assert.ok(html.indexOf("approval-panel") < html.indexOf("rules-panel"));
  assert.ok(html.indexOf("rules-panel") < html.indexOf("reminder-panel"));
  assert.ok(html.indexOf("reminder-panel") < html.indexOf("theme-panel"));
  assert.ok(html.indexOf("theme-panel") < html.indexOf("shared-panel"));
  assert.ok(html.indexOf("shared-panel") < html.indexOf("data-panel"));
  const templatedProducts = REWARD_PRODUCT_TEMPLATES.map((template, index) => ({
    ...template,
    id: `template_${index}`,
  }));
  assert.equal(
    validateRewardSettings({ ...DEFAULT_SETTINGS, products: templatedProducts }).length,
    0,
  );
  const tvFields = rewardProductFieldsHtml(templatedProducts[1]);
  assert.match(tvFields, /30 分钟电视时间/);
  assert.match(tvFields, /家庭特权/);
  assert.match(tvFields, /is-privilege/);
});
