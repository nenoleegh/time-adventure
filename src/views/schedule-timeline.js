import {
  addDays,
  dateKey,
  formatDateCN,
  formatMinutes,
  parseDateKey,
  weekKey,
} from "../utils/date.js";
import { escapeAttr, escapeHtml, icon } from "../ui/html.js";
import { buildCourseOccurrences } from "../services/course-schedule-rules.js";
import { resolveTaskSubject } from "../services/task-rules.js?v=1.11.0";

export const TIMELINE_START_MINUTES = 6 * 60 + 30;
export const TIMELINE_END_MINUTES = 23 * 60;
export const TIMELINE_PIXELS_PER_MINUTE = 1;

export const DAY_PERIODS = [
  { id: "morning", label: "上午", start: 6 * 60 + 30, end: 12 * 60 },
  { id: "afternoon", label: "下午", start: 12 * 60, end: 18 * 60 },
  { id: "evening", label: "晚上", start: 18 * 60, end: 23 * 60 },
];

const COLORS = [
  "color-1",
  "color-2",
  "color-3",
  "color-4",
  "color-5",
  "color-6",
];

function hashText(value) {
  return Array.from(String(value || "")).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

export function taskColorClass(task) {
  const subject = resolveTaskSubject(task);
  if (/语文/.test(subject)) return "color-1";
  if (/数学/.test(subject)) return "color-2";
  if (/英语/.test(subject)) return "color-3";
  if (/科学/.test(subject)) return "color-4";
  if (/体育/.test(subject)) return "color-5";
  if (/美术|音乐/.test(subject)) return "color-6";
  if (/语文/.test(task.title)) return "color-1";
  if (/数学/.test(task.title)) return "color-2";
  if (/英语/.test(task.title)) return "color-3";
  if (/科学/.test(task.title)) return "color-4";
  if (/体育|运动|跑步/.test(task.title)) return "color-5";
  if (/美术|音乐|手抄报/.test(task.title)) return "color-6";
  return COLORS[hashText(task.title) % COLORS.length];
}

export function isCompletedOnTime(task) {
  if (task.status !== "completed" || !task.completedAt || !task.scheduledEnd) return false;
  const deadline = new Date(`${task.date}T${task.scheduledEnd}:00`);
  return new Date(task.completedAt).getTime() <= deadline.getTime();
}

function minutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeLabel(value) {
  return String(value || "").padStart(5, "0");
}

function blockForTask(
  task,
  {
    startBoundary = TIMELINE_START_MINUTES,
    endBoundary = TIMELINE_END_MINUTES,
    percentage = false,
  } = {},
) {
  const start = minutes(task.scheduledStart);
  const end = minutes(task.scheduledEnd);
  if (start === null || end === null || end <= start) return "";
  const visibleStart = Math.max(start, startBoundary);
  const visibleEnd = Math.min(end, endBoundary);
  if (visibleEnd <= visibleStart) return "";
  const span = endBoundary - startBoundary;
  const top = percentage
    ? ((visibleStart - startBoundary) / span) * 100
    : (visibleStart - startBoundary) * TIMELINE_PIXELS_PER_MINUTE;
  const height = percentage
    ? ((visibleEnd - visibleStart) / span) * 100
    : (visibleEnd - visibleStart) * TIMELINE_PIXELS_PER_MINUTE;
  const compact = visibleEnd - visibleStart < 34;
  const onTime = isCompletedOnTime(task);
  const finished = task.status === "completed";
  const subject = resolveTaskSubject(task);
  return `
    <button
      class="timeline-block ${taskColorClass(task)} status-${task.status} ${compact ? "compact" : ""}"
      style="top:${top}${percentage ? "%" : "px"};height:${height}${percentage ? "%" : "px"}"
      data-action="edit-task"
      data-id="${task.id}"
      data-drag-task="${task.id}"
      data-task-duration="${task.estimatedMinutes}"
      title="${escapeAttr(`${task.title} · ${task.scheduledStart}–${task.scheduledEnd}`)}"
    >
      <span class="timeline-block-subject">${escapeHtml(subject)}</span>
      <span class="timeline-block-title">${escapeHtml(task.title)}</span>
      <span class="timeline-block-time">${timeLabel(task.scheduledStart)}–${timeLabel(task.scheduledEnd)}</span>
      ${onTime ? `<span class="on-time-badge">${icon("check")}准时</span>` : ""}
      ${!onTime && finished ? `<span class="finished-badge">${icon("check")}</span>` : ""}
    </button>`;
}

function blockForCourse(
  course,
  {
    startBoundary = TIMELINE_START_MINUTES,
    endBoundary = TIMELINE_END_MINUTES,
    percentage = false,
  } = {},
) {
  const start = minutes(course.scheduledStart);
  const end = minutes(course.scheduledEnd);
  if (start === null || end === null || end <= start) return "";
  const visibleStart = Math.max(start, startBoundary);
  const visibleEnd = Math.min(end, endBoundary);
  if (visibleEnd <= visibleStart) return "";
  const span = endBoundary - startBoundary;
  const top = percentage
    ? ((visibleStart - startBoundary) / span) * 100
    : (visibleStart - startBoundary) * TIMELINE_PIXELS_PER_MINUTE;
  const height = percentage
    ? ((visibleEnd - visibleStart) / span) * 100
    : (visibleEnd - visibleStart) * TIMELINE_PIXELS_PER_MINUTE;
  const compact = visibleEnd - visibleStart < 34;
  return `
    <div
      class="timeline-block course-block ${taskColorClass(course)} ${compact ? "compact" : ""}"
      style="top:${top}${percentage ? "%" : "px"};height:${height}${percentage ? "%" : "px"}"
      title="${escapeAttr(`${course.title}${course.teacher ? `（${course.teacher}）` : ""} · 每周固定课程 · ${course.scheduledStart}–${course.scheduledEnd}`)}"
    >
      <span class="timeline-block-title">${icon("lock")}${escapeHtml(course.title)}${course.teacher ? `（${escapeHtml(course.teacher)}）` : ""}</span>
      <span class="timeline-block-time">${timeLabel(course.scheduledStart)}–${timeLabel(course.scheduledEnd)}</span>
    </div>`;
}

function blockForBreak(
  task,
  {
    startBoundary = TIMELINE_START_MINUTES,
    endBoundary = TIMELINE_END_MINUTES,
    percentage = false,
  } = {},
) {
  const start = minutes(task.breakStart);
  const end = minutes(task.breakEnd);
  if (start === null || end === null || end <= start) return "";
  const visibleStart = Math.max(start, startBoundary);
  const visibleEnd = Math.min(end, endBoundary);
  if (visibleEnd <= visibleStart) return "";
  const span = endBoundary - startBoundary;
  const top = percentage
    ? ((visibleStart - startBoundary) / span) * 100
    : (visibleStart - startBoundary) * TIMELINE_PIXELS_PER_MINUTE;
  const height = percentage
    ? ((visibleEnd - visibleStart) / span) * 100
    : (visibleEnd - visibleStart) * TIMELINE_PIXELS_PER_MINUTE;
  return `
    <div
      class="timeline-block break-block ${height < 34 || percentage ? "compact" : ""}"
      style="top:${top}${percentage ? "%" : "px"};height:${height}${percentage ? "%" : "px"}"
      title="休息建议 ${timeLabel(task.breakStart)}–${timeLabel(task.breakEnd)}"
    >
      <span class="timeline-block-title">${icon("pause")}休息</span>
      <span class="timeline-block-time">${task.breakBeforeMinutes} 分钟</span>
    </div>`;
}

function hourLabels(
  startBoundary = TIMELINE_START_MINUTES,
  endBoundary = TIMELINE_END_MINUTES,
  percentage = false,
) {
  const labels = [];
  const firstHour = Math.ceil(startBoundary / 60) * 60;
  for (let value = firstHour; value <= endBoundary; value += 60) {
    const top = percentage
      ? ((value - startBoundary) / (endBoundary - startBoundary)) * 100
      : (value - startBoundary) * TIMELINE_PIXELS_PER_MINUTE;
    labels.push(`
      <span class="hour-label" style="top:${top}${percentage ? "%" : "px"}">
        ${String(Math.floor(value / 60)).padStart(2, "0")}:00
      </span>`);
  }
  return labels.join("");
}

function currentTimeLine(
  day,
  today,
  startBoundary = TIMELINE_START_MINUTES,
  endBoundary = TIMELINE_END_MINUTES,
  percentage = false,
) {
  if (day !== today) return "";
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < startBoundary || nowMinutes > endBoundary) return "";
  const top = percentage
    ? ((nowMinutes - startBoundary) / (endBoundary - startBoundary)) * 100
    : (nowMinutes - startBoundary) * TIMELINE_PIXELS_PER_MINUTE;
  return `<div class="current-time-line" style="top:${top}${percentage ? "%" : "px"}"><span>现在</span></div>`;
}

