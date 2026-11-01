import {
  DEFAULT_IMPORT_SETTINGS,
} from "../services/teacher-import-rules.js?v=1.13.8";
import { formatDateCN, parseDateKey } from "../utils/date.js";
import { escapeAttr, escapeHtml, icon } from "../ui/html.js";
import { FEATURES } from "../config/features.js?v=1.13.8";
import { SUBJECT_OPTIONS } from "../services/task-rules.js?v=1.13.8";

function heading(eyebrow, title, description = "") {
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

function tagEditor(group, label, values, placeholder, helper) {
  return `
    <section class="token-section">
      <div class="token-heading">
        <div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(helper)}</p></div>
      </div>
      <div class="token-editor" data-token-group="${group}">
        <div class="token-chips">
          ${values.map((value) => `
            <span class="token-chip" data-value="${escapeAttr(value)}">
              ${escapeHtml(value)}
              <button type="button" data-action="remove-import-token" data-group="${group}" aria-label="删除 ${escapeAttr(value)}">${icon("close")}</button>
            </span>`).join("")}
        </div>
        <div class="token-add-row">
          <input type="text" data-token-input="${group}" maxlength="20" placeholder="${escapeAttr(placeholder)}">
          <button class="button secondary small" type="button" data-action="add-import-token" data-group="${group}">${icon("plus")}添加</button>
        </div>
      </div>
    </section>`;
}

export function importEntryDialogHtml(state) {
  const importer = state.settings.importerSettings || DEFAULT_IMPORT_SETTINGS;
  return `
    <form id="teacher-import-form" class="dialog-form teacher-import-entry">
      ${heading("老师消息导入", "把一大段作业，变成可执行的下一步", "先在照片中长按文字并拷贝，或直接粘贴老师发来的消息。分析结果会先给你确认，不会自动写入。")}
      <div class="import-status-row">
        <span class="import-status">${icon("shield")}只在本机分析，不上传消息</span>
        <button class="text-button" type="button" data-action="open-import-settings">${icon("edit")}识别设置</button>
      </div>
      <div class="field message-field">
        <div class="field-label-row">
          <span>老师消息</span>
          <button type="button" class="clear-button" data-action="clear-field" data-target="teacher-message-input">${icon("close")}清空消息</button>
        </div>
        <textarea id="teacher-message-input" name="message" maxlength="8000" required aria-label="老师消息" placeholder="例如：\n今日作业：\n1. 语文：完成练习册第12页\n2. 数学：完成口算第3页\n周末作业：完成科学手抄报\n昨日完成情况：12号张三数学全对，提出表扬。">${escapeHtml(state.importMessage || "")}</textarea>
      </div>
      <div class="identifier-summary">
        <span>正在识别</span>
        ${importer.identifiers.length
          ? importer.identifiers.map((item) => `<b>${escapeHtml(item)}</b>`).join("")
          : `<em>还没有设置名字或学号</em>`}
      </div>
      <div class="import-tips">
        <p><b>工作日</b>：放学后自动排入可用时间，跳过晚饭和已排任务。</p>
        <p><b>时间分配</b>：工作日当天从放学时间（默认 17:00）开始寻找空档，跳过晚饭；周末默认从上午开始，所有时间都可调整。</p>
        <p><b>选做</b>：也会进入${FEATURES.rewards ? "计划、计时和奖励流程" : "计划和计时"}，只标记为自选任务。</p>
        <p><b>周一检查</b>：按周末任务处理，标题中保留检查提醒。</p>
        <p><b>老师反馈</b>：只提取匹配名字或学号的内容，记在当天成长记录里。</p>
      </div>
      <div class="dialog-actions spread">
        <button class="button outline" type="button" data-action="fill-import-example">填入示例</button>
        <button class="button primary" type="submit">${icon("spark")}分析消息</button>
      </div>
    </form>`;
}

export function importSettingsDialogHtml(state) {
  const importer = {
    ...DEFAULT_IMPORT_SETTINGS,
    ...(state.settings.importerSettings || {}),
  };
  return `
    <form id="import-settings-form" class="dialog-form import-settings-dialog">
      ${heading("识别设置", "告诉时间冒险家，哪些内容属于你", "这些词只用于本机消息分析，可以随时增加或删除。")}
      ${tagEditor(
        "identifiers",
        "孩子名字和学号",
        importer.identifiers,
        "例如：张三 或 12",
        "老师反馈必须匹配其中一项。输入多个词后可直接保存，也可以按回车添加。",
      )}
      ${tagEditor(
        "praise",
        "表扬关键词",
        importer.praiseKeywords,
        "例如：进步很大",
        "出现这些词时，反馈会被标为“老师表扬”。",
      )}
      ${tagEditor(
        "criticism",
        "需要改进的关键词",
        importer.criticismKeywords,
        "例如：需要订正",
        "出现这些词时，反馈会被标为“老师批评”，并记录老师指出的具体问题。",
      )}
      <section class="schedule-settings">
        <div class="token-heading">
          <div><h3>工作日自动安排</h3><p>系统只在放学后的时间内找空档，并避开晚饭。</p></div>
        </div>
        <div class="schedule-settings-grid">
          <label><span>放学后开始</span><input type="time" name="weekdayStartTime" value="${escapeAttr(importer.weekdayStartTime)}" required></label>
          <label><span>晚上最晚结束</span><input type="time" name="weekdayEndTime" value="${escapeAttr(importer.weekdayEndTime)}" required></label>
          <label><span>晚饭开始</span><input type="time" name="dinnerStartTime" value="${escapeAttr(importer.dinnerStartTime)}" required></label>
          <label><span>晚饭停留</span><div class="input-with-unit"><input type="number" name="dinnerMinutes" min="0" max="180" step="5" value="${importer.dinnerMinutes}"><b>分钟</b></div></label>
        </div>
      </section>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">${icon("check")}保存识别设置</button>
      </div>
    </form>`;
}

function taskDraftRow(task, index) {
  const weekend = [0, 6].includes(parseDateKey(task.date).getDay());
  const subject = SUBJECT_OPTIONS.includes(task.subject) ? task.subject : "其他";
  return `
    <article class="import-draft-row ${task.duplicate ? "duplicate" : ""}" data-import-task="${task.draftId}">
      <label class="draft-select">
        <input type="checkbox" name="include-${task.draftId}" ${task.duplicate ? "" : "checked"}>
        <span>${index + 1}</span>
      </label>
      <div class="draft-fields">
        <div class="draft-title-row">
          <input name="title-${task.draftId}" value="${escapeAttr(task.title)}" maxlength="40" aria-label="任务名称">
          ${task.duplicate ? `<span class="duplicate-badge">可能已存在</span>` : ""}
        </div>
        <div class="draft-meta">
          <label>
            <span>科目</span>
            <select name="subject-${task.draftId}" aria-label="科目">
              ${SUBJECT_OPTIONS.map((option) => `
                <option value="${option}" ${option === subject ? "selected" : ""}>${option}</option>
              `).join("")}
            </select>
          </label>
          <label><span>完成日期</span><input name="date-${task.draftId}" type="date" value="${task.date}"></label>
          <label><span>${weekend ? "周末建议时间" : "自动安排时间"}</span><input name="time-${task.draftId}" type="time" step="300" value="${task.scheduledStart || ""}" ${task.needsTimeSelection ? "data-needs-time=\"true\"" : ""}></label>
          <label><span>预计时长</span><div class="input-with-unit"><input name="minutes-${task.draftId}" type="number" min="5" max="240" step="5" value="${task.estimatedMinutes}"><b>分钟</b></div></label>
        </div>
        <div class="draft-schedule-note">
          ${icon(weekend ? "calendar" : "clock")}
          <span>${escapeHtml(task.scheduleNote)}${task.scheduledEnd && !weekend ? ` · ${task.scheduledStart}–${task.scheduledEnd}` : ""}${task.breakBefore ? ` · 休息 ${task.breakBefore.scheduledStart}–${task.breakBefore.scheduledEnd}` : ""}${task.deadlineNote ? ` · ${escapeHtml(task.deadlineNote)}` : ""}</span>
          <small>${task.type === "choice" ? "选做" : task.type === "flex" ? "弹性" : "必做"} · ${escapeHtml(subject)}</small>
        </div>
      </div>
    </article>`;
}

function feedbackDraftRow(note, index) {
  const subject = SUBJECT_OPTIONS.includes(note.subject) ? note.subject : "其他";
  return `
    <article class="feedback-draft ${note.type}" data-feedback-index="${index}">
      <label class="feedback-select">
        <input type="checkbox" name="feedback-${index}" checked>
        <span class="feedback-type">${note.type === "praise" ? "表扬" : "批评"}</span>
      </label>
      <div class="feedback-draft-body">
        <div class="feedback-subject-row">
          <span>学科</span>
          <select name="feedback-subject-${index}" aria-label="反馈学科">
            ${SUBJECT_OPTIONS.map((option) => `
              <option value="${option}" ${option === subject ? "selected" : ""}>${option}</option>
            `).join("")}
          </select>
        </div>
        <textarea name="feedback-text-${index}" maxlength="300">${escapeHtml(note.content)}</textarea>
        <p>${note.matchedIdentifiers?.length ? `匹配：${note.matchedIdentifiers.map(escapeHtml).join("、")}` : "未设置学生标识，请确认这条反馈属于孩子。"}</p>
      </div>
      <input type="hidden" name="feedback-type-${index}" value="${note.type}">
    </article>`;
}

export function importPreviewDialogHtml(parsed, state) {
  const taskCount = parsed.tasks.filter((task) => !task.duplicate).length;
  const weekendCount = parsed.tasks.filter(
    (task) => [0, 6].includes(parseDateKey(task.date).getDay()),
  ).length;
  const scheduleHint = weekendCount
    ? `${taskCount} 项可直接加入，其中 ${weekendCount} 项已生成周末建议时间。`
    : `${taskCount} 项已按放学后的可用时间排好。`;
  return `
    <form id="teacher-import-confirm-form" class="dialog-form import-preview">
      ${heading("确认导入", `识别出 ${parsed.tasks.length} 项作业和 ${parsed.feedback.length} 条反馈`, "可以取消勾选、修改标题和时间。只有点“加入计划”后才会保存。")}
      ${parsed.warnings.length ? `
        <div class="parse-warnings">
          ${parsed.warnings.map((warning) => `<p>${icon("spark")}${escapeHtml(warning)}</p>`).join("")}
        </div>` : ""}
      <section class="import-preview-section">
        <div class="preview-section-heading">
          <div><h3>作业任务</h3><p>${scheduleHint}</p></div>
          <button class="text-button" type="button" data-action="change-import-settings">${icon("edit")}修改识别设置</button>
        </div>
        <div class="import-draft-list">
          ${parsed.tasks.length
            ? parsed.tasks.map(taskDraftRow).join("")
            : `<div class="empty-inline">没有识别出作业。可以返回修改消息，或在识别设置中补充学生标识。</div>`}
        </div>
      </section>
      ${parsed.feedback.length ? `
        <section class="import-preview-section">
          <div class="preview-section-heading">
            <div><h3>老师反馈</h3><p>将在今天留下 ${parsed.feedback.length} 条记录，不会变成扣分。</p></div>
          </div>
          <div class="feedback-draft-list">${parsed.feedback.map(feedbackDraftRow).join("")}</div>
        </section>` : ""}
      <div class="dialog-actions sticky-actions">
        <button class="button outline" type="button" data-action="back-to-import">返回修改消息</button>
        <button class="button primary" type="submit" ${parsed.tasks.length || parsed.feedback.length ? "" : "disabled"}>${icon("check")}加入计划和成长记录</button>
      </div>
    </form>`;
}

export function todayFeedbackHtml(notes) {
  if (!notes?.length) return "";
  return `
    <section class="teacher-feedback-card">
      <div class="teacher-feedback-heading">
        <div class="teacher-feedback-icon">${icon("people")}</div>
        <div><span class="eyebrow">老师今天说</span><h2>看见肯定，也看见下一步</h2></div>
      </div>
      <div class="teacher-feedback-list">
        ${notes.map((note) => `
          <article class="teacher-note ${note.type}">
            <div class="teacher-note-labels">
              <span>${note.type === "praise" ? "老师表扬" : "老师批评"}</span>
              <b>${escapeHtml(note.subject || "其他")}</b>
            </div>
            <p>${escapeHtml(note.content)}</p>
          </article>`).join("")}
      </div>
    </section>`;
}

export function importExampleText() {
  return `【今日作业】
1. 语文：完成练习册第12页
2. 数学：完成口算第3页
周末作业：完成科学手抄报
昨日完成情况：
12号张三数学全对，提出表扬。
李四英语未完成。
张三语文听写需要订正。`;
}
