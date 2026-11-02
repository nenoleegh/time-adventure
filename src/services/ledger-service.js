import { getAll, putRecord } from "./db.js?v=1.13.11";
import { makeId } from "../utils/id.js";
import {
  hasEntry,
  ledgerBalance,
  reflectionKey,
  rewardKey,
} from "./ledger-rules.js";
import { getSettings } from "./settings-service.js?v=1.13.11";
import { rewardBudgetUsed } from "./reward-rules.js?v=1.13.11";
import { FEATURES } from "../config/features.js?v=1.13.11";

export async function getLedger() {
  const entries = await getAll("ledger");
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBalance() {
  return ledgerBalance(await getLedger());
}

export async function addLedgerEntry(record) {
  const entries = await getLedger();
  if (record.idempotencyKey && hasEntry(entries, record.idempotencyKey)) {
    return { added: false, entry: entries.find((item) => item.idempotencyKey === record.idempotencyKey) };
  }
  const entry = {
    id: makeId("ledger"),
    createdAt: new Date().toISOString(),
    ...record,
  };
  await putRecord("ledger", entry);
  return { added: true, entry };
}

export async function awardTask(task) {
  if (!FEATURES.rewards) return { added: false, amount: 0, disabled: true };
  const entries = await getLedger();
  const key = rewardKey(task.id);
  if (hasEntry(entries, key)) return { added: false, amount: 0, capped: false };
  const settings = await getSettings();
  const alreadyRewarded = rewardBudgetUsed(entries, task.date);
  const remaining = Math.max(0, settings.dailyRewardCap - alreadyRewarded);
  if (remaining === 0) return { added: false, amount: 0, capped: true };
  const amount = Math.min(settings.completionReward, remaining);
  await addLedgerEntry({
    amount,
    type: "reward",
    reason: `完成：${task.title}`,
    date: task.date,
    taskId: task.id,
    idempotencyKey: key,
    capped: amount < settings.completionReward,
  });
  return {
    added: true,
    amount,
    capped: amount < settings.completionReward,
  };
}

export async function awardReflection(day) {
  if (!FEATURES.rewards) return { added: false, amount: 0, disabled: true };
  const entries = await getLedger();
  const key = reflectionKey(day);
  if (hasEntry(entries, key)) return { added: false, amount: 0 };
  const settings = await getSettings();
  if (settings.reflectionReward <= 0) return { added: false, amount: 0 };
  const alreadyRewarded = rewardBudgetUsed(entries, day);
  const remaining = Math.max(0, settings.dailyRewardCap - alreadyRewarded);
  if (remaining === 0) return { added: false, amount: 0, capped: true };
  const amount = Math.min(settings.reflectionReward, remaining);
  await addLedgerEntry({
    amount,
    type: "reward",
    reason: "完成晚间复盘",
    date: day,
    idempotencyKey: key,
    capped: amount < settings.reflectionReward,
  });
  return { added: true, amount, capped: amount < settings.reflectionReward };
}

export async function addManualAdjustment({ amount, date, reason }) {
  if (!Number.isInteger(amount) || amount === 0) throw new Error("调整值需要是非零整数。");
  if (!reason?.trim()) throw new Error("请填写调整原因。");
  return addLedgerEntry({
    amount,
    type: "adjustment",
    reason: reason.trim(),
    date,
    idempotencyKey: makeId("adjustment"),
  });
}
