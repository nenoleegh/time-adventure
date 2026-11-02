import test from "node:test";
import assert from "node:assert/strict";
import { helpDialogHtml } from "../src/views/help.js";

test("first-run guide explains the main workflow and backup boundary", () => {
  const html = helpDialogHtml({ firstRun: true });
  assert.match(html, /欢迎来到时间冒险家/);
  assert.match(html, /粘贴老师消息/);
  assert.match(html, /照顾小恐龙/);
  assert.match(html, /22:00 至次日 06:30/);
  assert.match(html, /本地保存，不搜集学生数据/);
  assert.match(html, /一位家长为解决孩子作业问题而做的开源项目/);
  assert.match(html, /纯静态网页/);
  assert.match(html, /不会上传或搜集任何学生数据/);
  assert.match(html, /AI 辅助制作，仅供试用/);
  assert.match(html, /不保证使用结果/);
  assert.match(
    html,
    /https:\/\/github\.com\/nenoleegh\/time-adventure/,
  );
  assert.ok(
    html.indexOf("guide-project-note") < html.indexOf("guide-data-note"),
  );
  assert.ok(
    html.indexOf("guide-data-note") < html.indexOf("guide-disclaimer"),
  );
  assert.ok(
    html.indexOf("guide-disclaimer") < html.indexOf("guide-highlight"),
  );
  assert.ok(
    html.indexOf("guide-highlight") < html.indexOf("guide-steps"),
  );
  assert.match(html, /知道了，开始使用/);
});

test("manual help omits first-run welcome wording", () => {
  const html = helpDialogHtml();
  assert.doesNotMatch(html, /欢迎来到时间冒险家/);
  assert.match(html, /关闭说明/);
});
