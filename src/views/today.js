import { formatDateCN, formatMinutes } from "../utils/date.js";
import {
  estimateFeedback,
  filterTasksBySubject,
  nextTask,
  taskCompletionSummary,
  taskSubjectFilters,
  TASK_TYPES,
  elapsedMs,
  resolveTaskSubject,
} from "../services/task-rules.js?v=1.12.0";
import { escapeHtml, icon, statusPill } from "../ui/html.js?v=1.12.0";
import { todayFeedbackHtml } from "./teacher-import.js?v=1.12.0";
import { FEATURES } from "../config/features.js?v=1.12.0";

function liveTimer(task) {
  if (task.status !== "inProgress") return "";
  const totalSeconds = Math.floor(elapsedMs(task) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display = hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return `<span class="live-timer" data-live-timer="${task.id}">${display}</span>`;
}

function taskAction(task) {
  if (task.status === "completed") {
    return `<span class="task-feedback">${escapeHtml(estimateFeedback(task))}</span>`;
  }
  if (task.status === "skipped") {
    return `<span class="task-feedback muted">已经放回计划，随时可以重新安排。</span>`;
  }
  if (task.status === "inProgress") {
    return `
      <div class="timer-live" data-timer-task="${task.id}">
        ${icon("clock")}
        ${liveTimer(task)}
      </div>
      <div class="task-actions">
        <button class="button secondary" data-action="pause-task" data-id="${task.id}">${icon("pause")}暂停</button>
        <button class="button primary" data-action="open-complete" data-id="${task.id}">${icon("check")}完成</button>
      </div>`;
  }
  const calendarAction =
    task.scheduledStart && !task.sourceImportId
      ? `<button class="button outline" data-action="add-task-calendar" data-id="${task.id}">${icon("calendar")}日历提醒</button>`
      : "";
  return `
    <div class="task-actions">
      <button class="button subtle" data-action="start-task" data-id="${task.id}">${icon("play")}${task.status === "paused" ? "继续" : "开始"}</button>
      <button class="button outline" data-action="open-complete" data-id="${task.id}">${icon("check")}完成</button>
      ${calendarAction}
    </div>`;
}

function taskCard(task, index) {
  const type = TASK_TYPES[task.type] || TASK_TYPES.must;
  const subject = resolveTaskSubject(task);
  return `
    <article class="task-card ${task.status} ${type.className}" style="--task-index:${index}">
      <div class="task-accent"></div>
      <div class="task-main">
        <div class="task-topline">
          <div class="task-label-group">
            <span class="subject-badge">${escapeHtml(subject)}</span>
            <div class="task-kind"><span class="kind-dot"></span>${escapeHtml(type.label)}</div>
          </div>
          ${statusPill(task.status)}
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        <div class="task-meta">
          ${task.scheduledStart ? `<span class="task-time">${icon("calendar")}${task.scheduledStart}${task.scheduledEnd ? `–${task.scheduledEnd}` : ""}</span>` : ""}
          ${task.breakBeforeMinutes ? `<span class="break-hint">${icon("pause")}先休息 ${task.breakBeforeMinutes} 分钟</span>` : ""}
          <span>${icon("clock")}预计 ${formatMinutes(task.estimatedMinutes)}</span>
          ${task.actualMinutes ? `<span>实际 ${formatMinutes(task.actualMinutes)}</span>` : ""}
          ${FEATURES.rewards && task.status !== "completed" ? `<span class="reward-hint">${icon("spark")}完成有星能</span>` : ""}
        </div>
        ${taskAction(task)}
      </div>
    </article>`;
}

function nextCard(task) {
  if (!task) {
    return `
      <section class="next-card empty">
        <span class="eyebrow">下一步</span>
        <h2>今天的画布还是空的</h2>
        <p>先放入一件真的想完成的事，不用一次安排满。</p>
        <button class="button primary wide" data-action="open-add">${icon("plus")}加入第一件事</button>
      </section>`;
  }
  const type = TASK_TYPES[task.type] || TASK_TYPES.must;
  const active = task.status === "inProgress";
  const subject = resolveTaskSubject(task);
  return `
    <section class="next-card ${active ? "active" : ""}">
      <span class="eyebrow">${active ? "正在进行" : "下一步"}</span>
      <div class="next-type">${escapeHtml(subject)} · ${type.label}</div>
      <h2>${escapeHtml(task.title)}</h2>
      <p>${active ? "按自己的节奏来。休息和暂停也算计划的一部分。" : `先做这一小段，完成后再决定下一步。`}</p>
      <div class="next-facts">
        ${task.scheduledStart ? `<span>${icon("calendar")}${task.scheduledStart}${task.scheduledEnd ? `–${task.scheduledEnd}` : ""}</span>` : ""}
        <span>${icon("clock")}${formatMinutes(task.estimatedMinutes)}</span>
        ${FEATURES.rewards ? `<span>${icon("spark")}完成得星能</span>` : ""}
      </div>
      ${active ? liveTimer(task) : ""}
      <div class="next-actions">
        ${
          active
            ? `<button class="button secondary" data-action="pause-task" data-id="${task.id}">${icon("pause")}暂停</button>
               <button class="button primary" data-action="open-complete" data-id="${task.id}">${icon("check")}完成</button>`
            : `<button class="button primary wide" data-action="start-task" data-id="${task.id}">${icon("play")}${task.status === "paused" ? "继续任务" : "开始这一小段"}</button>`
        }
      </div>
    </section>`;
}

export function todayView(state) {
  const summary = taskCompletionSummary(state.tasks);
  const subjectFilters = taskSubjectFilters(state.tasks);
  const requestedSubject = state.todaySubjectFilter || "全部";
  const activeSubject = subjectFilters.some(
    (item) => item.subject === requestedSubject,
  )
    ? requestedSubject
    : "全部";
  const visibleTasks = filterTasksBySubject(state.tasks, activeSubject);
  const next = nextTask(visibleTasks);
  const percent = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const completedPoints = state.todayLedger
    .filter((entry) => entry.type === "reward")
    .reduce((sum, entry) => sum + entry.amount, 0);
  return `
    <div class="page-heading today-heading">
      <div>
        <span class="eyebrow">${formatDateCN(state.today)}</span>
        <h1>今天，先走好下一步</h1>
        <p>${summary.total ? `你已经完成 ${summary.completed} 件事，今天共安排 ${formatMinutes(summary.plannedMinutes)}。` : "把想做的事放进来，留白也属于计划。"}</p>
      </div>
      <div class="heading-actions today-heading-actions">
        <button class="button secondary import-entry-button" data-action="open-teacher-import">${icon("upload")}老师消息</button>
        <button class="add-round" data-action="open-add" aria-label="添加任务">${icon("plus")}</button>
      </div>
    </div>

    <div class="today-grid">
      <div class="today-main">
        <section class="progress-card">
          <div class="progress-top">
            <div>
              <span class="label">今日进度</span>
              <strong>${summary.completed}<span> / ${summary.total || 0} 件</span></strong>
            </div>
            <div class="progress-ring" style="--progress:${percent}">
              <span>${percent}%</span>
            </div>
          </div>
          <div class="progress-track"><span style="width:${percent}%"></span></div>
          <div class="progress-foot">
            <span>${summary.actualMinutes ? `实际投入 ${formatMinutes(summary.actualMinutes)}` : "开始后会记录实际用时"}</span>
            ${FEATURES.rewards ? `<span>${completedPoints ? `今天获得 ${completedPoints} 星能` : "完成一件就有反馈"}</span>` : ""}
          </div>
        </section>

        ${todayFeedbackHtml(state.todayFeedback)}

        ${state.tasks.length ? `
          <section class="task-filter-bar" aria-label="按科目筛选今天的任务">
            <div class="task-filter-label">
              <span>${icon("filter")}按科目筛选</span>
              <small>${activeSubject === "全部" ? "显示全部任务" : `只看${activeSubject}，共 ${visibleTasks.length} 项`}</small>
            </div>
            <div class="task-filter-options">
              <button class="${activeSubject === "全部" ? "active" : ""}" data-action="filter-today-subject" data-subject="全部">
                全部<b>${state.tasks.length}</b>
              </button>
              ${subjectFilters.map((item) => `
                <button class="${activeSubject === item.subject ? "active" : ""}" data-action="filter-today-subject" data-subject="${escapeHtml(item.subject)}">
                  ${escapeHtml(item.subject)}<b>${item.count}</b>
                </button>
              `).join("")}
            </div>
          </section>` : ""}

        <section class="section-block">
          <div class="section-title">
            <div>
              <span class="eyebrow">我的安排</span>
              <h2>${summary.total ? (activeSubject === "全部" ? "今天的三件重要事" : `${activeSubject} · ${visibleTasks.length} 项` ) : "今天的计划"}</h2>
            </div>
            <button class="text-button" data-route="plan">管理计划${icon("arrow")}</button>
          </div>
          <div class="task-list">
            ${visibleTasks.length ? visibleTasks.map(taskCard).join("") : `
              <div class="empty-state">
                <div class="empty-orbit">${icon("spark")}</div>
                <h3>先选一件最重要的事</h3>
                <p>可以写作业、运动、阅读，也可以把一件大任务拆成小步骤。</p>
                <button class="button primary" data-action="open-add">${icon("plus")}添加今天的事</button>
              </div>`}
          </div>
        </section>
      </div>

      <aside class="today-rail">
        ${nextCard(next)}
        ${FEATURES.rewards ? `<section class="bank-card">
          <div class="bank-title">
            <div class="star-orb">${icon("spark")}</div>
            <div><span class="label">我的星能</span><strong>${state.balance}</strong></div>
          </div>
          <p>基础游戏时间照常保留。星能只兑换额外时间或家庭特权。</p>
          <button class="button outline wide" data-route="rewards">看看可以换什么</button>
        </section>` : ""}
        <section class="quiet-card">
          <span class="eyebrow">今日提醒</span>
          <p>计划不是承诺每一分钟。遇到变化时，先调整，再继续。</p>
        </section>
      </aside>
    </div>`;
}
