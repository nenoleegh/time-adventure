import {
  deleteRecord,
  getAll,
  getAllByIndex,
  getRecord,
  putMany,
  putRecord,
} from "./db.js?v=1.11.0";
import { makeId } from "../utils/id.js";
import { dateKey } from "../utils/date.js";
import {
  activeTask,
  canCompleteTask,
  canPauseTask,
  canStartTask,
  elapsedMinutes,
  elapsedMs,
  detectSubject,
  normalizeEstimate,
  normalizeActualMinutes,
  scheduledMinutesFitDay,
  shiftConflictingTasks,
} from "./task-rules.js?v=1.11.0";
import { awardTask } from "./ledger-service.js?v=1.11.0";
import {
  minutesToTime,
  parseTeacherMessage,
  timeToMinutes,
} from "./teacher-import-rules.js?v=1.11.0";

export async function getTasksForDate(day) {
  const tasks = await getAllByIndex("tasks", "date", day);
  return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAllTasks() {
  return getAll("tasks");
}

async function persistScheduledTask(task, tasksForDate, prioritize) {
  let shifted = [];
  if (prioritize) {
    const result = shiftConflictingTasks(task, tasksForDate);
    if (result.unresolved.length) {
      const first = result.unresolved[0];
      throw new Error(
        `“${first.title}”无法继续向后顺延，已经超过当天 23:59。请换一个开始时间。`,
      );
    }
    shifted = result.tasks;
  }
  const now = new Date().toISOString();
  const saved = { ...task, updatedAt: now };
  await putMany("tasks", [
    saved,
    ...shifted.map((item) => ({ ...item, updatedAt: now })),
  ]);
  return { ...saved, delayedTaskCount: shifted.length };
}

export async function createTask({
  date,
  title,
  type = "must",
  estimatedMinutes = 20,
  notes = "",
  subject = "",
  scheduledStart = "",
  scheduledEnd = "",
  sourceImportId = null,
}) {
  const cleanTitle = title?.trim();
  if (!cleanTitle) throw new Error("请给这件事写个名字。");
  if (cleanTitle.length > 40) throw new Error("任务名称最多 40 个字。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    throw new Error("请选择有效的任务日期。");
  }
  const current = await getTasksForDate(date);
  const now = new Date().toISOString();
  const normalizedEstimate = normalizeEstimate(estimatedMinutes);
  const startMinutes = timeToMinutes(scheduledStart);
  const endMinutes = timeToMinutes(scheduledEnd);
  if (
    (scheduledStart || scheduledEnd) &&
    (startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes ||
      !scheduledMinutesFitDay(startMinutes, normalizedEstimate))
  ) {
    throw new Error("任务开始时间和预计时长需要安排在当天 23:59 前。");
  }
  const task = {
    id: makeId("task"),
    date,
    title: cleanTitle,
    type,
    subject: subject || detectSubject(cleanTitle),
    estimatedMinutes: normalizedEstimate,
    actualMinutes: null,
    status: "planned",
    sortOrder: current.length ? Math.max(...current.map((task) => task.sortOrder)) + 1 : 0,
    notes: notes.trim(),
    scheduledStart,
    scheduledEnd,
    breakBeforeMinutes: 0,
    breakStart: "",
    breakEnd: "",
    sourceImportId,
    accumulatedMs: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    splitCount: 0,
  };
  const shouldPrioritize = !sourceImportId && scheduledStart && scheduledEnd;
  if (!shouldPrioritize) {
    await putRecord("tasks", task);
    return { ...task, delayedTaskCount: 0 };
  }
  return persistScheduledTask(task, current, true);
}

async function saveTask(task) {
  const saved = { ...task, updatedAt: new Date().toISOString() };
  await putRecord("tasks", saved);
  return saved;
}

export async function startTask(taskId) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (!canStartTask(task)) return task;
  const tasks = await getTasksForDate(task.date);
  const running = activeTask(tasks);
  if (running && running.id !== taskId) await pauseTask(running.id);
  const now = new Date().toISOString();
  return saveTask({ ...task, status: "inProgress", startedAt: now });
}

export async function pauseTask(taskId) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (!canPauseTask(task)) return task;
  const total = elapsedMs(task);
  return saveTask({
    ...task,
    status: "paused",
    accumulatedMs: total,
    startedAt: null,
  });
}

export async function completeTask(taskId, actualMinutesOverride = null) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (task.status === "completed") {
    return { task, reward: { added: false, amount: 0 } };
  }
  if (!canCompleteTask(task)) {
    return { task, reward: { added: false, amount: 0 } };
  }

  const fallbackMinutes = elapsedMinutes(task) || task.estimatedMinutes;
  const actualMinutes = normalizeActualMinutes(
    actualMinutesOverride,
    fallbackMinutes,
  );

  const completed = await saveTask({
    ...task,
    status: "completed",
    accumulatedMs: elapsedMs(task),
    startedAt: null,
    completedAt: task.completedAt || new Date().toISOString(),
    actualMinutes,
  });
  const reward = await awardTask(completed);
  return { task: completed, reward };
}

