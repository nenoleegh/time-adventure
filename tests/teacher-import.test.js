import test from "node:test";
import assert from "node:assert/strict";
import {
  inferDueDate,
  parseTeacherMessage,
  scheduleTaskDrafts,
  buildTaskSchedulePlan,
} from "../src/services/teacher-import-rules.js";
import { resolveImportedTaskSubject } from "../src/services/task-service.js";
import {
  resolveImportedFeedbackSubject,
  sanitizeImportedFeedbackContent,
} from "../src/services/teacher-import-service.js";

const settings = {
  identifiers: ["张三", "12"],
  praiseKeywords: ["表扬", "优秀", "满分", "全对", "进步", "认真", "按时完成", "学霸", "之星"],
  criticismKeywords: [
    "批评",
    "未交",
    "缺交",
    "未完成",
    "不合格",
    "错误较多",
    "错题",
    "未订正",
    "没订正",
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

test("relative and named weekdays resolve without timezone drift", () => {
  assert.equal(inferDueDate("今天作业", "2026-10-23"), "2026-10-23");
  assert.equal(inferDueDate("明天完成", "2026-10-23"), "2026-10-24");
  assert.equal(inferDueDate("周末作业", "2026-10-23"), "2026-10-24");
  assert.equal(inferDueDate("完成关于周末活动的作业", "2026-10-23"), null);
  assert.equal(inferDueDate("下周一交", "2026-10-23"), "2026-10-26");
  assert.equal(inferDueDate("10月28日前提交", "2026-10-23"), "2026-10-28");
});

test("weekday teacher messages schedule separate blocks from the review start time", () => {
  const message = `
【今日作业】
1. 语文：完成练习册第12页
2. 数学：完成口算第3页
周末作业：完成科学手抄报
昨日完成情况：
12号张三数学全对，提出表扬。
李四英语未完成。
张三语文听写需要订正。
`;
  const parsed = parseTeacherMessage(message, {
    today: "2026-10-23",
    settings,
    now: new Date(2026, 9, 23, 16, 0),
  });

  assert.equal(parsed.tasks.length, 3);
  assert.equal(parsed.tasks[0].date, "2026-10-23");
  assert.equal(parsed.tasks[0].scheduledStart, "17:00");
  assert.equal(parsed.tasks[1].scheduledStart, "17:10");
  assert.equal(parsed.tasks[1].scheduledEnd, "17:20");
  assert.equal(parsed.tasks[2].date, "2026-10-24");
  assert.equal(parsed.tasks[2].isWeekend, true);
  assert.equal(parsed.tasks[2].scheduledStart, "09:00");
  assert.equal(parsed.feedback.length, 2);
  assert.equal(parsed.feedback[0].type, "praise");
  assert.equal(parsed.feedback[1].type, "criticism");
  assert.equal(parsed.feedback[0].subject, "数学");
  assert.equal(parsed.feedback[1].subject, "语文");
  assert.match(parsed.feedback[0].content, /你数学全对/);
  assert.doesNotMatch(parsed.feedback[0].content, /你号你/);
  assert.match(parsed.warnings.join(" "), /忽略 1 条/);
});

test("new homework defaults to ten minutes except practice papers", () => {
  const parsed = parseTeacherMessage(
    `今日作业：
1.抄写第三单元词语；
2.完成练习册第45页；
3.完成轴对称练习卷一张；
4.复习书本第32页。`,
    {
      today: "2026-10-23",
      settings,
      now: new Date(2026, 9, 23, 16, 0),
    },
  );
  assert.deepEqual(
    parsed.tasks.map((task) => task.estimatedMinutes),
    [10, 10, 30, 10],
  );
});

test("weekday evening import reviews from 5pm and skips dinner", () => {
  const drafts = scheduleTaskDrafts(
    [
      {
        title: "数学练习",
        date: "2026-10-23",
        estimatedMinutes: 30,
        subject: "数学",
      },
    ],
    {
      today: "2026-10-23",
      settings,
      existingTasks: [],
      now: new Date(2026, 9, 23, 18, 10),
    },
  );
  assert.equal(drafts[0].scheduledStart, "17:00");
  assert.equal(drafts[0].scheduledEnd, "17:30");
});

test("late weekday import can use the earlier 5pm review window", () => {
  const drafts = scheduleTaskDrafts(
    [
      {
        title: "英语回顾",
        date: "2026-10-23",
        estimatedMinutes: 45,
        subject: "英语",
      },
    ],
    {
      today: "2026-10-23",
      settings,
      existingTasks: [],
      now: new Date(2026, 9, 23, 20, 15),
    },
  );
  assert.equal(drafts[0].scheduledStart, "17:00");
  assert.equal(drafts[0].scheduledEnd, "17:45");
  assert.match(drafts[0].scheduleNote, /下午 5 点/);
});

test("duplicate tasks are flagged but not silently discarded", () => {
  const parsed = parseTeacherMessage("今日作业：\n语文：完成练习册第8页", {
    today: "2026-10-23",
    settings,
    existingTasks: [
      {
        title: "语文：完成练习册第8页",
        date: "2026-10-23",
        scheduledStart: "17:00",
        scheduledEnd: "17:20",
      },
    ],
    now: new Date(2026, 9, 23, 16, 0),
  });
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].duplicate, true);
  assert.notEqual(parsed.tasks[0].scheduledStart, "17:00");
});

