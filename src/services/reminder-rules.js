import { dateKey } from "../utils/date.js";

function minutesOfDay(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function reminderKey(task) {
  return task?.scheduledStart ? `${task.date}|${task.scheduledStart}` : "";
}

export function findDueTaskReminder(
  tasks,
  { now = new Date(), leadMinutes = 0, windowMinutes = 10 } = {},
) {
  const today = dateKey(now);
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return (
    tasks
      .filter(
        (task) =>
          task.date === today &&
          ["planned", "paused", "rescheduled"].includes(task.status) &&
          task.scheduledStart,
      )
      .map((task) => ({
        task,
        triggerMinutes: minutesOfDay(task.scheduledStart) - leadMinutes,
        key: reminderKey(task),
      }))
      .filter(
        (item) =>
          item.triggerMinutes !== null &&
          item.task.reminderShownFor !== item.key &&
          nowMinutes >= item.triggerMinutes &&
          nowMinutes < item.triggerMinutes + windowMinutes,
      )
      .sort((a, b) => a.triggerMinutes - b.triggerMinutes)[0]?.task ?? null
  );
}

function calendarText(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function compactDate(day) {
  return String(day || "").replaceAll("-", "");
}

function compactTime(value) {
  return String(value || "").replace(":", "") + "00";
}

function timestamp(value) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildTaskCalendarIcs(
  task,
  { reminderMinutes = 0, now = new Date(), timezone = "Asia/Shanghai" } = {},
) {
  if (!task?.date || !task?.scheduledStart || !task?.scheduledEnd) {
    throw new Error("任务需要先安排开始和结束时间，才能加入日历。");
  }
  const trigger =
    reminderMinutes > 0 ? `-PT${Math.round(reminderMinutes)}M` : "PT0S";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Time Adventure//Task Reminder//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarText("时间冒险家")}`,
    `X-WR-TIMEZONE:${timezone}`,
    "BEGIN:VTIMEZONE",
    `TZID:${timezone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${calendarText(task.id)}@time-adventure.local`,
    `DTSTAMP:${timestamp(now)}`,
    `DTSTART;TZID=${timezone}:${compactDate(task.date)}T${compactTime(task.scheduledStart)}`,
    `DTEND;TZID=${timezone}:${compactDate(task.date)}T${compactTime(task.scheduledEnd)}`,
    `SUMMARY:${calendarText(`任务：${task.title}`)}`,
    `DESCRIPTION:${calendarText("由时间冒险家安排的提醒。修改任务后请重新添加日历事件。")}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${calendarText(`该开始“${task.title}”了`)}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function calendarFileName(task) {
  const safeTitle = String(task?.title || "任务")
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 28);
  return `${safeTitle}-${task?.date || dateKey()}.ics`;
}
