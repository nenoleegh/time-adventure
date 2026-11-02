export const PET_MILESTONES = {
  lowHours: 48,
  sickHours: 72,
  endHours: 144,
  recoveryHours: 6,
};

export const PET_WEIGHT = {
  birthKg: 3.2,
  maxKg: 12,
  dailyGrowthKg: 0.14,
  feedGainKg: 0.12,
};

export const PET_CARE_ACTIONS = {
  feed: { label: "喂食", need: "satiety", gain: 20, cost: 1 },
  water: { label: "喂水", need: "hydration", gain: 20, cost: 1 },
  clean: { label: "清理", need: "cleanliness", gain: 45, cost: 1 },
  pet: { label: "抚摸", need: "mood", gain: 24, cost: 0 },
};

export const PET_CARE_COSTS = {
  ...Object.fromEntries(
    Object.entries(PET_CARE_ACTIONS).map(([action, care]) => [action, care.cost]),
  ),
  treat: 2,
};

export const PET_TASK_COMPLETION_POINTS = 1;

export const PET_SLEEP_START_MINUTES = 22 * 60;
export const PET_SLEEP_END_MINUTES = 6 * 60 + 30;
export const PET_SLEEP_LABEL = "22:00–06:30";

const HOUR_MS = 60 * 60 * 1000;

function clampNeed(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nowIso(now) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

export function isPetSleepTime(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) return false;
  const minutes = current.getHours() * 60 + current.getMinutes();
  return minutes >= PET_SLEEP_START_MINUTES || minutes < PET_SLEEP_END_MINUTES;
}

