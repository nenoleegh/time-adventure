import {
  addDays,
  dateKey,
  formatDateCN,
  formatMinutes,
  weekKey,
} from "./utils/date.js?v=1.13.7";
import {
  DEFAULT_PRODUCTS,
  validateRewardSettings,
} from "./services/reward-rules.js?v=1.13.7";
import {
  getSettings,
  getSettingHistory,
  saveSettings,
  setParentPin,
  verifyParentPin,
} from "./services/settings-service.js?v=1.13.7";
import { getAll, exportDatabase, importDatabase } from "./services/db.js?v=1.13.7";
import {
  createTask,
  deleteTask,
  getTasksForDate,
  moveTask,
  pauseTask,
  rescheduleTask,
  scheduleTask,
  skipTask,
  splitTask,
  startTask,
  completeTask,
  updateTask,
  backfillTaskSubjects,
  markTaskReminderShown,
} from "./services/task-service.js?v=1.13.7";
import { getLedger } from "./services/ledger-service.js?v=1.13.7";
import {
  cancelRedemption,
  approveRedemption,
  getRedemptions,
  markRedeemed,
  rejectRedemption,
  requestRedemption,
} from "./services/redemption-service.js?v=1.13.7";
import { getReflection, saveReflection } from "./services/reflection-service.js?v=1.13.7";
import {
  estimateFeedback,
  elapsedMs,
  resolveTaskSubject,
  SUBJECT_OPTIONS,
  TASK_TYPES,
} from "./services/task-rules.js?v=1.13.7";
import { ledgerBalance } from "./services/ledger-rules.js?v=1.13.7";
import { todayView } from "./views/today.js?v=1.13.7";
import { planView } from "./views/plan.js?v=1.13.7";
import { rewardsView } from "./views/rewards.js?v=1.13.7";
import { growthView } from "./views/growth.js?v=1.13.7";
import {
  parentView,
  REWARD_PRODUCT_TEMPLATES,
  rewardProductFieldsHtml,
} from "./views/parent.js?v=1.13.7";
import { helpDialogHtml } from "./views/help.js?v=1.13.7";
import { escapeHtml, icon } from "./ui/html.js?v=1.13.7";
import { validatePin } from "./utils/pin.js?v=1.13.7";
import { makeId } from "./utils/id.js?v=1.13.7";
import {
  minutesToTime,
  parseTeacherMessage,
  timeToMinutes,
} from "./services/teacher-import-rules.js?v=1.13.7";
import {
  backfillFeedbackSubjects,
  commitTeacherImport,
  getFeedbackForDate,
} from "./services/teacher-import-service.js?v=1.13.7";
import {
  importEntryDialogHtml,
  importExampleText,
  importPreviewDialogHtml,
  importSettingsDialogHtml,
} from "./views/teacher-import.js?v=1.13.7";
import { installTimelineDrag } from "./ui/timeline-drag.js?v=1.13.7";
import {
  buildCourseOccurrences,
  courseHasConflict,
  defaultSemesterRange,
  markCourseDuplicates,
  parseCourseText,
  parseCourseRows,
} from "./services/course-schedule-rules.js?v=1.13.7";
import {
  deleteCourseTemplate,
  getCourseTemplates,
  saveCourseTemplates,
} from "./services/course-schedule-service.js?v=1.13.7";
import {
  COURSE_EXAMPLE,
  courseImportEntryHtml,
  courseImportPreviewHtml,
  courseManagerHtml,
  deleteCourseDialogHtml,
} from "./views/course-import.js?v=1.13.7";
import {
  parseDelimitedText,
  readCourseSpreadsheet,
  rowsToTsv,
} from "./services/table-file.js?v=1.13.7";
import {
  applyFeatureSettings,
  FEATURES,
} from "./config/features.js?v=1.13.7";
import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  THEME_OPTIONS,
} from "./config/themes.js?v=1.13.7";
import {
  buildTaskCalendarIcs,
  calendarFileName,
  findDueTaskReminder,
  reminderKey,
} from "./services/reminder-rules.js?v=1.13.7";
import {
  careForPet,
  awardPetPointsForTask,
  backfillPetPointsForCompletedTasks,
  getPetCareLog,
  getPetProfile,
  hatchPetWithName,
  reAdoptPet,
  tapPetEgg,
  treatPet,
} from "./services/pet-service.js?v=1.13.7";
import { petView } from "./views/pet.js?v=1.13.7";
import {
  PET_CARE_ACTIONS,
  PET_CARE_COSTS,
  petVisualState,
} from "./services/pet-rules.js?v=1.13.7";

const ALL_ROUTES = [
  { id: "today", label: "今天", icon: "today" },
  { id: "plan", label: "计划", icon: "plan" },
  { id: "pet", label: "小恐龙", icon: "pet" },
  { id: "rewards", label: "奖励", icon: "reward" },
  { id: "growth", label: "成长", icon: "growth" },
];
function enabledRoutes() {
  return ALL_ROUTES.filter(
    (route) =>
      (FEATURES.rewards || route.id !== "rewards") &&
      (FEATURES.pets || route.id !== "pet"),
  );
}

const state = {
  route: "today",
  today: dateKey(),
  planDay: dateKey(),
  planMode: "day",
  todaySubjectFilter: "全部",
  loading: true,
  error: "",
  tasks: [],
  planTasks: [],
  allTasks: [],
  ledger: [],
  redemptions: [],
  reflections: [],
  settings: null,
  settingHistory: [],
  reflection: null,
  todayFeedback: [],
  courseTemplates: [],
  petProfile: null,
  petCareLog: [],
  petAction: "",
  petIdleAction: "",
  petMessage: "",
  courseImportText: "",
  courseParsed: null,
  parentUnlocked: false,
  busy: false,
  importMessage: "",
  importParsed: null,
  resumeImport: false,
};

const root = document.querySelector("#app");
const dialog = document.querySelector("#app-dialog");
const toast = document.querySelector("#toast");
let toastTimer;
let reminderAudioContext;
let reminderShowing = false;
let lastPetRefreshMinute = "";
let lastPlanRefreshMinute = "";
let petIdleTimer;
let petIdleClearTimer;
let lastPetIdleAction = "";
const MOBILE_LAYOUT_KEY = "time-adventure-layout-v2";
const GUIDE_SEEN_KEY = "time-adventure-guide-seen-v1";
const portraitPhoneQuery = window.matchMedia(
  "(max-width: 760px) and (orientation: portrait)",
);

function readStoredLayout() {
  try {
    const value = localStorage.getItem(MOBILE_LAYOUT_KEY);
    return ["mobile", "desktop"].includes(value) ? value : null;
  } catch {
    return null;
  }
}

const storedLayout = readStoredLayout();
let layoutPreferenceLocked = Boolean(storedLayout);
let layoutMode = storedLayout || (portraitPhoneQuery.matches ? "mobile" : "desktop");
let guideSeenThisSession = false;

function applyLayoutMode(mode, { persist = false } = {}) {
  layoutMode = mode === "mobile" ? "mobile" : "desktop";
  document.documentElement.dataset.mobileLayout =
    layoutMode === "mobile" ? "true" : "false";
  document.documentElement.dataset.layoutMode = layoutMode;
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.content = "width=device-width, initial-scale=1, viewport-fit=cover";
  }
  if (persist) {
    layoutPreferenceLocked = true;
    try {
      localStorage.setItem(MOBILE_LAYOUT_KEY, layoutMode);
    } catch {
      // The selected layout still applies for this session.
    }
  }
}

applyLayoutMode(layoutMode);
portraitPhoneQuery.addEventListener?.("change", (event) => {
  if (layoutPreferenceLocked) return;
  applyLayoutMode(event.matches ? "mobile" : "desktop");
  if (!state.loading) render();
});

const PET_IDLE_ACTIONS = [
  { id: "walk", duration: 3600 },
  { id: "selfClean", duration: 3600 },
  { id: "headPet", duration: 3000 },
  { id: "sleep", duration: 4800 },
  { id: "cute", duration: 3000 },
  { id: "play", duration: 3600 },
];

function schedulePetIdle(delay = 5000 + Math.random() * 4500) {
  window.clearTimeout(petIdleTimer);
  petIdleTimer = window.setTimeout(() => {
    const profile = state.petProfile;
    const canAnimate =
      state.route === "pet" &&
      profile?.stage === "baby" &&
      !state.busy &&
      !state.petAction &&
      !dialog.open &&
      petVisualState(profile) === "healthy";
    if (!canAnimate) {
      schedulePetIdle(4500);
      return;
    }
    const choices = PET_IDLE_ACTIONS.filter(
      (item) => item.id !== lastPetIdleAction,
    );
    const selected =
      choices[Math.floor(Math.random() * choices.length)] || PET_IDLE_ACTIONS[0];
    lastPetIdleAction = selected.id;
    state.petIdleAction = selected.id;
    render();
    window.clearTimeout(petIdleClearTimer);
    petIdleClearTimer = window.setTimeout(() => {
      state.petIdleAction = "";
      if (state.route === "pet") render();
      schedulePetIdle();
    }, selected.duration);
  }, delay);
}

function ensureReminderAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    reminderAudioContext ||= new AudioContextClass();
    if (reminderAudioContext.state === "suspended") {
      reminderAudioContext.resume().catch(() => {});
    }
    return reminderAudioContext;
  } catch {
    return null;
  }
}

function playReminderChime() {
  const context = ensureReminderAudio();
  navigator.vibrate?.([120, 70, 120]);
  if (!context || context.state !== "running") return;
  const notes = [
    { offset: 0, frequency: 659.25 },
    { offset: 0.2, frequency: 783.99 },
    { offset: 0.42, frequency: 987.77 },
  ];
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + note.offset;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.34);
  }
}

function getBalance() {
  return ledgerBalance(state.ledger);
}

function applyTheme(themeId) {
  const normalized = normalizeThemeId(themeId);
  document.documentElement.dataset.theme = normalized;
  const theme = THEME_OPTIONS.find((item) => item.id === normalized);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && theme) meta.content = theme.themeColor;
  try {
    localStorage.setItem("time-adventure-theme", normalized);
  } catch {
    // Theme still applies for this session when storage is unavailable.
  }
}

function storedThemeId() {
  try {
    return localStorage.getItem("time-adventure-theme") || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

applyTheme(storedThemeId());

function viewState() {
  return {
    ...state,
    balance: getBalance(),
    week: weekKey(state.today),
    todayLedger: state.ledger.filter((entry) => entry.date === state.today),
  };
}

async function refresh() {
  const currentDate = dateKey();
  if (state.today !== currentDate) {
    state.today = currentDate;
  }
  const [
    settings,
    allTasks,
    ledger,
    redemptions,
    reflection,
    reflections,
    settingHistory,
    todayFeedback,
    courseTemplates,
    petProfile,
    petCareLog,
  ] = await Promise.all([
    getSettings(),
    getAll("tasks"),
    getLedger(),
    getRedemptions(),
    getReflection(state.today),
    getAll("reflections"),
    getSettingHistory(),
    getFeedbackForDate(state.today),
    getCourseTemplates(),
    getPetProfile(),
    getPetCareLog(),
  ]);
  state.settings = settings;
  applyFeatureSettings(settings);
  applyTheme(settings.themeId);
  state.allTasks = allTasks.sort((a, b) => {
    const dateDelta = b.date.localeCompare(a.date);
    return dateDelta || a.sortOrder - b.sortOrder;
  });
  state.tasks = await getTasksForDate(state.today);
  state.planTasks = await getTasksForDate(state.planDay);
  state.ledger = ledger;
  state.redemptions = redemptions;
  state.reflection = reflection;
  state.reflections = reflections;
  state.settingHistory = settingHistory;
  state.todayFeedback = todayFeedback;
  state.courseTemplates = courseTemplates;
  state.petProfile = petProfile;
  state.petCareLog = petCareLog;
  state.loading = false;
  state.error = "";
}

function navButton(route) {
  const active =
    state.route === route.id ||
    (state.route === "parent" && route.id === (FEATURES.rewards ? "rewards" : "today"));
  return `
    <button class="nav-item ${active ? "active" : ""}" data-route="${route.id}" aria-current="${active ? "page" : "false"}">
      <span class="nav-icon">${icon(route.icon)}</span>
      <span>${route.label}</span>
    </button>`;
}

function appShell() {
  if (state.loading) {
    return `
      <div class="loading-screen">
        <div class="brand-mark large">${icon("spark")}</div>
        <h1>时间冒险家</h1>
        <p>正在找回今天的计划...</p>
      </div>`;
  }
  if (state.error) {
    return `
      <div class="loading-screen error">
        <h1>暂时没有打开本机数据</h1>
        <p>${escapeHtml(state.error)}</p>
        <button class="button primary" data-action="retry-load">重新尝试</button>
      </div>`;
  }
  const balance = getBalance();
  const routes = enabledRoutes();
  const mobileLayout = layoutMode === "mobile";
  return `
    <div class="app-frame">
      <header class="topbar">
        <button class="brand" data-route="today" aria-label="回到今天">
          <span class="brand-mark">${icon("spark")}</span>
          <span><strong>时间冒险家</strong><small>TIME ADVENTURE</small></span>
        </button>
        <div class="topbar-center">${formatDateCN(state.today)}</div>
        <div class="topbar-actions">
          <button
            class="layout-mode-toggle"
            data-action="toggle-layout-mode"
            aria-pressed="${mobileLayout ? "true" : "false"}"
            aria-label="${mobileLayout ? "切换到详细布局" : "切换到简洁竖屏布局"}"
            title="${mobileLayout ? "显示今日进度、余额和提醒等更多信息" : "只保留下一步和核心任务"}"
          >
            ${icon("phone")}
            <span>${mobileLayout ? "详细版" : "简洁版"}</span>
          </button>
          <button class="guide-entry" data-action="open-guide" aria-label="打开使用说明" title="使用说明">
            ${icon("help")}<span>说明</span>
          </button>
          ${FEATURES.rewards
            ? `<button class="star-balance" data-route="rewards">${icon("spark")}<strong>${balance}</strong><span>星能</span></button>`
            : `<button class="parent-entry" data-action="open-parent">${icon("lock")}家长</button>`}
          <span class="offline-pill" id="offline-pill" hidden>离线也能用</span>
        </div>
      </header>
      <main id="app-main">${renderRoute()}</main>
      <nav class="bottom-nav" aria-label="主要页面" style="--nav-count:${routes.length}">
        ${routes.map(navButton).join("")}
      </nav>
    </div>`;
}

function renderRoute() {
  const data = viewState();
  if (state.route === "plan") return planView(data);
  if (state.route === "pet") return petView(data);
  if (state.route === "rewards") {
    if (!FEATURES.rewards) return todayView(data);
    return rewardsView(data);
  }
  if (state.route === "growth") return growthView(data);
  if (state.route === "parent") {
    if (!state.parentUnlocked) {
      window.setTimeout(openParentAccess, 0);
      return todayView(data);
    }
    return parentView(data);
  }
  return todayView(data);
}

function render() {
  root.innerHTML = appShell();
  updateOfflineStatus();
}

function showToast(message, tone = "default") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast visible ${tone}`;
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function closeDialog() {
  const guideWasOpen = dialog.classList.contains("guide-modal");
  if (dialog.classList.contains("reminder-modal")) reminderShowing = false;
  if (dialog.open) dialog.close();
  dialog.innerHTML = "";
  if (guideWasOpen) markGuideSeen();
}

function openDialog(content, className = "") {
  dialog.className = `app-dialog ${className}`;
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
  const focusTarget = dialog.querySelector("input, textarea, button");
  window.setTimeout(() => focusTarget?.focus(), 60);
}

function hasSeenGuide() {
  if (guideSeenThisSession) return true;
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

function markGuideSeen() {
  guideSeenThisSession = true;
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, "true");
  } catch {
    // Keep the in-memory flag so the guide does not reopen this session.
  }
}

function openGuideDialog({ firstRun = false } = {}) {
  openDialog(helpDialogHtml({ firstRun }), "guide-modal");
}

function maybeOpenFirstRunGuide() {
  if (hasSeenGuide()) return;
  window.setTimeout(() => openGuideDialog({ firstRun: true }), 120);
}

function modalHeader(eyebrow, title, description = "") {
  return `
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      <button type="button" class="dialog-close" data-action="close-dialog" aria-label="关闭">${icon("close")}</button>
    </div>`;
}

function subjectOptions(selected = "") {
  return `
    <option value="" ${selected ? "" : "selected"}>自动识别</option>
    ${SUBJECT_OPTIONS.map(
      (subject) =>
        `<option value="${escapeHtml(subject)}" ${selected === subject ? "selected" : ""}>${escapeHtml(subject)}</option>`,
    ).join("")}`;
}

function addTaskDialog(preselectedDate = state.planDay) {
  openDialog(`
    <form id="add-task-form" class="dialog-form">
      ${modalHeader("加入计划", "下一步想做什么？", "先写一件事，估一个大概时间。以后可以再调整。")}
      <div class="form-utility-row">
        <span>如果手动设置开始时间，时间冲突时其他任务会自动向后顺延。</span>
        <button type="button" class="clear-button" data-action="clear-add-task">${icon("close")}清空内容</button>
      </div>
      <input type="hidden" name="date" value="${preselectedDate}">
      <label class="field">
        <span>任务名称</span>
        <input name="title" maxlength="40" placeholder="例如：数学练习第 1 到 5 题" required>
      </label>
      <label class="field">
        <span>科目</span>
        <select name="subject">${subjectOptions()}</select>
      </label>
      <fieldset class="field">
        <legend>这件事的类型</legend>
        <div class="segmented">
          ${Object.entries(TASK_TYPES).map(([id, type], index) => `
            <label class="segment-option">
              <input type="radio" name="type" value="${id}" ${index === 0 ? "checked" : ""}>
              <span>${type.label}</span>
            </label>`).join("")}
        </div>
      </fieldset>
      <label class="field">
        <span>预计需要多久？</span>
        <div class="estimate-input"><input name="estimatedMinutes" type="number" min="5" max="240" step="5" value="20" required><b>分钟</b></div>
        <div class="quick-estimates">
          ${[10, 20, 30, 45, 60].map((value) => `<button type="button" data-estimate="${value}">${value} 分钟</button>`).join("")}
        </div>
      </label>
      <label class="field">
        <span>计划开始时间 <small>可选，手动任务优先</small></span>
        <input name="scheduledStart" type="time" step="300">
      </label>
      <label class="field">
        <span>给自己留一句提示 <small>可选</small></span>
        <textarea name="notes" maxlength="160" placeholder="例如：先做会做的部分"></textarea>
      </label>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">先不添加</button>
        <button class="button primary" type="submit">${icon("plus")}放进计划</button>
      </div>
    </form>`);
}

function editTaskDialog(task) {
  const selectedSubject = resolveTaskSubject(task);
  openDialog(`
    <form id="edit-task-form" class="dialog-form">
      ${modalHeader("调整任务", "让计划更符合实际", FEATURES.rewards ? "改动不会影响已经获得的星能。" : "改动只影响之后的计划和计时。")}
      <input type="hidden" name="taskId" value="${task.id}">
      <label class="field">
        <span>任务名称</span>
        <input name="title" maxlength="40" value="${escapeHtml(task.title)}" required>
      </label>
      <label class="field">
        <span>科目</span>
        <select name="subject">${subjectOptions(selectedSubject)}</select>
      </label>
      <fieldset class="field">
        <legend>这件事的类型</legend>
        <div class="segmented">
          ${Object.entries(TASK_TYPES).map(([id, type]) => `
            <label class="segment-option">
              <input type="radio" name="type" value="${id}" ${task.type === id ? "checked" : ""}>
              <span>${type.label}</span>
            </label>`).join("")}
        </div>
      </fieldset>
      <label class="field">
        <span>预计时长</span>
        <div class="estimate-input"><input name="estimatedMinutes" type="number" min="5" max="240" step="5" value="${task.estimatedMinutes}" required><b>分钟</b></div>
      </label>
      <label class="field">
        <span>计划开始时间 <small>可选</small></span>
        <input name="scheduledStart" type="time" step="300" value="${task.scheduledStart || ""}">
      </label>
      <label class="field">
        <span>提示 <small>可选</small></span>
        <textarea name="notes" maxlength="160" placeholder="例如：先做会做的部分">${escapeHtml(task.notes)}</textarea>
      </label>
      ${task.status === "completed" ? `
        <label class="field">
          <span>实际用时</span>
          <div class="estimate-input"><input name="actualMinutes" type="number" min="1" max="600" step="1" value="${task.actualMinutes}"><b>分钟</b></div>
        </label>` : ""}
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">保存调整</button>
      </div>
    </form>`);
}

function petNameDialog() {
  openDialog(`
    <form id="pet-name-form" class="dialog-form pet-name-dialog">
      ${modalHeader("小恐龙要出生了", "给新伙伴起一个名字", "名字会出现在孵化记录和每次互动里，之后暂时不能修改。")}
      <div class="hatching-preview">
        <span class="hatching-shell left"></span>
        <span class="hatching-star">✦</span>
        <span class="hatching-shell right"></span>
      </div>
      <label class="field">
        <span>小恐龙的名字</span>
        <input name="petName" maxlength="12" required autocomplete="off" placeholder="例如：泡泡">
      </label>
      <p class="dialog-note">${icon("heart")}建议使用孩子喜欢的 1 至 12 个字符。</p>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">再想一下</button>
        <button class="button primary" type="submit">${icon("heart")}破壳出生</button>
      </div>
    </form>`, "pet-name-modal");
}

function readoptPetDialog() {
  openDialog(`
    <form id="pet-readopt-form" class="dialog-form pet-readopt-dialog">
      ${modalHeader("重新领养", "开始一段新的陪伴", "会得到一颗新的蛋，需要重新敲开并起名字。之前的照料记录会保留。")}
      <div class="readopt-egg">◇</div>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">先不领养</button>
        <button class="button primary" type="submit">${icon("heart")}领养新蛋</button>
      </div>
    </form>`, "pet-name-modal");
}

function completeTaskDialog(task) {
  const measured = Math.round(elapsedMs(task) / 60000);
  const suggested = measured || task.actualMinutes || task.estimatedMinutes;
  openDialog(`
    <form id="complete-task-form" class="dialog-form complete-dialog">
      ${modalHeader("完成这一步", task.title, "记下实际用了多久。与预计不同也很正常。")}
      <input type="hidden" name="taskId" value="${task.id}">
      <div class="complete-comparison">
        <div><span>原来预计</span><strong>${formatMinutes(task.estimatedMinutes)}</strong></div>
        <div class="comparison-arrow">→</div>
        <label><span>这次实际用了</span><div class="estimate-input"><input name="actualMinutes" type="number" inputmode="numeric" min="1" max="600" step="1" value="${suggested}" required><b>分钟</b></div></label>
      </div>
      <div class="actual-quick-times">
        <span>快速填写实际用时</span>
        ${[5, 10, 15, 20, 30, 45].map((minutes) => `
          <button type="button" data-actual-minutes="${minutes}">${minutes} 分钟</button>
        `).join("")}
      </div>
      <p class="dialog-note">${icon(FEATURES.rewards ? "spark" : "check")}${FEATURES.rewards ? "完成后会按当前家庭约定获得星能，同一任务只结算一次。" : "完成后会记录实际用时，帮助你了解自己的时间节奏。"}</p>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">还没完成</button>
        <button class="button primary" type="submit">${icon("check")}确认完成</button>
      </div>
    </form>`);
}

function reminderDialog(task) {
  openDialog(`
    <div class="dialog-form reminder-dialog">
      ${modalHeader(
        "任务时间到了",
        task.title,
        `计划在 ${task.scheduledStart}${task.scheduledEnd ? `–${task.scheduledEnd}` : ""} 完成。`,
      )}
      <div class="reminder-dialog-mark">${icon("clock")}</div>
      <p class="dialog-note">${icon("spark")}先看看现在能否开始；如果时间不合适，可以关闭提醒后重新安排。</p>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="dismiss-reminder">稍后再说</button>
        <button class="button primary" type="button" data-action="start-reminder-task" data-id="${task.id}">${icon("play")}开始任务</button>
      </div>
    </div>`, "reminder-modal");
}

function downloadTaskCalendar(task) {
  const ics = buildTaskCalendarIcs(task, {
    reminderMinutes: Number(state.settings.reminderLeadMinutes) || 0,
  });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = calendarFileName(task);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("日历提醒已生成。打开下载的文件即可加入 iPad 日历。");
}

function taskMenuDialog(task) {
  openDialog(`
    <div class="task-menu-dialog">
      ${modalHeader("安排选项", task.title, FEATURES.rewards ? "这些调整都不会扣除已经获得的星能。" : "这些调整不会改变已经完成的记录。")}
      <div class="menu-list">
        <button data-action="reschedule-task" data-id="${task.id}">
          <span>${icon("calendar")}移到下一天</span><small>保留任务和预计时长</small>
        </button>
        <button data-action="skip-task" data-id="${task.id}">
          <span>${icon("plan")}暂时跳过</span><small>记录为主动调整，不算失败</small>
        </button>
        ${task.status === "completed" ? "" : `
          <button class="danger-quiet" data-action="delete-task" data-id="${task.id}">
            <span>${icon("close")}删除计划</span><small>只删除尚未完成的安排</small>
          </button>`}
      </div>
      <button class="button outline wide dialog-bottom-button" data-action="close-dialog">返回</button>
    </div>`, "task-menu");
}

function requestRedemptionDialog(product) {
  openDialog(`
    <div class="dialog-form">
      ${modalHeader("申请兑换", product.title, `申请后会先使用 ${product.cost} 星能，家长拒绝时自动退回。`)}
      <div class="confirm-reward">
        <div class="reward-symbol">${icon(product.kind === "game" ? "clock" : "people")}</div>
        <div><h3>${escapeHtml(product.title)}</h3><p>${escapeHtml(product.description)}</p></div>
      </div>
      <p class="dialog-note">${icon("shield")}家长批准只代表同意。真正使用后，还需要由家长记录“已兑现”。</p>
      <div class="dialog-actions">
        <button class="button outline" data-action="close-dialog">再想想</button>
        <button class="button primary" data-action="confirm-redemption" data-id="${product.id}">提交申请</button>
      </div>
    </div>`);
}

function parentAccessDialog() {
  const hasPin = Boolean(state.settings.pinHash);
  openDialog(`
    <form id="parent-access-form" class="dialog-form pin-dialog">
      ${modalHeader(hasPin ? "家长入口" : "第一次设置家长入口", hasPin ? "输入 4 至 6 位 PIN" : "设置一个只有家长知道的数字 PIN", "这个入口用于防止孩子误改规则，不能替代 iPad 系统级屏幕功能限制。")}
      <label class="field pin-field">
        <span>${hasPin ? "家长 PIN" : "新 PIN"}</span>
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="off" placeholder="••••" required>
      </label>
      ${hasPin ? "" : `
        <label class="field pin-field">
          <span>再输入一次</span>
          <input name="pinConfirm" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="off" placeholder="••••" required>
        </label>`}
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">${hasPin ? "进入家长区" : "保存并进入"}</button>
      </div>
    </form>`, "pin-modal");
}

function openParentAccess() {
  if (state.parentUnlocked) {
    state.route = "parent";
    render();
    return;
  }
  parentAccessDialog();
}

function rejectRedemptionDialog(item) {
  openDialog(`
    <form id="reject-redemption-form" class="dialog-form">
      ${modalHeader("说明原因", item.title, "孩子会看到具体规则原因，而不只是“被拒绝”。")}
      <input type="hidden" name="redemptionId" value="${item.id}">
      <label class="field">
        <span>这次没有通过的原因</span>
        <textarea name="reason" maxlength="160" required placeholder="例如：已经达到今天额外游戏时间的家庭上限"></textarea>
      </label>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">返回</button>
        <button class="button primary" type="submit">确认并退回星能</button>
      </div>
    </form>`);
}

function changeParentPinDialog() {
  openDialog(`
    <form id="change-parent-pin-form" class="dialog-form pin-dialog">
      ${modalHeader("家长入口", "设置新的 PIN", "修改后，下一次进入家长区需要使用新 PIN。")}
      <label class="field pin-field">
        <span>新 PIN</span>
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="off" placeholder="••••" required>
      </label>
      <label class="field pin-field">
        <span>再输入一次</span>
        <input name="pinConfirm" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="off" placeholder="••••" required>
      </label>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">保存新 PIN</button>
      </div>
    </form>`, "pin-modal");
}

function openTeacherImportDialog() {
  state.importParsed = null;
  openDialog(importEntryDialogHtml(state), "teacher-import-modal");
}

function scheduleTaskDialog(task) {
  openDialog(`
    <form id="schedule-task-form" class="dialog-form">
      ${modalHeader(
        "安排时间",
        task.title,
        task.sourceImportId
          ? "可以点按设置，也可以直接把灰色待安排块拖到时间轴。"
          : "这是手动任务。如果与已有任务冲突，其他任务会自动向后顺延。",
      )}
      <input type="hidden" name="taskId" value="${task.id}">
      <label class="field">
        <span>完成日期</span>
        <input name="date" type="date" value="${task.date}" required>
      </label>
      <div class="dialog-fields-grid">
        <label class="field">
          <span>开始时间</span>
          <input name="scheduledStart" type="time" step="300" value="${task.scheduledStart || "17:00"}" required>
        </label>
        <label class="field">
          <span>预计时长</span>
          <div class="estimate-input"><input name="estimatedMinutes" type="number" min="5" max="240" step="5" value="${task.estimatedMinutes}"><b>分钟</b></div>
        </label>
      </div>
      <p class="dialog-note">${icon("clock")}放在时间轴后，仍可以拖动区块继续调整。</p>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">${icon("check")}放进时间轴</button>
      </div>
    </form>`);
}

function openImportSettingsDialog(resumeImport = false) {
  state.resumeImport = resumeImport;
  openDialog(importSettingsDialogHtml(state), "import-settings-modal");
}

function openImportPreviewDialog(parsed) {
  state.importParsed = parsed;
  openDialog(importPreviewDialogHtml(parsed, state), "import-preview-modal");
}

function openCourseImportDialog() {
  state.courseParsed = null;
  openDialog(courseImportEntryHtml(state), "course-import-modal");
}

function openCoursePreviewDialog(parsed) {
  state.courseParsed = parsed;
  openDialog(courseImportPreviewHtml(parsed, state), "course-import-preview-modal");
}

function openCourseManager() {
  openDialog(courseManagerHtml(state.courseTemplates), "course-manager-modal");
}

function readImportTokens(form, group) {
  const committed = Array.from(
    form.querySelectorAll(`[data-token-group="${group}"] .token-chip`),
    (chip) => chip.dataset.value,
  ).filter(Boolean);
  const pending = String(
    form.querySelector(`[data-token-input="${group}"]`)?.value || "",
  )
    .split(/[,，、]/)
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...committed, ...pending])];
}

function showDialogError(message) {
  if (!dialog.open) return;
  dialog.querySelector(".dialog-error")?.remove();
  const error = document.createElement("div");
  error.className = "dialog-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  const actions = dialog.querySelector(".dialog-actions");
  if (actions) actions.before(error);
  else dialog.prepend(error);
  error.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle("is-busy", busy);
}

async function afterMutation(message, tone = "success") {
  await refresh();
  render();
  if (message) showToast(message, tone);
}

function findTask(taskId) {
  return state.allTasks.find((task) => task.id === taskId);
}

async function handleAction(action, element) {
  if (state.busy) return;
  const id = element.dataset.id;
  try {
    if (action === "close-dialog") return closeDialog();
    if (action === "open-guide") return openGuideDialog();
    if (action === "finish-guide") {
      closeDialog();
      showToast("使用说明已关闭，可以开始安排今天了。");
      return;
    }
    if (action === "retry-load") {
      state.loading = true;
      render();
      await refresh();
      render();
      return;
    }
    if (action === "pet-tap-egg") {
      setBusy(true);
      const result = await tapPetEgg();
      state.petProfile = result.profile;
      render();
      if (result.readyToName) petNameDialog();
      return;
    }
    if (action === "pet-care") {
      const careAction = element.dataset.petAction;
      setBusy(true);
      state.petIdleAction = "";
      if (careAction === "treat") {
        const profile = await treatPet();
        state.petProfile = profile;
        state.petMessage = `使用药品后，小恐龙开始恢复了，消耗 ${PET_CARE_COSTS.treat} 互动点。`;
        state.petAction = "treat";
      } else {
        const result = await careForPet(careAction);
        state.petProfile = result.profile;
        state.petMessage = `${PET_CARE_ACTIONS[careAction]?.label || "照顾"}完成${result.gained ? `，状态提升了 ${Math.round(result.gained)}%` : ""}${result.pointCost ? `，消耗 ${result.pointCost} 互动点` : ""}。`;
        state.petAction = careAction;
      }
      state.petCareLog = await getPetCareLog();
      render();
      window.setTimeout(() => {
        state.petAction = "";
        state.petMessage = "";
        if (state.route === "pet") render();
      }, 1600);
      return;
    }
    if (action === "pet-readopt") {
      readoptPetDialog();
      return;
    }
    if (action === "open-add") return addTaskDialog(element.dataset.date || state.planDay);
    if (action === "filter-today-subject") {
      state.todaySubjectFilter = element.dataset.subject || "全部";
      render();
      return;
    }
    if (action === "toggle-layout-mode") {
      const next = layoutMode === "mobile" ? "desktop" : "mobile";
      applyLayoutMode(next, { persist: true });
      render();
      showToast(next === "mobile" ? "已切换到简洁竖屏布局。" : "已显示更多今日信息。");
      return;
    }
    if (action === "schedule-task") return scheduleTaskDialog(findTask(id));
    if (action === "plan-mode") {
      state.planMode = element.dataset.mode === "week" ? "week" : "day";
      render();
      return;
    }
    if (action === "plan-week") {
      state.planDay = addDays(state.planDay, Number(element.dataset.offset) * 7);
      state.planTasks = await getTasksForDate(state.planDay);
      render();
      return;
    }
    if (action === "open-teacher-import") return openTeacherImportDialog();
    if (action === "open-course-import") return openCourseImportDialog();
    if (action === "choose-course-file") {
      dialog.querySelector("#course-schedule-file")?.click();
      return;
    }
    if (action === "fill-course-example") {
      const input = dialog.querySelector("#course-table-text");
      if (input) {
        input.value = COURSE_EXAMPLE;
        input.focus();
      }
      return;
    }
    if (action === "back-to-course-import") return openCourseImportDialog();
    if (action === "open-course-manager") return openCourseManager();
    if (action === "delete-course-template") {
      const course = state.courseTemplates.find(
        (template) => template.id === element.dataset.id,
      );
      if (course) openDialog(deleteCourseDialogHtml(course), "pin-modal");
      return;
    }
    if (action === "confirm-delete-course") {
      setBusy(true);
      await deleteCourseTemplate(element.dataset.id);
      await refresh();
      render();
      openCourseManager();
      showToast("每周课程已删除，完成历史不受影响。");
    }
    if (action === "open-import-settings" || action === "change-import-settings") {
      const messageInput = dialog.querySelector("#teacher-message-input");
      if (messageInput) state.importMessage = messageInput.value;
      return openImportSettingsDialog(Boolean(messageInput) || Boolean(state.importParsed));
    }
    if (action === "back-to-import") return openTeacherImportDialog();
    if (action === "clear-field") {
      const input = dialog.querySelector(`#${element.dataset.target}`);
      if (input) {
        input.value = "";
        input.focus();
      }
      if (element.dataset.target === "teacher-message-input") state.importMessage = "";
      if (element.dataset.target === "course-table-text") state.courseImportText = "";
      return;
    }
    if (action === "clear-add-task") {
      dialog.querySelector("#add-task-form")?.reset();
      dialog.querySelector('#add-task-form [name="title"]')?.focus();
      return;
    }
    if (action === "dismiss-reminder") {
      reminderShowing = false;
      closeDialog();
      return;
    }
    if (action === "start-reminder-task") {
      reminderShowing = false;
      closeDialog();
      setBusy(true);
      await startTask(id);
      await afterMutation("任务已经开始，专注在手头这一小段。");
      return;
    }
    if (action === "add-task-calendar") {
      const task = findTask(id);
      if (task) downloadTaskCalendar(task);
      return;
    }
    if (action === "fill-import-example") {
      const input = dialog.querySelector("#teacher-message-input");
      if (input) {
        input.value = importExampleText();
        input.focus();
      }
      return;
    }
    if (action === "add-import-token") {
      const group = element.dataset.group;
      const input = dialog.querySelector(`[data-token-input="${group}"]`);
      const values = String(input?.value || "")
        .split(/[,，、]/)
        .map((value) => value.trim())
        .filter(Boolean);
      const chips = dialog.querySelector(`[data-token-group="${group}"] .token-chips`);
      const existing = new Set(
        Array.from(chips?.querySelectorAll(".token-chip") || [], (chip) => chip.dataset.value),
      );
      for (const value of values) {
        if (existing.has(value) || !chips) continue;
        const chip = document.createElement("span");
        chip.className = "token-chip";
        chip.dataset.value = value;
        chip.append(document.createTextNode(value));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.action = "remove-import-token";
        remove.dataset.group = group;
        remove.setAttribute("aria-label", `删除 ${value}`);
        remove.innerHTML = icon("close");
        chip.append(remove);
        chips.append(chip);
        existing.add(value);
      }
      if (input) input.value = "";
      return;
    }
    if (action === "remove-import-token") {
      element.closest(".token-chip")?.remove();
      return;
    }
    if (action === "edit-task") return editTaskDialog(findTask(id));
    if (action === "open-complete") return completeTaskDialog(findTask(id));
    if (action === "task-menu") return taskMenuDialog(findTask(id));
    if (action === "start-task") {
      setBusy(true);
      await startTask(id);
      await afterMutation("这一步已经开始，专注在手头的小任务上。");
    }
    if (action === "pause-task") {
      setBusy(true);
      await pauseTask(id);
      await afterMutation("已经暂停。休息后再继续也没关系。");
    }
    if (action === "move-task") {
      setBusy(true);
      await moveTask(id, Number(element.dataset.direction));
      await afterMutation("");
    }
    if (action === "split-task") {
      setBusy(true);
      await splitTask(id);
      await afterMutation("已经拆成两小段，先做第一段就好。");
    }
    if (action === "reschedule-task") {
      setBusy(true);
      const task = findTask(id);
      await rescheduleTask(id, addDays(task.date, 1));
      closeDialog();
      await afterMutation("已经移到下一天，原来的记录仍然保留。");
    }
    if (action === "skip-task") {
      setBusy(true);
      await skipTask(id);
      closeDialog();
      await afterMutation(
        FEATURES.rewards
          ? "已经把这件事放回计划，不会扣掉星能。"
          : "已经把这件事放回计划，不会产生失败记录。",
      );
    }
    if (action === "delete-task") {
      setBusy(true);
      await deleteTask(id);
      closeDialog();
      await afterMutation("这件尚未完成的计划已经删除。");
    }
    if (action === "plan-day") {
      state.planDay = addDays(state.planDay, Number(element.dataset.offset));
      state.planTasks = await getTasksForDate(state.planDay);
      render();
      return;
    }
    if (action === "request-redemption") {
      const product = state.settings.products.find((item) => item.id === id);
      return requestRedemptionDialog(product);
    }
    if (action === "confirm-redemption") {
      setBusy(true);
      await requestRedemption(id);
      closeDialog();
      await afterMutation("兑换申请已经提交，等家长确认。");
    }
    if (action === "cancel-redemption") {
      setBusy(true);
      await cancelRedemption(id);
      await afterMutation("申请已取消，星能已经退回。");
    }
    if (action === "open-parent") return openParentAccess();
    if (action === "lock-parent") {
      state.parentUnlocked = false;
      state.route = FEATURES.rewards ? "rewards" : "today";
      render();
      showToast("家长区已锁定。");
      return;
    }
    if (action === "approve-redemption") {
      setBusy(true);
      await approveRedemption(id);
      await afterMutation("已批准。请在 iPad 屏幕使用时间中安排，完成后回来记录兑现。");
    }
    if (action === "reject-redemption") {
      const item = state.redemptions.find((redemption) => redemption.id === id);
      return rejectRedemptionDialog(item);
    }
    if (action === "mark-redeemed") {
      setBusy(true);
      await markRedeemed(id);
      await afterMutation("已经记录实际兑现。");
    }
    if (action === "export-data") {
      const payload = await exportDatabase();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `时间冒险家备份-${state.today}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("备份文件已经导出。");
    }
    if (action === "import-data") {
      document.querySelector("#backup-file")?.click();
      return;
    }
    if (action === "change-parent-pin") return changeParentPinDialog();
    if (action === "add-reward-product") {
      const list =
        element.closest("#parent-settings-form")?.querySelector(".product-settings-list") ||
        document.querySelector(".product-settings-list");
      if (!list) return;
      list.insertAdjacentHTML(
        "beforeend",
        rewardProductFieldsHtml({
          id: makeId("reward"),
          title: "",
          description: "",
          kind: "privilege",
          period: "week",
          minuteValue: 0,
          cost: 10,
          limit: 1,
        }),
      );
      list.lastElementChild?.querySelector("[data-product-title]")?.focus();
      return;
    }
    if (action === "add-reward-template") {
      const list =
        element.closest("#parent-settings-form")?.querySelector(".product-settings-list") ||
        document.querySelector(".product-settings-list");
      const template = REWARD_PRODUCT_TEMPLATES.find(
        (item) => item.key === element.dataset.template,
      );
      if (!list || !template) return;
      list.insertAdjacentHTML(
        "beforeend",
        rewardProductFieldsHtml({
          ...template,
          id: makeId("reward"),
        }),
      );
      const row = list.lastElementChild;
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.querySelector("[data-product-title]")?.focus({ preventScroll: true });
      return;
    }
    if (action === "remove-reward-product") {
      element.closest(".product-setting")?.remove();
      return;
    }
    if (action === "toggle-rewards") {
      const rewardsEnabled = !Boolean(state.settings.rewardsEnabled);
      setBusy(true);
      const saved = await saveSettings(
        { ...state.settings, rewardsEnabled },
        rewardsEnabled ? "开启奖励模块" : "暂停奖励模块",
      );
      applyFeatureSettings(saved);
      await afterMutation(
        rewardsEnabled
          ? "奖励模块已开启，任务完成和复盘会开始记录星能。"
          : "奖励模块已暂停，历史星能和兑换记录仍然保留。",
      );
      return;
    }
    if (action === "select-theme") {
      const themeId = normalizeThemeId(element.dataset.theme);
      const theme = THEME_OPTIONS.find((item) => item.id === themeId);
      setBusy(true);
      applyTheme(themeId);
      await saveSettings(
        { ...state.settings, themeId },
        `切换界面主题：${theme?.name || themeId}`,
      );
      await afterMutation(`已切换为“${theme?.name || "新主题"}”。`);
    }
  } catch (error) {
    closeDialog();
    showToast(error.message || "这一步暂时没有完成，请再试一次。", "error");
  } finally {
    setBusy(false);
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (state.busy) return;
  const formData = new FormData(form);
  const submitButton =
    form.id === "teacher-import-confirm-form"
      ? form.querySelector('button[type="submit"]')
      : null;
  const originalButtonContent = submitButton?.innerHTML;
  dialog.querySelector(".dialog-error")?.remove();
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "正在加入计划…";
    form.setAttribute("aria-busy", "true");
  }
  try {
    setBusy(true);
    if (form.id === "teacher-import-form") {
      const message = String(formData.get("message") || "").trim();
      if (!message) throw new Error("请先粘贴老师发来的消息。");
      state.importMessage = message;
      const parsed = parseTeacherMessage(message, {
        today: state.today,
        settings: state.settings.importerSettings,
        existingTasks: [
          ...state.allTasks,
          ...buildCourseOccurrences(
            state.courseTemplates,
            state.today,
            addDays(state.today, 21),
          ),
        ],
        now: new Date(),
      });
      openImportPreviewDialog(parsed);
    }
    if (form.id === "course-import-form") {
      const text = String(formData.get("tableText") || "").trim();
      if (!text) throw new Error("请先选择表格文件，或粘贴课程表内容。");
      state.courseImportText = text;
      const looksLikeScheduleText =
        /^\s*(?:[-*]\s*)?(?:\*\*)?(?:周|星期|礼拜)[一二三四五六日天](?:\*\*)?\s*$/m.test(
          text,
        ) ||
        /^\s*(?:[-*]\s*)?(?:\*\*)?\d{1,2}:\d{2}/m.test(text);
      const parsed = looksLikeScheduleText
        ? parseCourseText(text, {
            effectiveFrom: state.planDay,
          })
        : parseCourseRows(parseDelimitedText(text), {
            effectiveFrom: state.planDay,
          });
      parsed.semesterRange = defaultSemesterRange(state.today);
      parsed.courses = markCourseDuplicates(
        parsed.courses,
        state.courseTemplates,
      ).map((course) => ({
        ...course,
        include: course.weekday !== null && course.include,
      }));
      openCoursePreviewDialog(parsed);
    }
    if (form.id === "course-import-confirm-form") {
      const effectiveFrom = String(formData.get("effectiveFrom") || "");
      const effectiveTo = String(formData.get("effectiveTo") || "");
      if (!effectiveFrom) throw new Error("请选择每周课程的生效日期。");
      if (effectiveTo && effectiveTo < effectiveFrom) {
        throw new Error("结束日期不能早于生效日期。");
      }
      const selected = [];
      for (const row of form.querySelectorAll(".course-draft-row")) {
        const checked = row.querySelector('input[type="checkbox"]')?.checked;
        if (!checked) continue;
        const title = row.querySelector('[name^="course-title-"]')?.value.trim();
        const weekdayValue = String(
          row.querySelector('[name^="course-weekday-"]')?.value || "",
        );
        const weekday = Number(weekdayValue);
        const startTime = String(
          row.querySelector('[name^="course-start-"]')?.value || "",
        );
        const endTime = String(
          row.querySelector('[name^="course-end-"]')?.value || "",
        );
        const location = String(
          row.querySelector('[name^="course-location-"]')?.value || "",
        ).trim();
        const teacher = String(
          row.querySelector('[name^="course-teacher-"]')?.value || "",
        ).trim();
        if (!title) throw new Error("有一门课程还没有名称。");
        if (weekdayValue === "" || !Number.isInteger(weekday)) {
          throw new Error(`请为“${title}”选择星期。`);
        }
        if (
          timeToMinutes(startTime) === null ||
          timeToMinutes(endTime) === null ||
          timeToMinutes(endTime) <= timeToMinutes(startTime)
        ) {
          throw new Error(`请检查“${title}”的开始和结束时间。`);
        }
        const course = {
          title,
          weekday,
          startTime,
          endTime,
          location,
          teacher,
          effectiveFrom,
          effectiveTo,
        };
        const conflict = [...state.courseTemplates, ...selected].some((other) =>
          courseHasConflict(course, [other]),
        );
        if (conflict) {
          throw new Error(
            `“${title}”与已有课程或本次另一门课程时间重叠，请取消或用不同时间。`,
          );
        }
        selected.push(course);
      }
      if (!selected.length) throw new Error("请至少选择一门课程。");
      await saveCourseTemplates(selected);
      closeDialog();
      state.planDay = effectiveFrom;
      state.planMode = "day";
      state.route = "plan";
      await afterMutation(`已生成 ${selected.length} 门每周重复课程。`);
    }
    if (form.id === "import-settings-form") {
      const start = String(formData.get("weekdayStartTime") || "");
      const end = String(formData.get("weekdayEndTime") || "");
      if (
        timeToMinutes(start) === null ||
        timeToMinutes(end) === null ||
        timeToMinutes(start) >= timeToMinutes(end)
      ) {
        throw new Error("晚间开始时间需要早于结束时间。");
      }
      const dinnerMinutes = Number(formData.get("dinnerMinutes"));
      if (!Number.isInteger(dinnerMinutes) || dinnerMinutes < 0 || dinnerMinutes > 180) {
        throw new Error("晚饭停留时间需要是 0 至 180 分钟的整数。");
      }
      const nextSettings = {
        ...state.settings,
        importerSettings: {
          identifiers: readImportTokens(form, "identifiers"),
          praiseKeywords: readImportTokens(form, "praise"),
          criticismKeywords: readImportTokens(form, "criticism"),
          weekdayStartTime: start,
          weekdayEndTime: end,
          dinnerStartTime: String(formData.get("dinnerStartTime") || ""),
          dinnerMinutes,
        },
      };
      if (timeToMinutes(nextSettings.importerSettings.dinnerStartTime) === null) {
        throw new Error("请选择有效的晚饭开始时间。");
      }
      const shouldResume = state.resumeImport;
      await saveSettings(nextSettings, "调整作业消息识别设置");
      closeDialog();
      await refresh();
      render();
      showToast("识别设置已保存。");
      if (shouldResume) openTeacherImportDialog();
    }
    if (form.id === "teacher-import-confirm-form") {
      const tasks = [];
      for (const row of form.querySelectorAll(".import-draft-row")) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox?.checked) continue;
        const title = row.querySelector('input[name^="title-"]')?.value.trim();
        const date = row.querySelector('input[name^="date-"]')?.value;
        const scheduledStart = row.querySelector('input[name^="time-"]')?.value;
        const estimatedMinutes = Number(
          row.querySelector('input[name^="minutes-"]')?.value,
        );
        const subject = row.querySelector('select[name^="subject-"]')?.value;
        if (!title) throw new Error("有一项作业还没有名称。");
        if (!date) throw new Error(`请为“${title}”选择完成日期。`);
        if (!scheduledStart) {
          throw new Error(`请为“${title}”选择完成时间。周末安排由孩子自己决定。`);
        }
        const startMinutes = timeToMinutes(scheduledStart);
        if (
          startMinutes === null ||
          !Number.isFinite(estimatedMinutes) ||
          estimatedMinutes < 5 ||
          estimatedMinutes > 240 ||
          startMinutes + estimatedMinutes > 23 * 60 + 59
        ) {
          throw new Error(`“${title}”的时间或预计时长需要调整。`);
        }
        tasks.push({
          ...(state.importParsed?.tasks.find(
            (task) => row.dataset.importTask === task.draftId,
          ) || {}),
          title,
          subject,
          date,
          scheduledStart,
          scheduledEnd: minutesToTime(startMinutes + estimatedMinutes),
          estimatedMinutes: Math.round(estimatedMinutes),
        });
      }

      const feedback = [];
      for (const row of form.querySelectorAll(".feedback-draft")) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox?.checked) continue;
        const content = row.querySelector("textarea")?.value.trim();
        if (!content) continue;
        const index = row.dataset.feedbackIndex;
        feedback.push({
          type: row.querySelector(`[name="feedback-type-${index}"]`)?.value || "praise",
          subject:
            row.querySelector(`[name="feedback-subject-${index}"]`)?.value ||
            "其他",
          content,
          matchedIdentifiers:
            state.importParsed?.feedback[Number(index)]?.matchedIdentifiers || [],
        });
      }
      if (!tasks.length && !feedback.length) {
        throw new Error("至少选择一项作业或一条老师反馈。");
      }
      const result = await commitTeacherImport({
        message: state.importMessage,
        tasks,
        feedback,
        today: state.today,
      });
      closeDialog();
      state.importParsed = null;
      if (result.tasks.some((task) => task.date === state.today)) {
        state.route = "today";
      } else if (result.tasks.length) {
        state.planDay = [...result.tasks].sort((a, b) => a.date.localeCompare(b.date))[0].date;
        state.route = "plan";
      } else {
        state.route = "today";
      }
      await afterMutation(
        `已加入 ${result.tasks.length} 项作业，记下 ${result.feedback.length} 条老师反馈。`,
      );
    }
    if (form.id === "reminder-settings-form") {
      const reminderLeadMinutes = Number(formData.get("reminderLeadMinutes"));
      if (![0, 5, 10, 15].includes(reminderLeadMinutes)) {
        throw new Error("请选择有效的提前提醒时间。");
      }
      await saveSettings(
        {
          ...state.settings,
          reminderEnabled: formData.get("reminderEnabled") === "on",
          reminderLeadMinutes,
        },
        "调整任务开始提醒",
      );
      await afterMutation("任务提醒设置已保存。");
    }
    if (form.id === "schedule-task-form") {
      const taskId = String(formData.get("taskId"));
      const date = String(formData.get("date") || "");
      const start = String(formData.get("scheduledStart") || "");
      const duration = Number(formData.get("estimatedMinutes"));
      const startMinutes = timeToMinutes(start);
      if (
        !date ||
        startMinutes === null ||
        !Number.isFinite(duration) ||
        duration < 5 ||
        duration > 240 ||
        startMinutes + duration > 23 * 60 + 59
      ) {
        throw new Error("请选择有效的日期、开始时间和预计时长。");
      }
      const result = await scheduleTask(taskId, {
        date,
        scheduledStart: start,
        scheduledEnd: minutesToTime(startMinutes + duration),
        estimatedMinutes: duration,
      });
      closeDialog();
      await afterMutation(
        `已经安排到 ${formatDateCN(date)} ${start}。${result.delayedTaskCount ? ` 其他 ${result.delayedTaskCount} 项任务已向后顺延。` : ""}`,
      );
    }
    if (form.id === "pet-name-form") {
      const profile = await hatchPetWithName(String(formData.get("petName") || ""));
      state.petProfile = profile;
      state.petCareLog = await getPetCareLog();
      state.petAction = "hatch";
      state.petMessage = `${profile.name}从蛋里孵出来了！`;
      state.route = "pet";
      closeDialog();
      await afterMutation(`${profile.name}出生了，从现在开始一起照顾它吧。`);
      window.setTimeout(() => {
        state.petAction = "";
        state.petMessage = "";
        if (state.route === "pet") render();
      }, 2200);
    }
    if (form.id === "pet-readopt-form") {
      const profile = await reAdoptPet();
      state.petProfile = profile;
      state.petCareLog = await getPetCareLog();
      state.petAction = "";
      state.petMessage = "";
      state.route = "pet";
      closeDialog();
      await afterMutation("一颗新的蛋已经准备好了。轻轻敲三次，再给它起名字。");
    }
    if (form.id === "add-task-form") {
      const estimatedMinutes = Number(formData.get("estimatedMinutes"));
      const scheduledStart = String(formData.get("scheduledStart") || "");
      const startMinutes = timeToMinutes(scheduledStart);
      if (
        scheduledStart &&
        (startMinutes === null ||
          !Number.isFinite(estimatedMinutes) ||
          startMinutes + estimatedMinutes > 23 * 60 + 59)
      ) {
        throw new Error("开始时间或预计时长需要调整，任务不能超过当天 23:59。");
      }
      const task = await createTask({
        date: formData.get("date"),
        title: formData.get("title"),
        type: formData.get("type"),
        subject: String(formData.get("subject") || ""),
        estimatedMinutes,
        notes: formData.get("notes"),
        scheduledStart,
        scheduledEnd: scheduledStart
          ? minutesToTime(startMinutes + estimatedMinutes)
          : "",
      });
      closeDialog();
      if (state.route === "today" && task.date !== state.today) state.route = "plan";
      await afterMutation(
        task.delayedTaskCount
          ? `已经放进计划，其他 ${task.delayedTaskCount} 项任务已向后顺延。`
          : "已经放进计划。先做第一步就好。",
      );
    }
    if (form.id === "edit-task-form") {
      const result = await updateTask(formData.get("taskId"), {
        title: formData.get("title"),
        type: formData.get("type"),
        subject: String(formData.get("subject") || "其他"),
        estimatedMinutes: Number(formData.get("estimatedMinutes")),
        notes: formData.get("notes"),
        scheduledStart: String(formData.get("scheduledStart") || ""),
        actualMinutes: formData.get("actualMinutes")
          ? Number(formData.get("actualMinutes"))
          : undefined,
      });
      closeDialog();
      await afterMutation(
        `任务调整已经保存。${result.delayedTaskCount ? ` 其他 ${result.delayedTaskCount} 项任务已向后顺延。` : ""}`,
      );
    }
    if (form.id === "complete-task-form") {
      const actualMinutes = Math.round(
        Number(form.querySelector('[name="actualMinutes"]')?.value),
      );
      if (!Number.isFinite(actualMinutes) || actualMinutes < 1) {
        throw new Error("请填写实际用了多少分钟。");
      }
      const result = await completeTask(
        formData.get("taskId"),
        actualMinutes,
      );
      const petReward = await awardPetPointsForTask(result.task).catch(() => null);
      closeDialog();
      let message = `这件事完成了，实际用时已记录为 ${actualMinutes} 分钟。`;
      if (petReward?.added) {
        message += ` 小恐龙互动点 +${petReward.amount}。`;
      }
      if (result.reward?.added) message += ` 获得 ${result.reward.amount} 星能。`;
      if (result.reward?.capped) message += " 今天已经达到奖励上限。";
      await afterMutation(message);
    }
    if (form.id === "reflection-form") {
      const result = await saveReflection(state.today, {
        smooth: String(formData.get("smooth") || ""),
        disrupted: String(formData.get("disrupted") || ""),
        adjust: String(formData.get("adjust") || ""),
        visibility: formData.get("shared") ? "shared" : "private",
      });
      await refresh();
      render();
      showToast(
        result.reward?.added
          ? `今天的发现已保存，获得 ${result.reward.amount} 星能。`
          : "今天的发现已保存。",
      );
    }
    if (form.id === "parent-access-form") {
      const pin = String(formData.get("pin") || "");
      if (!validatePin(pin)) throw new Error("PIN 需要是 4 至 6 位数字。");
      if (!state.settings.pinHash) {
        if (pin !== formData.get("pinConfirm")) throw new Error("两次 PIN 不一致。");
        await setParentPin(pin);
      } else if (!(await verifyParentPin(pin))) {
        throw new Error("PIN 不正确，请重新输入。");
      }
      state.parentUnlocked = true;
      state.route = "parent";
      closeDialog();
      await afterMutation("");
    }
    if (form.id === "reject-redemption-form") {
      await rejectRedemption(
        formData.get("redemptionId"),
        String(formData.get("reason") || ""),
      );
      closeDialog();
      await afterMutation("已说明原因，星能已经退回。");
    }
    if (form.id === "parent-settings-form") {
      const products = Array.from(
        form.querySelectorAll(".product-setting"),
        (row) => {
          const kind =
            row.querySelector("[data-product-kind]")?.value === "game"
              ? "game"
              : "privilege";
          return {
            id: row.dataset.productId || makeId("reward"),
            title: String(
              row.querySelector("[data-product-title]")?.value || "",
            ).trim(),
            description: String(
              row.querySelector("[data-product-description]")?.value || "",
            ).trim(),
            kind,
            period:
              row.querySelector("[data-product-period]")?.value === "week"
                ? "week"
                : "day",
            minuteValue:
              kind === "game"
                ? Number(row.querySelector("[data-product-minutes]")?.value)
                : 0,
            cost: Number(row.querySelector("[data-product-cost]")?.value),
            limit: Number(row.querySelector("[data-product-limit]")?.value),
          };
        },
      );
      const next = {
        ...state.settings,
        baseGameMinutes: Number(formData.get("baseGameMinutes")),
        completionReward: Number(formData.get("completionReward")),
        reflectionReward: Number(formData.get("reflectionReward")),
        dailyRewardCap: Number(formData.get("dailyRewardCap")),
        dailyGameLimit: Number(formData.get("dailyGameLimit")),
        products,
      };
      const errors = validateRewardSettings(next);
      if (errors.length) throw new Error(errors[0]);
      await saveSettings(next);
      await afterMutation("家庭约定已保存，从现在开始生效。");
    }
    if (form.id === "change-parent-pin-form") {
      const pin = String(formData.get("pin") || "");
      if (!validatePin(pin)) throw new Error("PIN 需要是 4 至 6 位数字。");
      if (pin !== formData.get("pinConfirm")) throw new Error("两次 PIN 不一致。");
      await setParentPin(pin);
      closeDialog();
      await afterMutation("家长 PIN 已经更新。");
    }
  } catch (error) {
    const message = error.message || "表单没有保存，请检查后重试。";
    showToast(message, "error");
    showDialogError(message);
  } finally {
    if (submitButton?.isConnected) {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonContent;
    }
    form.removeAttribute("aria-busy");
    setBusy(false);
  }
}

function changeRoute(route) {
  if (!enabledRoutes().some((item) => item.id === route)) return;
  state.route = route;
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
  if (route === "pet") schedulePetIdle(1400);
}

function liveTimerText(task) {
  const totalSeconds = Math.floor(elapsedMs(task) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function maybeShowTaskReminder() {
  if (
    reminderShowing ||
    dialog.open ||
    !state.settings?.reminderEnabled
  ) {
    return;
  }
  const task = findDueTaskReminder(state.tasks, {
    now: new Date(),
    leadMinutes: Number(state.settings.reminderLeadMinutes) || 0,
  });
  if (!task) return;

  reminderShowing = true;
  const key = reminderKey(task);
  const mark = (item) =>
    item.id === task.id ? { ...item, reminderShownFor: key } : item;
  state.tasks = state.tasks.map(mark);
  state.planTasks = state.planTasks.map(mark);
  state.allTasks = state.allTasks.map(mark);
  await markTaskReminderShown(task.id, key).catch(() => {});
  playReminderChime();
  reminderDialog(task);
}

function tickTimers() {
  const runningTasks = state.tasks.filter((task) => task.status === "inProgress");
  runningTasks.forEach((task) => {
    document.querySelectorAll(`[data-live-timer="${task.id}"]`).forEach((node) => {
      node.textContent = liveTimerText(task);
    });
  });
  if (state.today !== dateKey()) {
    state.today = dateKey();
    refresh().then(render);
  }
  const petMinute = new Date().toISOString().slice(0, 16);
  if (state.petProfile && petMinute !== lastPetRefreshMinute) {
    lastPetRefreshMinute = petMinute;
    getPetProfile()
      .then((profile) => {
        state.petProfile = profile;
        if (state.route === "pet") render();
      })
      .catch(() => {});
  }
  if (
    state.route === "plan" &&
    !state.busy &&
    petMinute !== lastPlanRefreshMinute
  ) {
    lastPlanRefreshMinute = petMinute;
    render();
  }
  maybeShowTaskReminder().catch(() => {
    reminderShowing = false;
  });
}

function updateOfflineStatus() {
  const pill = document.querySelector("#offline-pill");
  if (!pill) return;
  pill.hidden = navigator.onLine;
}

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    changeRoute(routeTarget.dataset.route);
    return;
  }
  const estimateTarget = event.target.closest("[data-estimate]");
  if (estimateTarget) {
    const input = estimateTarget.closest("form")?.querySelector('[name="estimatedMinutes"]');
    if (input) {
      input.value = estimateTarget.dataset.estimate;
      estimateTarget.closest("form")
        ?.querySelectorAll("[data-estimate]")
        .forEach((button) => button.classList.toggle("active", button === estimateTarget));
    }
    return;
  }
  const actualTarget = event.target.closest("[data-actual-minutes]");
  if (actualTarget) {
    const form = actualTarget.closest("form");
    const input = form?.querySelector('[name="actualMinutes"]');
    if (input) {
      input.value = actualTarget.dataset.actualMinutes;
      form
        .querySelectorAll("[data-actual-minutes]")
        .forEach((button) =>
          button.classList.toggle("active", button === actualTarget),
        );
    }
    return;
  }
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget && !actionTarget.disabled) {
    handleAction(actionTarget.dataset.action, actionTarget);
  }
});

document.addEventListener("submit", handleSubmit);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches("[data-token-input]")) return;
  event.preventDefault();
  const group = event.target.dataset.tokenInput;
  dialog
    .querySelector(`[data-action="add-import-token"][data-group="${group}"]`)
    ?.click();
});

document.addEventListener("change", async (event) => {
  const productKind = event.target.closest?.("[data-product-kind]");
  if (productKind) {
    const row = productKind.closest(".product-setting");
    const gameMinutes = row?.querySelector("[data-product-minutes]");
    const isPrivilege = productKind.value === "privilege";
    row?.classList.toggle("is-privilege", isPrivilege);
    if (gameMinutes) {
      gameMinutes.disabled = isPrivilege;
      if (isPrivilege) gameMinutes.value = "0";
    }
  }
  const productPeriod = event.target.closest?.("[data-product-period]");
  if (productPeriod) {
    const label = productPeriod
      .closest(".product-setting")
      ?.querySelector("[data-limit-label]");
    if (label) label.textContent = productPeriod.value === "week" ? "每周上限" : "每日上限";
  }
  if (event.target.id === "plan-date") {
    state.planDay = event.target.value || dateKey();
    state.planTasks = await getTasksForDate(state.planDay);
    render();
  }
  if (event.target.id === "backup-file" && event.target.files?.length) {
    try {
      setBusy(true);
      const text = await event.target.files[0].text();
      const payload = JSON.parse(text);
      const confirmed = window.confirm(
        "恢复备份会替换当前设备上的全部计划和成长记录。确认继续吗？",
      );
      if (!confirmed) return;
      await importDatabase(payload);
      state.parentUnlocked = false;
      await refresh();
      state.route = FEATURES.rewards ? "rewards" : "today";
      state.planDay = state.today;
      render();
      showToast("备份已经恢复。原数据已被备份内容替换。");
    } catch (error) {
      showToast(error.message || "备份文件无法读取。", "error");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }
  if (event.target.id === "course-schedule-file" && event.target.files?.length) {
    try {
      setBusy(true);
      const rows = await readCourseSpreadsheet(event.target.files[0]);
      state.courseImportText = ["txt", "md"].some((extension) =>
        event.target.files[0].name.toLowerCase().endsWith(`.${extension}`),
      )
        ? await event.target.files[0].text()
        : rowsToTsv(rows);
      const textarea = dialog.querySelector("#course-table-text");
      if (textarea) textarea.value = state.courseImportText;
      showToast(`已读取 ${rows.length} 行表格，请检查后分析。`);
    } catch (error) {
      showToast(error.message || "表格文件无法读取。", "error");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }
});

window.addEventListener("online", updateOfflineStatus);
window.addEventListener("offline", updateOfflineStatus);
document.addEventListener("pointerdown", ensureReminderAudio, { passive: true });

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

installTimelineDrag(async (taskId, schedule) => {
  if (state.busy) return;
  try {
    setBusy(true);
    const result = await scheduleTask(taskId, schedule);
    await afterMutation(
      `已移动到 ${formatDateCN(schedule.date, { weekday: false })} ${schedule.scheduledStart}–${schedule.scheduledEnd}。${result.delayedTaskCount ? ` 其他 ${result.delayedTaskCount} 项任务已向后顺延。` : ""}`,
    );
  } catch (error) {
    showToast(error.message || "没有完成时间调整，请再试一次。", "error");
  } finally {
    setBusy(false);
  }
});

async function boot() {
  try {
    render();
    await backfillTaskSubjects();
    await backfillFeedbackSubjects().catch(() => 0);
    await backfillPetPointsForCompletedTasks().catch(() => 0);
    await refresh();
    render();
    maybeOpenFirstRunGuide();
    schedulePetIdle(7000);
    setInterval(tickTimers, 1000);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  } catch (error) {
    state.loading = false;
    state.error = error.message || "本机数据暂时无法读取。";
    render();
  }
}

boot();