test("custom praise wording is honoured outside a feedback section", () => {
  const parsed = parseTeacherMessage("张三今天的课堂表现棒极了", {
    today: "2026-10-23",
    settings: {
      ...settings,
      praiseKeywords: ["棒极了"],
    },
    now: new Date(2026, 9, 23, 16, 0),
  });
  assert.equal(parsed.feedback.length, 1);
  assert.equal(parsed.feedback[0].type, "praise");
});

test("a named feedback block resets when another student starts", () => {
  const parsed = parseTeacherMessage(
    `张三：
数学作业全对，表扬。
李四：
数学作业未交。`,
    {
      today: "2026-10-23",
      settings,
      now: new Date(2026, 9, 23, 16, 0),
    },
  );
  assert.equal(parsed.feedback.length, 1);
  assert.match(parsed.feedback[0].content, /张三|全对/);
});

test("homework scheduling avoids fixed course occurrences", () => {
  const parsed = parseTeacherMessage("周一作业：\n数学：完成练习册第5页", {
    today: "2026-10-24",
    settings,
    existingTasks: [
      {
        date: "2026-10-26",
        title: "语文课",
        scheduledStart: "17:00",
        scheduledEnd: "17:40",
      },
    ],
    now: new Date(2026, 9, 24, 10, 0),
  });
  assert.equal(parsed.tasks[0].date, "2026-10-26");
  assert.equal(parsed.tasks[0].scheduledStart, "17:40");
});

const realMessages = {
  chinese: `今天学习完了第13课，作业为：
1、完成练习册第13课，若昨天12课未完成的，请一起完成；
2、完成一份阅读修炼手册，要求第三格为情节图；
3、订正两次的课堂听写和默写；（2、8、16、17、26、29、31、39、44、46、49，根据作业登记表11或12课背诵默写需加强）
4、根据作业登记本进行订正各项作业，预习第14课。
5、这周语文学霸：蔡雁初、陈国涵、陈屹梵、陈昱羽、刁予晴、何凯琳、李昕珊、梁宁恩、梁屹坤、石茁桦、王炳杰、余欣洛、禹闻希；语文之星：侯语棠、梁钧睿、梁清悦、刘铭浩、杨宸宇。（打√的都是未能按时提交，后面补交的，今天的一号本未交的同学下周一补给我）`,
  math: `10.23数学
一、作业
1.订正错题、练计算（小数除法）
2.练习册P44。
3.订正启智17-20。
4.每日一题（选做）：[图片]。
5.轴对称练习卷一张。
二、小结
1.课堂学习了平移，完成了数学书P41-42、44。
2.表扬每日一题（选做）A的16人：37.25.9.23.43.3.12.6.41.38.45.32.14.22.20.21。
3.表扬练习册P43A+的21人：19.40.36.3.11.28.35.1.49.41.27.37.7.25.18.9.38.45.34.47.4。
4.启智17-20还有错题没订正的18人：1.2.5.7.8.13.16.17.18.20.21.22.26.27.28.29.33.46。
（周一再检查！！！）`,
  english: `10.23英语学习情况反馈
1️⃣课堂学习
学习书本第32页B learn内容
2️⃣作业（如图）
1.抄写动词词语一次并用重点句型仿写（四问四答，其中两答肯定，两答否定）
2.家默书本第87页第三单元句子
3.背书本第32页内容，预习第33页
补充通知：周一交英语第二单元高质量作业（卷子）
也补充通知：周一交语文第三单元高质量作业（卷子）`,
};

