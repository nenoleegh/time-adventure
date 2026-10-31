import {
  TIMELINE_END_MINUTES,
  TIMELINE_PIXELS_PER_MINUTE,
  TIMELINE_START_MINUTES,
} from "../views/schedule-timeline.js";

let activeDrag = null;
let suppressNextClick = false;
let onScheduleCallback = null;

function timeFromMinutes(value) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function cleanUp() {
  document.querySelector(".timeline-drag-ghost")?.remove();
  document.querySelectorAll(".timeline-drop-active").forEach((node) => {
    node.classList.remove("timeline-drop-active");
  });
  activeDrag?.source?.classList.remove("is-dragging");
  document.body.classList.remove("is-dragging-timeline");
  activeDrag = null;
}

function beginVisualDrag(event) {
  const source = activeDrag.source;
  const ghost = document.createElement("div");
  ghost.className = `timeline-drag-ghost ${activeDrag.colorClass || ""}`;
  ghost.textContent = activeDrag.title;
  ghost.style.width = `${Math.min(260, Math.max(150, source.getBoundingClientRect().width))}px`;
  document.body.append(ghost);
  activeDrag.ghost = ghost;
  activeDrag.moved = true;
  source.classList.add("is-dragging");
  document.body.classList.add("is-dragging-timeline");
}

function moveGhost(event) {
  if (!activeDrag?.ghost) return;
  activeDrag.ghost.style.left = `${event.clientX + 12}px`;
  activeDrag.ghost.style.top = `${event.clientY + 12}px`;
  document.querySelectorAll(".timeline-drop-active").forEach((node) => {
    if (node !== activeDrag.targetColumn) node.classList.remove("timeline-drop-active");
  });
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const column = element?.closest?.("[data-timeline-day]") ?? null;
  activeDrag.targetColumn = column;
  column?.classList.add("timeline-drop-active");
}

function handlePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const source = event.target.closest("[data-drag-task]");
  if (!source || event.target.closest("[data-no-drag]")) return;
  activeDrag = {
    source,
    taskId: source.dataset.dragTask,
    duration: Math.max(5, Number(source.dataset.taskDuration) || 20),
    title: source.querySelector(".timeline-block-title, .unscheduled-title")?.textContent?.trim() || "任务",
    colorClass: Array.from(source.classList).find((name) => name.startsWith("color-")) || "",
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    ghost: null,
    targetColumn: null,
  };
}

function handlePointerMove(event) {
  if (!activeDrag) return;
  if (!activeDrag.moved) {
    const distance = Math.hypot(
      event.clientX - activeDrag.startX,
      event.clientY - activeDrag.startY,
    );
    if (distance < 7) return;
    beginVisualDrag(event);
  }
  event.preventDefault();
  moveGhost(event);
}

function handlePointerUp(event) {
  if (!activeDrag) return;
  const drag = activeDrag;
  if (drag.moved) {
    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
    moveGhost(event);
    if (drag.targetColumn) {
      const rect = drag.targetColumn.getBoundingClientRect();
      const rawY = event.clientY - rect.top;
      const periodStart = Number(
        drag.targetColumn.dataset.periodStart || TIMELINE_START_MINUTES,
      );
      const periodEnd = Number(
        drag.targetColumn.dataset.periodEnd || TIMELINE_END_MINUTES,
      );
      const periodSpan = periodEnd - periodStart;
      const rawMinutes =
        periodStart +
        Math.round((rawY / rect.height) * periodSpan / 5) * 5;
      const latestStart = Math.max(periodStart, periodEnd - drag.duration);
      const start = Math.max(
        periodStart,
        Math.min(latestStart, rawMinutes),
      );
      onScheduleCallback?.(drag.taskId, {
        date: drag.targetColumn.dataset.timelineDay,
        scheduledStart: timeFromMinutes(start),
        scheduledEnd: timeFromMinutes(start + drag.duration),
      });
    }
  }
  cleanUp();
}

export function installTimelineDrag(onSchedule) {
  onScheduleCallback = onSchedule;
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointermove", handlePointerMove, { passive: false });
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", cleanUp);
  document.addEventListener(
    "click",
    (event) => {
      if (!suppressNextClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
    },
    true,
  );
}
