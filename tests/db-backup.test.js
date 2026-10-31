import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_STORES,
  validateBackupPayload,
} from "../src/services/db.js";

function validPayload() {
  return {
    format: "time-adventure-backup",
    version: 1,
    exportedAt: "2026-10-29T00:00:00.000Z",
    data: Object.fromEntries(BACKUP_STORES.map((name) => [name, []])),
  };
}

test("backup validation accepts a complete version 1 backup", () => {
  assert.equal(validateBackupPayload(validPayload()).format, "time-adventure-backup");
});

test("backup validation rejects unsupported or incomplete files before import", () => {
  assert.throws(
    () => validateBackupPayload({ ...validPayload(), version: 2 }),
    /版本不受支持/,
  );
  const incomplete = validPayload();
  delete incomplete.data.petCareLog;
  assert.throws(
    () => validateBackupPayload(incomplete),
    /缺少/,
  );
});
