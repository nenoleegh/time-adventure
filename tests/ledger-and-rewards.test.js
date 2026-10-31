import test from "node:test";
import assert from "node:assert/strict";
import {
  hasEntry,
  ledgerBalance,
  refundKey,
  rewardKey,
} from "../src/services/ledger-rules.js";
import {
  countRedemptionsInPeriod,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS,
  rewardBudgetUsed,
  validateRedemption,
  validateRewardSettings,
} from "../src/services/reward-rules.js";

test("ledger balance is calculated from append-only entries", () => {
  const entries = [{ amount: 10 }, { amount: -20 }, { amount: 20 }, { amount: 2 }];
  assert.equal(ledgerBalance(entries), 12);
});

test("idempotency key prevents duplicate rewards", () => {
  const entries = [{ idempotencyKey: rewardKey("task-1"), amount: 10 }];
  assert.equal(hasEntry(entries, rewardKey("task-1")), true);
  assert.equal(hasEntry(entries, rewardKey("task-2")), false);
  assert.equal(refundKey("r-1"), "redemption:r-1:refund");
});

test("reward budget counts earnings but not refunds or corrections", () => {
  const day = "2026-10-24";
  const used = rewardBudgetUsed(
    [
      { amount: 10, type: "reward", date: day },
      { amount: 2, type: "reward", date: day },
      { amount: 20, type: "refund", date: day },
      { amount: 5, type: "adjustment", date: day },
      { amount: 10, type: "reward", date: "2026-10-23" },
    ],
    day,
  );
  assert.equal(used, 12);
});

test("redemption limit ignores rejected and cancelled requests", () => {
  const items = [
    { productId: "game_15", date: "2026-10-24", status: "approved" },
    { productId: "game_15", date: "2026-10-24", status: "rejected" },
    { productId: "game_15", date: "2026-10-24", status: "cancelled" },
    { productId: "game_15", date: "2026-10-23", status: "pending" },
  ];
  assert.equal(countRedemptionsInPeriod(items, "game_15", "day", "2026-10-24"), 1);
});

test("redemption validates balance and daily limits", () => {
  const product = DEFAULT_PRODUCTS[0];
  const base = {
    product,
    redemptions: [],
    entries: [{ amount: 40 }],
    settings: { ...DEFAULT_SETTINGS, products: DEFAULT_PRODUCTS, dailyGameLimit: 60 },
    day: "2026-10-24",
    week: "2026-10-19",
  };
  assert.equal(validateRedemption(base).ok, true);
  assert.equal(
    validateRedemption({ ...base, entries: [{ amount: 5 }] }).ok,
    false,
  );
  assert.equal(
    validateRedemption({
      ...base,
      redemptions: [
        { productId: "game_15", date: base.day, status: "pending" },
        { productId: "game_15", date: base.day, status: "approved" },
      ],
    }).ok,
    false,
  );
});

test("daily extra-game cap protects the agreed boundary", () => {
  const product = DEFAULT_PRODUCTS[0];
  const result = validateRedemption({
    product,
    redemptions: [
      {
        productId: "game_30",
        date: "2026-10-24",
        status: "approved",
        kind: "game",
        minuteValue: 30,
      },
    ],
    entries: [{ amount: 80 }],
    settings: { ...DEFAULT_SETTINGS, dailyGameLimit: 30 },
    day: "2026-10-24",
    week: "2026-10-19",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /上限/);
});

test("a zero daily game limit blocks game rewards but not privileges", () => {
  const game = DEFAULT_PRODUCTS[0];
  const privilege = DEFAULT_PRODUCTS.find((product) => product.kind === "privilege");
  const base = {
    redemptions: [],
    entries: [{ amount: 100 }],
    settings: { ...DEFAULT_SETTINGS, dailyGameLimit: 0 },
    day: "2026-10-24",
    week: "2026-10-19",
  };
  assert.equal(validateRedemption({ ...base, product: game }).ok, false);
  assert.equal(validateRedemption({ ...base, product: privilege }).ok, true);
});

test("settings validation rejects invalid values", () => {
  const errors = validateRewardSettings({
    baseGameMinutes: -1,
    completionReward: 0,
    reflectionReward: -1,
    dailyRewardCap: 0,
    products: DEFAULT_PRODUCTS,
  });
  assert.ok(errors.length >= 4);
});
