import {
  getAll,
  getRecord,
  putRecord,
  transactionDone,
  openDatabase,
} from "./db.js?v=1.12.0";
import { makeId } from "../utils/id.js";
import { dateKey } from "../utils/date.js";
import {
  advancePetProfile,
  applyPetCare,
  applyPetTreatment,
  createEggProfile,
  normalizePetName,
  applyPetPointAward,
  PET_CARE_COSTS,
  PET_CARE_ACTIONS,
  PET_TASK_COMPLETION_POINTS,
  petCareAvailability,
  spendPetPoints,
  petNameIsValid,
} from "./pet-rules.js?v=1.12.0";

function nowIso() {
  return new Date().toISOString();
}

async function savePet(profile, log = null) {
  const db = await openDatabase();
  const stores = log ? ["petProfiles", "petCareLog"] : ["petProfiles"];
  const transaction = db.transaction(stores, "readwrite");
  transaction.objectStore("petProfiles").put(profile);
  if (log) transaction.objectStore("petCareLog").add(log);
  await transactionDone(transaction);
  return profile;
}

function careLog(action, message, profile) {
  const createdAt = nowIso();
  return {
    id: makeId("petcare"),
    petId: profile.id,
    action,
    message,
    createdAt,
    date: createdAt.slice(0, 10),
  };
}

export async function getPetProfile(now = new Date()) {
  const stored = await getRecord("petProfiles", "active");
  if (!stored) {
    const profile = createEggProfile(now);
    await putRecord("petProfiles", profile);
    return profile;
  }
  const normalized = {
    ...stored,
    petPoints: Math.max(0, Math.round(Number(stored.petPoints) || 0)),
    petPointAwards: stored.petPointAwards || {},
  };
  const advanced = advancePetProfile(normalized, now);
  if (
    advanced.status !== stored.status ||
    advanced.needsUpdatedAt !== stored.needsUpdatedAt ||
    advanced.poopCount !== stored.poopCount
  ) {
    await putRecord("petProfiles", advanced);
  }
  return advanced;
}

export async function getPetCareLog() {
  return (await getAll("petCareLog")).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function tapPetEgg(now = new Date()) {
  const profile = await getPetProfile(now);
  if (profile.stage !== "egg") {
    throw new Error("蛋已经孵化了。");
  }
  const eggTaps = Math.min(3, (profile.eggTaps || 0) + 1);
  const next = {
    ...profile,
    eggTaps,
    updatedAt: nowIso(),
  };
  await savePet(next);
  return { profile: next, readyToName: eggTaps >= 3 };
}

export async function hatchPetWithName(name, now = new Date()) {
  const profile = await getPetProfile(now);
  if (profile.stage !== "egg") {
    throw new Error("小恐龙已经孵化了。");
  }
  if ((profile.eggTaps || 0) < 3) {
    throw new Error("先轻轻敲三次蛋壳，再给小恐龙起名字。");
  }
  if (!petNameIsValid(name)) {
    throw new Error("名字需要包含 1 至 12 个字符。");
  }
  const createdAt = nowIso();
  const next = {
    ...profile,
    stage: "baby",
    name: normalizePetName(name),
    status: "healthy",
    hatchedAt: createdAt,
    adoptedAt: createdAt,
    lastEffectiveCareAt: createdAt,
    needsUpdatedAt: createdAt,
    updatedAt: createdAt,
  };
  await savePet(
    next,
    careLog("hatch", `${next.name}从蛋里孵出来了`, next),
  );
  return next;
}

export async function careForPet(action, now = new Date()) {
  const profile = await getPetProfile(now);
  const cost = PET_CARE_COSTS[action] || 0;
  const availability = petCareAvailability(profile, action);
  if (!availability.available && availability.reason === "full") {
    throw new Error(`${PET_CARE_ACTIONS[action]?.label || "这项互动"}对应的状态已经满了，不需要再操作。`);
  }
  const spent = spendPetPoints(profile, cost);
  if (!spent.ok) {
    throw new Error(`互动点不够，${action === "clean" ? "清理" : "这项互动"}需要 ${cost} 点。完成计划任务可以赚取互动点。`);
  }
  const result = applyPetCare(profile, action, now);
  const labels = {
    feed: "喂了食物",
    water: "喝了水",
    clean: "清理了小屋",
    pet: "陪它玩了一会儿",
  };
  await savePet(
    { ...result.profile, petPoints: spent.profile.petPoints },
    careLog(action, labels[action] || "照顾了小恐龙", result.profile),
  );
  return {
    ...result,
    profile: { ...result.profile, petPoints: spent.profile.petPoints },
    pointCost: cost,
  };
}

export async function treatPet(now = new Date()) {
  const profile = await getPetProfile(now);
  const cost = PET_CARE_COSTS.treat;
  const spent = spendPetPoints(profile, cost);
  if (!spent.ok) {
    throw new Error(`互动点不够，治疗需要 ${cost} 点。完成计划任务可以赚取互动点。`);
  }
  const next = applyPetTreatment(profile, now);
  const saved = { ...next, petPoints: spent.profile.petPoints };
  await savePet(saved, careLog("treat", "使用了药品，开始恢复", saved));
  return saved;
}

export async function awardPetPointsForTask(task, now = new Date()) {
  if (!task?.id) return { added: false, profile: null, amount: 0 };
  const profile = await getPetProfile(now);
  const award = applyPetPointAward(profile, task, now);
  if (!award.added) return { added: false, profile, amount: 0 };
  const next = award.profile;
  await savePet(
    next,
    careLog(
      "points",
      `完成任务「${task.title}」，获得 ${PET_TASK_COMPLETION_POINTS} 互动点`,
      next,
    ),
  );
  return {
    added: true,
    profile: next,
    amount: PET_TASK_COMPLETION_POINTS,
  };
}

export async function backfillPetPointsForCompletedTasks(day = dateKey(), now = new Date()) {
  const tasks = await getAll("tasks");
  let awarded = 0;
  for (const task of tasks) {
    if (task.date !== day || task.status !== "completed") continue;
    const result = await awardPetPointsForTask(task, now);
    if (result.added) awarded += result.amount;
  }
  return awarded;
}

export async function reAdoptPet(now = new Date()) {
  const profile = await createEggProfile(now);
  await savePet(profile, careLog("reAdopt", "开始领养一只新的小恐龙", profile));
  return profile;
}
