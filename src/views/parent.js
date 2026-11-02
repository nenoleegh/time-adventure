import { formatDateCN } from "../utils/date.js";
import { REDEMPTION_STATUSES } from "../services/reward-rules.js?v=1.13.11";
import { escapeAttr, escapeHtml, icon } from "../ui/html.js";
import { THEME_OPTIONS } from "../config/themes.js?v=1.13.11";

export const REWARD_PRODUCT_TEMPLATES = [
  {
    key: "game",
    label: "游戏",
    icon: "play",
    title: "20 分钟游戏时间",
    description: "完成约定后兑换，不替代系统屏幕使用时间。",
    kind: "game",
    period: "day",
    minuteValue: 20,
    cost: 20,
    limit: 1,
  },
  {
    key: "tv",
    label: "电视",
    icon: "monitor",
    title: "30 分钟电视时间",
    description: "完成约定后兑换，使用前和家长确认想看的节目。",
    kind: "privilege",
    period: "day",
    minuteValue: 0,
    cost: 20,
    limit: 1,
  },
  {
    key: "sport",
    label: "运动",
    icon: "heart",
    title: "选择一次家庭运动",
    description: "从跑步、骑车、球类等活动中选择一项，和家人一起完成。",
    kind: "privilege",
    period: "week",
    minuteValue: 0,
    cost: 30,
    limit: 1,
  },
  {
    key: "shopping",
    label: "购物",
    icon: "reward",
    title: "周末选购一件小物",
    description: "兑换前先约定预算和用途，再去挑选。",
    kind: "privilege",
    period: "week",
    minuteValue: 0,
    cost: 40,
    limit: 1,
  },
];

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

export function rewardProductFieldsHtml(product) {
  const kind = product.kind === "game" ? "game" : "privilege";
  const period = product.period === "week" ? "week" : "day";
  return `
    <article class="product-setting ${kind === "privilege" ? "is-privilege" : ""}" data-product-id="${escapeAttr(product.id)}">
      <div class="product-setting-head">
        <label class="product-title-field">
          <span>奖励内容</span>
          <input data-product-title maxlength="30" required value="${escapeAttr(product.title)}" placeholder="例如：周末选择一部电影">
        </label>
        <button type="button" class="icon-button danger-quiet" data-action="remove-reward-product" title="删除这个奖励项目" aria-label="删除 ${escapeAttr(product.title)}">${icon("close")}</button>
      </div>
      <label class="product-description-field">
        <span>说明</span>
        <input data-product-description maxlength="100" value="${escapeAttr(product.description || "")}" placeholder="告诉孩子这个奖励代表什么">
      </label>
      <div class="product-setting-grid">
        <label>
          <span>奖励类型</span>
          <select data-product-kind>
            <option value="game" ${kind === "game" ? "selected" : ""}>额外游戏时间</option>
            <option value="privilege" ${kind === "privilege" ? "selected" : ""}>家庭特权</option>
          </select>
        </label>
        <label>
          <span>兑换周期</span>
          <select data-product-period>
            <option value="day" ${period === "day" ? "selected" : ""}>每天</option>
            <option value="week" ${period === "week" ? "selected" : ""}>每周</option>
          </select>
        </label>
        <label data-game-minutes-field>
          <span>游戏时长</span>
          <div class="input-with-unit"><input data-product-minutes type="number" min="1" max="240" step="1" value="${Number(product.minuteValue) || 15}" ${kind === "privilege" ? "disabled" : ""}><b>分钟</b></div>
        </label>
        <label>
          <span>星能价格</span>
          <input data-product-cost type="number" min="1" step="1" value="${Number(product.cost) || 10}">
        </label>
        <label>
          <span data-limit-label>${period === "week" ? "每周" : "每日"}上限</span>
          <input data-product-limit type="number" min="1" step="1" value="${Number(product.limit) || 1}">
        </label>
      </div>
    </article>`;
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
        <p>${rewardsEnabled ? "这里管理规则和兑换状态。" : "奖励模块当前暂停使用，历史账本数据仍然保留。"}家长只能看到孩子允许在本设备查看的复盘，其他设备和私密内容不会显示。</p>
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
      </section>` : ""}

      <section class="rules-panel">
        <div class="section-title">
          <div><span class="eyebrow">家庭约定</span><h2>奖励与边界</h2></div>
          <span class="rule-version">${rewardsEnabled ? "修改只影响之后的行为" : "奖励暂停中，设置会保留"}</span>
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
            <div class="product-settings-heading">
              <div class="subsection-label">兑换项目</div>
              <button type="button" class="button outline small" data-action="add-reward-product">${icon("plus")}添加奖励</button>
            </div>
            <div class="reward-template-bar">
              <div class="reward-template-copy">
                <strong>快速模板</strong>
                <span>选一个常见奖励，自动填好后仍可修改</span>
              </div>
              <div class="reward-template-options" aria-label="奖励模板">
                ${REWARD_PRODUCT_TEMPLATES.map((template) => `
                  <button
                    type="button"
                    class="reward-template-button"
                    data-action="add-reward-template"
                    data-template="${template.key}"
                  >
                    ${icon(template.icon)}
                    <span>${template.label}</span>
                  </button>`).join("")}
              </div>
            </div>
            <div class="product-settings-list">
              ${state.settings.products.map(rewardProductFieldsHtml).join("")}
            </div>
            <p class="fine-print">奖励不限于游戏，也可以设置家庭活动、选择权或孩子喜欢的其他约定。删除项目不会删除历史兑换记录。</p>
          </div>
          <div class="form-actions">
            <span class="fine-print">保存后会留下规则版本，历史奖励不会追溯扣除。</span>
            <button class="button primary" type="submit">${icon("check")}保存家庭约定</button>
          </div>
        </form>
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

      <section class="shared-panel">
        <div class="section-title">
          <div><span class="eyebrow">孩子允许在本设备查看的复盘</span><h2>只看见孩子主动展示的内容</h2></div>
        </div>
        ${sharedReflections.length ? sharedReflections.map((item) => `
          <article class="shared-reflection">
            <span>${formatDateCN(item.date)}</span>
            <p><b>最顺的事：</b>${escapeHtml(item.smooth || "没有填写")}</p>
            <p><b>打乱计划的事：</b>${escapeHtml(item.disrupted || "没有填写")}</p>
            <p><b>想做的调整：</b>${escapeHtml(item.adjust || "没有填写")}</p>
          </article>`).join("") : `<div class="empty-inline">孩子勾选“允许家长在本设备查看”后才会显示在这里。私密复盘和其他设备上的内容都不会出现。</div>`}
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
