import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const inputPath = path.resolve("docs/design/assets/dino-sprite-reference.png");
const outputPath = path.resolve("assets/dino/dino-baby.png");
const png = PNG.sync.read(fs.readFileSync(inputPath));
const { width, height, data } = png;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;

const isBackgroundWhite = (index) => {
  const offset = index * 4;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return (
    red > 232 &&
    green > 232 &&
    blue > 232 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) < 12
  );
};

const enqueue = (index) => {
  if (!visited[index] && isBackgroundWhite(index)) {
    visited[index] = 1;
    queue[tail++] = index;
  }
};

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const index = queue[head++];
  data[index * 4 + 3] = 0;
  const x = index % width;
  if (x > 0) enqueue(index - 1);
  if (x < width - 1) enqueue(index + 1);
  if (index >= width) enqueue(index - width);
  if (index < width * (height - 1)) enqueue(index + width);
}

let left = width;
let top = height;
let right = 0;
let bottom = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
}

const padding = 8;
const cropLeft = Math.max(0, left - padding);
const cropTop = Math.max(0, top - padding);
const cropWidth = Math.min(width - cropLeft, right - left + 1 + padding * 2);
const cropHeight = Math.min(height - cropTop, bottom - top + 1 + padding * 2);
const cropped = new PNG({ width: cropWidth, height: cropHeight });
PNG.bitblt(png, cropped, cropLeft, cropTop, cropWidth, cropHeight, 0, 0);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(cropped));
console.log(`Wrote ${outputPath} (${cropWidth}x${cropHeight})`);
