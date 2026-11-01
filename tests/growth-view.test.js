import test from "node:test";
import assert from "node:assert/strict";
import { growthView } from "../src/views/growth.js";
import { emptyReflection } from "../src/services/reflection-service.js";

function stateFor(visibility) {
  return {
    allTasks: [],
    ledger: [],
    today: "2026-11-01",
    balance: 0,
    reflection: {
      ...emptyReflection("2026-11-01"),
      visibility,
    },
  };
}

test("reflection sharing is explained as same-device visibility", () => {
  const html = growthView(stateFor("private"));
  assert.match(html, /允许家长在本设备查看/);
  assert.match(html, /不会发送到家长手机/);
  assert.match(html, /分享与否都不影响复盘奖励/);
  assert.match(html, /仅自己可见/);
});

test("shared reflections are labelled as visible only in the local parent area", () => {
  const html = growthView(stateFor("shared"));
  assert.match(html, /仅本设备家长区可见/);
});
