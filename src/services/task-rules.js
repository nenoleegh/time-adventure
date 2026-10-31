export const TASK_TYPES = {
  must: { label: "必须做", short: "必做", className: "must" },
  flex: { label: "弹性做", short: "弹性", className: "flex" },
  choice: { label: "自选加分", short: "自选", className: "choice" },
};

export const SUBJECT_OPTIONS = [
  "语文",
  "数学",
  "英语",
  "科学",
  "信息科技",
  "道德与法治",
  "体育",
  "美术",
  "音乐",
  "劳动",
  "其他",
];

const SUBJECT_ALIASES = [
  ["道德与法治", "道法"],
  ["体育", "运动", "跑步"],
  ["信息科技", "信息技术", "信息"],
  ["美术", "画画"],
  ["音乐", "唱歌"],
];

export function detectSubject(text, fallback = "其他") {
  const source = String(text || "");
  const candidates = [];
  for (const subject of SUBJECT_OPTIONS) {
    const index = source.indexOf(subject);
    if (index >= 0) candidates.push({ subject, index });
  }
  for (const aliases of SUBJECT_ALIASES) {
    const canonical = aliases[0];
    for (const alias of aliases.slice(1)) {
      const index = source.indexOf(alias);
      if (index >= 0) candidates.push({ subject: canonical, index });
    }
  }
  candidates.sort((a, b) => a.index - b.index);
  if (candidates.length) return candidates[0].subject;
  if (/口算|小数|方程|几何|轴对称|计算/.test(source)) return "数学";
  if (/作文|阅读|古诗|课文|听写|默写/.test(source)) return "语文";
  if (/单词|句型|动词|家默/.test(source)) return "英语";
  return fallback;
}

export function resolveTaskSubject(task) {
  const explicit = String(task?.subject || "").trim();
  if (explicit && explicit !== "作业") return explicit;
  return detectSubject(task?.title || "");
}

export function taskSubjectFilters(tasks) {
  const counts = new Map();
  for (const task of tasks) {
    const subject = resolveTaskSubject(task);
    counts.set(subject, (counts.get(subject) || 0) + 1);
  }
  const known = SUBJECT_OPTIONS.filter((subject) => counts.has(subject));
  const extra = [...counts.keys()].filter(
    (subject) => !SUBJECT_OPTIONS.includes(subject),
  );
  return [...known, ...extra].map((subject) => ({
    subject,
    count: counts.get(subject),
  }));
}

export function filterTasksBySubject(tasks, subject) {
  if (!subject || subject === "全部") return tasks;
  return tasks.filter((task) => resolveTaskSubject(task) === subject);
}

function clockMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clockLabel(value) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function scheduledInterval(task) {
  const start = clockMinutes(task.scheduledStart);
  const end = clockMinutes(task.scheduledEnd);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function findFollowingSlot(start, duration, blockers, endBoundary) {
  let cursor = start;
  const ordered = [...blockers].sort((a, b) => a.start - b.start);
  for (const blocker of ordered) {
    const candidateEnd = cursor + duration;
    if (candidateEnd > endBoundary) return null;
    if (blocker.end <= cursor) continue;
    if (blocker.start >= candidateEnd) return { start: cursor, end: candidateEnd };
    cursor = blocker.end;
  }
  const end = cursor + duration;
  return end <= endBoundary ? { start: cursor, end } : null;
}

export function shiftConflictingTasks(
  priorityTask,
  tasks,
  { endBoundary = 23 * 60 + 59 } = {},
) {
  const priorityInterval = scheduledInterval(priorityTask);
  if (!priorityInterval) return { tasks: [], unresolved: [] };

  const others = tasks.filter(
    (task) =>
      task.id !== priorityTask.id &&
      task.date === priorityTask.date &&
      !["completed", "skipped"].includes(task.status) &&
      scheduledInterval(task),
  );
  const unresolved = others.filter(
    (task) =>
      task.status === "inProgress" &&
      priorityInterval.start < scheduledInterval(task).end &&
      priorityInterval.end > scheduledInterval(task).start,
  );
  if (unresolved.length) return { tasks: [], unresolved };

  const conflicts = others
    .filter((task) => {
      const interval = scheduledInterval(task);
      return (
        task.status !== "inProgress" &&
        priorityInterval.start < interval.end &&
        priorityInterval.end > interval.start
      );
    })
    .sort((a, b) => {
      const startDelta =
        scheduledInterval(a).start - scheduledInterval(b).start;
      return startDelta || (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  if (!conflicts.length) return { tasks: [], unresolved: [] };

  const conflictIds = new Set(conflicts.map((task) => task.id));
  const blockers = others
    .filter((task) => !conflictIds.has(task.id))
    .map(scheduledInterval);
  let cursor = priorityInterval.end;
  const shifted = [];

  for (const task of conflicts) {
    const interval = scheduledInterval(task);
    const duration = interval.end - interval.start;
    const slot = findFollowingSlot(cursor, duration, blockers, endBoundary);
    if (!slot) return { tasks: [], unresolved: [task] };
    const breakMinutes = Math.max(0, Number(task.breakBeforeMinutes) || 0);
    const moved = {
      ...task,
      scheduledStart: clockLabel(slot.start),
      scheduledEnd: clockLabel(slot.end),
      breakStart:
        breakMinutes > 0 && slot.start >= breakMinutes
          ? clockLabel(slot.start - breakMinutes)
          : "",
      breakEnd:
        breakMinutes > 0 && slot.start >= breakMinutes
          ? clockLabel(slot.start)
          : "",
    };
    shifted.push(moved);
    blockers.push({ start: slot.start, end: slot.end });
    cursor = slot.end;
  }

  return { tasks: shifted, unresolved: [] };
}

export function normalizeEstimate(value) {
  const minutes = Math.round(Number(value) || 0);
  return Math.min(240, Math.max(5, minutes));
}

export function normalizeActualMinutes(value, fallback) {
  const minutes = Math.round(Number(value));
  if (Number.isFinite(minutes) && minutes > 0) {
    return Math.min(600, Math.max(1, minutes));
  }
  return Math.min(600, Math.max(1, Math.round(Number(fallback) || 1)));
}

export function scheduledMinutesFitDay(startMinutes, durationMinutes) {
  const start = Number(startMinutes);
  const duration = Number(durationMinutes);
  return (
    Number.isFinite(start) &&
    Number.isFinite(duration) &&
    start >= 0 &&
    duration > 0 &&
    start + duration <= 23 * 60 + 59
  );
}

export function elapsedMs(task, now = Date.now()) {
  const accumulated = Math.max(0, Number(task.accumulatedMs) || 0);
  if (task.status !== "inProgress" || !task.startedAt) return accumulated;
  const startedAt = new Date(task.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return accumulated;
  return accumulated + Math.max(0, now - startedAt);
}

export function elapsedMinutes(task, now = Date.now()) {
  const seconds = elapsedMs(task, now) / 1000;
  return seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : 0;
}

export function canStartTask(task) {
  return ["planned", "paused", "rescheduled"].includes(task.status);
}

export function canPauseTask(task) {
  return task.status === "inProgress";
}

export function canCompleteTask(task) {
  return ["planned", "paused", "inProgress", "rescheduled"].includes(task.status);
}

export function estimateFeedback(task) {
  if (task.status !== "completed" || !task.actualMinutes) {
    return "完成后看看原来的估计是否合适。";
  }
  const delta = task.actualMinutes - task.estimatedMinutes;
  const absolute = Math.abs(delta);
  if (absolute <= 2) return "这次估得很接近。";
  if (delta > 0) {
    return `比预计多用 ${absolute} 分钟。下次可以留一点缓冲。`;
  }
  return `比预计少用 ${absolute} 分钟。这项可能比想象中容易。`;
}

export function estimateDeviationMinutes(tasks) {
  const completed = tasks.filter(
    (task) => task.status === "completed" && task.actualMinutes > 0,
  );
  if (!completed.length) return null;
  const total = completed.reduce(
    (sum, task) => sum + Math.abs(task.actualMinutes - task.estimatedMinutes),
    0,
  );
  return Math.round(total / completed.length);
}

export function activeTask(tasks) {
  return tasks.find((task) => task.status === "inProgress") ?? null;
}

export function nextTask(tasks) {
  const order = { inProgress: 0, planned: 1, paused: 1, rescheduled: 2 };
  return [...tasks]
    .filter((task) => task.status in order)
    .sort((a, b) => {
      const statusDelta = order[a.status] - order[b.status];
      return statusDelta || a.sortOrder - b.sortOrder;
    })[0] ?? null;
}

export function taskCompletionSummary(tasks) {
  const countable = tasks.filter((task) => task.status !== "skipped");
  const completed = countable.filter((task) => task.status === "completed");
  return {
    completed: completed.length,
    total: countable.length,
    plannedMinutes: countable.reduce(
      (sum, task) => sum + Number(task.estimatedMinutes || 0),
      0,
    ),
    actualMinutes: completed.reduce(
      (sum, task) => sum + Number(task.actualMinutes || 0),
      0,
    ),
  };
}