function dayColumn(day, tasks, courses, today) {
  const blocks = tasks
    .filter((task) => task.date === day)
    .map((task) => blockForTask(task))
    .join("");
  const courseBlocks = courses
    .filter((course) => course.date === day)
    .map((course) => blockForCourse(course))
    .join("");
  const breakBlocks = tasks
    .filter((task) => task.date === day && task.breakStart)
    .map((task) => blockForBreak(task))
    .join("");
  return `
    <div class="timeline-day-column" data-timeline-day="${day}" data-period-start="${TIMELINE_START_MINUTES}" data-period-end="${TIMELINE_END_MINUTES}">
      <div class="timeline-hour-lines"></div>
      ${courseBlocks}
      ${breakBlocks}
      ${blocks}
      ${currentTimeLine(day, today)}
    </div>`;
}

function hourLineTicks(startBoundary, endBoundary) {
  const ticks = [];
  const firstHour = Math.ceil(startBoundary / 60) * 60;
  for (let value = firstHour; value < endBoundary; value += 60) {
    const top = ((value - startBoundary) / (endBoundary - startBoundary)) * 100;
    ticks.push(`<span class="period-hour-line" style="top:${top}%"></span>`);
  }
  return ticks.join("");
}

function dayPeriodColumn(period, day, tasks, courses, today) {
  const periodTasks = tasks.filter((task) => task.date === day);
  const blocks = periodTasks
    .map((task) =>
      blockForTask(task, {
        startBoundary: period.start,
        endBoundary: period.end,
        percentage: true,
      }),
    )
    .join("");
  const courseBlocks = courses
    .filter((course) => course.date === day)
    .map((course) =>
      blockForCourse(course, {
        startBoundary: period.start,
        endBoundary: period.end,
        percentage: true,
      }),
    )
    .join("");
  const breakBlocks = periodTasks
    .filter((task) => task.breakStart)
    .map((task) =>
      blockForBreak(task, {
        startBoundary: period.start,
        endBoundary: period.end,
        percentage: true,
      }),
    )
    .join("");
  return `
    <section class="day-period-section period-${period.id}">
      <div class="day-period-heading">
        <strong>${period.label}</strong>
        <span>${String(Math.floor(period.start / 60)).padStart(2, "0")}:${String(period.start % 60).padStart(2, "0")}–${String(Math.floor(period.end / 60)).padStart(2, "0")}:${String(period.end % 60).padStart(2, "0")}</span>
      </div>
      <div class="day-period-calendar">
        <div class="day-period-axis">${hourLabels(period.start, period.end, true)}</div>
        <div
          class="timeline-day-column day-period-track"
          data-timeline-day="${day}"
          data-period-start="${period.start}"
          data-period-end="${period.end}"
        >
          <div class="period-hour-lines">${hourLineTicks(period.start, period.end)}</div>
          ${courseBlocks}
          ${breakBlocks}
          ${blocks}
          ${currentTimeLine(day, today, period.start, period.end, true)}
        </div>
      </div>
    </section>`;
}