export function createEggProfile(now = new Date()) {
  const createdAt = nowIso(now);
  return {
    id: "active",
    stage: "egg",
    name: "",
    eggTaps: 0,
    status: "egg",
    needs: {
      satiety: 82,
      hydration: 82,
      cleanliness: 92,
      mood: 90,
    },
    weightKg: PET_WEIGHT.birthKg,
    petPoints: 0,
    petPointAwards: {},
    poopCount: 0,
    nextPoopAt: null,
    lastActionAt: {},
    lastEffectiveCareAt: null,
    lowNeedSince: null,
    needsUpdatedAt: createdAt,
    treatmentStartedAt: null,
    endedAt: null,
    hatchedAt: null,
    adoptedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function petNameIsValid(name) {
  const characters = Array.from(String(name || "").trim());
  return characters.length >= 1 && characters.length <= 12;
}

export function normalizePetName(name) {
  return Array.from(String(name || "").trim()).slice(0, 12).join("");
}

export function petNeglectHours(profile, now = new Date()) {
  if (!profile?.lastEffectiveCareAt || profile.stage === "egg") return 0;
  return Math.max(
    0,
    ((now instanceof Date ? now.getTime() : new Date(now).getTime()) -
      new Date(profile.lastEffectiveCareAt).getTime()) /
      HOUR_MS,
  );
}

export function petStatusFor(profile, now = new Date()) {
  if (profile.stage === "egg") return "egg";
  if (profile.endedAt || profile.status === "ended") return "ended";
  if (profile.treatmentStartedAt) {
    const recoveryHours =
      ((now instanceof Date ? now : new Date(now)).getTime() -
        new Date(profile.treatmentStartedAt).getTime()) /
      HOUR_MS;
    return recoveryHours >= PET_MILESTONES.recoveryHours ? "healthy" : "recovering";
  }
  const risk = petHealthRisk(profile, now);
  if (risk.due) return "sick";
  const neglectHours = petNeglectHours(profile, now);
  if (neglectHours >= PET_MILESTONES.endHours) return "ended";
  if (neglectHours >= 96) return "critical";
  if (neglectHours >= PET_MILESTONES.sickHours) return "sick";
  if (neglectHours >= PET_MILESTONES.lowHours) return "low";
  return "healthy";
}

export function petHealthRisk(profile, now = new Date()) {
  const satiety = Number(profile?.needs?.satiety) || 0;
  const hydration = Number(profile?.needs?.hydration) || 0;
  const lowNeeds = [satiety < 30, hydration < 30].filter(Boolean).length;
  const lowHours = profile?.lowNeedSince
    ? Math.max(
        0,
        ((now instanceof Date ? now.getTime() : new Date(now).getTime()) -
          new Date(profile.lowNeedSince).getTime()) /
          HOUR_MS,
      )
    : 0;
  const thresholdHours = lowNeeds === 2 ? 6 : 12;
  return {
    lowNeeds,
    lowHours,
    thresholdHours,
    atRisk: lowNeeds > 0,
    due: lowNeeds > 0 && Boolean(profile.lowNeedSince) && lowHours >= thresholdHours,
  };
}

export function petVisualState(profile) {
  if (profile.stage === "egg") return "egg";
  if (profile.status === "ended") return "ended";
  if (["sick", "critical"].includes(profile.status)) return "sick";
  if (profile.status === "recovering") return "recovering";
  if ((profile.poopCount || 0) > 0 || profile.needs.cleanliness <= 28) {
    return "dirty";
  }
  if (profile.needs.hydration <= 35) return "thirsty";
  if (profile.needs.satiety <= 35) return "hungry";
  return "healthy";
}

export function petSizeScale(profile) {
  const weight = Math.max(
    PET_WEIGHT.birthKg,
    Math.min(PET_WEIGHT.maxKg, Number(profile.weightKg) || PET_WEIGHT.birthKg),
  );
  const progress =
    (weight - PET_WEIGHT.birthKg) / (PET_WEIGHT.maxKg - PET_WEIGHT.birthKg);
  return 0.33 + Math.max(0, Math.min(1, progress)) * 0.67;
}

export function applyPetPointAward(profile, task, now = new Date()) {
  if (!task?.id || profile.petPointAwards?.[task.id]) {
    return { profile, added: false, amount: 0 };
  }
  const updatedAt = nowIso(now);
  return {
    profile: {
      ...profile,
      petPoints: Math.max(0, Number(profile.petPoints) || 0) +
        PET_TASK_COMPLETION_POINTS,
      petPointAwards: {
        ...(profile.petPointAwards || {}),
        [task.id]: updatedAt,
      },
      updatedAt,
    },
    added: true,
    amount: PET_TASK_COMPLETION_POINTS,
  };
}

export function spendPetPoints(profile, cost) {
  const safeCost = Math.max(0, Math.round(Number(cost) || 0));
  const balance = Math.max(0, Number(profile.petPoints) || 0);
  if (balance < safeCost) {
    return { ok: false, profile, balance, cost: safeCost };
  }
  return {
    ok: true,
    profile: { ...profile, petPoints: balance - safeCost },
    balance: balance - safeCost,
    cost: safeCost,
  };
}

export function petCareAvailability(profile, action) {
  const care = PET_CARE_ACTIONS[action];
  if (!care) return { available: false, reason: "unknown", cost: 0 };
  const cost = care.cost || 0;
  const needValue = Number(profile?.needs?.[care.need]) || 0;
  const balance = Math.max(0, Number(profile?.petPoints) || 0);
  if (needValue >= 100) {
    return { available: false, reason: "full", cost, needValue, balance };
  }
  if (balance < cost) {
    return { available: false, reason: "points", cost, needValue, balance };
  }
  return { available: true, reason: "", cost, needValue, balance };
}

export function advancePetProfile(profile, now = new Date()) {
  if (profile.stage === "egg" || profile.status === "ended") return profile;
  const current = now instanceof Date ? now : new Date(now);
  const lastUpdate = new Date(profile.needsUpdatedAt || profile.lastEffectiveCareAt);
  const elapsedHours = Math.max(0, (current.getTime() - lastUpdate.getTime()) / HOUR_MS);
  if (elapsedHours < 1 / 60) return profile;

  const dailyNeedFactor = 0.5 ** (elapsedHours / 24);
  const needs = {
    satiety: clampNeed(profile.needs.satiety * dailyNeedFactor),
    hydration: clampNeed(profile.needs.hydration * dailyNeedFactor),
    cleanliness: clampNeed(profile.needs.cleanliness - elapsedHours * 0.72),
    mood: clampNeed(profile.needs.mood - elapsedHours * 0.64),
  };
  for (const value of [needs.satiety, needs.hydration, needs.cleanliness]) {
    if (value < 25) needs.mood = clampNeed(needs.mood - elapsedHours * 0.25);
  }

  let poopCount = profile.poopCount || 0;
  let nextPoopAt = profile.nextPoopAt || null;
  if (nextPoopAt && new Date(nextPoopAt).getTime() <= current.getTime()) {
    poopCount = Math.min(3, poopCount + 1);
    nextPoopAt = null;
    needs.cleanliness = clampNeed(needs.cleanliness - 18);
  }

  const lowNeedSince =
    needs.satiety < 30 || needs.hydration < 30
      ? profile.lowNeedSince || nowIso(current)
      : null;
  const status = petStatusFor({ ...profile, needs, lowNeedSince }, current);
  const ageDays = profile.hatchedAt
    ? Math.max(
        0,
        (current.getTime() - new Date(profile.hatchedAt).getTime()) /
          (24 * HOUR_MS),
      )
    : 0;
  const weightKg = Math.min(
    PET_WEIGHT.maxKg,
    Math.max(
      Number(profile.weightKg) || PET_WEIGHT.birthKg,
      PET_WEIGHT.birthKg + ageDays * PET_WEIGHT.dailyGrowthKg,
    ),
  );
  const endedAt =
    status === "ended" && !profile.endedAt
      ? nowIso(current)
      : profile.endedAt || null;
  const healingComplete = status === "healthy" && profile.treatmentStartedAt;
  return {
    ...profile,
    needs,
    lowNeedSince,
    poopCount,
    nextPoopAt,
    status,
    weightKg,
    petPoints: Math.max(0, Math.round(Number(profile.petPoints) || 0)),
    petPointAwards: profile.petPointAwards || {},
    endedAt,
    treatmentStartedAt: healingComplete ? null : profile.treatmentStartedAt,
    needsUpdatedAt: nowIso(current),
    updatedAt: nowIso(current),
  };
}

export function applyPetCare(profile, action, now = new Date()) {
  const care = PET_CARE_ACTIONS[action];
  if (!care) throw new Error("没有找到这个照料动作。");
  if (profile.stage === "egg") throw new Error("小恐龙还在蛋里，先完成孵化吧。");
  if (petStatusFor(profile, now) === "ended") {
    throw new Error("小恐龙已经暂时离开，需要重新领养。");
  }
  const current = now instanceof Date ? now : new Date(now);
  if (isPetSleepTime(current)) {
    throw new Error(`小恐龙正在睡觉（${PET_SLEEP_LABEL}），早上 6:30 后再来照顾它。`);
  }
  let next = advancePetProfile(profile, current);
  const lastAction = next.lastActionAt?.[action]
    ? new Date(next.lastActionAt[action]).getTime()
    : 0;
  if (current.getTime() - lastAction < 15_000) {
    throw new Error("刚刚已经照顾过啦，稍等一会儿再试。");
  }

  const before = next.needs[care.need];
  const needs = {
    ...next.needs,
    [care.need]: clampNeed(before + care.gain),
  };
  if (action === "clean") {
    next.poopCount = 0;
    next.nextPoopAt = null;
  }
  if (action === "feed" && !next.nextPoopAt && (next.poopCount || 0) < 3) {
    next.nextPoopAt = new Date(current.getTime() + 35_000).toISOString();
  }
  if (action === "feed" && before < 95) {
    next.weightKg = Math.min(
      PET_WEIGHT.maxKg,
      (Number(next.weightKg) || PET_WEIGHT.birthKg) + PET_WEIGHT.feedGainKg,
    );
  }
  if (action === "pet") {
    needs.mood = clampNeed(needs.mood + 8);
  }
  if ((next.poopCount || 0) > 0) {
    needs.cleanliness = clampNeed(needs.cleanliness - 4);
  }

  const actuallyHelped = needs[care.need] > before;
  const lowNeedSince =
    needs.satiety < 30 || needs.hydration < 30
      ? next.lowNeedSince || nowIso(current)
      : null;
  const requiresTreatment = ["sick", "critical"].includes(next.status);
  const lastEffectiveCareAt = actuallyHelped && !requiresTreatment
    ? nowIso(current)
    : next.lastEffectiveCareAt;
  next = {
    ...next,
    needs,
    lowNeedSince,
    status: requiresTreatment
      ? next.status
      : petStatusFor({ ...next, lastEffectiveCareAt }, current),
    lastActionAt: {
      ...(next.lastActionAt || {}),
      [action]: nowIso(current),
    },
    lastEffectiveCareAt,
    needsUpdatedAt: nowIso(current),
    updatedAt: nowIso(current),
  };
  return {
    profile: next,
    action,
    gained: Math.max(0, needs[care.need] - before),
  };
}

export function applyPetTreatment(profile, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  if (isPetSleepTime(current)) {
    throw new Error(`小恐龙正在睡觉（${PET_SLEEP_LABEL}），早上 6:30 后再来照顾它。`);
  }
  const next = advancePetProfile(profile, current);
  if (!["sick", "critical"].includes(petStatusFor(next, current))) {
    throw new Error("现在不需要治疗，继续照顾好它就好。");
  }
  return {
    ...next,
    status: "recovering",
    treatmentStartedAt: nowIso(current),
    lowNeedSince:
      next.needs.satiety < 30 || next.needs.hydration < 30
        ? nowIso(current)
        : null,
    lastEffectiveCareAt: nowIso(current),
    needsUpdatedAt: nowIso(current),
    updatedAt: nowIso(current),
  };
}

export function petStatusLabel(status) {
  return {
    egg: "等待孵化",
    healthy: "活力满满",
    low: "有点没精神",
    sick: "生病了",
    critical: "需要紧急照料",
    recovering: "正在恢复",
    ended: "暂时离开",
  }[status] || "等待照料";
}

export function petMilestoneSummary(profile, now = new Date()) {
  const neglectHours = petNeglectHours(profile, now);
  const status = petStatusFor(profile, now);
  if (status === "recovering") {
    const recoveryEnds = new Date(
      new Date(profile.treatmentStartedAt).getTime() +
        PET_MILESTONES.recoveryHours * HOUR_MS,
    );
    return {
      label: "恢复倒计时",
      hours: Math.max(0, (recoveryEnds.getTime() - now.getTime()) / HOUR_MS),
      targetStatus: "healthy",
    };
  }
  if (neglectHours < PET_MILESTONES.lowHours) {
    return {
      label: "距离精神不振",
      hours: PET_MILESTONES.lowHours - neglectHours,
      targetStatus: "low",
    };
  }
  if (neglectHours < PET_MILESTONES.sickHours) {
    return {
      label: "距离生病",
      hours: PET_MILESTONES.sickHours - neglectHours,
      targetStatus: "sick",
    };
  }
  return {
    label: "距离暂时离开",
    hours: Math.max(0, PET_MILESTONES.endHours - neglectHours),
    targetStatus: "ended",
  };
}
