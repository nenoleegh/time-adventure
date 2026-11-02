import {
  addDays,
  dateKey,
  formatDateCN,
  formatMinutes,
  parseDateKey,
  weekKey,
} from "../utils/date.js";
import {
  estimateFeedback,
  resolveTaskSubject,
  TASK_TYPES,
} from "../services/task-rules.js?v=1.13.13";
import { escapeHtml, icon, statusPill } from "../ui/html.js";
import { scheduleTimelineHtml } from "./schedule-timeline.js?v=1.13.13";
import {
  buildCourseOccurrences,
  courseDurationMinutes,
} from "../services/course-schedule-rules.js";

function taskRow(task, index, total) {
  const type = TASK_TYPES[task.type] || TASK_TYPES.must;
  const completed = task.status === "completed";
  const subject = resolveTaskSubject(task);
  return `
    <article class="plan-task ${completed ? "completed" : ""}">
      <div class="reorder-buttons">
        <button data-action="move-task" data-id="${task.id}" data-direction="-1" aria-label="向前移动" ${index === 0 ? "disabled" : ""}>↑</button>
        <button data-action="move-task" data-id="${task.id}" data-direction="1" aria-label="向后移动" ${index === total - 1 ? "disabled" : ""}>↓</button>
      </div>
      <div class="plan-task-body">
        <div class="plan-task-top">
          <span class="subject-badge">${escapeHtml(subject)}</span>
          <span class="type-badge ${type.className}">${type.label}</span>
          ${statusPill(task.status)}
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          ${task.scheduledStart ? `<span class="task-time">${icon("calendar")}${task.scheduledStart}${task.scheduledEnd ? `–${task.scheduledEnd}` : ""}</span>` : ""}
          ${task.breakBeforeMinutes ? `<span class="break-hint">${icon("pause")}先休息 ${task.breakBeforeMinutes} 分钟</span>` : ""}
          <span>${icon("clock")}预计 ${formatMinutes(task.estimatedMinutes)}</span>
          ${task.actualMinutes ? `<span>实际 ${formatMinutes(task.actualMinutes)}</span>` : ""}
        </div>
        <p class="task-note">${escapeHtml(completed ? estimateFeedback(task) : "先估个时长，做过后再对照。估偏了也能帮你更了解自己的节奏。")}</p>
      </div>
      <div class="plan-task-tools">
        ${task.scheduledStart && !completed ? `<button class="icon-button" data-action="add-task-calendar" data-id="${task.id}" title="加入 iPad 日历">${icon("calendar")}</button>` : ""}
        <button class="icon-button" data-action="edit-task" data-id="${task.id}" title="编辑">${icon("edit")}</button>
        ${!completed ? `<button class="icon-button" data-action="split-task" data-id="${task.id}" title="拆小一点">${icon("split")}</button>` : ""}
        ${!completed ? `<button class="icon-button" data-action="task-menu" data-id="${task.id}" title="更多">${icon("more")}</button>` : ""}
      </div>
    </article>`;
}

export function planView(state) {
  const tasks = state.planTasks;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const weekMode = state.planMode === "week";
  const weekStart = weekKey(state.planDay);
  const weekEnd = addDays(weekStart, 6);
  const startDate = parseDateKey(weekStart);
  const endDate = parseDateKey(weekEnd);
  const summaryTasks = weekMode
    ? state.allTasks.filter((task) => task.date >= weekStart && task.date <= weekEnd)
    : tasks;
  const summaryRangeStart = weekMode ? weekStart : state.planDay;
  const summaryRangeEnd = weekMode ? weekEnd : state.planDay;
  const summaryCourses = buildCourseOccurrences(
    state.courseTemplates || [],
    summaryRangeStart,
    summaryRangeEnd,
  );
  const summaryMinutes =
    summaryTasks.reduce(
      (sum, task) => sum + Number(task.estimatedMinutes || 0),
      0,
    ) +
    summaryCourses.reduce(
      (sum, course) => sum + courseDurationMinutes(course),
      0,
    );
  const summaryCompleted = summaryTasks.filter((task) => task.status === "completed").length;
  const summaryTotal = summaryTasks.filter((task) => task.status !== "skipped").length;
  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">计划与估时</span>
        <h1>由你决定先后和小步骤</h1>
        <p>每件事先估一个大致时长。不是考试，估偏了正好能发现自己的节奏。</p>
      </div>
      <div class="heading-actions">
        <button class="button outline import-entry-button" data-action="open-course-import">${icon("calendar")}导入课程表</button>
        <button class="button secondary import-entry-button" data-action="open-teacher-import">${icon("upload")}导入老师消息</button>
        <button class="button primary add-plan" data-action="open-add" data-date="${state.planDay}">${icon("plus")}添加任务</button>
      </div>
    </div>

    <section class="date-strip">
      <button class="date-arrow" data-action="${weekMode ? "plan-week" : "plan-day"}" data-offset="-1" aria-label="${weekMode ? "上一周" : "前一天"}">${icon("back")}</button>
      <div class="date-display">
        <span>${weekMode ? "本周" : state.planDay === dateKey() ? "今天" : state.planDay === addDays(dateKey(), 1) ? "明天" : "安排日"}</span>
        <strong>${weekMode
          ? `${startDate.getMonth() + 1}月${startDate.getDate()}日 – ${endDate.getMonth() + 1}月${endDate.getDate()}日`
          : formatDateCN(state.planDay)}</strong>
      </div>
      <label class="date-picker-label" title="选择日期">
        ${icon("calendar")}
        <input type="date" id="plan-date" value="${state.planDay}" aria-label="选择计划日期">
      </label>
      <button class="date-arrow" data-action="${weekMode ? "plan-week" : "plan-day"}" data-offset="1" aria-label="${weekMode ? "下一周" : "后一天"}">${icon("arrow")}</button>
    </section>

    <div class="plan-summary">
      <div><span>${weekMode ? "本周安排" : "安排时长"}</span><strong>${formatMinutes(summaryMinutes)}</strong></div>
      <div><span>完成任务</span><strong>${weekMode ? `${summaryCompleted} / ${summaryTotal} 件` : `${completed} 件`}</strong></div>
      <div><span>留下空白</span><strong>${summaryMinutes < (weekMode ? 600 : 180) ? "还有余地" : "留一点缓冲"}</strong></div>
    </div>

    ${scheduleTimelineHtml(state)}

    <section class="plan-panel">
      <div class="section-title">
        <div>
          <span class="eyebrow">任务顺序</span>
          <h2>${tasks.length ? `${formatDateCN(state.planDay)}的任务` : `${formatDateCN(state.planDay)}还没有任务`}</h2>
        </div>
        ${tasks.length ? `<span class="muted-caption">用上下按钮调整顺序；大任务可以拆成两段</span>` : ""}
      </div>
      <div class="plan-task-list">
        ${tasks.length ? tasks.map((task, index) => taskRow(task, index, tasks.length)).join("") : `
          <div class="empty-state compact">
            <div class="empty-orbit">${icon("calendar")}</div>
            <h3>给这一天留一张清楚的计划</h3>
            <p>先放三件以内的重要事，后面的时间可以留给变化。</p>
            <button class="button primary" data-action="open-add" data-date="${state.planDay}">${icon("plus")}添加任务</button>
          </div>`}
      </div>
    </section>
  `;
}
