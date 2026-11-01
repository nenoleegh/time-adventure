const CACHE_NAME = "time-adventure-v1.11.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/dino/dino-baby.png",
  "./assets/dino/animations/walk.png",
  "./assets/dino/animations/selfClean.png",
  "./assets/dino/animations/headPet.png",
  "./assets/dino/animations/sleep.png",
  "./assets/dino/animations/cute.png",
  "./assets/dino/animations/play.png",
  "./assets/dino/animations/thirsty.png",
  "./assets/dino/animations/hungry.png",
  "./assets/dino/animations/dirty.png",
  "./assets/dino/animations/sick.png",
  "./assets/dino/animations/idle.png",
  "./vendor/jszip/jszip.min.js",
  "./src/styles/main.css",
  "./src/app.js",
  "./src/config/features.js",
  "./src/config/themes.js",
  "./src/ui/html.js",
  "./src/ui/timeline-drag.js",
  "./src/utils/date.js",
  "./src/utils/id.js",
  "./src/utils/pin.js",
  "./src/views/today.js",
  "./src/views/plan.js",
  "./src/views/rewards.js",
  "./src/views/growth.js",
  "./src/views/parent.js",
  "./src/views/teacher-import.js",
  "./src/views/schedule-timeline.js",
  "./src/views/course-import.js",
  "./src/views/pet.js",
  "./src/services/db.js",
  "./src/services/settings-service.js",
  "./src/services/task-service.js",
  "./src/services/task-rules.js",
  "./src/services/ledger-service.js",
  "./src/services/ledger-rules.js",
  "./src/services/reward-rules.js",
  "./src/services/redemption-service.js",
  "./src/services/reflection-service.js",
  "./src/services/report-rules.js",
  "./src/services/teacher-import-rules.js",
  "./src/services/teacher-import-service.js",
  "./src/services/course-schedule-rules.js",
  "./src/services/course-schedule-service.js",
  "./src/services/table-file.js",
  "./src/services/pet-rules.js",
  "./src/services/pet-service.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || caches.match("./index.html")),
  );
});
