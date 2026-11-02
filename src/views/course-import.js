import {
  courseDurationMinutes,
  timeRangeLabel,
  WEEKDAY_OPTIONS,
  weekdayLabel,
} from "../services/course-schedule-rules.js?v=1.13.11";
import { formatMinutes } from "../utils/date.js";
import { escapeAttr, escapeHtml, icon } from "../ui/html.js";

function heading(title, description = "") {
  return `
    <div class="dialog-heading">
      <div>
        <span class="eyebrow">课程表导入</span>
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      <button type="button" class="dialog-close" data-action="close-dialog" aria-label="关闭">${icon("close")}</button>
    </div>`;
}

function weekdayOptions(selected) {
  const hasSelection =
    selected !== null &&
    selected !== undefined &&
    selected !== "";
  return `<option value="" ${hasSelection ? "" : "selected"}>请选择星期</option>${WEEKDAY_OPTIONS.map(
    (item) =>
      `<option value="${item.value}" ${hasSelection && Number(selected) === item.value ? "selected" : ""}>${item.label}</option>`,
  ).join("")}`;
}

export function courseImportEntryHtml(state) {
  return `
    <form id="course-import-form" class="dialog-form course-import-entry">
      ${heading("导入课程表，生成每周重复日程", "支持 XLSX、CSV、TSV、TXT，也可以直接粘贴课程表格或“星期 + 时间 + 课程 + 教师”列表。")}
      <div class="course-import-local">
        ${icon("shield")}
        <span>文件只在本机解析，不上传。支持“星期 + 时间 + 课程”长表，或“时间 + 周一到周日”网格。</span>
      </div>
      <div class="course-file-actions">
        <button class="button secondary" type="button" data-action="choose-course-file">${icon("upload")}选择表格文件</button>
        <button class="button outline" type="button" data-action="fill-course-example">填入示例</button>
        <input id="course-schedule-file" type="file" accept=".csv,.tsv,.xlsx,.txt,.md,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      </div>
      <div class="field course-table-field">
        <div class="field-label-row">
          <span>表格内容</span>
          <button type="button" class="clear-button" data-action="clear-field" data-target="course-table-text">${icon("close")}清空表格</button>
        </div>
        <textarea id="course-table-text" name="tableText" maxlength="30000" required aria-label="表格内容" placeholder="时间\t周一\t周二\t周三\t周四\t周五&#10;08:00-08:40\t语文\t数学\t英语\t科学\t道法&#10;08:50-09:30\t数学\t语文\t数学\t英语\t体育">${escapeHtml(state.courseImportText || "")}</textarea>
      </div>
      <div class="course-format-help">
        <p><b>格式一：课程网格</b> 第一行是星期，第一列是具体时间或“第 1 节”。</p>
        <p><b>格式二：逐行课程</b> 列名为“星期、开始时间、结束时间、课程、地点”。</p>
        <p><b>格式三：消息列表</b> 用“星期几”作为标题，下面逐行写时间、节次、课程和括号中的教师。</p>
      </div>
      ${state.courseTemplates.length ? `
        <div class="saved-course-summary">
          <div><span>已保存 ${state.courseTemplates.length} 门每周课程</span><small>重复安排会出现在日视图和周视图。</small></div>
          <button class="text-button" type="button" data-action="open-course-manager">管理已有课程${icon("arrow")}</button>
        </div>` : ""}
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="close-dialog">取消</button>
        <button class="button primary" type="submit">${icon("calendar")}分析课程表</button>
      </div>
    </form>`;
}

function courseDraftRow(course, index) {
  return `
    <article class="course-draft-row ${course.duplicate ? "duplicate" : ""} ${course.conflict ? "conflict" : ""}" data-course-row="${index}">
      <label class="draft-select">
        <input type="checkbox" name="include-course-${index}" ${course.include ? "checked" : ""}>
        <span>${index + 1}</span>
      </label>
      <div class="course-draft-fields">
        <div class="course-draft-title">
          <input name="course-title-${index}" maxlength="40" value="${escapeAttr(course.title)}" aria-label="课程名称">
          ${course.duplicate ? `<span class="duplicate-badge">已存在</span>` : ""}
          ${course.conflict ? `<span class="duplicate-badge conflict">时间重叠</span>` : ""}
        </div>
        <div class="course-draft-grid">
          <label><span>星期</span><select name="course-weekday-${index}">${weekdayOptions(course.weekday)}</select></label>
          <label><span>开始</span><input name="course-start-${index}" type="time" step="300" value="${course.startTime}"></label>
          <label><span>结束</span><input name="course-end-${index}" type="time" step="300" value="${course.endTime}"></label>
          <label><span>教师</span><input name="course-teacher-${index}" maxlength="20" value="${escapeAttr(course.teacher || "")}" placeholder="可选"></label>
          <label><span>地点</span><input name="course-location-${index}" maxlength="60" value="${escapeAttr(course.location || "")}" placeholder="可选"></label>
        </div>
        <p class="course-draft-meta">${weekdayLabel(course.weekday)} · ${formatMinutes(courseDurationMinutes(course))}${course.inferredTime ? " · 时间由节次推算，请核对" : ""}</p>
      </div>
    </article>`;
}

