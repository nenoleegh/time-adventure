export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

export function icon(name, className = "") {
  const paths = {
    today:
      '<path d="M6 3v3M18 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m9 15 2 2 4-5"/>',
    plan:
      '<path d="M5 6h14M5 12h14M5 18h9"/><circle cx="3" cy="6" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r=".8" fill="currentColor" stroke="none"/>',
    reward:
      '<path d="M12 3.5 14.7 9l6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.9l6-.9L12 3.5Z"/>',
    growth:
      '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 6 5-3 6 4 5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
    pause:
      '<path d="M8 5v14M16 5v14" stroke-width="4" stroke-linecap="round"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    spark:
      '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tablet:
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 18h6"/>',
    phone:
      '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/>',
    monitor:
      '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
    edit: '<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.5 7.5 3 3"/>',
    split: '<path d="M5 4v5a4 4 0 0 0 4 4h10M14 8l5 5-5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    pet:
      '<path d="M7 9 4 5v9l3 2v4h10v-4l3-2V5l-3 4"/><path d="M9 13h.01M15 13h.01M10 17h4"/>',
    heart:
      '<path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"/>',
    water:
      '<path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z"/>',
    broom:
      '<path d="m14 4 6 6M5 19l7-7M4 15l5 5M7 13l4 4M4 19l-1 2 2-1"/>',
    medicine:
      '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 3h8M12 11v6M9 14h6"/>',
    food:
      '<path d="M12 8c-2.5-3.1-8-2.2-8 3.2C4 16 8 21 12 21s8-5 8-9.8C20 5.8 14.5 4.9 12 8Z"/><path d="M12 8c.2-2 1.4-3.5 3.5-4"/>',
    filter:
      '<path d="M4 5h16l-6.2 7.2V19l-3.6 2v-8.8L4 5Z"/>',
    shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2M12 17h.01"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
}

export function statusPill(status) {
  const labels = {
    planned: "待开始",
    inProgress: "进行中",
    paused: "已暂停",
    completed: "已完成",
    skipped: "已跳过",
    rescheduled: "待重排",
  };
  return `<span class="status-pill ${status}">${labels[status] || escapeHtml(status)}</span>`;
}