function threePeriodDay(day, tasks, courses, today) {
  return `
    <div class="day-period-view">
      ${DAY_PERIODS.map((period) => dayPeriodColumn(period, day, tasks, courses, today)).join("")}
    </div>`;
}

function dayHeads(days) {
  return days
    .map((day) => {
      const date = parseDateKey(day);
      return `
        <div class="timeline-day-head ${day === dateKey() ? "is-today" : ""}">
          <span>${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}</span>
          <strong>${date.getMonth() + 1}/${date.getDate()}</strong>
        </div>`;
    })
    .join("");
}

function unscheduledBlock(task) {
  const subject = resolveTaskSubject(task);
  return `
    <button
      class="unscheduled-block ${task.sourceImportId ? "from-import" : ""}"
      data-action="schedule-task"
      data-id="${task.id}"
      data-drag-task="${task.id}"
      data-task-duration="${task.estimatedMinutes}"
      title="点按设置时间，也可以拖到时间轴"
    >
      <span class="unscheduled-heading-line">
        <span class="unscheduled-subject">${escapeHtml(subject)}</span>
        <span class="unscheduled-title">${escapeHtml(task.title)}</span>
      </span>
      <span class="unscheduled-meta">
        ${task.sourceImportId ? "导入后待分时" : "待安排"} · ${formatMinutes(task.estimatedMinutes)}
      </span>
      <span class="unscheduled-grip">${icon("clock")}</span>
    </button>`;
}

