import { addDays, dateKey, parseDateKey } from "../utils/date.js";
import { detectSubject } from "./task-rules.js?v=1.13.8";

export const DEFAULT_IMPORT_SETTINGS = {
  identifiers: [],
  praiseKeywords: [
    "表扬",
    "优秀",
    "满分",
    "全对",
    "进步",
    "认真",
    "按时完成",
    "学霸",
    "之星",
  ],
  criticismKeywords: [
    "批评",
    "没交",
    "未交",
    "缺交",
    "少做",
    "未完成",
    "不合格",
    "错误较多",
    "错题",
    "没及时订正",
    "没有及时订正",
    "未订正",
    "没订正",
    "没有订正",
    "需加强",
    "未能按时提交",
    "未按时",
    "迟到",
  ],
  weekdayStartTime: "17:00",
  weekdayEndTime: "21:30",
  dinnerStartTime: "18:00",
  dinnerMinutes: 45,
};

const WEEKDAY_NUMBER = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

const TASK_CUES =
  /作业|练习册|练习卷|练习|习题|口算|计算|练计算|每日一题|背诵|背书本|背课文|背书|默写|家默|听写|单词|词语|预习|复习|抄写|阅读|作文|试卷|卷子|手抄报|读书|朗读|读课文|整理错题|订正|修改|启智|仿照|画图|写自己|数学书|语文书|英语书|(?:^|[，；\s])完成|准备/;
const FEEDBACK_CUES =
  /完成情况|学习情况|表现|反馈|表扬|批评|全对|满分|优秀|进步|学霸|之星|未交|缺交|补交|未完成|未按时|不合格|错误较多|错题|未订正|没订正|没有订正|需加强|迟到/;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replaceAll(" ", "")
    .replaceAll("\u3000", "")
    .trim();
}

export function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function roundUpToFive(minutes) {
  return Math.ceil(minutes / 5) * 5;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function resolveWeekday(text, today) {
  const match = text.match(/(下周|本周|这周|周|星期)([一二三四五六日天])/);
  if (!match) return null;
  const target = WEEKDAY_NUMBER[match[2]];
  const base = parseDateKey(today);
  if (match[1] === "下周") {
    const nextMonday = startOfWeek(base);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const offset = target === 0 ? 6 : target - 1;
    nextMonday.setDate(nextMonday.getDate() + offset);
    return dateKey(nextMonday);
  }
  if (match[1] === "本周" || match[1] === "这周") {
    const monday = startOfWeek(base);
    const offset = target === 0 ? 6 : target - 1;
    monday.setDate(monday.getDate() + offset);
    if (dateKey(monday) < today) monday.setDate(monday.getDate() + 7);
    return dateKey(monday);
  }
  let delta = (target - base.getDay() + 7) % 7;
  if (delta === 0) delta = 0;
  const resolved = new Date(base);
  resolved.setDate(resolved.getDate() + delta);
  return dateKey(resolved);
}

export function inferDueDate(text, today = dateKey()) {
  const mentionsWeekendDeadline =
    /(?:^|[，。；;：:\s])(?:本|这|下)?周末(?:作业|任务|完成|完成情况|前|内|交|提交|检查|做|复习|预习|安排|计划)/.test(
      text,
    ) ||
    /利用(?:本|这|下)?周末/.test(text) ||
    /(?:在|到|于)(?:本|这|下)?周末(?:前|内|完成|交|提交|检查|做|复习|预习|安排|计划)/.test(
      text,
    );
  if (/下周末/.test(text) && mentionsWeekendDeadline) {
    const date = parseDateKey(today);
    date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
    return dateKey(date);
  }
  if (mentionsWeekendDeadline) {
    const date = parseDateKey(today);
    const day = date.getDay();
    if (day === 0 || day === 6) return today;
    date.setDate(date.getDate() + (6 - day));
    return dateKey(date);
  }
  if (/今天|今日/.test(text)) return today;
  if (/明天|明日/.test(text)) return addDays(today, 1);
  if (/后天/.test(text)) return addDays(today, 2);

  const explicit = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  if (explicit) {
    const base = parseDateKey(today);
    const year = explicit[1] ? Number(explicit[1]) : base.getFullYear();
    const build = (candidateYear) =>
      `${candidateYear}-${String(Number(explicit[2])).padStart(2, "0")}-${String(Number(explicit[3])).padStart(2, "0")}`;
    const candidate = build(year);
    if (explicit[1]) return candidate;
    const nextYear = build(year + 1);
    const currentDistance = Math.abs(parseDateKey(candidate) - base);
    const nextDistance = Math.abs(parseDateKey(nextYear) - base);
    return nextDistance < currentDistance ? nextYear : candidate;
  }

  const slash = text.match(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?:[^\d]|$)/);
  if (slash) {
    const base = parseDateKey(today);
    const build = (year) =>
      `${year}-${String(Number(slash[1])).padStart(2, "0")}-${String(Number(slash[2])).padStart(2, "0")}`;
    const candidate = build(base.getFullYear());
    const nextYear = build(base.getFullYear() + 1);
    const currentDistance = Math.abs(parseDateKey(candidate) - base);
    const nextDistance = Math.abs(parseDateKey(nextYear) - base);
    return nextDistance < currentDistance ? nextYear : candidate;
  }

  return resolveWeekday(text, today);
}

