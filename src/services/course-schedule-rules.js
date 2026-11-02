import { addDays, dateKey, parseDateKey } from "../utils/date.js";
import { minutesToTime, timeToMinutes } from "./teacher-import-rules.js?v=1.13.10";

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

export function defaultSemesterRange(today = dateKey()) {
  const date = parseDateKey(today);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 9) || month > 9 || (month === 1 && day <= 15)) {
    const startYear = month === 1 ? year - 1 : year;
    return {
      from: `${startYear}-09-01`,
      to: `${startYear + 1}-01-15`,
      label: `${startYear} 年秋季学期`,
    };
  }
  if (
    (month === 2 && day >= 15) ||
    month === 3 ||
    month === 4 ||
    month === 5 ||
    month === 6 ||
    (month === 7 && day === 1)
  ) {
    return {
      from: `${year}-02-15`,
      to: `${year}-07-01`,
      label: `${year} 年春季学期`,
    };
  }
  if ((month === 1 && day > 15) || (month === 2 && day < 15)) {
    return {
      from: `${year}-02-15`,
      to: `${year}-07-01`,
      label: `${year} 年春季学期`,
    };
  }
  return {
    from: `${year}-09-01`,
    to: `${year + 1}-01-15`,
    label: `${year} 年秋季学期`,
  };
}

const WEEKDAY_ALIASES = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 0,
  sun: 0,
};

const DEFAULT_PERIODS = [
  ["08:00", "08:40"],
  ["08:50", "09:30"],
  ["10:00", "10:40"],
  ["10:50", "11:30"],
  ["13:30", "14:10"],
  ["14:20", "15:00"],
  ["15:20", "16:00"],
  ["16:10", "16:50"],
];

function cell(value) {
  return String(value ?? "").replace(/\u3000/g, " ").trim();
}

export function normalizeWeekday(value) {
  const normalized = cell(value).toLowerCase().replace(/\s+/g, "");
  const chinese = normalized.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
  if (chinese) return WEEKDAY_ALIASES[chinese[1]];
  return WEEKDAY_ALIASES[normalized] ?? null;
}

export function parseTimeRange(value) {
  const text = cell(value).replace(/：/g, ":");
  const range = text.match(
    /(\d{1,2}):(\d{2})\s*(?:-|–|—|~|～|至|到)\s*(\d{1,2}):(\d{2})/,
  );
  if (range) {
    const start = `${String(Number(range[1])).padStart(2, "0")}:${range[2]}`;
    const end = `${String(Number(range[3])).padStart(2, "0")}:${range[4]}`;
    if (timeToMinutes(start) !== null && timeToMinutes(end) !== null && timeToMinutes(end) > timeToMinutes(start)) {
      return { startTime: start, endTime: end };
    }
  }
  const period = text.match(/第?\s*([一二三四五六七八1-8])\s*(?:节|节课|课时)/);
  if (period) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };
    const index = Number(map[period[1]] || period[1]) - 1;
    if (DEFAULT_PERIODS[index]) {
      return {
        startTime: DEFAULT_PERIODS[index][0],
        endTime: DEFAULT_PERIODS[index][1],
        inferred: true,
      };
    }
  }
  return null;
}

function normalizeSeparateTimes(start, end) {
  let startTime = cell(start).replace(/：/g, ":");
  let endTime = cell(end).replace(/：/g, ":");
  if (/^\d{1,2}$/.test(startTime)) startTime = `${startTime.padStart(2, "0")}:00`;
  if (/^\d{1,2}$/.test(endTime)) endTime = `${endTime.padStart(2, "0")}:00`;
  const sm = timeToMinutes(startTime);
  const em = timeToMinutes(endTime);
  if (sm === null || em === null || em <= sm) return null;
  return { startTime, endTime };
}

