import test from "node:test";
import assert from "node:assert/strict";
import { todayView } from "../src/views/today.js";

test("today view puts the parent entrance before the teacher message button", () => {
  const html = todayView({
    today: "2026-11-01",
    tasks: [],
    todaySubjectFilter: "全部",
    todayLedger: [],
    todayFeedback: [],
    balance: 0,
  });
  const parentIndex = html.indexOf('data-action="open-parent"');
  const teacherIndex = html.indexOf('data-action="open-teacher-import"');
  assert.ok(parentIndex >= 0);
  assert.ok(teacherIndex >= 0);
  assert.ok(parentIndex < teacherIndex);
});