const realMessageSettings = {
  ...settings,
  identifiers: ["16", "37", "19", "陈国涵"],
};

test("real Chinese homework message separates actions and targeted feedback", () => {
  const parsed = parseTeacherMessage(realMessages.chinese, {
    today: "2026-10-24",
    settings: realMessageSettings,
    now: new Date(2026, 9, 24, 10, 0),
  });
  assert.equal(parsed.tasks.length, 5);
  assert.ok(parsed.tasks.some((task) => task.title.includes("阅读修炼手册")));
  assert.ok(parsed.tasks.some((task) => task.title === "预习第14课"));
  assert.ok(parsed.tasks.every((task) => task.subject === "语文"));
  assert.equal(parsed.tasks[0].scheduledStart, "09:00");
  assert.match(parsed.tasks[0].scheduleNote, /周末上午/);
  assert.ok(
    parsed.feedback.some(
      (note) => note.type === "criticism" && /背诵默写需加强/.test(note.content),
    ),
  );
  assert.ok(parsed.feedback.every((note) => note.subject === "语文"));
  assert.equal(
    parsed.feedback.some((note) => /蔡雁初|侯语棠/.test(note.content)),
    false,
  );
});

test("real math message finds all assignments and the child's feedback", () => {
  const parsed = parseTeacherMessage(realMessages.math, {
    today: "2026-10-24",
    settings: realMessageSettings,
    now: new Date(2026, 9, 24, 10, 0),
  });
  assert.equal(parsed.tasks.length, 6);
  assert.ok(parsed.tasks.every((task) => task.subject === "数学"));
  assert.ok(
    parsed.tasks.some(
      (task) => task.title.includes("每日一题") && task.type === "choice",
    ),
  );
  assert.equal(parsed.feedback.filter((note) => note.type === "praise").length, 2);
  assert.equal(
    parsed.feedback.filter((note) => note.type === "criticism").length,
    1,
  );
  assert.ok(parsed.feedback.every((note) => note.subject === "数学"));
  const recheckTask = parsed.tasks.find((task) => task.title === "订正启智17-20");
  assert.ok(recheckTask);
  assert.equal(recheckTask.date, "2026-10-25");
  assert.equal(recheckTask.isWeekend, true);
  assert.equal(recheckTask.scheduledStart, "09:00");
  assert.equal(recheckTask.deadlineNote, "周末完成，周一检查");
  assert.equal(
    parsed.tasks.some((task) => task.title.includes("周一检查")),
    false,
  );
  assert.equal(
    parsed.tasks.some((task) => /课堂学习|周一再检查/.test(task.title)),
    false,
  );
});

test("English feedback heading does not swallow its homework subsection", () => {
  const parsed = parseTeacherMessage(realMessages.english, {
    today: "2026-10-24",
    settings: realMessageSettings,
    now: new Date(2026, 9, 24, 10, 0),
  });
  assert.equal(parsed.tasks.length, 6);
  assert.equal(
    parsed.tasks.filter((task) => task.date === "2026-10-26").length,
    2,
  );
  assert.ok(parsed.tasks.some((task) => task.title.includes("家默")));
  assert.ok(
    parsed.tasks.some((task) => task.title.includes("背书本第32页内容")),
  );
  assert.equal(
    parsed.tasks.filter((task) => task.subject === "英语").length,
    5,
  );
  assert.equal(
    parsed.tasks.filter((task) => task.subject === "语文").length,
    1,
  );
  assert.ok(parsed.tasks.some((task) => task.title === "预习第33页"));
  assert.equal(parsed.tasks.some((task) => task.title.includes("B learn")), false);
});

