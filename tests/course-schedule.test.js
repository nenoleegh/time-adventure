import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCourseOccurrences,
  courseHasConflict,
  defaultSemesterRange,
  markCourseDuplicates,
  normalizeWeekday,
  parseCourseRows,
  parseCourseText,
  parseTimeRange,
} from "../src/services/course-schedule-rules.js";
import {
  parseDelimitedText,
  rowsToTsv,
} from "../src/services/table-file.js";

const gridText = `时间\t周一\t周二\t周三\t周四\t周五
08:00-08:40\t语文\t数学\t英语\t科学\t道法
08:50-09:30\t数学\t语文\t数学\t英语\t体育`;

test("weekday aliases normalize to JavaScript weekdays", () => {
  assert.equal(normalizeWeekday("周一"), 1);
  assert.equal(normalizeWeekday("星期日"), 0);
  assert.equal(normalizeWeekday("Mon"), 1);
  assert.equal(normalizeWeekday("Friday"), 5);
});

test("default semester ranges match autumn and spring school terms", () => {
  assert.deepEqual(
    {
      from: defaultSemesterRange("2026-10-24").from,
      to: defaultSemesterRange("2026-10-24").to,
    },
    { from: "2026-09-01", to: "2027-01-15" },
  );
  assert.deepEqual(
    {
      from: defaultSemesterRange("2027-01-10").from,
      to: defaultSemesterRange("2027-01-10").to,
    },
    { from: "2026-09-01", to: "2027-01-15" },
  );
  assert.deepEqual(
    {
      from: defaultSemesterRange("2027-03-01").from,
      to: defaultSemesterRange("2027-03-01").to,
    },
    { from: "2027-02-15", to: "2027-07-01" },
  );
  assert.equal(defaultSemesterRange("2027-01-16").from, "2027-02-15");
  assert.equal(defaultSemesterRange("2027-07-01").to, "2027-07-01");
  assert.equal(defaultSemesterRange("2027-07-02").from, "2027-09-01");
  assert.deepEqual(
    {
      from: defaultSemesterRange("2027-08-20").from,
      to: defaultSemesterRange("2027-08-20").to,
    },
    { from: "2027-09-01", to: "2028-01-15" },
  );
});

test("grid course tables expand into individual weekly courses", () => {
  const parsed = parseCourseRows(parseDelimitedText(gridText), {
    effectiveFrom: "2026-10-24",
  });
  assert.equal(parsed.courses.length, 10);
  assert.deepEqual(
    {
      weekday: parsed.courses[0].weekday,
      title: parsed.courses[0].title,
      startTime: parsed.courses[0].startTime,
      endTime: parsed.courses[0].endTime,
    },
    { weekday: 1, title: "语文", startTime: "08:00", endTime: "08:40" },
  );
  assert.equal(parsed.courses[5].title, "数学");
  assert.equal(parsed.courses[5].weekday, 1);
});

test("long-form spreadsheets with separate start and end columns are supported", () => {
  const text = `星期,开始时间,结束时间,课程,地点
周一,08:00,08:40,语文,101教室
周三,10:00,10:40,科学,实验室`;
  const parsed = parseCourseRows(parseDelimitedText(text), {
    effectiveFrom: "2026-10-24",
  });
  assert.equal(parsed.courses.length, 2);
  assert.equal(parsed.courses[0].location, "101教室");
  assert.equal(parsed.courses[1].weekday, 3);
});

test("period labels use editable default times and produce a warning", () => {
  const text = `星期\t节次\t课程
周一\t第1节\t语文`;
  const parsed = parseCourseRows(parseDelimitedText(text), {
    effectiveFrom: "2026-10-24",
  });
  assert.equal(parsed.courses[0].startTime, "08:00");
  assert.match(parsed.warnings.join(" "), /请核对/);
});

test("duplicates and overlapping courses are marked before saving", () => {
  const existing = [
    {
      weekday: 1,
      title: "语文",
      startTime: "08:00",
      endTime: "08:40",
      effectiveFrom: "2026-01-01",
      effectiveTo: "",
    },
  ];
  const duplicates = markCourseDuplicates(
    [
      { ...existing[0], title: "语文" },
      {
        ...existing[0],
        title: "阅读",
        startTime: "08:20",
        endTime: "08:50",
      },
    ],
    existing,
  );
  assert.equal(duplicates[0].duplicate, true);
  assert.equal(duplicates[1].conflict, true);
  assert.equal(duplicates[1].include, false);
});

