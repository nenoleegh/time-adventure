const CN_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(key, amount) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function weekKey(key) {
  const date = parseDateKey(key);
  const day = date.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + distanceToMonday);
  return dateKey(date);
}

export function formatDateCN(key, options = {}) {
  const date = parseDateKey(key);
  const suffix = options.weekday === false ? "" : ` ${CN_WEEKDAYS[date.getDay()]}`;
  return `${date.getMonth() + 1}月${date.getDate()}日${suffix}`;
}

export function formatTime(dateOrIso) {
  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatShortDate(key) {
  const date = parseDateKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatMinutes(totalMinutes) {
  const value = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (value < 60) return `${value} 分钟`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

export function lastNDates(count, endKey = dateKey()) {
  return Array.from({ length: count }, (_, index) => addDays(endKey, index - count + 1));
}
