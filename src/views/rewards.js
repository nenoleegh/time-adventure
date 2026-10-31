import { formatShortDate } from "../utils/date.js";
import { LEDGER_LABELS } from "../services/ledger-rules.js";
import { countRedemptionsInPeriod, REDEMPTION_STATUSES } from "../services/reward-rules.js";
import { escapeHtml, icon } from "../ui/html.js";

function productCard(product, state) {
  const used = countRedemptionsInPeriod(
    state.redemptions,
    product.id,
    product.period,
    product.period === "week" ? state.week : state.today,
  );
  const limited = used >= product.limit;
  const unaffordable = state.balance < product.cost;
  const disabled = limited || unaffordable;
  return `
    <article class="reward-card ${product.kind}">
      <div class="reward-symbol">${icon(product.kind === "game" ? "clock" : "people")}</div>
      <div class="reward-copy">
        <div class="reward-header">
          <h3>${escapeHtml(product.title)}</h3>
          <span class="cost">${icon("spark")}${product.cost}</span>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <div class="reward-limit">${product.period === "week" ? "每周" : "每日"}最多 ${product.limit} 次 · 已用 ${used} 次</div>
      </div>
      <button class="button ${disabled ? "outline" : "primary"}" data-action="request-redemption" data-id="${product.id}" ${disabled ? "disabled" : ""}>
        ${limited ? "本期已用完" : unaffordable ? `还差 ${product.cost - state.balance} 星能` : "申请兑换"}
      </button>
    </article>`;
}

function redemptionRow(item, state) {
  return `
    <article class="redemption-row">
      <div class="redeem-date">${formatShortDate(item.date)}</div>
      <div class="redeem-info">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${REDEMPTION_STATUSES[item.status] || escapeHtml(item.status)} · ${item.cost} 星能</p>
        ${item.rejectReason ? `<small>说明：${escapeHtml(item.rejectReason)}</small>` : ""}
      </div>
      ${item.status === "pending" ? `<button class="text-button" data-action="cancel-redemption" data-id="${item.id}">取消申请</button>` : ""}
      ${item.status === "approved" ? `<span class="awaiting">等家长手动兑现</span>` : ""}
    </article>`;
}

export function rewardsView(state) {
  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">星能与奖励</span>
        <h1>把完成感，换成一次选择</h1>
        <p>基础游戏时间是自己的时间，不需要赚。额外时间才使用星能，规则提前约好。</p>
      </div>
      <button class="parent-entry" data-action="open-parent">${icon("lock")}家长入口</button>
    </div>

    <section class="balance-hero">
      <div>
        <span class="eyebrow light">现在可用</span>
        <strong>${state.balance}</strong>
        <span class="balance-unit">星能</span>
      </div>
      <div class="balance-context">
        <span>${icon("tablet")}基础游戏时间保留 ${state.settings.baseGameMinutes} 分钟</span>
        <span>${icon("shield")}兑换由家长确认，App 只负责记录</span>
      </div>
    </section>

    <div class="reward-layout">
      <div>
        <section class="section-block">
          <div class="section-title">
            <div><span class="eyebrow">奖励清单</span><h2>想换什么，由你决定</h2></div>
          </div>
          <div class="reward-grid">${state.settings.products.map((product) => productCard(product, state)).join("")}</div>
        </section>
        <section class="section-block">
          <div class="section-title">
            <div><span class="eyebrow">兑换记录</span><h2>每一步都有清楚状态</h2></div>
          </div>
          <div class="redemption-list">
            ${state.redemptions.length ? state.redemptions.slice(0, 12).map((item) => redemptionRow(item, state)).join("") : `<div class="empty-inline">还没有兑换申请。先完成下一件小事。</div>`}
          </div>
        </section>
      </div>
      <aside class="ledger-panel">
        <div class="section-title">
          <div><span class="eyebrow">透明账本</span><h2>星能怎么来，怎么用</h2></div>
        </div>
        <div class="ledger-list">
          ${state.ledger.length ? state.ledger.slice(0, 15).map((entry) => `
            <div class="ledger-row">
              <div class="ledger-dot ${entry.amount > 0 ? "in" : "out"}"></div>
              <div><strong>${escapeHtml(entry.reason)}</strong><span>${formatShortDate(entry.date)} · ${LEDGER_LABELS[entry.type] || "记录"}</span></div>
              <b class="${entry.amount > 0 ? "positive" : "negative"}">${entry.amount > 0 ? "+" : ""}${entry.amount}</b>
            </div>`).join("") : `<div class="empty-inline">完成第一项任务后，这里会出现一条奖励记录。</div>`}
        </div>
        <p class="fine-print">已经获得的星能不会因为后来没完成任务而被扣掉。家长调整规则只影响之后的行为。</p>
      </aside>
    </div>`;
}
