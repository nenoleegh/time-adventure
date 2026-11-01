import {
  deleteRecord,
  getAll,
  openDatabase,
  transactionDone,
} from "./db.js?v=1.11.0";
import { makeId } from "../utils/id.js";
import { weekdayLabel } from "./course-schedule-rules.js";

export async function getCourseTemplates() {
  const courses = await getAll("courseTemplates");
  return courses.sort(
    (a, b) =>
      Number(a.weekday) - Number(b.weekday) ||
      a.startTime.localeCompare(b.startTime),
  );
}

export async function saveCourseTemplates(courses) {
  const now = new Date().toISOString();
  const importId = makeId("course_import");
  const records = courses.map((course) => ({
    id: makeId("course"),
    title: course.title.trim().slice(0, 40),
    location: String(course.location || "").trim().slice(0, 60),
    teacher: String(course.teacher || "").trim().slice(0, 20),
    weekday: Number(course.weekday),
    startTime: course.startTime,
    endTime: course.endTime,
    effectiveFrom: course.effectiveFrom,
    effectiveTo: course.effectiveTo || "",
    sourceImportId: importId,
    createdAt: now,
    updatedAt: now,
  }));
  const db = await openDatabase();
  const transaction = db.transaction("courseTemplates", "readwrite");
  const store = transaction.objectStore("courseTemplates");
  records.forEach((record) => store.add(record));
  await transactionDone(transaction);
  return records;
}

export async function deleteCourseTemplate(courseId) {
  return deleteRecord("courseTemplates", courseId);
}

export function describeCourse(course) {
  return `${weekdayLabel(course.weekday)} ${course.startTime}–${course.endTime} ${course.title}`;
}
