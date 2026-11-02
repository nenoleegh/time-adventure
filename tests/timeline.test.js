import test from "node:test";
import assert from "node:assert/strict";
import {
  assignTaskLanes,
  isCompletedOnTime,
  scheduleTimelineHtml,
  taskColorClass,
  TIMELINE_PIXELS_PER_MINUTE,
} from "../src/views/schedule-timeline.js";

test("scheduled subjects get stable colors", () => {
  assert.equal(taskColorClass({ title: "语文：朗读课文" }), "color-1");
  assert.equal(taskColorClass({ title: "数学：口算" }), "color-2");
  assert.equal(
    taskColorClass({ title: "整理书包" }),
    taskColorClass({ title: "整理书包" }),
  );
});

test("on-time completion compares against the local scheduled end", () => {
  const completedAt = new Date(2026, 9, 24, 10, 30).toISOString();
  assert.equal(
    isCompletedOnTime({
      status: "completed",
      completedAt,
      date: "2026-10-24",
      scheduledEnd: "10:30",
    }),
    true,
  );
  assert.equal(
    isCompletedOnTime({
      status: "completed",
      completedAt: new Date(2026, 9, 24, 10, 31).toISOString(),
      date: "2026-10-24",
      scheduledEnd: "10:30",
    }),
    false,
  );
});

test("timeline scale keeps one minute equal to one pixel", () => {
  assert.equal(TIMELINE_PIXELS_PER_MINUTE, 1);
});

test("day-view tasks alternate lanes within the same hour", () => {
  const lanes = assignTaskLanes([
    {
      id: "task-a",
      date: "2026-11-01",
      scheduledStart: "09:00",
      scheduledEnd: "09:10",
      sortOrder: 0,
    },
    {
      id: "task-b",
      date: "2026-11-01",
      scheduledStart: "09:10",
      scheduledEnd: "09:20",
      sortOrder: 1,
    },
    {
      id: "task-c",
      date: "2026-11-01",
      scheduledStart: "09:40",
      scheduledEnd: "09:50",
      sortOrder: 2,
    },
    {
      id: "task-d",
      date: "2026-11-01",
      scheduledStart: "10:00",
      scheduledEnd: "10:10",
      sortOrder: 3,
    },
  ]);
  assert.equal(lanes.get("task-a"), 0);
  assert.equal(lanes.get("task-b"), 1);
  assert.equal(lanes.get("task-c"), 0);
  assert.equal(lanes.get("task-d"), 0);
});

test("automatic break is rendered as a separate, non-draggable timeline block", () => {
  const html = scheduleTimelineHtml({
    planMode: "day",
    planDay: "2026-10-24",
    today: "2026-10-24",
    allTasks: [
      {
        id: "task-1",
        title: "练习册 P44",
        date: "2026-10-24",
        status: "planned",
        estimatedMinutes: 30,
        scheduledStart: "20:45",
        scheduledEnd: "21:15",
        breakBeforeMinutes: 10,
        breakStart: "20:35",
        breakEnd: "20:45",
      },
    ],
    courseTemplates: [],
  });
  assert.match(html, /break-block/);
  assert.match(html, /休息/);
  assert.doesNotMatch(html, /data-drag-task="break/);
});

test("week view shows the teacher beside each course name", () => {
  const html = scheduleTimelineHtml({
    planMode: "week",
    planDay: "2026-10-26",
    today: "2026-10-24",
    allTasks: [],
    courseTemplates: [
      {
        id: "course-1",
        title: "数学",
        teacher: "示例老师乙",
        weekday: 1,
        startTime: "09:30",
        endTime: "10:10",
        effectiveFrom: "2026-09-01",
        effectiveTo: "2027-01-15",
      },
    ],
  });
  assert.match(html, /数学（示例老师乙）/);
});
