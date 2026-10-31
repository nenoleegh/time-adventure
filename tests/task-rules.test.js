import test from "node:test";
import assert from "node:assert/strict";
import {
  canStartTask,
  elapsedMinutes,
  elapsedMs,
  estimateDeviationMinutes,
  estimateFeedback,
  filterTasksBySubject,
  nextTask,
  normalizeEstimate,
  normalizeActualMinutes,
  resolveTaskSubject,
  scheduledMinutesFitDay,
  shiftConflictingTasks,
  taskCompletionSummary,
  taskSubjectFilters,
} from "../src/services/task-rules.js";

test("timer restores from timestamps after the page was suspended", () => {
  const now = new Date("2026-10-24T08:10:00.000Z").getTime();
  const task = {
    status: "inProgress",
    accumulatedMs: 60_000,
    startedAt: "2026-10-24T08:05:00.000Z",
  };
  assert.equal(elapsedMs(task, now), 360_000);
  assert.equal(elapsedMinutes(task, now), 6);
});

test("paused time does not continue increasing", () => {
  const task = { status: "paused", accumulatedMs: 420_000, startedAt: null };
  assert.equal(elapsedMs(task, Date.now() + 100_000), 420_000);
});

test("invalid timer timestamps fall back to accumulated time", () => {
  assert.equal(
    elapsedMs(
      { status: "inProgress", accumulatedMs: 90_000, startedAt: "not-a-date" },
      Date.now(),
    ),
    90_000,
  );
});

test("estimates are bounded to a practical range", () => {
  assert.equal(normalizeEstimate(1), 5);
  assert.equal(normalizeEstimate(30), 30);
  assert.equal(normalizeEstimate(999), 240);
});

test("scheduled duration cannot run past the end of day", () => {
  assert.equal(scheduledMinutesFitDay(23 * 60, 59), true);
  assert.equal(scheduledMinutesFitDay(23 * 60, 60), false);
  assert.equal(scheduledMinutesFitDay(Number.NaN, 20), false);
});

test("a user-entered actual duration overrides the original estimate", () => {
  assert.equal(normalizeActualMinutes(5, 20), 5);
  assert.equal(normalizeActualMinutes("", 20), 20);
  assert.equal(normalizeActualMinutes(-3, 20), 20);
});

test("estimate feedback names the difference without labeling the child", () => {
  assert.match(
    estimateFeedback({
      status: "completed",
      estimatedMinutes: 20,
      actualMinutes: 21,
    }),
    /接近/,
  );
  assert.match(
    estimateFeedback({
      status: "completed",
      estimatedMinutes: 20,
      actualMinutes: 35,
    }),
    /多用 15 分钟/,
  );
});

test("task state rules allow honest pause and completion", () => {
  assert.equal(canStartTask({ status: "paused" }), true);
  assert.equal(canStartTask({ status: "completed" }), false);
});

test("next task prioritizes an active task then planned order", () => {
  const tasks = [
    { id: "a", status: "planned", sortOrder: 1 },
    { id: "b", status: "inProgress", sortOrder: 3 },
    { id: "c", status: "completed", sortOrder: 0 },
  ];
  assert.equal(nextTask(tasks).id, "b");
});

test("completion summary does not count skipped tasks as failure", () => {
  const summary = taskCompletionSummary([
    { status: "completed", estimatedMinutes: 20, actualMinutes: 22 },
    { status: "planned", estimatedMinutes: 15, actualMinutes: null },
    { status: "skipped", estimatedMinutes: 30, actualMinutes: null },
  ]);
  assert.deepEqual(summary, {
    completed: 1,
    total: 2,
    plannedMinutes: 35,
    actualMinutes: 22,
  });
});

test("average estimate difference uses completed tasks only", () => {
  assert.equal(
    estimateDeviationMinutes([
      { status: "completed", estimatedMinutes: 20, actualMinutes: 22 },
      { status: "completed", estimatedMinutes: 30, actualMinutes: 25 },
      { status: "planned", estimatedMinutes: 10, actualMinutes: 0 },
    ]),
    4,
  );
});

test("task subjects use the saved value and fall back to the title", () => {
  assert.equal(
    resolveTaskSubject({ subject: "数学", title: "练习册P44" }),
    "数学",
  );
  assert.equal(
    resolveTaskSubject({ subject: "作业", title: "家默第87页句子" }),
    "英语",
  );
  assert.equal(resolveTaskSubject({ title: "练习小数除法计算" }), "数学");
});

test("today task filters are ordered by subject and preserve counts", () => {
  const tasks = [
    { id: "1", subject: "数学", title: "练习册" },
    { id: "2", subject: "语文", title: "阅读" },
    { id: "3", subject: "数学", title: "口算" },
    { id: "4", subject: "其他", title: "整理书包" },
  ];
  assert.deepEqual(taskSubjectFilters(tasks), [
    { subject: "语文", count: 1 },
    { subject: "数学", count: 2 },
    { subject: "其他", count: 1 },
  ]);
  assert.deepEqual(
    filterTasksBySubject(tasks, "数学").map((task) => task.id),
    ["1", "3"],
  );
  assert.equal(filterTasksBySubject(tasks, "全部").length, 4);
});

test("a priority task pushes overlapping tasks later without cascading overlaps", () => {
  const result = shiftConflictingTasks(
    {
      id: "manual",
      date: "2026-10-25",
      scheduledStart: "10:00",
      scheduledEnd: "10:30",
    },
    [
      {
        id: "a",
        date: "2026-10-25",
        title: "数学",
        status: "planned",
        sortOrder: 1,
        scheduledStart: "10:10",
        scheduledEnd: "10:40",
      },
      {
        id: "b",
        date: "2026-10-25",
        title: "英语",
        status: "planned",
        sortOrder: 2,
        scheduledStart: "10:20",
        scheduledEnd: "10:50",
      },
      {
        id: "blocker",
        date: "2026-10-25",
        title: "阅读",
        status: "planned",
        sortOrder: 3,
        scheduledStart: "11:00",
        scheduledEnd: "11:30",
      },
    ],
  );

  assert.equal(result.unresolved.length, 0);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0].scheduledStart, "10:30");
  assert.equal(result.tasks[0].scheduledEnd, "11:00");
  assert.equal(result.tasks[1].scheduledStart, "11:30");
  assert.equal(result.tasks[1].scheduledEnd, "12:00");
});

test("priority scheduling refuses to move a running task", () => {
  const result = shiftConflictingTasks(
    {
      id: "manual",
      date: "2026-10-25",
      scheduledStart: "10:00",
      scheduledEnd: "10:30",
    },
    [
      {
        id: "running",
        date: "2026-10-25",
        status: "inProgress",
        scheduledStart: "10:10",
        scheduledEnd: "10:40",
      },
    ],
  );
  assert.equal(result.tasks.length, 0);
  assert.equal(result.unresolved[0].id, "running");
});

test("conflicts are not saved when the delayed task cannot fit before midnight", () => {
  const result = shiftConflictingTasks(
    {
      id: "manual",
      date: "2026-10-25",
      scheduledStart: "23:00",
      scheduledEnd: "23:30",
    },
    [
      {
        id: "late",
        date: "2026-10-25",
        status: "planned",
        scheduledStart: "23:10",
        scheduledEnd: "23:40",
      },
    ],
  );
  assert.equal(result.tasks.length, 0);
  assert.equal(result.unresolved[0].id, "late");
});