export function courseImportPreviewHtml(parsed, state) {
  const semester = parsed.semesterRange || {
    from: state.planDay,
    to: "",
    label: "",
  };
  return `
    <form id="course-import-confirm-form" class="dialog-form course-import-preview">
      ${heading(
        `识别出 ${parsed.courses.length} 门每周课程`,
        "核对星期和时间后再保存。课程会从生效日期开始按周重复，不会生成大量重复任务。",
      )}
      ${parsed.warnings.length ? `<div class="parse-warnings">${parsed.warnings.map((warning) => `<p>${icon("spark")}${escapeHtml(warning)}</p>`).join("")}</div>` : ""}
      <section class="course-effective-range">
        <div><h3>重复生效范围</h3><p>默认使用当前学期${semester.label ? `：${escapeHtml(semester.label)}` : ""}，可以按学校安排调整。</p></div>
        <div class="course-effective-fields">
          <label><span>从</span><input name="effectiveFrom" type="date" value="${semester.from}" required></label>
          <label><span>到</span><input name="effectiveTo" type="date" value="${semester.to}"></label>
        </div>
      </section>
      <div class="course-draft-list">
        ${parsed.courses.map(courseDraftRow).join("")}
      </div>
      <p class="fine-print">保存后，这些课程会作为固定日程出现在每周对应日期的日视图和周视图。若课程时间与已有安排重叠，默认不会勾选。</p>
      <div class="dialog-actions sticky-actions">
        <button class="button outline" type="button" data-action="back-to-course-import">返回修改表格</button>
        <button class="button primary" type="submit">${icon("check")}生成每周重复日程</button>
      </div>
    </form>`;
}

export function courseManagerHtml(courses) {
  const grouped = WEEKDAY_OPTIONS.map((day) => ({
    ...day,
    courses: courses.filter((course) => Number(course.weekday) === day.value),
  })).filter((group) => group.courses.length);
  return `
    <div class="dialog-form course-manager">
      ${heading("已保存的每周课程", "删除课程会移除对应星期之后的所有重复安排，但不会删除已经完成的任务。")}
      <div class="course-manager-groups">
        ${grouped.length ? grouped.map((group) => `
          <section>
            <h3>${group.label}</h3>
            ${group.courses.map((course) => `
              <div class="course-manager-row">
                <div>
                  <strong>${escapeHtml(course.title)}</strong>
                  <span>${timeRangeLabel(course)}${course.teacher ? ` · ${escapeHtml(course.teacher)}` : ""}${course.location ? ` · ${escapeHtml(course.location)}` : ""}</span>
                </div>
                <button class="icon-button" data-action="delete-course-template" data-id="${course.id}" title="删除课程">${icon("close")}</button>
              </div>`).join("")}
          </section>`).join("") : `<div class="empty-inline">还没有保存的课程。</div>`}
      </div>
      <div class="dialog-actions">
        <button class="button primary" type="button" data-action="close-dialog">完成</button>
      </div>
    </div>`;
}

export function deleteCourseDialogHtml(course) {
  return `
    <div class="dialog-form">
      ${heading("删除每周课程", `${weekdayLabel(course.weekday)} ${timeRangeLabel(course)} · ${course.title}`)}
      <p class="dialog-note">${icon("calendar")}这会从所有未来日期移除这门重复课程，已经完成的历史任务不受影响。</p>
      <div class="dialog-actions">
        <button class="button outline" type="button" data-action="open-course-manager">取消</button>
        <button class="button primary" type="button" data-action="confirm-delete-course" data-id="${course.id}">删除每周课程</button>
      </div>
    </div>`;
}

export const COURSE_EXAMPLE = `**11:20—12:00**：第四节 美术（示例老师丙）
- **14:45—15:25**：第五节 语文（示例老师甲）
- **15:40—16:20**：第六节 信息科技（示例老师丁）

**星期三**
- **8:00—8:20**：早餐
- **8:20—9:00**：第一节 语文（示例老师甲）
- **9:30—10:10**：第二节 数学（示例老师乙）`;