export async function markTaskReminderShown(taskId, key) {
  const task = await getRecord("tasks", taskId);
  if (!task) return null;
  return saveTask({ ...task, reminderShownFor: key });
}

export async function updateTask(taskId, changes) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  const nextEstimate =
    changes.estimatedMinutes === undefined
      ? task.estimatedMinutes
      : normalizeEstimate(changes.estimatedMinutes);
  const scheduledStart =
    changes.scheduledStart === undefined
      ? task.scheduledStart || ""
      : String(changes.scheduledStart || "");
  let scheduledEnd = task.scheduledEnd || "";
  if (!scheduledStart && changes.scheduledStart !== undefined) {
    scheduledEnd = "";
  }
  if (scheduledStart && (changes.scheduledStart !== undefined || changes.estimatedMinutes !== undefined)) {
    const startMinutes = timeToMinutes(scheduledStart);
    if (startMinutes === null) throw new Error("计划开始时间格式不正确。");
    if (!scheduledMinutesFitDay(startMinutes, nextEstimate)) {
      throw new Error("预计时长会超过当天 23:59，请缩短时长或提前开始。");
    }
    scheduledEnd = minutesToTime(startMinutes + nextEstimate);
  }
  const allowed = {
    title: changes.title?.trim() || task.title,
    type: changes.type || task.type,
    subject:
      changes.subject === undefined
        ? task.subject || detectSubject(changes.title || task.title)
        : String(changes.subject || "其他"),
    estimatedMinutes: nextEstimate,
    notes: changes.notes === undefined ? task.notes : changes.notes.trim(),
    actualMinutes:
      changes.actualMinutes === undefined
        ? task.actualMinutes
        : Math.max(1, Math.round(Number(changes.actualMinutes) || 1)),
    scheduledStart,
    scheduledEnd,
    breakBeforeMinutes:
      changes.scheduledStart === undefined
        ? task.breakBeforeMinutes || 0
        : 0,
    breakStart:
      changes.scheduledStart === undefined ? task.breakStart || "" : "",
    breakEnd:
      changes.scheduledStart === undefined ? task.breakEnd || "" : "",
  };
  if (!allowed.title) throw new Error("任务名称不能为空。");
  const next = { ...task, ...allowed };
  const scheduleChanged =
    changes.scheduledStart !== undefined ||
    changes.estimatedMinutes !== undefined;
  if (!task.sourceImportId && next.scheduledStart && scheduleChanged) {
    const tasks = await getTasksForDate(task.date);
    return persistScheduledTask(next, tasks, true);
  }
  return saveTask(next);
}

export async function moveTask(taskId, direction) {
  const task = await getRecord("tasks", taskId);
  if (!task) return;
  const tasks = await getTasksForDate(task.date);
  const index = tasks.findIndex((item) => item.id === taskId);
  if (index < 0) return;
  const target = index + direction;
  if (target < 0 || target >= tasks.length) return;
  const other = tasks[target];
  const taskOrder = task.sortOrder;
  const otherOrder = other.sortOrder;
  const now = new Date().toISOString();
  await putMany("tasks", [
    { ...task, sortOrder: otherOrder, updatedAt: now },
    { ...other, sortOrder: taskOrder, updatedAt: now },
  ]);
}

export async function rescheduleTask(taskId, newDate) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (task.status === "completed") {
    throw new Error("已完成的任务会保留原来的日期记录。");
  }
  if (task.status === "inProgress") {
    throw new Error("正在计时的任务需要先暂停，再移到下一天。");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(newDate || ""))) {
    throw new Error("请选择有效的安排日期。");
  }
  const destination = await getTasksForDate(newDate);
  return saveTask({
    ...task,
    date: newDate,
    status: "planned",
    startedAt: null,
    sortOrder: destination.length
      ? Math.max(...destination.map((item) => item.sortOrder)) + 1
      : 0,
  });
}

export async function scheduleTask(
  taskId,
  { date, scheduledStart, scheduledEnd, estimatedMinutes, prioritize },
) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (task.status === "completed") throw new Error("已经完成的任务会保留原来的时间记录。");
  const start = timeToMinutes(scheduledStart);
  const end = timeToMinutes(scheduledEnd);
  if (start === null || end === null || end <= start) {
    throw new Error("请选择有效的开始和结束时间。");
  }
  if (!date) throw new Error("请选择安排日期。");
  const destinationTasks = await getTasksForDate(date);
  const next = {
    ...task,
    date,
    scheduledStart,
    scheduledEnd,
    breakBeforeMinutes: 0,
    breakStart: "",
    breakEnd: "",
    estimatedMinutes:
      estimatedMinutes === undefined
        ? task.estimatedMinutes
        : normalizeEstimate(estimatedMinutes),
    sortOrder:
      date === task.date
        ? task.sortOrder
        : destinationTasks.length
          ? Math.max(...destinationTasks.map((item) => item.sortOrder)) + 1
          : 0,
  };
  return persistScheduledTask(
    next,
    destinationTasks,
    prioritize === undefined ? !task.sourceImportId : Boolean(prioritize),
  );
}