test("numbered emoji subject homework headings start a task section", () => {
  const parsed = parseTeacherMessage(
    `英语-王老师 16:52:02
1️⃣课堂情况
学习了书本第33页的内容
2️⃣英语作业
1.完成练习册第28.29页
2.完成书本第33页、34页关于自己放学后的活动及周末活动
3.熟读书本第33页内容、知识清单作文
4.预习书本30页语音
3️⃣作业反馈
试卷没交的同学请明天再上交：2.5.7.9.16.17.26.31.33.39`,
    {
      today: "2026-10-27",
      settings: realMessageSettings,
      now: new Date(2026, 9, 27, 18, 0),
    },
  );
  assert.equal(parsed.tasks.length, 4);
  assert.ok(parsed.tasks.every((task) => task.subject === "英语"));
  assert.ok(
    parsed.tasks.some(
      (task) =>
        task.title.includes("放学后的活动及周末活动") &&
        task.date === "2026-10-27",
    ),
  );
  assert.ok(parsed.tasks.every((task) => task.estimatedMinutes === 10));
});

test("checkmarked revision and textbook homework are not dropped", () => {
  const parsed = parseTeacherMessage(
    `语文-钟老师 15:21:46
今天在校进行了习作批阅与修改，作业为：
✅ 修改习作四（在校基本完成，回家可以再复盘打磨）
✅ 预习第15课，根据作业登记表订正作业。

数学-刘老师 17:06:21
10.31数学
一、作业
1.订正错题、练计算（小数除法）
2.数学书P52-54。
二、小结
1.课堂学习了图案设计，完成了数学书P49-50。`,
    {
      today: "2026-11-01",
      settings: realMessageSettings,
      now: new Date(2026, 10, 1, 18, 0),
    },
  );
  assert.equal(parsed.tasks.length, 5);
  assert.ok(parsed.tasks.some((task) => task.title === "修改习作四（在校基本完成，回家可以再复盘打磨）"));
  assert.ok(parsed.tasks.some((task) => task.title === "数学书P52-54" && task.subject === "数学"));
  assert.ok(parsed.tasks.every((task) => !task.title.startsWith("✅")));
  assert.equal(parsed.tasks.some((task) => task.title.includes("P49-50")), false);
});

test("month and day dates near today do not jump to next year", () => {
  assert.equal(inferDueDate("10月23日数学作业", "2026-10-24"), "2026-10-23");
  assert.equal(inferDueDate("1月1日作业", "2026-12-31"), "2027-01-01");
});

test("automatic schedule adds a 15 minute break after 60 focused minutes", () => {
  const plan = buildTaskSchedulePlan(
    [
      { title: "任务一", date: "2026-10-24", estimatedMinutes: 30 },
      { title: "任务二", date: "2026-10-24", estimatedMinutes: 30 },
      { title: "任务三", date: "2026-10-24", estimatedMinutes: 20 },
    ],
    {
      today: "2026-10-24",
      settings,
      existingTasks: [],
      now: new Date(2026, 9, 24, 10, 0),
    },
  );
  assert.equal(plan.breaks.length, 1);
  assert.equal(plan.breaks[0].minutes, 15);
  assert.equal(plan.breaks[0].scheduledStart, "10:00");
  assert.equal(plan.tasks[2].scheduledStart, "10:15");
  assert.equal(plan.tasks[2].breakBefore.minutes, 15);
});

test("automatic schedule adds a short break after 45 to 59 focused minutes", () => {
  const plan = buildTaskSchedulePlan(
    [
      { title: "任务一", date: "2026-10-24", estimatedMinutes: 50 },
      { title: "任务二", date: "2026-10-24", estimatedMinutes: 20 },
    ],
    {
      today: "2026-10-24",
      settings,
      existingTasks: [],
      now: new Date(2026, 9, 24, 10, 0),
    },
  );
  assert.equal(plan.breaks[0].minutes, 10);
  assert.equal(plan.breaks[0].scheduledStart, "09:50");
  assert.equal(plan.tasks[1].scheduledStart, "10:00");
});

