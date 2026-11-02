import { getAll, getRecord, putRecord } from "./db.js?v=1.13.11";
import { makeId } from "../utils/id.js";
import { dateKey, weekKey } from "../utils/date.js";
import { getSettings } from "./settings-service.js?v=1.13.11";
import { getLedger, addLedgerEntry } from "./ledger-service.js?v=1.13.11";
import { refundKey, spendKey } from "./ledger-rules.js";
import { validateRedemption } from "./reward-rules.js?v=1.13.11";
import { FEATURES } from "../config/features.js?v=1.13.11";

async function allRedemptions() {
  const items = await getAll("redemptions");
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRedemptions() {
  return allRedemptions();
}

export async function requestRedemption(productId) {
  if (!FEATURES.rewards) throw new Error("奖励模块暂未启用。");
  const settings = await getSettings();
  const product = settings.products.find((item) => item.id === productId);
  const redemptions = await allRedemptions();
  const entries = await getLedger();
  const day = dateKey();
  const week = weekKey(day);
  const validation = validateRedemption({
    product,
    redemptions,
    entries,
    settings,
    day,
    week,
  });
  if (!validation.ok) throw new Error(validation.reason);
  const now = new Date().toISOString();
  const redemption = {
    id: makeId("redeem"),
    productId: product.id,
    title: product.title,
    cost: product.cost,
    minuteValue: product.minuteValue,
    kind: product.kind,
    date: day,
    weekKey: week,
    createdAt: now,
    status: "pending",
    approvedAt: null,
    redeemedAt: null,
    rejectedAt: null,
    rejectReason: "",
  };
  await putRecord("redemptions", redemption);
  try {
    await addLedgerEntry({
      amount: -product.cost,
      type: "spend",
      reason: `申请：${product.title}`,
      date: day,
      redemptionId: redemption.id,
      idempotencyKey: spendKey(redemption.id),
    });
  } catch (error) {
    await putRecord("redemptions", { ...redemption, status: "cancelled" });
    throw error;
  }
  return redemption;
}

async function transition(id, allowedStatuses, changes) {
  const redemption = await getRecord("redemptions", id);
  if (!redemption) throw new Error("没有找到这张兑换申请。");
  if (!allowedStatuses.includes(redemption.status)) {
    throw new Error("这张兑换申请的状态已经变化，请刷新后再试。");
  }
  const saved = { ...redemption, ...changes };
  await putRecord("redemptions", saved);
  return saved;
}

export async function approveRedemption(id) {
  if (!FEATURES.rewards) throw new Error("奖励模块暂未启用。");
  return transition(id, ["pending"], {
    status: "approved",
    approvedAt: new Date().toISOString(),
  });
}

export async function rejectRedemption(id, reason) {
  if (!FEATURES.rewards) throw new Error("奖励模块暂未启用。");
  if (!reason?.trim()) throw new Error("请填写不通过的具体原因。");
  const redemption = await getRecord("redemptions", id);
  if (!redemption) throw new Error("没有找到这张兑换申请。");
  if (redemption.status !== "pending") {
    throw new Error("这张兑换申请的状态已经变化，请刷新后再试。");
  }
  await addLedgerEntry({
    amount: redemption.cost,
    type: "refund",
    reason: `退回：${redemption.title}`,
    date: dateKey(),
    redemptionId: redemption.id,
    idempotencyKey: refundKey(redemption.id),
  });
  return transition(id, ["pending"], {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    rejectReason: reason.trim(),
  });
}

export async function markRedeemed(id) {
  if (!FEATURES.rewards) throw new Error("奖励模块暂未启用。");
  return transition(id, ["approved"], {
    status: "redeemed",
    redeemedAt: new Date().toISOString(),
  });
}

export async function cancelRedemption(id) {
  if (!FEATURES.rewards) throw new Error("奖励模块暂未启用。");
  const redemption = await getRecord("redemptions", id);
  if (!redemption) throw new Error("没有找到这张兑换申请。");
  if (redemption.status !== "pending") {
    throw new Error("这张兑换申请的状态已经变化，请刷新后再试。");
  }
  await addLedgerEntry({
    amount: redemption.cost,
    type: "refund",
    reason: `取消退回：${redemption.title}`,
    date: dateKey(),
    redemptionId: redemption.id,
    idempotencyKey: refundKey(redemption.id),
  });
  return transition(id, ["pending"], {
    status: "cancelled",
    rejectedAt: new Date().toISOString(),
    rejectReason: "由孩子取消申请",
  });
}