function cleanCourseCell(value) {
  const compact = cell(value).replace(/<br\s*\/?>/gi, "\n");
  if (!compact || /^[-\/—–]+$/.test(compact)) return null;
  if (/^(午休|课间|休息|午餐|时间|星期|周次)$/.test(compact)) return null;
  const lines = compact
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let title = lines.shift() || compact;
  let location = lines.join(" ");
  const atMatch = title.match(/^(.+?)\s*[@在]\s*(.+)$/);
  if (atMatch) {
    title = atMatch[1].trim();
    location = location || atMatch[2].trim();
  }
  let teacher = "";
  const teacherMatch = title.match(/^(.+?)[（(]([^）)]{2,16})[）)]$/);
  if (
    teacherMatch &&
    !/楼|室|场|班|馆|厅|校区|如图|图片/.test(teacherMatch[2])
  ) {
    title = teacherMatch[1].trim();
    teacher = teacherMatch[2].trim();
  }
  return {
    title: title.slice(0, 40),
    location: location.slice(0, 60),
    teacher: teacher.slice(0, 20),
  };
}

function baseCourse(parts, options) {
  return {
    weekday: parts.weekday,
    title: parts.title,
    location: parts.location || "",
    teacher: parts.teacher || "",
    startTime: parts.startTime,
    endTime: parts.endTime,
    effectiveFrom: options.effectiveFrom,
    effectiveTo: options.effectiveTo || "",
    inferredTime: Boolean(parts.inferredTime),
  };
}

function parseGrid(rows, options, warnings) {
  let headerIndex = -1;
  let weekdayColumns = [];
  for (let index = 0; index < Math.min(rows.length, 8); index += 1) {
    const columns = rows[index]
      .map((value, column) => ({ weekday: normalizeWeekday(value), column }))
      .filter((item) => item.weekday !== null);
    if (columns.length >= 2) {
      headerIndex = index;
      weekdayColumns = columns;
      break;
    }
  }
  if (headerIndex < 0) return [];

  const header = rows[headerIndex];
  const timeColumn = header.findIndex((value) =>
    /时间|节次|时段|课程时间/.test(cell(value)),
  );
  const courses = [];
  for (const row of rows.slice(headerIndex + 1)) {
    let timeInfo = null;
    if (timeColumn >= 0) timeInfo = parseTimeRange(row[timeColumn]);
    if (!timeInfo) {
      for (const value of row) {
        timeInfo = parseTimeRange(value);
        if (timeInfo) break;
      }
    }
    if (!timeInfo) continue;
    if (timeInfo.inferred) {
      warnings.add("有些课程只写了第几节，已按常见时段填入，请核对具体时间。");
    }
    for (const { weekday, column } of weekdayColumns) {
      const entry = cleanCourseCell(row[column]);
      if (!entry) continue;
      courses.push(
        baseCourse(
          {
            ...entry,
            weekday,
            ...timeInfo,
          },
          options,
        ),
      );
    }
  }
  return courses;
}

function headerIndexes(row) {
  const indexes = {
    weekday: -1,
    course: -1,
    location: -1,
    teacher: -1,
    start: -1,
    end: -1,
    time: -1,
  };
  row.forEach((value, index) => {
    const text = cell(value);
    if (/星期|周几/.test(text)) indexes.weekday = index;
    else if (/课程|科目|内容/.test(text)) indexes.course = index;
    else if (/地点|教室|场地/.test(text)) indexes.location = index;
    else if (/教师|老师|任课/.test(text)) indexes.teacher = index;
    else if (/开始/.test(text)) indexes.start = index;
    else if (/结束/.test(text)) indexes.end = index;
    else if (/时间|节次|时段/.test(text)) indexes.time = index;
  });
  return indexes;
}