test("students listed as not corrected are recorded as criticism", () => {
  const parsed = parseTeacherMessage(
    "以下同学没有订正：3.8.16.27",
    {
      today: "2026-10-24",
      settings: realMessageSettings,
      now: new Date(2026, 9, 24, 10, 0),
    },
  );
  assert.equal(parsed.feedback.length, 1);
  assert.equal(parsed.feedback[0].type, "criticism");
  assert.deepEqual(parsed.feedback[0].matchedIdentifiers, ["16"]);
  assert.match(parsed.feedback[0].content, /没有订正/);
});

test("copied list noise and delayed correction wording keep feedback", () => {
  const parsed = parseTeacherMessage(
    `数学-刘老师 16:16:23
二、小结
2.表扬每日一题A的12人\u00144：22.21.37.41.38.12.3.6.43.45.32.25。
练习册P43没及时订正的6人：2.20.33。`,
    {
      today: "2026-10-26",
      settings: {
        ...realMessageSettings,
        identifiers: [...realMessageSettings.identifiers, "20"],
      },
      now: new Date(2026, 9, 26, 18, 5),
    },
  );
  assert.equal(parsed.feedback.length, 2);
  const correctionNote = parsed.feedback.find((note) => /P43/.test(note.content));
  assert.equal(correctionNote.type, "criticism");
  assert.equal(correctionNote.subject, "数学");
  assert.doesNotMatch(correctionNote.content, /\u0014/);
});

test("numbered task parentheses do not swallow the trailing note", () => {
  const parsed = parseTeacherMessage(
    `英语-王老师 17:56:02
2.作业布置：
（2）复习书本32页内容，一般疑问句仍不是很掌握（订正作业本）`,
    {
      today: "2026-10-26",
      settings: realMessageSettings,
      now: new Date(2026, 9, 26, 18, 5),
    },
  );
  assert.equal(parsed.tasks.length, 1);
  assert.match(parsed.tasks[0].title, /（订正作业本）$/);
});

test("combined teacher messages keep each subject and preserve follow-up checks", () => {
  const parsed = parseTeacherMessage(
    `语文-钟老师 15:59:36
作业为：
1、抄写书本63和64的成语各两遍；
2、完成一张文言文小练习；
3、家庭词语[图片]今天未交阅读手册和练习册的同学请明天补交。

数学-刘老师 16:16:23
10.26数学
一、作业
1.订正错题、练计算（小数除法）
2.练习册P45-46。
3.启智21。
4.每日一题（选做）：[图片]。
二、小结
2.表扬练习册P44A+的30人：3.20.33。
4.启智17-20还有错题没订正的11人：2.20.33。
（周二再检查！！！）

英语-王老师 17:56:02
10.26英语学习情况
2.作业布置：
（1）仿照书本第35页写自己，注意画图
（2）复习书本32页内容
（3）预习书本第33页内容
3.作业反馈
批评第二单元试卷没交的同学：2.20.33`,
    {
      today: "2026-10-26",
      settings: {
        ...realMessageSettings,
        identifiers: [...realMessageSettings.identifiers, "20"],
      },
      now: new Date(2026, 9, 26, 18, 5),
    },
  );

  assert.ok(
    parsed.tasks.some(
      (task) => task.title === "启智21" && task.subject === "数学",
    ),
  );
  assert.equal(
    parsed.tasks.filter((task) => task.subject === "英语").length,
    3,
  );
  assert.ok(
    parsed.tasks
      .filter((task) => /练习册P45|每日一题/.test(task.title))
      .every((task) => task.subject === "数学"),
  );
  assert.equal(
    parsed.tasks.find((task) => task.title.includes("启智17-20"))?.date,
    "2026-10-26",
  );
  assert.ok(
    parsed.feedback
      .filter((note) => note.subject === "数学")
      .every((note) => note.subject === "数学"),
  );
  assert.ok(
    parsed.feedback.some(
      (note) => note.type === "criticism" && note.subject === "英语",
    ),
  );
});

