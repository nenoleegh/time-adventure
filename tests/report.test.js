import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklySummary } from "../src/services/report-rules.js";

test("weekly report derives trends from tasks and the append-only ledger", () => {
  const tasks = [
    {
      date: "2026-10-20",
      status: "completed",
      estimatedMinutes: 20,
      actualMinutes: 24,
    },
    {
      date: "2026-10-21",
      status: "skipped",
      estimatedMinutes: 30,
      actualMinutes: null,
    },
    {
      date: "2026-10-24",
      status: "completed",
      estimatedMinutes: 15,
      actualMinutes: 14,
    },
    {
      date: "2026-10-10",
      status: "completed",
      estimatedMinutes: 10,
      actualMinutes: 10,
    },
  ];
  const ledger = [
    { date: "2026-10-20", amount: 10 },
    { date: "2026-10-10", amount: 30 },
  ];
  const summary = buildWeeklySummary(tasks, ledger, "2026-10-24");
  assert.equal(summary.completed, 2);
  assert.equal(summary.adjusted, 1);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.estimateAverage, 3);
  assert.equal(summary.earned, 10);
  assert.equal(summary.days.length, 7);
});

test("empty weekly report has honest null values", () => {
  const summary = buildWeeklySummary([], [], "2026-10-24");
  assert.equal(summary.completed, 0);
  assert.equal(summary.estimateAverage, null);
  assert.equal(summary.activeDays, 0);
});
