export const LEDGER_LABELS = {
  reward: "任务奖励",
  spend: "兑换消费",
  refund: "兑换退回",
  adjustment: "账目修正",
};

export function ledgerBalance(entries) {
  return entries.reduce((total, entry) => total + Number(entry.amount || 0), 0);
}

export function hasEntry(entries, idempotencyKey) {
  return entries.some((entry) => entry.idempotencyKey === idempotencyKey);
}

export function rewardKey(taskId) {
  return `task:${taskId}:completion`;
}

export function reflectionKey(day) {
  return `reflection:${day}:awarded`;
}

export function spendKey(redemptionId) {
  return `redemption:${redemptionId}:spend`;
}

export function refundKey(redemptionId) {
  return `redemption:${redemptionId}:refund`;
}
