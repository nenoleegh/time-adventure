export const DEFAULT_PRODUCTS = [
  {
    id: "game_15",
    title: "15 分钟游戏券",
    description: "完成后再兑换，不和基础游戏时间混在一起。",
    cost: 20,
    minuteValue: 15,
    limit: 2,
    period: "day",
    kind: "game",
  },
  {
    id: "game_30",
    title: "30 分钟游戏券",
    description: "适合周末或阶段目标。",
    cost: 40,
    minuteValue: 30,
    limit: 1,
    period: "day",
    kind: "game",
  },
  {
    id: "family_choice",
    title: "周末活动选择权",
    description: "和家人一起选电影、桌游或户外活动。",
    cost: 30,
    minuteValue: 0,
    limit: 1,
    period: "week",
    kind: "privilege",
  },
];

export const DEFAULT_SETTINGS = {
  id: "family",
  themeId: "breeze",
  rewardsEnabled: false,
  reminderEnabled: true,
  reminderLeadMinutes: 0,
  baseGameMinutes: 30,
  completionReward: 10,
  reflectionReward: 2,
  dailyRewardCap: 60,
  dailyGameLimit: 60,
  products: DEFAULT_PRODUCTS,
  pinHash: null,
  pinSalt: null,
  createdAt: null,
  updatedAt: null,
};

export const REDEMPTION_STATUSES = {
  pending: "等家长确认",
  approved: "已批准，未兑现",
  redeemed: "已兑现",
  rejected: "未通过",
  cancelled: "已取消",
};

export function validateRewardSettings(settings) {
  const errors = [];
  if (!Number.isInteger(settings.baseGameMinutes) || settings.baseGameMinutes < 0) {
    errors.push("基础游戏时间需要是大于等于 0 的整数。");
  }
  if (!Number.isInteger(settings.completionReward) || settings.completionReward < 1) {
    errors.push("任务奖励至少为 1 星能。");
  }
  if (!Number.isInteger(settings.reflectionReward) || settings.reflectionReward < 0) {
    errors.push("复盘奖励不能为负数。");
  }
  if (!Number.isInteger(settings.dailyRewardCap) || settings.dailyRewardCap < 1) {
    errors.push("每日奖励上限至少为 1 星能。");
  }
  if (
    settings.dailyGameLimit !== undefined &&
    (!Number.isInteger(settings.dailyGameLimit) || settings.dailyGameLimit < 0)
  ) {
    errors.push("额外游戏时间上限需要是大于等于 0 的整数。");
  }
  const productIds = new Set();
  for (const product of settings.products) {
    if (!product.id || productIds.has(product.id)) errors.push("奖励商品编号不能重复。");
    productIds.add(product.id);
    if (!product.title?.trim()) errors.push("奖励商品需要有名称。");
    if (!["game", "privilege"].includes(product.kind)) {
      errors.push("奖励类型需要是游戏时间或家庭特权。");
    }
    if (!["day", "week"].includes(product.period)) {
      errors.push("奖励兑换周期需要是每天或每周。");
    }
    if (
      product.kind === "game" &&
      (!Number.isInteger(product.minuteValue) ||
        product.minuteValue < 1 ||
        product.minuteValue > 240)
    ) {
      errors.push("游戏时间奖励需要设置 1 至 240 分钟的时长。");
    }
    if (product.kind === "privilege" && Number(product.minuteValue) !== 0) {
      errors.push("家庭特权奖励的游戏时长需要为 0。");
    }
    if (!Number.isInteger(product.cost) || product.cost < 1) errors.push("兑换价格需要是正整数。");
    if (!Number.isInteger(product.limit) || product.limit < 1) errors.push("兑换上限需要是正整数。");
  }
  return [...new Set(errors)];
}

export function countRedemptionsInPeriod(redemptions, productId, period, periodValue) {
  return redemptions.filter((item) => {
    if (item.productId !== productId) return false;
    if (["rejected", "cancelled"].includes(item.status)) return false;
    return period === "week" ? item.weekKey === periodValue : item.date === periodValue;
  }).length;
}

export function rewardBudgetUsed(entries, day) {
  return entries
    .filter(
      (entry) =>
        entry.date === day &&
        entry.amount > 0 &&
        entry.type !== "refund" &&
        entry.type !== "adjustment",
    )
    .reduce((total, entry) => total + entry.amount, 0);
}

export function validateRedemption({
  product,
  redemptions,
  entries,
  settings,
  day,
  week,
  requestedCost = product?.cost,
}) {
  if (!product) return { ok: false, reason: "没有找到这个奖励。" };
  const periodValue = product.period === "week" ? week : day;
  const used = countRedemptionsInPeriod(redemptions, product.id, product.period, periodValue);
  if (used >= product.limit) {
    return {
      ok: false,
      reason: product.period === "week" ? "这周这个奖励已经用完了。" : "今天这个奖励已经用完了。",
    };
  }
  if (requestedCost !== product.cost && requestedCost > 0) {
    return { ok: false, reason: "兑换价格已经变化，请刷新后再试。" };
  }
  const balance = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  if (balance < requestedCost) {
    return { ok: false, reason: `还差 ${requestedCost - balance} 星能。可以先完成下一件事。` };
  }
  const dailyGameLimit = Number(settings?.dailyGameLimit);
  if (Number.isFinite(dailyGameLimit) && dailyGameLimit >= 0) {
    const todayGameMinutes = redemptions
      .filter(
        (item) =>
          item.date === day &&
          item.kind === "game" &&
          !["rejected", "cancelled"].includes(item.status),
      )
      .reduce((sum, item) => sum + Number(item.minuteValue || 0), 0);
    if (todayGameMinutes + product.minuteValue > dailyGameLimit) {
      return { ok: false, reason: "今天的额外游戏时间已经达到家庭约定上限。" };
    }
  }
  return { ok: true, reason: "" };
}
