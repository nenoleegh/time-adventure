import test from "node:test";
import assert from "node:assert/strict";
import { helpDialogHtml } from "../src/views/help.js";

test("first-run guide explains the main workflow and backup boundary", () => {
  const html = helpDialogHtml({ firstRun: true });
  assert.match(html, /欢迎来到时间冒险家/);
  assert.match(html, /粘贴老师消息/);
  assert.match(html, /照顾小恐龙/);
  assert.match(html, /数据保存在当前浏览器/);
  assert.match(html, /知道了，开始使用/);
});

test("manual help omits first-run welcome wording", () => {
  const html = helpDialogHtml();
  assert.doesNotMatch(html, /欢迎来到时间冒险家/);
  assert.match(html, /关闭说明/);
});