function upcomingSunday(today) {
  const date = parseDateKey(today);
  const distance = (7 - date.getDay()) % 7;
  return addDays(today, distance);
}

function stripBrackets(value) {
  let text = value.trim();
  const matchingClose = {
    "【": "】",
    "[": "]",
    "（": "）",
    "(": ")",
  };
  const wrapsWholeLine = () => {
    const open = text[0];
    const close = matchingClose[open];
    if (!close || text.at(-1) !== close) return false;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === open) depth += 1;
      if (text[index] === close) depth -= 1;
      if (depth === 0) return index === text.length - 1;
    }
    return false;
  };
  while (wrapsWholeLine()) {
    text = text.slice(1, -1).trim();
  }
  return text.replace(/^[【\[]|[】\]]$/g, "").trim();
}

function detectSection(rawLine, today) {
  const clean = stripBrackets(rawLine)
    .replace(/^[#*\-\s]+/, "")
    .trim();
  if (!clean || clean.length > 36) return null;
  const divider = clean.search(/[：:]/);
  const prefix = (divider >= 0 ? clean.slice(0, divider) : clean).trim();
  const content = divider >= 0 ? clean.slice(divider + 1).trim() : "";
  const isFeedback =
    /(?:完成情况|学习情况|学习反馈|情况反馈|表现情况|课堂小结|小结|反馈)$/.test(
      prefix,
    );
  const headingWithoutNumber = prefix
    .replace(/^[一二三四五六七八九十0-9]+\s*[、.．]\s*/, "")
    .replace(/^[^\p{L}]+/u, "");
  const homeworkHeading = headingWithoutNumber.replace(
    /^(?:语文|数学|英语|科学|信息科技|道德与法治|体育|美术|音乐|劳动)\s*/,
    "",
  );
  const isHomework =
    /^(?:(?:今日|今天|明日|明天|本周|下周|周末|(?:周|星期|礼拜)[一二三四五六日天])(?:的)?)?(?:作业|任务)(?:清单|如下|安排|布置|为|内容)?(?:[（(].*?[）)])?$/.test(
      homeworkHeading,
    ) || /，作业为$/.test(prefix);
  const detectedSubject = subjectOf(prefix);
  const isSubjectHeading =
    detectedSubject !== "作业" &&
    /^(?:(?:\d{1,2}[.月/\-]\d{1,2}(?:日)?\s*)?(?:语文|数学|英语|科学|信息科技|道德与法治|体育|美术|音乐|劳动)(?:[-—·\s]*[\p{L}]{1,12}(?:老师)?)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)$/u.test(
      clean,
    );
  if (!isFeedback && !isHomework && !isSubjectHeading) return null;
  return {
    kind: isFeedback ? "feedback" : isHomework ? "homework" : null,
    date: inferDueDate(prefix, today),
    subject: detectedSubject,
    content: isSubjectHeading ? "" : content,
  };
}

function cleanLine(value) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/^[\s>*•·\-–—✅✔☑️]+/u, "")
    .replace(/^\d+[.、．)）]\s*/, "")
    .replace(/^[（(]\d+[)）]\s*/, "")
    .trim();
}