function unscheduledPanel(unscheduled, mode) {
  return `
    <section class="unscheduled-panel">
      <div class="unscheduled-heading">
        <div>
          <span class="eyebrow">待安排</span>
          <h3>${mode === "week" ? "本周还没分时的任务" : "今天还没分时的任务"}</h3>
        </div>
        <span class="unscheduled-count">${unscheduled.length}</span>
      </div>
      <p class="unscheduled-help">点按设置时间，或直接拖到左侧时间轴。灰色虚线来自还没分时的导入任务。</p>
      <div class="unscheduled-list">
        ${unscheduled.length
          ? unscheduled.map(unscheduledBlock).join("")
          : `<div class="unscheduled-empty">${icon("check")}所有未完成任务都已有时间。</div>`}
      </div>
    </section>`;
}

export function scheduleTimelineHtml(state) {
  const mode = state.planMode === "week" ? "week" : "day";
  const today = state.today;
  const days = mode === "week"
    ? Array.from({ length: 7 }, (_, index) => addDays(weekKey(state.planDay), index))
    : [state.planDay];
  const daySet = new Set(days);
  const relevantTasks = state.allTasks.filter((task) => daySet.has(task.date));
  const relevantCourses = buildCourseOccurrences(
    state.courseTemplates || [],
    days[0],
    days[days.length - 1],
  );
  const unscheduled = relevantTasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "skipped" &&
      (!task.scheduledStart || !task.scheduledEnd),
  );
  const height = (TIMELINE_END_MINUTES - TIMELINE_START_MINUTES) * TIMELINE_PIXELS_PER_MINUTE;
  return `
    <section class="timeline-card">
      <div class="timeline-toolbar">
        <div>
          <span class="eyebrow">时间视图</span>
          <h2>${mode === "week" ? "这一周，时间都去了哪里" : `${formatDateCN(state.planDay)}的时间安排`}</h2>
        </div>
        <div class="view-toggle" role="group" aria-label="切换日视图或周视图">
          <button class="${mode === "day" ? "active" : ""}" data-action="plan-mode" data-mode="day">日视图</button>
          <button class="${mode === "week" ? "active" : ""}" data-action="plan-mode" data-mode="week">周视图</button>
        </div>
      </div>
      <div class="timeline-legend">
        <span><i class="legend-color color-1"></i>语文</span>
        <span><i class="legend-color color-2"></i>数学</span>
        <span><i class="legend-color color-3"></i>英语</span>
        <span><i class="legend-lock">${icon("lock")}</i>固定课程</span>
        <span><i class="legend-break"></i>休息</span>
        <span><i class="legend-dashed"></i>待分时</span>
        <span class="legend-tip">${icon("clock")}拖动区块可调整时间，点按可编辑</span>
      </div>
      ${mode === "day"
        ? threePeriodDay(state.planDay, relevantTasks, relevantCourses, today)
        : `
          <div class="timeline-scroll">
            <div class="timeline-grid week" style="--timeline-height:${height}px;--timeline-days:${days.length}">
              <div class="timeline-corner">时间</div>
              ${dayHeads(days)}
              <div class="timeline-axis">${hourLabels()}</div>
              ${days.map((day) => dayColumn(day, relevantTasks, relevantCourses, today)).join("")}
            </div>
          </div>`}
    </section>
    ${unscheduledPanel(unscheduled, mode)}`;
}
