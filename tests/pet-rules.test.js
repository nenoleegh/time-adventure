import test from "node:test";
import assert from "node:assert/strict";
import {
  advancePetProfile,
  applyPetCare,
  applyPetPointAward,
  applyPetTreatment,
  createEggProfile,
  isPetSleepTime,
  petMilestoneSummary,
  petNameIsValid,
  petCareAvailability,
  petSizeScale,
  petStatusFor,
  petVisualState,
  spendPetPoints,
  PET_WEIGHT,
} from "../src/services/pet-rules.js";

function hatchedProfile(now) {
  return {
    ...createEggProfile(now),
    stage: "baby",
    name: "泡泡",
    status: "healthy",
    eggTaps: 3,
    lastEffectiveCareAt: now.toISOString(),
    needsUpdatedAt: now.toISOString(),
    hatchedAt: now.toISOString(),
  };
}

test("pet name accepts one to twelve characters and rejects empty names", () => {
  assert.equal(petNameIsValid("泡泡"), true);
  assert.equal(petNameIsValid("小恐龙探险家一号"), true);
  assert.equal(petNameIsValid(""), false);
  assert.equal(petNameIsValid("一".repeat(13)), false);
});

test("pet sleep window covers 22:00 through 06:29", () => {
  assert.equal(isPetSleepTime(new Date(2026, 10, 1, 21, 59)), false);
  assert.equal(isPetSleepTime(new Date(2026, 10, 1, 22, 0)), true);
  assert.equal(isPetSleepTime(new Date(2026, 10, 2, 0, 0)), true);
  assert.equal(isPetSleepTime(new Date(2026, 10, 2, 6, 29)), true);
  assert.equal(isPetSleepTime(new Date(2026, 10, 2, 6, 30)), false);
});

test("pet state moves through low, sick, critical and ended milestones", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const pet = hatchedProfile(start);
  assert.equal(
    petStatusFor(pet, new Date("2026-10-03T07:59:00.000Z")),
    "healthy",
  );
  assert.equal(
    petStatusFor(pet, new Date("2026-10-03T08:01:00.000Z")),
    "low",
  );
  assert.equal(
    petStatusFor(pet, new Date("2026-10-04T08:01:00.000Z")),
    "sick",
  );
  assert.equal(
    petStatusFor(pet, new Date("2026-10-05T08:01:00.000Z")),
    "critical",
  );
  assert.equal(
    petStatusFor(pet, new Date("2026-10-07T08:01:00.000Z")),
    "ended",
  );
});

test("offline time lowers needs and produces poop when scheduled", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(start),
    nextPoopAt: "2026-10-01T08:01:00.000Z",
  };
  const advanced = advancePetProfile(
    pet,
    new Date("2026-10-01T10:00:00.000Z"),
  );
  assert.equal(advanced.poopCount, 1);
  assert.ok(advanced.needs.satiety < 82);
  assert.ok(advanced.needs.hydration < 82);
});

test("satiety and hydration lose half of their value each day", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(start),
    needs: { satiety: 80, hydration: 80, cleanliness: 100, mood: 100 },
    lastEffectiveCareAt: start.toISOString(),
    needsUpdatedAt: start.toISOString(),
  };
  const dayOne = advancePetProfile(
    pet,
    new Date("2026-10-02T08:00:00.000Z"),
  );
  assert.equal(dayOne.needs.satiety, 40);
  assert.equal(dayOne.needs.hydration, 40);
  const dayTwo = advancePetProfile(
    { ...dayOne, needsUpdatedAt: "2026-10-02T08:00:00.000Z" },
    new Date("2026-10-03T08:00:00.000Z"),
  );
  assert.equal(dayTwo.needs.satiety, 20);
  assert.equal(dayTwo.needs.hydration, 20);
});

test("care actions improve needs and reset the effective care time", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(start),
    needs: { satiety: 30, hydration: 60, cleanliness: 40, mood: 50 },
    lastEffectiveCareAt: "2026-09-30T08:00:00.000Z",
    needsUpdatedAt: start.toISOString(),
  };
  const result = applyPetCare(
    pet,
    "feed",
    new Date("2026-10-01T08:05:00.000Z"),
  );
  assert.ok(result.profile.needs.satiety > 30);
  assert.equal(
    result.profile.lastEffectiveCareAt,
    "2026-10-01T08:05:00.000Z",
  );
  assert.ok(result.profile.nextPoopAt);
});

test("care and treatment are blocked while the pet is sleeping", () => {
  const pet = hatchedProfile(new Date(2026, 10, 1, 20, 0));
  assert.throws(
    () => applyPetCare(pet, "feed", new Date(2026, 10, 1, 22, 0)),
    /正在睡觉/,
  );
  assert.throws(
    () => applyPetTreatment(pet, new Date(2026, 10, 1, 23, 0)),
    /正在睡觉/,
  );
  assert.doesNotThrow(
    () => applyPetCare(pet, "feed", new Date(2026, 10, 2, 6, 30)),
  );
});
test("treatment enters recovery and completes after six hours", () => {
  const sickAt = new Date("2026-10-04T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")),
    status: "sick",
  };
  const recovering = applyPetTreatment(pet, sickAt);
  assert.equal(recovering.status, "recovering");
  assert.equal(advancePetProfile(recovering, new Date("2026-10-04T14:01:00.000Z")).status, "healthy");
  assert.equal(
    advancePetProfile(recovering, new Date("2026-10-04T14:01:00.000Z"))
      .treatmentStartedAt,
    null,
  );
});

