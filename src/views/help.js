import { icon } from "../ui/html.js?v=1.12.0";

const guideSteps = [
  {
    icon: "today",
    title: "从“下一步”开始",
    text: "首页会优先显示现在最值得做的一件事。开始、暂停和完成都会记录真实用时。",
  },
  {
    icon: "upload",
    title: "粘贴老师消息",
    text: "“老师消息”可以拆出各科作业，自动安排放学后的时间，并把点到孩子名字或学号的表扬、批评记在当天。",
  },
  {
    icon: "calendar",
    title: "用计划页调整时间",
    text: "日视图分成上午、下午和晚上；拖动任务块可以改时间，导入课程表后会自动生成每周固定课程。",
  },
  {
    icon: "pet",
    title: "照顾小恐龙",
    text: "完成一项任务获得 1 个互动点，可用来喂食、喂水、清理和治疗。记得每天回来看看它。",
  },
  {
    icon: "lock",
    title: "家长设置与备份",
    text: "家长区可以调整识别关键词、主题、奖励开关，并导出备份。数据默认只保存在当前浏览器。",
  },
];

export function helpDialogHtml({ firstRun = false } = {}) {
  return `
    <div class="dialog-form guide-dialog">
      <div class="dialog-heading guide-heading">
        <div>
          <span class="eyebrow">使用说明</span>
          <h2>${firstRun ? "欢迎来到时间冒险家" : "把今天，变成清楚的下一步"}</h2>
          <p>${firstRun
            ? "这是一份快速指南，先了解最重要的几件事，然后就可以开始安排今天。"
            : "随时可以回到这里查看作业导入、计划时间和照顾小恐龙的方法。"}</p>
        </div>
        <button type="button" class="dialog-close" data-action="finish-guide" aria-label="关闭使用说明">${icon("close")}</button>
      </div>
      <div class="guide-highlight">
        <span>${icon("spark")}</span>
        <div>
          <strong>建议的每日顺序</strong>
          <p>看一眼下一步 → 完成一小段 → 记录实际用时 → 晚上花 3 分钟复盘。</p>
        </div>
      </div>
      <div class="guide-steps">
        ${guideSteps.map((step, index) => `
          <article class="guide-step">
            <span class="guide-step-icon">${icon(step.icon)}</span>
            <div><small>0${index + 1}</small><h3>${step.title}</h3><p>${step.text}</p></div>
          </article>`).join("")}
      </div>
      <div class="guide-data-note">
        ${icon("shield")}
        <p><strong>数据保存在当前浏览器</strong><span>清理 Safari 网站数据可能删除记录，建议家长定期导出 JSON 备份。</span></p>
      </div>
      <div class="guide-actions">
        <button type="button" class="button primary wide" data-action="finish-guide">${icon("check")}${firstRun ? "知道了，开始使用" : "关闭说明"}</button>
      </div>
    </div>`;
}
