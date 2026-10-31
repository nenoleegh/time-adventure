import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist");
const files = ["index.html", "manifest.webmanifest", "service-worker.js"];
const directories = ["assets", "src", "vendor"];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
for (const directory of directories) {
  fs.cpSync(path.join(root, directory), path.join(output, directory), {
    recursive: true,
  });
}
fs.writeFileSync(
  path.join(output, "_headers"),
  [
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
    "",
    "/index.html",
    "  Cache-Control: no-cache",
    "",
    "/manifest.webmanifest",
    "  Cache-Control: no-cache",
    "",
    "/service-worker.js",
    "  Cache-Control: no-cache",
    "",
  ].join("\n"),
);

console.log(`Cloudflare Pages bundle ready: ${output}`);