test("annotation homework is captured and future class drills do not move review to tomorrow", () => {
  const parsed = parseTeacherMessage(
    `数学-示例老师 16:41:14
11.2数学
一、作业
1.订正错题、练计算（小数乘除法）
2.练习册P54-56。
3.订正启智21-24。（周二再查）
4.每日一题（选做）：
长方形绕中心点至少旋转（      ）° 可以与原图形重合。
二、小结
2.表扬练习册P51-53A+的2人：101.102。
缺交或少做的2人：103.104。

英语-示例老师 16:43:03
2️⃣作业布置
1.用二号本写一篇作文（仿写）
2.继续默写知识清单
3.复习、明天堂练

语文-示例老师 16:47:09
今天学习了第15课第一课时，作业为：
1、继续完成第15课生字和词语；
2、批注：用课堂上老师讲的方法读熟第15课，并批注“说明方法”（最少5处）。`,
    {
      today: "2026-11-02",
      settings: {
        ...realMessageSettings,
        identifiers: ["900", "示例孩子"],
      },
      now: new Date(2026, 10, 2, 18, 0),
    },
  );
  assert.equal(parsed.tasks.length, 10);
  assert.ok(
    parsed.tasks.some(
      (task) =>
        task.subject === "语文" &&
        /批注/.test(task.title) &&
        task.date === "2026-11-02",
    ),
  );
  const reviewTask = parsed.tasks.find((task) => task.title === "复习、明天堂练");
  assert.ok(reviewTask);
  assert.equal(reviewTask.date, "2026-11-02");
});

test("legacy imports are rematched to the correct subject section", () => {
  const importRecord = {
    id: "import_legacy",
    date: "2026-10-26",
    message: `语文-钟老师 15:59:36
作业为：
1、抄写书本63和64的成语各两遍；

数学-刘老师 16:16:23
10.26数学
一、作业
1.订正错题、练计算（小数除法）
2.练习册P45-46。
3.启智21。
4.每日一题（选做）：[图片]。
二、小结
2.表扬练习册P44A+的30人：3.20.33。
4.启智17-20还有错题没订正的11人：2.20.33。
（周二再检查！！！）

英语-王老师 17:56:02
10.26英语学习情况
3.作业反馈
批评第二单元试卷没交的同学：2.20.33`,
  };

  assert.equal(
    resolveImportedTaskSubject(
      { title: "订正错题", notes: "1.订正错题、练计算（小数除法）" },
      importRecord,
    ),
    "数学",
  );
  assert.equal(
    resolveImportedTaskSubject({ title: "练习册P45-46" }, importRecord),
    "数学",
  );
  assert.equal(
    resolveImportedTaskSubject({ title: "每日一题" }, importRecord),
    "数学",
  );
  assert.equal(
    resolveImportedTaskSubject({ title: "启智21" }, importRecord),
    "数学",
  );
  assert.equal(
    resolveImportedTaskSubject(
      { title: "抄写书本63和64的成语各两遍" },
      importRecord,
    ),
    "语文",
  );
  assert.equal(
    resolveImportedFeedbackSubject(
      { content: "练习册P44A+的30人获得老师表扬。" },
      importRecord,
    ),
    "数学",
  );
  assert.equal(
    resolveImportedFeedbackSubject(
      { content: "启智17-20还有错题没订正" },
      importRecord,
    ),
    "数学",
  );
  assert.equal(
    resolveImportedFeedbackSubject(
      { content: "批评第二单元试卷没交的同学" },
      importRecord,
    ),
    "英语",
  );
  assert.equal(
    sanitizeImportedFeedbackContent(
      "练习册P44A+的30人\u00144获得老师表扬。",
    ),
    "练习册P44A+的30人获得老师表扬。",
  );
});

test("Saturday scheduling starts in the morning and overflow continues on Sunday", () => {
  const plan = buildTaskSchedulePlan(
    Array.from({ length: 7 }, (_, index) => ({
      title: `任务${index + 1}`,
      date: "2026-10-24",
      estimatedMinutes: 120,
    })),
    {
      today: "2026-10-24",
      settings,
      existingTasks: [],
      now: new Date(2026, 9, 24, 22, 20),
    },
  );
  assert.equal(plan.tasks[0].date, "2026-10-24");
  assert.equal(plan.tasks[0].scheduledStart, "09:00");
  assert.match(plan.tasks[0].scheduleNote, /周末上午/);
  assert.equal(plan.tasks[5].date, "2026-10-24");
  assert.equal(plan.tasks[6].date, "2026-10-25");
  assert.equal(plan.tasks[6].scheduledStart, "09:00");
  assert.match(plan.tasks[6].scheduleNote, /顺延到周日/);
});
