import { lastNDates } from "../utils/date.js";

export function buildWeeklySummary(tasks, entries, endDate) {
  const days = lastNDates(7, endDate);
  const daySet = new Set(days);
  const weekTasks = tasks.filter((task) => daySet.has(task.date));
  const weekEntries = entries.filter((entry) => daySet.has(entry.date));
  const completed = weekTasks.filter((task) => task.status === "completed");
  const adjusted = weekTasks.filter((task) =>
    ["rescheduled", "skipped"].includes(task.status),
  );
  const activeDays = new Set(
    weekTasks
      .filter((task) => task.status !== "planned")
      .map((task) => task.date),
  ).size;
  const estimateDiffs = completed
    .filter((task) => task.actualMinutes > 0)
    .map((task) => Math.abs(task.actualMinutes - task.estimatedMinutes));
  const estimateAverage = estimateDiffs.length
    ? Math.round(estimateDiffs.reduce((sum, value) => sum + value, 0) / estimateDiffs.length)
    : null;
  const earned = weekEntries
    .filter((entry) => entry.amount > 0)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const spent = Math.abs(
    weekEntries
      .filter((entry) => entry.amount < 0)
      .reduce((sum, entry) => sum + entry.amount, 0),
  );
  const daily = days.map((day) => {
    const dayTasks = weekTasks.filter((task) => task.date === day);
    return {
      date: day,
      total: dayTasks.filter((task) => task.status !== "skipped").length,
      completed: dayTasks.filter((task) => task.status === "completed").length,
      plannedMinutes: dayTasks.reduce(
        (sum, task) => sum + Number(task.estimatedMinutes || 0),
        0,
      ),
    };
  });
  return {
    days,
    daily,
    completed: completed.length,
    total: weekTasks.filter((task) => task.status !== "skipped").length,
    adjusted: adjusted.length,
    activeDays,
    estimateAverage,
    earned,
    spent,
  };
}