test("ordinary care does not cure a sick pet without treatment", () => {
  const now = new Date("2026-10-04T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")),
    status: "sick",
  };
  const result = applyPetCare(pet, "feed", now);
  assert.equal(result.profile.status, "sick");
  assert.equal(
    result.profile.lastEffectiveCareAt,
    "2026-10-01T08:00:00.000Z",
  );
  assert.equal(
    petStatusFor(result.profile, new Date("2026-10-04T09:00:00.000Z")),
    "sick",
  );
});

test("low food or water creates a time-based illness risk", () => {
  const baseTime = new Date("2026-10-04T08:00:00.000Z");
  const base = {
    ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")),
    needs: { satiety: 25, hydration: 80, cleanliness: 80, mood: 80 },
    lowNeedSince: baseTime.toISOString(),
    lastEffectiveCareAt: new Date("2026-10-04T07:00:00.000Z").toISOString(),
  };
  assert.equal(
    petStatusFor(base, new Date("2026-10-04T19:59:00.000Z")),
    "healthy",
  );
  assert.equal(
    petStatusFor(base, new Date("2026-10-04T20:01:00.000Z")),
    "sick",
  );
  const bothLow = {
    ...base,
    needs: { ...base.needs, hydration: 20 },
  };
  assert.equal(
    petStatusFor(bothLow, new Date("2026-10-04T14:01:00.000Z")),
    "sick",
  );
});

test("milestone summary shows the next visible state", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  assert.deepEqual(
    petMilestoneSummary(hatchedProfile(start), new Date("2026-10-02T08:00:00.000Z")),
    { label: "距离精神不振", hours: 24, targetStatus: "low" },
  );
});

test("weight grows slowly with age and is capped", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const baby = hatchedProfile(start);
  assert.equal(baby.weightKg, PET_WEIGHT.birthKg);
  assert.equal(petSizeScale(baby), .33);
  const grown = advancePetProfile(
    baby,
    new Date("2026-10-15T08:00:00.000Z"),
  );
  assert.ok(grown.weightKg > baby.weightKg);
  assert.ok(petSizeScale(grown) > petSizeScale(baby));
  const capped = advancePetProfile(
    {
      ...baby,
      weightKg: 99,
      status: "healthy",
      needsUpdatedAt: "2026-10-01T07:00:00.000Z",
      lastEffectiveCareAt: "2026-10-01T08:00:00.000Z",
    },
    new Date("2026-10-01T08:00:00.000Z"),
  );
  assert.equal(capped.weightKg, PET_WEIGHT.maxKg);
  assert.equal(petSizeScale(capped), 1);
});

test("feeding increases weight without exceeding the cap", () => {
  const start = new Date("2026-10-01T08:00:00.000Z");
  const pet = {
    ...hatchedProfile(start),
    weightKg: 11.95,
    needs: { satiety: 40, hydration: 80, cleanliness: 80, mood: 80 },
  };
  const result = applyPetCare(
    pet,
    "feed",
    new Date("2026-10-01T08:05:00.000Z"),
  );
  assert.equal(result.profile.weightKg, PET_WEIGHT.maxKg);
});

test("visual state prioritizes illness, waste, thirst and hunger", () => {
  const base = hatchedProfile(new Date("2026-10-01T08:00:00.000Z"));
  assert.equal(
    petVisualState({
      ...base,
      status: "sick",
      poopCount: 1,
    }),
    "sick",
  );
  assert.equal(petVisualState({ ...base, poopCount: 1 }), "dirty");
  assert.equal(
    petVisualState({
      ...base,
      needs: { ...base.needs, hydration: 20 },
    }),
    "thirsty",
  );
  assert.equal(
    petVisualState({
      ...base,
      needs: { ...base.needs, satiety: 20 },
    }),
    "hungry",
  );
});

test("task completion awards one pet point only once", () => {
  const pet = { ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")) };
  const first = applyPetPointAward(pet, { id: "task-1", title: "数学" });
  assert.equal(first.added, true);
  assert.equal(first.profile.petPoints, 1);
  const duplicate = applyPetPointAward(first.profile, {
    id: "task-1",
    title: "数学",
  });
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.profile.petPoints, 1);
});

test("pet interactions cannot spend more points than available", () => {
  const pet = {
    ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")),
    petPoints: 1,
  };
  const spent = spendPetPoints(pet, 1);
  assert.equal(spent.ok, true);
  assert.equal(spent.profile.petPoints, 0);
  assert.equal(spendPetPoints(spent.profile, 1).ok, false);
});

test("full needs disable their care action without spending points", () => {
  const pet = {
    ...hatchedProfile(new Date("2026-10-01T08:00:00.000Z")),
    petPoints: 3,
    needs: { satiety: 100, hydration: 70, cleanliness: 100, mood: 100 },
  };
  assert.deepEqual(
    petCareAvailability(pet, "feed"),
    {
      available: false,
      reason: "full",
      cost: 1,
      needValue: 100,
      balance: 3,
    },
  );
  assert.equal(petCareAvailability(pet, "clean").reason, "full");
  assert.equal(petCareAvailability(pet, "pet").reason, "full");
  assert.equal(petCareAvailability(pet, "water").available, true);
});
