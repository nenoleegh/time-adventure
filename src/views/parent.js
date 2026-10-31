import { formatDateCN } from "../utils/date.js";
import { REDEMPTION_STATUSES } from "../services/reward-rules.js?v=1.10.0";
import { escapeHtml, icon } from "../ui/html.js";
import { THEME_OPTIONS } from "../config/themes.js?v=1.10.0";

function requestActions(item) {
  if (item.status === "pending") {
    return `
      <div class="approval-actions">
        <button class="button primary small" data-action="approve-redemption" data-id="${item.id}">批准</button>
        <button class="button outline small" data-action="reject-redemption" data-id="${item.id}">说明原因</button>
      </div>`;
  }
  if (item.status === "approved") {
    return `<button class="button secondary small" data-action="mark-redeemed" data-id="${item.id}">记录已兑现</button>`;
  }
  return `<span class="request-state">${REDEMPTION_STATUSES[item.status]}</span>`;
}

function productFields(product) {
  return `
    <div class="product-setting" data-product-id="${product.id}">
      <div class="product-setting-name">${escapeHtml(product.title)}</div>
      <label><span>星能价格</span><input name="product-cost-${product.id}" type="number" min="1" step="1" data-product-cost="${product.id}" value="${product.cost}"></label>
      <label><span>${product.period === "week" ? "每周" : "每日"}上限</span><input name="product-limit-${product.id}" type="number" min="1" step="1" data-product-limit="${product.id}" value="${product.limit}"></label>
    </div>`;
}

