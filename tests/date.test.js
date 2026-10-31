import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  formatMinutes,
  lastNDates,
  parseDateKey,
  weekKey,
} from "../src/utils/date.js";

test("dateKey additions keep local calendar dates", () => {
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(parseDateKey("2026-10-24").getDate(), 24);
});

test("week keys start on Monday", () => {
  assert.equal(weekKey("2026-10-24"), "2026-10-19");
  assert.equal(weekKey("2026-10-25"), "2026-10-19");
  assert.equal(weekKey("2026-10-26"), "2026-10-26");
});

test("duration labels remain readable", () => {
  assert.equal(formatMinutes(25), "25 分钟");
  assert.equal(formatMinutes(60), "1 小时");
  assert.equal(formatMinutes(85), "1 小时 25 分钟");
});

test("lastNDates is inclusive and ordered", () => {
  assert.deepEqual(lastNDates(3, "2026-10-24"), [
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
  ]);
});