test("the same course in non-overlapping semesters is not a duplicate", () => {
  const [course] = markCourseDuplicates(
    [
      {
        weekday: 1,
        title: "语文",
        startTime: "08:00",
        endTime: "08:40",
        effectiveFrom: "2027-02-15",
        effectiveTo: "2027-07-01",
      },
    ],
    [
      {
        weekday: 1,
        title: "语文",
        startTime: "08:00",
        endTime: "08:40",
        effectiveFrom: "2026-09-01",
        effectiveTo: "2027-01-15",
      },
    ],
  );
  assert.equal(course.duplicate, false);
  assert.equal(course.conflict, false);
  assert.equal(course.include, true);
});

test("recurring courses produce only matching weekdays in the date range", () => {
  const occurrences = buildCourseOccurrences(
    [
      {
        id: "course-1",
        weekday: 1,
        title: "语文",
        startTime: "08:00",
        endTime: "08:40",
        effectiveFrom: "2026-10-01",
        effectiveTo: "2026-12-31",
      },
    ],
    "2026-10-19",
    "2026-11-01",
  );
  assert.deepEqual(
    occurrences.map((item) => item.date),
    ["2026-10-19", "2026-10-26"],
  );
});

test("time parsing and TSV round-trip remain stable", () => {
  assert.deepEqual(parseTimeRange("08：10 至 08：50"), {
    startTime: "08:10",
    endTime: "08:50",
  });
  assert.equal(
    rowsToTsv([
      ["时间", "周一"],
      ["08:00-08:40", "语文"],
    ]),
    "时间\t周一\n08:00-08:40\t语文",
  );
});

test("CSV parser handles quoted commas", () => {
  assert.deepEqual(parseDelimitedText('星期,课程\n周一,"语文,阅读"'), [
    ["星期", "课程"],
    ["周一", "语文,阅读"],
  ]);
});

test("non-overlapping effective date ranges can share a weekday", () => {
  assert.equal(
    courseHasConflict(
      {
        weekday: 1,
        title: "数学",
        startTime: "08:00",
        endTime: "08:40",
        effectiveFrom: "2026-10-01",
        effectiveTo: "2026-10-31",
      },
      [
        {
          weekday: 1,
          title: "语文",
          startTime: "08:00",
          endTime: "08:40",
          effectiveFrom: "2026-11-01",
          effectiveTo: "",
        },
      ],
    ),
    false,
  );
});

test("plain teacher timetable text with Markdown headings and teachers is parsed", () => {
  const text = `**11:20—12:00**：第四节 美术（钟维）
- **14:45—15:25**：第五节 语文（钟献英）
- **15:40—16:20**：第六节 信息科技（杨馥蔓）

**星期三**
- **8:00—8:20**：早餐
- **8:20—9:00**：第一节 语文（钟献英）
- **9:30—10:10**：第二节 数学（刘娟）
- **10:25—11:05**：第三节 音乐（郑清华）
- **11:20—12:00**：第四节 体育活动（钟献英）
- **14:45—15:25**：第五节 劳动（胡明婉）
- **15:40—16:20**：第六节 道德与法治（钟献英）`;
  const parsed = parseCourseText(text, { effectiveFrom: "2026-10-24" });
  assert.equal(parsed.courses.length, 10);
  assert.equal(parsed.courses[0].weekday, 2);
  assert.equal(parsed.courses[0].title, "美术");
  assert.equal(parsed.courses[0].teacher, "钟维");
  assert.equal(parsed.courses[3].weekday, 3);
  assert.equal(parsed.courses[3].title, "早餐");
  assert.equal(parsed.courses[9].title, "道德与法治");
  assert.equal(parsed.courses[9].teacher, "钟献英");
  assert.match(parsed.warnings.join(" "), /推定为前一天/);
});

test("long-form tables can carry a separate teacher column", () => {
  const text = `星期,开始时间,结束时间,课程,教师
周一,08:00,08:40,语文,钟老师`;
  const parsed = parseCourseRows(parseDelimitedText(text), {
    effectiveFrom: "2026-10-24",
  });
  assert.equal(parsed.courses[0].teacher, "钟老师");
});