export async function skipTask(taskId) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (task.status === "completed") {
    throw new Error("已完成的任务不能再标记为跳过。");
  }
  return saveTask({
    ...task,
    status: "skipped",
    accumulatedMs: elapsedMs(task),
    startedAt: null,
  });
}

export async function splitTask(taskId) {
  const task = await getRecord("tasks", taskId);
  if (!task) throw new Error("没有找到这个任务。");
  if (task.estimatedMinutes < 10) throw new Error("这个任务已经很短了，可以直接开始。");
  if ((task.splitCount || 0) >= 1) throw new Error("这项任务已经拆过一次，先试试现在的小步骤。");
  const firstMinutes = Math.round(task.estimatedMinutes / 2);
  const secondMinutes = task.estimatedMinutes - firstMinutes;
  const tasks = await getTasksForDate(task.date);
  const now = new Date().toISOString();
  const firstStart = timeToMinutes(task.scheduledStart);
  const first = {
    ...task,
    title: `${task.title}（1）`,
    estimatedMinutes: firstMinutes,
    scheduledEnd:
      firstStart === null ? task.scheduledEnd || "" : minutesToTime(firstStart + firstMinutes),
    splitCount: 1,
    updatedAt: now,
  };
  const second = {
    ...task,
    id: makeId("task"),
    title: `${task.title}（2）`,
    estimatedMinutes: secondMinutes,
    sortOrder: task.sortOrder + 1,
    status: "planned",
    accumulatedMs: 0,
    startedAt: null,
    actualMinutes: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    splitCount: 1,
    scheduledStart: "",
    scheduledEnd: "",
  };
  const later = tasks.filter((item) => item.sortOrder > task.sortOrder);
  await putMany("tasks", [
    first,
    second,
    ...later.map((item, index) => ({
      ...item,
      sortOrder: second.sortOrder + index + 1,
      updatedAt: now,
    })),
  ]);
  return [first, second];
}

export async function deleteTask(taskId) {
  const task = await getRecord("tasks", taskId);
  if (!task || task.status === "completed") throw new Error("已完成的任务会保留在成长记录中。");
  await deleteRecord("tasks", taskId);
}

const SUBJECT_BACKFILL_VERSION = 2;

function normalizedImportText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function bestImportedSubject(records, candidates, candidateText) {
  const normalizedCandidates = candidates
    .map((candidate) => ({
      subject: candidate.subject,
      text: normalizedImportText(candidateText(candidate)),
    }))
    .filter((candidate) => candidate.subject && candidate.text.length >= 3);
  let best = null;
  for (const record of records) {
    const normalizedRecord = normalizedImportText(record);
    if (normalizedRecord.length < 3) continue;
    for (const candidate of normalizedCandidates) {
      const exact = normalizedRecord === candidate.text;
      const contains =
        normalizedRecord.includes(candidate.text) ||
        candidate.text.includes(normalizedRecord);
      if (!exact && !contains) continue;
      const score =
        (exact ? 1000 : 0) +
        Math.min(normalizedRecord.length, candidate.text.length);
      if (!best || score > best.score) {
        best = { subject: candidate.subject, score };
      }
    }
  }
  return best?.subject || null;
}

export function resolveImportedTaskSubject(task, importRecord) {
  if (!importRecord?.message) return null;
  const parsed = parseTeacherMessage(importRecord.message, {
    today: importRecord.date || task.date || dateKey(),
  });
  return bestImportedSubject(
    [task.title, task.notes],
    parsed.tasks,
    (candidate) => candidate.title,
  );
}

export async function backfillTaskSubjects() {
  const [tasks, imports] = await Promise.all([
    getAll("tasks"),
    getAll("teacherImports"),
  ]);
  const importById = new Map(imports.map((item) => [item.id, item]));
  const changed = [];
  for (const task of tasks) {
    if (task.sourceImportId && task.subjectBackfillVersion !== SUBJECT_BACKFILL_VERSION) {
      const resolvedSubject = resolveImportedTaskSubject(
        task,
        importById.get(task.sourceImportId),
      );
      if (resolvedSubject) {
        changed.push({
          ...task,
          subject: resolvedSubject,
          subjectBackfillVersion: SUBJECT_BACKFILL_VERSION,
        });
      }
      continue;
    }
    if (task.subject && task.subject !== "作业") continue;
    const titleSubject = detectSubject(task.title);
    changed.push({
      ...task,
      subject: titleSubject !== "其他" ? titleSubject : "其他",
    });
  }
  if (changed.length) await putMany("tasks", changed);
  return changed.length;
}