function parseLongTable(rows, options, warnings) {
  const courses = [];
  const headerIndex = rows.findIndex((row) => {
    const indexes = headerIndexes(row);
    return indexes.weekday >= 0 && indexes.course >= 0;
  });

  if (headerIndex >= 0) {
    const indexes = headerIndexes(rows[headerIndex]);
    for (const row of rows.slice(headerIndex + 1)) {
      const weekday = normalizeWeekday(row[indexes.weekday]);
      const entry = cleanCourseCell(row[indexes.course]);
      if (weekday === null || !entry) continue;
      let timeInfo =
        indexes.start >= 0 && indexes.end >= 0
          ? normalizeSeparateTimes(row[indexes.start], row[indexes.end])
          : null;
      if (!timeInfo && indexes.time >= 0) timeInfo = parseTimeRange(row[indexes.time]);
      if (!timeInfo) {
        for (const value of row) {
          timeInfo = parseTimeRange(value);
          if (timeInfo) break;
        }
      }
      if (!timeInfo) {
        warnings.add("有课程缺少时间，已跳过；请在表格中补充开始和结束时间。");
        continue;
      }
      if (timeInfo.inferred) {
        warnings.add("有些课程只写了第几节，已按常见时段填入，请核对具体时间。");
      }
      courses.push(
        baseCourse(
          {
            ...entry,
            weekday,
            location: indexes.location >= 0 ? cell(row[indexes.location]) : entry.location,
            teacher: indexes.teacher >= 0 ? cell(row[indexes.teacher]) : entry.teacher,
            ...timeInfo,
          },
          options,
        ),
      );
    }
    return courses;
  }

  for (const row of rows) {
    const joined = row.map(cell).filter(Boolean).join(" ");
    const weekday = normalizeWeekday(joined);
    const timeInfo = parseTimeRange(joined);
    if (weekday === null || !timeInfo) continue;
    const remaining = joined
      .replace(/(?:周|星期|礼拜)[一二三四五六日天]/g, " ")
      .replace(/\d{1,2}:\d{2}\s*(?:-|–|—|~|～|至|到)\s*\d{1,2}:\d{2}/g, " ")
      .trim();
    const entry = cleanCourseCell(remaining);
    if (!entry) continue;
    courses.push(
      baseCourse(
        {
          ...entry,
          weekday,
          ...timeInfo,
        },
        options,
      ),
    );
  }
  return courses;
}

