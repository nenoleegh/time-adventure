import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskCalendarIcs,
  calendarFileName,
  findDueTaskReminder,
} from "../src/services/reminder-rules.js";

const scheduledTask = {
  id: "task-1",
  date: "2026-10-25",
  title: "练琴",
  scheduledStart: "10:00",
  scheduledEnd: "10:20",
  estimatedMinutes: 20,
  status: "planned",
};

test("a task becomes due at its scheduled minute and only once", () => {
  const due = findDueTaskReminder([scheduledTask], {
    now: new Date(2026, 9, 25, 10, 0, 10),
  });
  assert.equal(due.id, "task-1");

  const alreadyShown = findDueTaskReminder(
    [{ ...scheduledTask, reminderShownFor: "2026-10-25|10:00" }],
    { now: new Date(2026, 9, 25, 10, 1) },
  );
  assert.equal(alreadyShown, null);
});

test("reminder lead time is applied to the task start", () => {
  assert.equal(
    findDueTaskReminder([scheduledTask], {
      now: new Date(2026, 9, 25, 9, 55),
      leadMinutes: 5,
    })?.id,
    "task-1",
  );
  assert.equal(
    findDueTaskReminder([scheduledTask], {
      now: new Date(2026, 9, 25, 9, 50),
      leadMinutes: 5,
    }),
    null,
  );
});

test("calendar event contains a local alarm at task start", () => {
  const ics = buildTaskCalendarIcs(scheduledTask, {
    now: new Date("2026-10-25T02:00:00.000Z"),
  });
  assert.match(ics, /SUMMARY:任务：练琴/);
  assert.match(ics, /DTSTART;TZID=Asia\/Shanghai:20261025T100000/);
  assert.match(ics, /TRIGGER:PT0S/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.equal(calendarFileName(scheduledTask), "练琴-2026-10-25.ics");
});

test("calendar event supports a lead reminder", () => {
  const ics = buildTaskCalendarIcs(scheduledTask, {
    reminderMinutes: 5,
    now: new Date("2026-10-25T02:00:00.000Z"),
  });
  assert.match(ics, /TRIGGER:-PT5M/);
});
