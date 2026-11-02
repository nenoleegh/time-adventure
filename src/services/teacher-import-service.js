import {
  getAll,
  getAllByIndex,
  openDatabase,
  putMany,
  transactionDone,
} from "./db.js?v=1.13.11";
import { makeId } from "../utils/id.js";
import { dateKey } from "../utils/date.js";
import { detectSubject, normalizeEstimate } from "./task-rules.js?v=1.13.11";
import { parseTeacherMessage } from "./teacher-import-rules.js?v=1.13.11";

const FEEDBACK_BACKFILL_VERSION = 3;

export async function getFeedbackForDate(day) {
  const notes = await getAllByIndex("feedbackNotes", "date", day);
  return notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function teacherImportMetadata(record) {
  const { message: _discardedMessage, ...metadata } = record;
  return metadata;
}

export async function commitTeacherImport({ tasks, feedback, today = dateKey() }) {
  const importId = makeId("import");
  const now = new Date().toISOString();
  const dates = [...new Set(tasks.map((task) => task.date))];
  const currentByDate = {};
  for (const date of dates) {
    currentByDate[date] = await getAllByIndex("tasks", "date", date);
  }
  const orderByDate = Object.fromEntries(
    Object.entries(currentByDate).map(([date, records]) => [
      date,
      records.length ? Math.max(...records.map((task) => task.sortOrder)) + 1 : 0,
    ]),
  );
  const createdTasks = tasks.map((task) => {
    const title = task.title?.trim();
    if (!title) throw new Error("导入的作业名称不能为空。");
    const record = {
      id: makeId("task"),
      date: task.date,
      title: title.slice(0, 40),
      type: ["must", "flex", "choice"].includes(task.type) ? task.type : "must",
      subject: task.subject || "其他",
      estimatedMinutes: normalizeEstimate(task.estimatedMinutes),
      actualMinutes: null,
      status: "planned",
      sortOrder: orderByDate[task.date]++,
      notes: "",
      scheduledStart: task.scheduledStart || "",
      scheduledEnd: task.scheduledEnd || "",
      breakBeforeMinutes: Number(task.breakBefore?.minutes || 0),
      breakStart: task.breakBefore?.scheduledStart || "",
      breakEnd: task.breakBefore?.scheduledEnd || "",
      sourceImportId: importId,
      subjectBackfillVersion: 2,
      accumulatedMs: 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      splitCount: 0,
    };
    return record;
  });

  const existingNotes = await getFeedbackForDate(today);
  const existingKeys = new Set(
    existingNotes.map((note) => `${note.type}|${note.content.replaceAll(" ", "")}`),
  );
  const feedbackRecords = feedback
    .filter((item) => !existingKeys.has(`${item.type}|${item.content.replaceAll(" ", "")}`))
    .map((item) => ({
      id: makeId("feedback"),
      date: today,
      type: item.type,
      subject: item.subject || "其他",
      content: item.content,
      matchedIdentifiers: item.matchedIdentifiers || [],
      sourceImportId: importId,
      feedbackBackfillVersion: FEEDBACK_BACKFILL_VERSION,
      createdAt: now,
    }));
  const importRecord = {
    id: importId,
    date: today,
    taskCount: createdTasks.length,
    feedbackCount: feedbackRecords.length,
    createdAt: now,
  };

  const db = await openDatabase();
  const transaction = db.transaction(
    ["tasks", "feedbackNotes", "teacherImports"],
    "readwrite",
  );
  const taskStore = transaction.objectStore("tasks");
  const feedbackStore = transaction.objectStore("feedbackNotes");
  createdTasks.forEach((task) => taskStore.add(task));
  feedbackRecords.forEach((note) => feedbackStore.add(note));
  transaction.objectStore("teacherImports").add(importRecord);
  await transactionDone(transaction);

  return {
    importId,
    tasks: createdTasks,
    feedback: feedbackRecords,
  };
}

export async function scrubTeacherImportMessages() {
  const imports = await getAll("teacherImports");
  const scrubbed = imports
    .filter((item) => Object.hasOwn(item, "message"))
    .map(teacherImportMetadata);
  if (scrubbed.length) await putMany("teacherImports", scrubbed);
  return scrubbed.length;
}

function normalizedImportText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function feedbackTopicText(value) {
  const normalized = normalizedImportText(value)
    .replace(/的\d+人/g, "")
    .replace(/获得老师表扬|老师提醒需要继续改进|获得表扬/g, "");
  return normalized.length >= 3 ? normalized : normalizedImportText(value);
}

export function sanitizeImportedFeedbackContent(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/(\d+人)\d(?=获得老师表扬|$)/, "$1");
}

export function resolveImportedFeedbackSubject(note, importRecord) {
  if (!importRecord?.message) return null;
  const parsed = parseTeacherMessage(importRecord.message, {
    today: importRecord.date || note.date || dateKey(),
  });
  const noteText = feedbackTopicText(note.content);
  if (noteText.length < 3) return null;
  let best = null;
  for (const candidate of parsed.feedback) {
    const candidateText = feedbackTopicText(candidate.content);
    if (candidateText.length < 3 || !candidate.subject) continue;
    const exact = noteText === candidateText;
    const contains =
      noteText.includes(candidateText) || candidateText.includes(noteText);
    if (!exact && !contains) continue;
    const score =
      (exact ? 1000 : 0) + Math.min(noteText.length, candidateText.length);
    if (!best || score > best.score) {
      best = { subject: candidate.subject, score };
    }
  }
  return best?.subject || null;
}

export async function backfillFeedbackSubjects() {
  const [notes, imports] = await Promise.all([
    getAll("feedbackNotes"),
    getAll("teacherImports"),
  ]);
  const importById = new Map(imports.map((item) => [item.id, item]));
  const changed = [];
  for (const note of notes) {
    if (
      note.sourceImportId &&
      note.feedbackBackfillVersion !== FEEDBACK_BACKFILL_VERSION
    ) {
      const resolvedSubject = resolveImportedFeedbackSubject(
        note,
        importById.get(note.sourceImportId),
      );
      const content = sanitizeImportedFeedbackContent(note.content);
      if (
        resolvedSubject ||
        content !== note.content ||
        note.feedbackBackfillVersion !== FEEDBACK_BACKFILL_VERSION
      ) {
        changed.push({
          ...note,
          subject: resolvedSubject || note.subject || "其他",
          content,
          feedbackBackfillVersion: FEEDBACK_BACKFILL_VERSION,
        });
      }
      continue;
    }
    if (note.subject && note.subject !== "作业") continue;
    const contentSubject = detectSubject(note.content);
    changed.push({
      ...note,
      subject: contentSubject !== "其他" ? contentSubject : "其他",
      content: sanitizeImportedFeedbackContent(note.content),
      feedbackBackfillVersion: FEEDBACK_BACKFILL_VERSION,
    });
  }
  if (changed.length) await putMany("feedbackNotes", changed);
  return changed.length;
}