function splitSentences(value) {
  return value
    .split(/[。；;]+/)
    .map(cleanLine)
    .filter(Boolean);
}

function splitMixedTaskFeedback(value) {
  return value
    .split(/(?=(?:今天|昨日|昨天)?未交(?:阅读|练习|作业|手册|试卷|卷子))/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchedKeywords(text, keywords) {
  const normalized = normalize(text)
    .toLowerCase()
    .replace(/^\d{1,2}[.\/-]\d{1,2}(?=[a-z\u4e00-\u9fa5])/, "");
  return keywords.filter((keyword) => {
    const clean = normalize(keyword).toLowerCase();
    if (!clean) return false;
    if (/^\d+$/.test(clean)) {
      const detailNumbers = normalized
        .split(/[：:]/)
        .slice(1)
        .join(" ")
        .match(/\d+/g);
      if (detailNumbers?.includes(clean)) return true;
      const lists = normalized.match(
        /(?:^|[：:（(])\s*\d{1,3}(?:[.、,，]\d{1,3}){1,}/g,
      ) || [];
      if (
        lists.some((list) =>
          list
            .split(/[^\d]+/)
            .filter(Boolean)
            .includes(clean),
        )
      ) {
        return true;
      }
      return new RegExp(
        `(?:^|[、,，;；:：（(\\s]|学号)${clean}(?:号|同学|$|[、,，;；)）])`,
      ).test(normalized);
    }
    return normalized.includes(clean);
  });
}

function identifierHeading(line, identifiers) {
  const clean = normalize(line.replace(/[：:]$/, ""));
  return identifiers.find((identifier) => normalize(identifier).toLowerCase() === clean.toLowerCase()) ?? null;
}

function feedbackType(text, settings) {
  const praise = matchedKeywords(text, settings.praiseKeywords);
  const criticism = matchedKeywords(text, settings.criticismKeywords);
  let type = "praise";
  if (/批评/.test(text)) type = "criticism";
  else if (/表扬/.test(text)) type = "praise";
  else if (
    criticism.some((item) => /未交|缺交|未完成|不合格|迟到|错误|订正/.test(item)) ||
    /订正|需要加强|需要重做|需要改进/.test(text)
  ) {
    type = "criticism";
  } else if (!praise.length && criticism.length) type = "criticism";
  return { type, praise, criticism };
}

function conciseFeedback(text, matchedIdentifiers) {
  let cleaned = cleanLine(text);
  const divider = cleaned.search(/[：:]/);
  if (divider > 0) {
    const label = cleaned.slice(0, divider).trim();
    const cleanLabel = label
      .replace(/\[emoji\]/gi, "")
      .replace(/🆗/g, "完成")
      .replace(/(\d+人)\d$/, "$1");
    const detail = cleaned.slice(divider + 1).trim();
    const listLike = detail.split(/[、,，.．]/).filter(Boolean).length >= 3;
    if (listLike) {
      if (/学霸/.test(cleanLabel)) return "本周被评为“语文学霸”，得到老师点名肯定。";
      if (/之星/.test(cleanLabel)) return "本周被评为“语文之星”，得到老师点名肯定。";
      const subject = cleanLabel
        .replace(/^\d+[.、．)）]\s*/, "")
        .replace(/表扬/g, "")
        .replace(/的?\s*\d+\s*人\s*$/, "")
        .trim();
      if (/表扬|优秀|全对|满分/.test(cleanLabel)) {
        return `${subject || "本项作业"}获得老师表扬。`;
      }
      return `${subject || cleaned}，老师提醒需要继续改进。`;
    }
  }

  cleaned = cleaned
    .replace(/\[emoji\]/gi, "")
    .replace(/[（(]\s*(?:\d{1,3}\s*[、,，.．]\s*)+/g, "")
    .replace(/[）)]/g, "")
    .replace(/(?:\d{1,3}[.、．]\s*){3,}\d{1,3}/g, "名单中的孩子")
    .replace(/^[、,，\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (matchedIdentifiers?.length) {
    const escapePattern = (item) =>
      String(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const identifier of matchedIdentifiers.filter((item) => /^\d+$/.test(item))) {
      cleaned = cleaned.replace(
        new RegExp(`(^|[^\\d])${escapePattern(identifier)}号?(?=$|[^\\d])`, "g"),
        "$1",
      );
    }
    for (const identifier of matchedIdentifiers.filter((item) => !/^\d+$/.test(item))) {
      cleaned = cleaned.replace(new RegExp(escapePattern(identifier), "g"), "你");
    }
  }
  return cleaned.slice(0, 300);
}

function estimateDuration(title) {
  if (/练习卷|试卷|卷子|整套/.test(title)) return 30;
  return 10;
}

function subjectOf(title) {
  return detectSubject(title, "作业");
}

function explicitSubjectOf(text) {
  return (
    String(text || "").match(
      /道德与法治|信息科技|语文|数学|英语|科学|体育|美术|音乐|劳动/,
    )?.[0] || null
  );
}

function cleanTaskTitle(value) {
  let title = cleanLine(value)
    .replace(/^[【\[].*?[】\]]\s*/, "")
    .replace(/^(今日|今天|明日|明天|周末|下周|本周|这周)[^：:]{0,6}(作业|任务)[：:]?/, "")
    .replace(/^(?:补充通知|也补充通知|另通知|通知)[：:]\s*/, "")
    .replace(/^(?:本周|下周|这周)?(?:周|星期)[一二三四五六日天]?(?:请)?交\s*/, "")
    .replace(/^(请|记得|需要)/, "")
    .replace(/(今天|今日|明天|明日|周末|本周|下周)内?完成/g, "完成")
    .replace(/\[(?:图片|图|照片)\]|（如图）|\(如图\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/[。；;：:]+$/g, "")
    .trim();
  if (title.length > 40) title = `${title.slice(0, 39)}…`;
  return title;
}

function looksLikeTask(text) {
  if (!TASK_CUES.test(text)) return false;
  if (/完成情况|情况反馈|以下同学|表扬名单|批评名单/.test(text)) return false;
  return text.length >= 3;
}

function taskTypeFromTitle(title) {
  if (/选做|可选|有兴趣|自愿/.test(title)) return "choice";
  if (/弹性|有余力/.test(title)) return "flex";
  return "must";
}

function splitTaskClauses(text) {
  const clauses = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if ((character === "，" || character === "," || character === "、") && current.trim()) {
      const rest = text.slice(index + 1);
      const startsNewAction =
        /^(?:请|再|并|然后|还要|另|先)?(?:预习|复习|订正|补完|完成|背诵|背读|默写|家默|听写|朗读|阅读|抄写|练计算|练习|做)/.test(
          rest.trim(),
        );
      const currentHasAction =
        /^(?:请|先)?(?:预习|复习|订正|补完|完成|背诵|背|默写|家默|听写|朗读|阅读|抄写|练计算|练习|做|根据)/.test(
          current.trim(),
        );
      const continuesReadingTask =
        /^(?:请|先)?(?:阅读|朗读|背诵)/.test(current.trim()) &&
        /^(?:完成|读完|背完)(?:一篇|一页|一章|一次|一段)/.test(rest.trim());
      if (startsNewAction && currentHasAction && !continuesReadingTask) {
        clauses.push(current.trim());
        current = "";
        continue;
      }
    }
    current += character;
  }
  if (current.trim()) clauses.push(current.trim());
  return clauses.length ? clauses : [text];
}

function isWeekendDay(day) {
  const weekday = parseDateKey(day).getDay();
  return weekday === 0 || weekday === 6;
}

function busyIntervalsFor(day, existingTasks) {
  return existingTasks
    .filter((task) => task.date === day && task.scheduledStart && task.scheduledEnd)
    .map((task) => ({
      start: timeToMinutes(task.scheduledStart),
      end: timeToMinutes(task.scheduledEnd),
    }))
    .filter((interval) => interval.start !== null && interval.end !== null && interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
}

function findSlot({
  day,
  duration,
  today,
  settings,
  existingTasks,
  now,
  startLimit,
  endLimit,
  respectCurrentTime = true,
}) {
  const resolvedStart =
    startLimit ?? timeToMinutes(settings.weekdayStartTime) ?? 17 * 60;
  const resolvedEnd =
    endLimit ?? timeToMinutes(settings.weekdayEndTime) ?? 21 * 60 + 30;
  const dinnerStart = timeToMinutes(settings.dinnerStartTime) ?? 18 * 60;
  const dinnerEnd = dinnerStart + Math.max(0, Number(settings.dinnerMinutes) || 0);
  const intervals = busyIntervalsFor(day, existingTasks);
  let cursor = resolvedStart;
  if (respectCurrentTime && day === today && now) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    cursor = Math.max(cursor, currentMinutes + 5);
  }
  cursor = roundUpToFive(cursor);
  const dinner = { start: dinnerStart, end: dinnerEnd };
  const allBlocks = [...intervals, dinner].sort((a, b) => a.start - b.start);
  let guard = 0;
  while (cursor + duration <= resolvedEnd && guard < 30) {
    const conflict = allBlocks.find(
      (interval) => cursor < interval.end && cursor + duration > interval.start,
    );
    if (!conflict) {
      return { start: cursor, end: cursor + duration };
    }
    cursor = roundUpToFive(conflict.end);
    guard += 1;
  }
  return null;
}

export function buildTaskSchedulePlan(drafts, options) {
  const {
    today,
    settings = DEFAULT_IMPORT_SETTINGS,
    existingTasks = [],
    now = new Date(),
  } = options;
  const virtualTasks = existingTasks.map((task) => ({ ...task }));
  const scheduledByIndex = new Map();
  const breaks = [];
  const dates = [...new Set(drafts.map((draft) => draft.date))];
  let breakSequence = 0;
  const focusByDate = new Map();

  const boundariesFor = (day) => {
    const weekend = isWeekendDay(day);
    const isToday = day === today;
    const fromWeekdayStart = isToday && !weekend;
    return {
      weekend,
      isToday,
      fromWeekdayStart,
      startLimit: isToday
        ? weekend
          ? 9 * 60
          : timeToMinutes(settings.weekdayStartTime) ?? 17 * 60
        : weekend
          ? 9 * 60
          : timeToMinutes(settings.weekdayStartTime) ?? 17 * 60,
      endLimit: isToday
        ? 23 * 60
        : weekend
          ? 21 * 60 + 30
          : timeToMinutes(settings.weekdayEndTime) ?? 21 * 60 + 30,
    };
  };

  for (const day of dates) {
    const group = drafts
      .map((draft, index) => ({ draft, index }))
      .filter((item) => item.draft.date === day);
    const saturdayRollover =
      isWeekendDay(day) && parseDateKey(day).getDay() === 6
        ? addDays(day, 1)
        : null;
    let dayOverflowed = false;

    for (let position = 0; position < group.length; position += 1) {
      const { draft, index } = group[position];
      let targetDate = dayOverflowed && saturdayRollover ? saturdayRollover : day;
      let bounds = boundariesFor(targetDate);
      const ignoreCurrentTime = bounds.fromWeekdayStart || bounds.weekend;
      let slot = findSlot({
        day: targetDate,
        duration: draft.estimatedMinutes,
        today,
        settings,
        existingTasks: virtualTasks,
        now,
        startLimit: bounds.startLimit,
        endLimit: bounds.endLimit,
        respectCurrentTime: !ignoreCurrentTime,
      });
      if (!slot && saturdayRollover && targetDate === day) {
        targetDate = saturdayRollover;
        dayOverflowed = true;
        bounds = boundariesFor(targetDate);
        const ignoreRolloverTime = bounds.fromWeekdayStart || bounds.weekend;
        slot = findSlot({
          day: targetDate,
          duration: draft.estimatedMinutes,
          today,
          settings,
          existingTasks: virtualTasks,
          now,
          startLimit: bounds.startLimit,
          endLimit: bounds.endLimit,
          respectCurrentTime: !ignoreRolloverTime,
        });
      }

      let focusedMinutes = focusByDate.get(targetDate) || 0;
      let breakBefore = null;
      if (slot && focusedMinutes >= 45) {
        const breakMinutes = focusedMinutes >= 60 ? 15 : 10;
        const breakSlot = findSlot({
          day: targetDate,
          duration: breakMinutes,
          today,
          settings,
          existingTasks: virtualTasks,
          now,
          startLimit: bounds.startLimit,
          endLimit: bounds.endLimit,
          respectCurrentTime: !(bounds.fromWeekdayStart || bounds.weekend),
        });
        if (breakSlot) {
          virtualTasks.push({
            date: targetDate,
            scheduledStart: minutesToTime(breakSlot.start),
            scheduledEnd: minutesToTime(breakSlot.end),
          });
          const taskWithBreak = findSlot({
            day: targetDate,
            duration: draft.estimatedMinutes,
            today,
            settings,
            existingTasks: virtualTasks,
            now,
            startLimit: bounds.startLimit,
            endLimit: bounds.endLimit,
            respectCurrentTime: !(bounds.fromWeekdayStart || bounds.weekend),
          });
          if (taskWithBreak) {
            breakSequence += 1;
            breakBefore = {
              draftId: `break_${breakSequence}`,
              minutes: breakMinutes,
              scheduledStart: minutesToTime(breakSlot.start),
              scheduledEnd: minutesToTime(breakSlot.end),
              beforeTaskDraftId: draft.draftId || `draft_${index + 1}`,
            };
            breaks.push({ ...breakBefore, date: targetDate });
            slot = taskWithBreak;
          } else {
            virtualTasks.pop();
          }
        }
      }

      const scheduledStart = slot ? minutesToTime(slot.start) : "";
      const scheduledEnd = slot ? minutesToTime(slot.end) : "";
      if (slot) {
        virtualTasks.push({
          date: targetDate,
          scheduledStart,
          scheduledEnd,
        });
        focusedMinutes = breakBefore ? draft.estimatedMinutes : focusedMinutes + draft.estimatedMinutes;
        focusByDate.set(targetDate, focusedMinutes);
      }
      scheduledByIndex.set(index, {
        ...draft,
        date: targetDate,
        draftId: draft.draftId || `draft_${index + 1}`,
        isWeekend: bounds.weekend,
        needsTimeSelection: !slot,
        scheduledStart,
        scheduledEnd,
        breakBefore,
        scheduleNote: slot
          ? targetDate !== day
            ? "当天已排满，已自动顺延到周日，可自行修改"
            : bounds.weekend
              ? bounds.isToday
                ? "从周末上午开始顺排，已避开已有安排"
                : "周末自动建议时间，可自行修改"
            : bounds.fromWeekdayStart
              ? "从下午 5 点开始回顾排程，已避开晚饭和已有安排"
              : bounds.isToday
            ? breakBefore
              ? `先休息 ${breakBefore.minutes} 分钟，再从当前时间顺排`
              : "从当前时间开始顺排，已避开晚饭和已有安排"
            : "已避开晚饭和已有安排"
          : "当天没有找到空档，请手动选择时间",
      });
    }
  }

  return {
    tasks: drafts.map((_, index) => scheduledByIndex.get(index)),
    breaks,
  };
}

export function scheduleTaskDrafts(drafts, options) {
  return buildTaskSchedulePlan(drafts, options).tasks;
}

export function parseTeacherMessage(text, options = {}) {
  const today = options.today || dateKey();
  const settings = { ...DEFAULT_IMPORT_SETTINGS, ...(options.settings || {}) };
  const existingTasks = options.existingTasks || [];
  const now = options.now || new Date();
  const messageSubject = detectSubject(text, "作业");
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => stripBrackets(line.trim()))
    .filter(Boolean);
  if (!lines.length) {
    return {
      tasks: [],
      feedback: [],
      warnings: ["请先粘贴老师发来的完整消息。"],
      ignoredFeedbackCount: 0,
    };
  }

  let section = {
    kind: null,
    date: today,
    identifierMatched: false,
    subject: messageSubject,
    subjectExplicit: false,
  };
  const rawTasks = [];
  const feedback = [];
  let ignoredFeedbackCount = 0;
  let lastRelevantFeedback = null;

  for (const originalLine of lines) {
    const detected = detectSection(originalLine, today);
    let line = originalLine;
    if (detected) {
      section = {
        kind: detected.kind,
        date: detected.date || section.date || today,
        identifierMatched:
          detected.kind === null ? false : section.identifierMatched,
        subject:
          detected.subject && detected.subject !== "作业"
            ? detected.subject
            : section.subject,
        subjectExplicit:
          detected.subject && detected.subject !== "作业"
            ? true
            : section.subjectExplicit,
      };
      if (!detected.content) continue;
      line = detected.content;
    }

    const identifierOnly = identifierHeading(line, settings.identifiers);
    if (identifierOnly) {
      section.identifierMatched = true;
      continue;
    }
    if (/^[\u4e00-\u9fa5A-Za-z0-9]{2,12}[：:]$/.test(line.trim())) {
      section.identifierMatched = !settings.identifiers.length;
      continue;
    }

    for (const sentence of splitSentences(line).flatMap(splitMixedTaskFeedback)) {
      const matchedIdentifiers = matchedKeywords(sentence, settings.identifiers);
      const targetMatches = !settings.identifiers.length || matchedIdentifiers.length > 0;
      const followupCheck = sentence.match(
        /^[（(]?\s*((?:本周|下周)?(?:周|星期)[一二三四五六日天]).{0,5}(?:再)?(?:检查|复查)/,
      );
      if (followupCheck) {
        const topic =
          ["improvement", "criticism"].includes(lastRelevantFeedback?.type)
            ? lastRelevantFeedback.content
                .split(/[，,。]/)[0]
                .replace(/还有错题没订正/g, "错题订正")
                .replace(/^你/, "")
                .slice(0, 24)
            : "作业订正";
        const checkDate = inferDueDate(followupCheck[1], today);
        const followupDate = addDays(checkDate, -1);
        const checkLabel = followupCheck[1].replace(/^本周|^下周/, "");
        const deadlineNote =
          parseDateKey(followupDate).getDay() === 0
            ? `周末完成，${checkLabel}检查`
            : `${checkLabel}检查`;
        const anchor =
          lastRelevantFeedback?.content
            .split(/[，,。]/)[0]
            .split(/还有|仍有|仍需/)[0]
            .replace(/^你/, "")
            .trim() || "";
        const sourceTask = [...rawTasks]
          .reverse()
          .find(
            (task) =>
              anchor &&
              task.title.includes(anchor) &&
              !task.title.includes("周一检查"),
          );
        if (sourceTask) {
          sourceTask.date = followupDate;
          sourceTask.sourceExcerpt = `${sourceTask.sourceExcerpt} ${lastRelevantFeedback?.content || ""} ${originalLine}`
            .trim()
            .slice(0, 200);
          sourceTask.deadlineNote = deadlineNote;
        } else {
          const title = cleanTaskTitle(`完成：${topic}（${checkLabel}检查）`);
          rawTasks.push({
            title,
            date: followupDate,
            estimatedMinutes: estimateDuration(title),
            subject:
              lastRelevantFeedback?.subject &&
              lastRelevantFeedback.subject !== "其他"
                ? lastRelevantFeedback.subject
                : subjectOf(title) !== "作业"
                ? subjectOf(title)
                : section.subject || messageSubject,
            type: "must",
            sourceExcerpt: `${lastRelevantFeedback?.content || topic} ${originalLine}`.slice(
              0,
              200,
            ),
            deadlineNote,
          });
        }
        continue;
      }
      const hasCustomFeedbackKeyword =
        matchedKeywords(sentence, settings.praiseKeywords).length > 0 ||
        matchedKeywords(sentence, settings.criticismKeywords).length > 0;
      const taskLike = looksLikeTask(sentence);
      const explicitFeedback =
        /表扬|批评|全对|满分|优秀|进步|学霸|之星|没交|未交|缺交|少做|补交|未按时|未能按时|不合格|没及时订正|没有及时订正|没订正|未订正|没有订正|需加强|需要.{0,4}(?:订正|加强|重做)/.test(
          sentence,
        );
      const shouldTreatAsFeedback =
        explicitFeedback || (!taskLike && hasCustomFeedbackKeyword);
      const ownFeedback =
        FEEDBACK_CUES.test(sentence) ||
        hasCustomFeedbackKeyword ||
        explicitFeedback;
      const hasOwnership = targetMatches || section.identifierMatched;

      if (
        ownFeedback &&
        shouldTreatAsFeedback &&
        (hasOwnership || !settings.identifiers.length)
      ) {
        const classified = feedbackType(sentence, settings);
        feedback.push({
          type: classified.type,
          content: conciseFeedback(sentence, matchedIdentifiers),
          subject:
            explicitSubjectOf(sentence) ||
            (section.subjectExplicit && section.subject !== "作业"
              ? section.subject
              : subjectOf(sentence) !== "作业"
                ? subjectOf(sentence)
                : messageSubject === "作业"
                  ? "其他"
                  : messageSubject),
          matchedIdentifiers,
          sourceDateText: inferDueDate(sentence, today),
        });
        lastRelevantFeedback = feedback[feedback.length - 1];
        continue;
      }

      if (
        ownFeedback &&
        shouldTreatAsFeedback &&
        settings.identifiers.length &&
        !hasOwnership
      ) {
        ignoredFeedbackCount += 1;
        continue;
      }

      const shouldParseTask =
        section.kind === "homework" ||
        (section.kind !== "feedback" && looksLikeTask(sentence));
      if (!shouldParseTask || /完成情况|情况反馈|以下同学/.test(sentence)) continue;

      const pieces = sentence
        .split(/(?=\d+[.、．](?!\d)\s*)/)
        .flatMap((piece) => piece.split(/；|;/))
        .flatMap(splitTaskClauses)
        .map(cleanTaskTitle)
        .filter((piece) => piece.length >= 3 && looksLikeTask(piece));
      for (const title of pieces) {
        rawTasks.push({
          title,
          date: inferDueDate(sentence, today) || section.date || today,
          estimatedMinutes: estimateDuration(title),
          subject:
            explicitSubjectOf(title) ||
            (section.subjectExplicit && section.subject !== "作业"
              ? section.subject
              : subjectOf(title) !== "作业"
                ? subjectOf(title)
                : messageSubject),
          type: taskTypeFromTitle(title),
          sourceExcerpt: originalLine.slice(0, 200),
        });
      }
    }
  }

  const dedupedTasks = [];
  const seenTasks = new Set();
  for (const task of rawTasks) {
    const key = `${task.date}|${normalize(task.title)}`;
    if (seenTasks.has(key)) continue;
    seenTasks.add(key);
    dedupedTasks.push(task);
  }

  const schedulePlan = buildTaskSchedulePlan(dedupedTasks, {
    today,
    settings,
    existingTasks,
    now,
  });
  const tasks = schedulePlan.tasks.map((task) => {
    const duplicate = existingTasks.some(
      (existing) =>
        existing.date === task.date &&
        normalize(existing.title) === normalize(task.title),
    );
    return { ...task, duplicate };
  });

  const dedupedFeedback = [];
  const seenFeedback = new Set();
  for (const item of feedback) {
    const key = `${item.type}|${normalize(item.content)}`;
    if (seenFeedback.has(key)) continue;
    seenFeedback.add(key);
    dedupedFeedback.push(item);
  }

  const warnings = [];
  if (!tasks.length) warnings.push("没有找到明确的作业任务，可以检查措辞后重新分析。");
  if (dedupedFeedback.length && !settings.identifiers.length) {
    warnings.push("还没有设置名字或学号，请核对每条老师反馈后再导入。");
  }
  if (ignoredFeedbackCount) {
    warnings.push(`已忽略 ${ignoredFeedbackCount} 条未匹配孩子名字或学号的反馈。`);
  }
  if (tasks.some((task) => task.needsTimeSelection)) {
    warnings.push("有任务还需要选择完成时间，周末的安排由孩子决定。");
  }

  return {
    tasks,
    breaks: schedulePlan.breaks,
    feedback: dedupedFeedback,
    warnings: unique(warnings),
    ignoredFeedbackCount,
  };
}
