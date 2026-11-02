import { getRecord, putRecord } from "./db.js?v=1.13.11";
import { awardReflection } from "./ledger-service.js?v=1.13.11";

export function emptyReflection(day) {
  return {
    date: day,
    smooth: "",
    disrupted: "",
    adjust: "",
    visibility: "private",
    createdAt: null,
    updatedAt: null,
  };
}

export async function getReflection(day) {
  return (await getRecord("reflections", day)) ?? emptyReflection(day);
}

export async function saveReflection(day, values) {
  const existing = await getReflection(day);
  const hasAnyAnswer = [values.smooth, values.disrupted, values.adjust].some(
    (value) => value?.trim(),
  );
  if (!hasAnyAnswer) throw new Error("至少写一句今天想留下的话。");
  const now = new Date().toISOString();
  const reflection = {
    ...existing,
    date: day,
    smooth: values.smooth.trim().slice(0, 240),
    disrupted: values.disrupted.trim().slice(0, 240),
    adjust: values.adjust.trim().slice(0, 240),
    visibility: values.visibility === "shared" ? "shared" : "private",
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  await putRecord("reflections", reflection);
  const reward = await awardReflection(day);
  return { reflection, reward };
}
