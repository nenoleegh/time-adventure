const DB_NAME = "time-adventure";
const DB_VERSION = 4;
export const BACKUP_STORES = [
  "tasks",
  "ledger",
  "redemptions",
  "reflections",
  "settings",
  "settingHistory",
  "feedbackNotes",
  "teacherImports",
  "courseTemplates",
  "petProfiles",
  "petCareLog",
];

let databasePromise;

export function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("tasks")) {
        const tasks = db.createObjectStore("tasks", { keyPath: "id" });
        tasks.createIndex("date", "date");
        tasks.createIndex("status", "status");
      }

      if (!db.objectStoreNames.contains("ledger")) {
        const ledger = db.createObjectStore("ledger", { keyPath: "id" });
        ledger.createIndex("date", "date");
        ledger.createIndex("taskId", "taskId");
        ledger.createIndex("redemptionId", "redemptionId");
        ledger.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
      }

      if (!db.objectStoreNames.contains("redemptions")) {
        const redemptions = db.createObjectStore("redemptions", { keyPath: "id" });
        redemptions.createIndex("date", "date");
        redemptions.createIndex("weekKey", "weekKey");
        redemptions.createIndex("productId", "productId");
      }

      if (!db.objectStoreNames.contains("reflections")) {
        db.createObjectStore("reflections", { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settingHistory")) {
        const settingHistory = db.createObjectStore("settingHistory", { keyPath: "id" });
        settingHistory.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("feedbackNotes")) {
        const feedbackNotes = db.createObjectStore("feedbackNotes", { keyPath: "id" });
        feedbackNotes.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("teacherImports")) {
        const teacherImports = db.createObjectStore("teacherImports", { keyPath: "id" });
        teacherImports.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("courseTemplates")) {
        const courseTemplates = db.createObjectStore("courseTemplates", { keyPath: "id" });
        courseTemplates.createIndex("weekday", "weekday");
      }
      if (!db.objectStoreNames.contains("petProfiles")) {
        db.createObjectStore("petProfiles", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("petCareLog")) {
        const petCareLog = db.createObjectStore("petCareLog", { keyPath: "id" });
        petCareLog.createIndex("date", "date");
        petCareLog.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error);
    };
  });
  return databasePromise;
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("数据库操作已取消。"));
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).getAll());
}

export async function getRecord(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).get(key));
}

export async function putRecord(storeName, record) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await transactionDone(transaction);
  return record;
}

export async function putMany(storeName, records) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  records.forEach((record) => store.put(record));
  await transactionDone(transaction);
  return records;
}

export async function deleteRecord(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).clear();
  await transactionDone(transaction);
}

export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  const index = transaction.objectStore(storeName).index(indexName);
  return requestToPromise(index.getAll(value));
}

export async function exportDatabase() {
  const data = {};
  for (const name of BACKUP_STORES) data[name] = await getAll(name);
  return {
    format: "time-adventure-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function validateBackupPayload(payload) {
  if (payload?.format !== "time-adventure-backup" || !payload.data) {
    throw new Error("这不是时间冒险家的有效备份文件。");
  }
  if (payload.version !== 1) {
    throw new Error("备份版本不受支持，请使用当前版本重新导出。");
  }
  for (const name of BACKUP_STORES) {
    if (!Array.isArray(payload.data[name])) {
      throw new Error(`备份文件缺少“${name}”数据，无法安全恢复。`);
    }
  }
  return payload;
}

export async function importDatabase(payload) {
  validateBackupPayload(payload);
  const db = await openDatabase();
  const transaction = db.transaction(BACKUP_STORES, "readwrite");
  for (const name of BACKUP_STORES) {
    const store = transaction.objectStore(name);
    store.clear();
    for (const record of payload.data[name] || []) store.put(record);
  }
  await transactionDone(transaction);
}

export async function clearFamilyData() {
  const db = await openDatabase();
  const transaction = db.transaction(BACKUP_STORES, "readwrite");
  BACKUP_STORES.forEach((name) => transaction.objectStore(name).clear());
  await transactionDone(transaction);
}