function finalizeCourses(parsed, warnings) {
  const unique = [];
  const seen = new Set();
  for (const course of parsed) {
    const key = `${course.weekday}|${course.startTime}|${course.endTime}|${course.title}|${course.teacher}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...course,
      draftId: `course_${unique.length + 1}`,
      include: true,
      duplicate: false,
      conflict: false,
    });
  }
  if (!unique.length) warnings.add("没有识别出课程，请检查星期、时间和课程列。");
  return { courses: unique, warnings: [...warnings].length ? [...warnings] : [] };
}

export function parseCourseRows(rows, options = {}) {
  const effectiveFrom = options.effectiveFrom || dateKey();
  const effectiveTo = options.effectiveTo || "";
  const warnings = new Set();
  const parsed = [
    ...parseGrid(rows, { effectiveFrom, effectiveTo }, warnings),
    ...parseLongTable(rows, { effectiveFrom, effectiveTo }, warnings),
  ];
  return finalizeCourses(parsed, warnings);
}

export function parseCourseText(text, options = {}) {
  const effectiveFrom = options.effectiveFrom || dateKey();
  const effectiveTo = options.effectiveTo || "";
  const warnings = new Set();
  const courses = [];
  let currentWeekday = null;
  let firstHeaderSeen = false;

  const normalizeLine = (value) =>
    cell(value)
      .replace(/\*\*/g, "")
      .replace(/^#{1,6}\s*/, "")
      .replace(/^[-*•]\s*/, "")
      .trim();

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line) continue;
    const weekday = normalizeWeekday(line);
    if (weekday !== null && /^(?:周|星期|礼拜)[一二三四五六日天]$/.test(line)) {
      if (!firstHeaderSeen && courses.length) {
        const inferredWeekday = (weekday + 6) % 7;
        courses.forEach((course) => {
          if (course.weekday === null) course.weekday = inferredWeekday;
        });
        warnings.add("开头课程缺少星期标题，已按下一个星期标题推定为前一天，请核对。");
      }
      currentWeekday = weekday;
      firstHeaderSeen = true;
      continue;
    }

    const timeMatch = line.match(
      /^(\d{1,2}:\d{2}\s*[—–\-~～至到]\s*\d{1,2}:\d{2})\s*[：:]?\s*(.+)$/,
    );
    if (!timeMatch) continue;
    const timeInfo = parseTimeRange(timeMatch[1]);
    if (!timeInfo) continue;
    const entryText = timeMatch[2]
      .replace(/^第?\s*[一二三四五六七八九十0-9]+\s*节\s*/, "")
      .trim();
    const entry = cleanCourseCell(entryText);
    if (!entry) continue;
    courses.push({
      ...baseCourse(
        {
          ...entry,
          weekday: currentWeekday,
          ...timeInfo,
        },
        { effectiveFrom, effectiveTo },
      ),
    });
  }

  if (!firstHeaderSeen && courses.some((course) => course.weekday === null)) {
    warnings.add("没有找到“星期几”标题，请为每门课程选择星期。");
  }
  return finalizeCourses(courses, warnings);
}

export function courseHasConflict(candidate, pool) {
  if (candidate.effectiveTo && candidate.effectiveFrom > candidate.effectiveTo) return true;
  return pool.some((other) => {
    if (other === candidate || other.weekday !== candidate.weekday) return false;
    if (
      candidate.effectiveTo &&
      other.effectiveFrom > candidate.effectiveTo
    ) return false;
    if (
      other.effectiveTo &&
      candidate.effectiveFrom > other.effectiveTo
    ) return false;
    return (
      timeToMinutes(candidate.startTime) < timeToMinutes(other.endTime) &&
      timeToMinutes(candidate.endTime) > timeToMinutes(other.startTime)
    );
  });
}

export function markCourseDuplicates(courses, existingCourses = []) {
  const pool = [...existingCourses];
  return courses.map((course) => {
    const duplicate = pool.some(
      (existing) =>
        existing.weekday === course.weekday &&
        existing.startTime === course.startTime &&
        existing.endTime === course.endTime &&
        existing.title.trim() === course.title.trim() &&
        courseDateRangesOverlap(existing, course),
    );
    const conflict = !duplicate && courseHasConflict(course, pool);
    const marked = {
      ...course,
      duplicate,
      conflict,
      include: !duplicate && !conflict,
    };
    pool.push(marked);
    return marked;
  });
}

function courseDateRangesOverlap(left, right) {
  const leftFrom = left.effectiveFrom || "0000-01-01";
  const rightFrom = right.effectiveFrom || "0000-01-01";
  const leftTo = left.effectiveTo || "9999-12-31";
  const rightTo = right.effectiveTo || "9999-12-31";
  return leftFrom <= rightTo && rightFrom <= leftTo;
}

export function buildCourseOccurrences(courses, startDate, endDate) {
  const occurrences = [];
  let day = startDate;
  let guard = 0;
  while (day <= endDate && guard < 370) {
    const weekday = parseDateKey(day).getDay();
    for (const course of courses) {
      if (Number(course.weekday) !== weekday) continue;
      if (course.effectiveFrom && day < course.effectiveFrom) continue;
      if (course.effectiveTo && day > course.effectiveTo) continue;
      occurrences.push({
        ...course,
        id: `course_instance_${course.id}_${day}`,
        date: day,
        scheduledStart: course.startTime,
        scheduledEnd: course.endTime,
        kind: "course",
      });
    }
    day = addDays(day, 1);
    guard += 1;
  }
  return occurrences;
}

export function courseDurationMinutes(course) {
  return timeToMinutes(course.endTime) - timeToMinutes(course.startTime);
}

export function weekdayLabel(weekday) {
  return WEEKDAY_OPTIONS.find((item) => item.value === Number(weekday))?.label || "";
}

export function timeRangeLabel(course) {
  return `${course.startTime}–${course.endTime}`;
}

export function normalizeCourseTime(value) {
  const parsed = timeToMinutes(value);
  return parsed === null ? "" : minutesToTime(parsed);
}
