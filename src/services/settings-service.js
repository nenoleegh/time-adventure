import { getRecord, putRecord, getAll, transactionDone, openDatabase } from "./db.js?v=1.13.13";
import { DEFAULT_SETTINGS } from "./reward-rules.js?v=1.13.13";
import { makeId } from "../utils/id.js";
import { hashPin, makeSalt, validatePin } from "../utils/pin.js?v=1.13.13";
import { DEFAULT_IMPORT_SETTINGS } from "./teacher-import-rules.js?v=1.13.13";

function normalizedImporterSettings(value = {}) {
  return {
    ...DEFAULT_IMPORT_SETTINGS,
    ...value,
    identifiers: Array.isArray(value.identifiers)
      ? value.identifiers
      : [...DEFAULT_IMPORT_SETTINGS.identifiers],
    praiseKeywords: Array.isArray(value.praiseKeywords)
      ? value.praiseKeywords
      : [...DEFAULT_IMPORT_SETTINGS.praiseKeywords],
    criticismKeywords: Array.isArray(value.criticismKeywords)
      ? value.criticismKeywords
      : [...DEFAULT_IMPORT_SETTINGS.criticismKeywords],
  };
}

function normalizedProducts(value) {
  return Array.isArray(value)
    ? value.map((product) => ({ ...product }))
    : DEFAULT_SETTINGS.products.map((product) => ({ ...product }));
}

export async function getSettings() {
  const stored = await getRecord("settings", "family");
  if (stored) {
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      products: normalizedProducts(stored.products),
      importerSettings: normalizedImporterSettings(stored.importerSettings),
    };
  }
  const fresh = {
    ...DEFAULT_SETTINGS,
    products: normalizedProducts(),
    importerSettings: normalizedImporterSettings(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putRecord("settings", fresh);
  return fresh;
}

export async function saveSettings(nextSettings, changeNote = "调整家庭约定") {
  const current = await getSettings();
  const now = new Date().toISOString();
  const saved = {
    ...current,
    ...nextSettings,
    id: "family",
    products: normalizedProducts(nextSettings.products || current.products),
    importerSettings: normalizedImporterSettings(
      nextSettings.importerSettings || current.importerSettings,
    ),
    updatedAt: now,
  };
  const history = {
    id: makeId("rule"),
    note: changeNote,
    createdAt: now,
    before: {
      baseGameMinutes: current.baseGameMinutes,
      completionReward: current.completionReward,
      reflectionReward: current.reflectionReward,
      dailyRewardCap: current.dailyRewardCap,
      products: current.products,
      dailyGameLimit: current.dailyGameLimit,
      rewardsEnabled: current.rewardsEnabled,
      reminderEnabled: current.reminderEnabled,
      reminderLeadMinutes: current.reminderLeadMinutes,
      importerSettings: current.importerSettings,
    },
    after: {
      baseGameMinutes: saved.baseGameMinutes,
      completionReward: saved.completionReward,
      reflectionReward: saved.reflectionReward,
      dailyRewardCap: saved.dailyRewardCap,
      products: saved.products,
      dailyGameLimit: saved.dailyGameLimit,
      rewardsEnabled: saved.rewardsEnabled,
      reminderEnabled: saved.reminderEnabled,
      reminderLeadMinutes: saved.reminderLeadMinutes,
      importerSettings: saved.importerSettings,
    },
  };
  const db = await openDatabase();
  const transaction = db.transaction(["settings", "settingHistory"], "readwrite");
  transaction.objectStore("settings").put(saved);
  transaction.objectStore("settingHistory").add(history);
  await transactionDone(transaction);
  return saved;
}

export async function setParentPin(pin) {
  if (!validatePin(pin)) throw new Error("请输入 4 至 6 位数字。");
  const settings = await getSettings();
  const pinSalt = makeSalt();
  const pinHash = await hashPin(pin, pinSalt);
  return saveSettings({ ...settings, pinHash, pinSalt }, "设置家长 PIN");
}

export async function verifyParentPin(pin) {
  const settings = await getSettings();
  if (!settings.pinHash || !settings.pinSalt) return false;
  return (await hashPin(pin, settings.pinSalt)) === settings.pinHash;
}

export async function getSettingHistory() {
  const history = await getAll("settingHistory");
  return history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