export function parentView(state) {
  const rewardsEnabled = Boolean(state.settings.rewardsEnabled);
  const pending = state.redemptions.filter((item) => item.status === "pending");
  const approved = state.redemptions.filter((item) => item.status === "approved");
  const sharedReflections = state.reflections
    .filter((item) => item.visibility === "shared")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  return `
    <div class="page-heading parent-heading">
      <div>
        <button class="text-button back-button" data-route="${rewardsEnabled ? "rewards" : "today"}">${icon("back")}返回${rewardsEnabled ? "奖励" : "今天"}</button>
        <span class="eyebrow">家长协作区</span>
        <h1>${rewardsEnabled ? "一起约定边界，少做临时拉扯" : "查看隐私边界与备份"}</h1>
        <p>${rewardsEnabled ? "这里管理规则和兑换状态。" : "奖励模块当前暂停使用，历史账本数据仍然保留。"}家长默认看不到孩子设为私密的复盘。</p>
      </div>
      <button class="button outline" data-action="lock-parent">${icon("lock")}锁定</button>
    </div>

    <div class="parent-grid">
      <section class="reward-control-panel ${rewardsEnabled ? "enabled" : ""}">
        <div class="reward-control-icon">${icon("spark")}</div>
        <div class="reward-control-copy">
          <span class="eyebrow">奖励模块</span>
          <h2>${rewardsEnabled ? "奖励页面正在使用" : "奖励页面当前暂停"}</h2>
          <p>${rewardsEnabled
            ? "完成任务和复盘会按家庭约定积累星能，孩子可以从“奖励”页申请兑换。"
            : "主界面会隐藏奖励入口，也不会产生新的星能；已有账本和兑换历史不会删除。"}</p>
        </div>
        <button
          type="button"
          class="feature-switch"
          data-action="toggle-rewards"
          role="switch"
          aria-checked="${rewardsEnabled ? "true" : "false"}"
        >
          <span class="switch-track"><i></i></span>
          <strong>${rewardsEnabled ? "已开启" : "已关闭"}</strong>
        </button>
      </section>

      <section class="theme-panel">
        <div class="section-title">
          <div><span class="eyebrow">孩子的主界面外观</span><h2>选择一个喜欢的时间冒险主题</h2></div>
          <span class="rule-version">立即生效</span>
        </div>
        <div class="theme-choice-grid">
          ${THEME_OPTIONS.map((theme) => `
            <button
              type="button"
              class="theme-choice ${state.settings.themeId === theme.id ? "selected" : ""}"
              data-action="select-theme"
              data-theme="${theme.id}"
              aria-pressed="${state.settings.themeId === theme.id ? "true" : "false"}"
            >
              <span class="theme-preview theme-${theme.id}">
                ${theme.colors.map((color) => `<i style="--swatch:${color}"></i>`).join("")}
              </span>
              <span class="theme-choice-tag">${theme.tag}</span>
              <span class="theme-choice-copy"><strong>${escapeHtml(theme.name)}</strong><small>${escapeHtml(theme.description)}</small></span>
              ${state.settings.themeId === theme.id ? `<span class="theme-selected">${icon("check")}当前</span>` : ""}
            </button>`).join("")}
        </div>
      </section>

      <section class="reminder-panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">任务开始提醒</span>
            <h2>让时间和孩子同时看见下一步</h2>
          </div>
          <span class="rule-version">${state.settings.reminderEnabled ? "应用内提醒已开启" : "应用内提醒已关闭"}</span>
        </div>
        <form id="reminder-settings-form" class="reminder-settings-form">
          <label class="reminder-check">
            <input type="checkbox" name="reminderEnabled" ${state.settings.reminderEnabled ? "checked" : ""}>
            <span><strong>App 打开时播放提醒</strong><small>到点后显示任务卡片并播放轻提示音，同一开始时间只提醒一次。</small></span>
          </label>
          <label class="reminder-lead">
            <span>提前多久提醒</span>
            <select name="reminderLeadMinutes">
              ${[0, 5, 10, 15].map((minutes) => `
                <option value="${minutes}" ${Number(state.settings.reminderLeadMinutes) === minutes ? "selected" : ""}>${minutes === 0 ? "任务开始时" : `提前 ${minutes} 分钟`}</option>
              `).join("")}
            </select>
          </label>
          <button class="button primary" type="submit">${icon("check")}保存提醒设置</button>
        </form>
        <p class="reminder-boundary">${icon("tablet")}网页关闭后无法自行唤醒 iPad 闹钟。需要后台提醒时，请在任务卡上点“加入日历”，由 iPad 日历负责准时提醒。</p>
      </section>

      ${rewardsEnabled ? `<section class="approval-panel">
        <div class="section-title">
          <div><span class="eyebrow">待处理</span><h2>${pending.length + approved.length ? "需要你确认的兑换" : "目前没有待处理请求"}</h2></div>
          ${pending.length ? `<span class="count-badge">${pending.length} 个待审批</span>` : ""}
        </div>
        <div class="approval-list">
          ${[...pending, ...approved].length ? [...pending, ...approved].map((item) => `
            <article class="approval-row">
              <div class="approval-icon">${icon(item.kind === "game" ? "clock" : "people")}</div>
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${item.cost} 星能 · 申请于 ${formatDateCN(item.date, { weekday: false })}</p>
                ${item.status === "approved" ? `<small>已批准不等于已经使用。请先通过 iPad 屏幕使用时间安排，再回来记录。</small>` : ""}
              </div>
              ${requestActions(item)}
            </article>`).join("") : `
            <div class="empty-inline">孩子提交兑换后，会在这里出现。拒绝时必须填写具体原因。</div>`}
        </div>
        <p class="fine-print">家长批准和实际兑现分开记录。App 不会自动解锁其他游戏，也不会绕过系统屏幕使用时间设置。</p>
      </section>

      <section class="rules-panel">
        <div class="section-title">
          <div><span class="eyebrow">家庭约定</span><h2>奖励与边界</h2></div>
          <span class="rule-version">修改只影响之后的行为</span>
        </div>
        <form id="parent-settings-form">
          <div class="settings-grid">
            <label>
              <span>基础游戏时间</span>
              <div class="input-with-unit"><input name="baseGameMinutes" type="number" min="0" step="1" value="${state.settings.baseGameMinutes}"><b>分钟/天</b></div>
              <small>这是不需要赚取的基础时间。</small>
            </label>
            <label>
              <span>完成一件任务</span>
              <div class="input-with-unit"><input name="completionReward" type="number" min="1" step="1" value="${state.settings.completionReward}"><b>星能</b></div>
            </label>
            <label>
              <span>完成每日复盘</span>
              <div class="input-with-unit"><input name="reflectionReward" type="number" min="0" step="1" value="${state.settings.reflectionReward}"><b>星能</b></div>
            </label>
            <label>
              <span>每日星能奖励上限</span>
              <div class="input-with-unit"><input name="dailyRewardCap" type="number" min="1" step="1" value="${state.settings.dailyRewardCap}"><b>星能</b></div>
            </label>
            <label>
              <span>额外游戏时间上限</span>
              <div class="input-with-unit"><input name="dailyGameLimit" type="number" min="0" step="1" value="${state.settings.dailyGameLimit ?? 60}"><b>分钟/天</b></div>
              <small>只限制用星能换取的额外时间。</small>
            </label>
          </div>
          <div class="product-settings">
            <div class="subsection-label">兑换项目</div>
            ${state.settings.products.map(productFields).join("")}
          </div>
          <div class="form-actions">
            <span class="fine-print">保存后会留下规则版本，历史奖励不会追溯扣除。</span>
            <button class="button primary" type="submit">${icon("check")}保存家庭约定</button>
          </div>
        </form>
      </section>` : ""}

      <section class="shared-panel">
        <div class="section-title">
          <div><span class="eyebrow">孩子愿意分享的复盘</span><h2>看发现，不做评判</h2></div>
        </div>
        ${sharedReflections.length ? sharedReflections.map((item) => `
          <article class="shared-reflection">
            <span>${formatDateCN(item.date)}</span>
            <p><b>最顺的事：</b>${escapeHtml(item.smooth || "没有填写")}</p>
            <p><b>打乱计划的事：</b>${escapeHtml(item.disrupted || "没有填写")}</p>
            <p><b>想做的调整：</b>${escapeHtml(item.adjust || "没有填写")}</p>
          </article>`).join("") : `<div class="empty-inline">孩子把复盘设为“愿意分享”后才会显示在这里。私密复盘不会出现。</div>`}
      </section>

      <section class="data-panel">
        <div class="section-title">
          <div><span class="eyebrow">数据安全</span><h2>保留一份本机备份</h2></div>
        </div>
        <p>所有数据默认保存在当前浏览器。清理 Safari 网站数据可能会删除计划和历史记录，建议定期导出备份。</p>
        <div class="data-actions">
          <button class="button secondary" data-action="export-data">${icon("download")}导出备份</button>
          <button class="button outline" data-action="import-data">${icon("upload")}恢复备份</button>
          <button class="button outline" data-action="change-parent-pin">${icon("lock")}修改 PIN</button>
          <input type="file" id="backup-file" accept="application/json,.json" hidden>
        </div>
        <p class="fine-print">本机 PIN 用于防止孩子误改规则，不能提供系统级安全。首版不采集账号、广告或追踪数据。</p>
      </section>
    </div>`;
}
