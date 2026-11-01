import { formatDateCN, formatMinutes, formatShortDate } from "../utils/date.js";
import { buildWeeklySummary } from "../services/report-rules.js";
import { escapeHtml, icon } from "../ui/html.js";
import { FEATURES } from "../config/features.js?v=1.13.7";

function chart(summary) {
  const max = Math.max(1, ...summary.daily.map((day) => day.total));
  return summary.daily
    .map((day) => {
      const height = day.total ? Math.max(14, (day.completed / max) * 100) : 4;
      const expected = day.total ? Math.max(14, (day.total / max) * 100) : 4;
      return `
        <div class="chart-day" title="${formatDateCN(day.date)}：完成 ${day.completed}/${day.total}">
          <div class="chart-columns">
            <span class="chart-plan" style="height:${expected}%"></span>
            <span class="chart-done" style="height:${height}%"></span>
          </div>
          <small>${formatShortDate(day.date)}</small>
        </div>`;
    })
    .join("");
}

export function growthView(state) {
  const summary = buildWeeklySummary(state.allTasks, state.ledger, state.today);
  const reflection = state.reflection;
  const shared = reflection.visibility === "shared";
  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">这一周的成长</span>
        <h1>看见自己怎样安排时间</h1>
        <p>这里记录你做出的选择和发现，不用每天满分，也不和别人比较。</p>
      </div>
    </div>

    <section class="insight-grid" style="--insight-count:${FEATURES.rewards ? 4 : 3}">
      <article class="insight-card highlight">
        <span class="insight-icon">${icon("calendar")}</span>
        <strong>${summary.completed}</strong>
        <h3>完成的事情</h3>
        <p>这一周有 ${summary.activeDays} 天留下了行动记录。</p>
      </article>
      <article class="insight-card">
        <span class="insight-icon">${icon("clock")}</span>
        <strong>${summary.estimateAverage === null ? "—" : `±${summary.estimateAverage}`}</strong>
        <h3>估时平均差</h3>
        <p>这是分钟差，不是成绩。多观察几次，时间感会慢慢变准。</p>
      </article>
      <article class="insight-card">
        <span class="insight-icon">${icon("spark")}</span>
        <strong>${summary.adjusted}</strong>
        <h3>重新安排</h3>
        <p>发现计划不合适并调整，也是一种完成。</p>
      </article>
      ${FEATURES.rewards ? `<article class="insight-card">
        <span class="insight-icon">${icon("reward")}</span>
        <strong>${summary.earned}</strong>
        <h3>本周获得星能</h3>
        <p>已经用掉 ${summary.spent} 星能，余额 ${state.balance}。</p>
      </article>` : ""}
    </section>

    <div class="growth-layout">
      <section class="week-chart-card">
        <div class="section-title">
          <div><span class="eyebrow">近 7 天</span><h2>完成与安排的对照</h2></div>
          <div class="chart-legend"><span class="done"></span>完成 <span class="planned"></span>计划</div>
        </div>
        <div class="week-chart">${chart(summary)}</div>
        <p class="chart-note">${summary.total ? `这周计划了 ${summary.total} 件事，完成 ${summary.completed} 件。没走完的安排可以用来调整下一次计划。` : "开始安排第一件事后，这里会长出你的时间记录。"}</p>
      </section>

      <section class="reflection-card">
        <div class="reflection-heading">
          <div>
            <span class="eyebrow">晚间三问 · 3 分钟</span>
            <h2>${formatDateCN(state.today)}，留下一点发现</h2>
          </div>
          <div class="privacy-chip">${icon(shared ? "people" : "lock")}${shared ? "会分享给家长" : "仅自己可见"}</div>
        </div>
        <form id="reflection-form">
          <label>
            <span>今天哪件事做起来最顺？</span>
            <textarea name="smooth" maxlength="240" placeholder="例如：数学第一段比想象中快">${escapeHtml(reflection.smooth)}</textarea>
          </label>
          <label>
            <span>有什么打乱了计划？</span>
            <textarea name="disrupted" maxlength="240" placeholder="例如：临时加了一节辅导课">${escapeHtml(reflection.disrupted)}</textarea>
          </label>
          <label>
            <span>明天想保留或调整什么？</span>
            <textarea name="adjust" maxlength="240" placeholder="例如：英语复习从 30 分钟改成 20 分钟">${escapeHtml(reflection.adjust)}</textarea>
          </label>
          <div class="reflection-footer">
            <label class="visibility-choice">
              <input type="checkbox" name="shared" ${shared ? "checked" : ""}>
              <span>愿意分享给家长</span>
            </label>
            <button class="button primary" type="submit">${icon("check")}保存今天的发现</button>
          </div>
        </form>
        <p class="fine-print">复盘可以跳过。没有完成，也能记录什么方法不适用。</p>
      </section>
    </div>

    <section class="evidence-strip">
      <div><span class="evidence-number">${summary.activeDays}</span><span>天留下行动</span></div>
      <div><span class="evidence-number">${summary.completed}</span><span>次完成</span></div>
      <div><span class="evidence-number">${summary.adjusted}</span><span>次主动调整</span></div>
      <p>${FEATURES.rewards ? "成长值不会因为兑换而减少。" : ""}真正的目标，是以后即使没有提醒，也更能知道下一步怎么走。</p>
    </section>`;
}
