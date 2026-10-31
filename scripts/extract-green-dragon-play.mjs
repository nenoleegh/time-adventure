import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourcePath =
  process.argv[2] || "/Users/huhu/Downloads/像素小恐龙玩球动画序列.png";
const outputPath = path.resolve("assets/dino/animations/play.png");
const frameCount = 6;
const frameWidth = 120;
const frameHeight = 150;
const minimumAlpha = 60;
const targetBodyWidth = 100;
const groundBaseline = 143;

const source = PNG.sync.read(fs.readFileSync(sourcePath));
for (let offset = 3; offset < source.data.length; offset += 4) {
  if (source.data[offset] >= minimumAlpha) {
    source.data[offset] = 255;
  } else {
    source.data[offset - 3] = 0;
    source.data[offset - 2] = 0;
    source.data[offset - 1] = 0;
    source.data[offset] = 0;
  }
}

function visibleBounds(leftBound, rightBound) {
  let left = rightBound;
  let top = source.height;
  let right = leftBound;
  let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = leftBound; x < rightBound; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function largestComponentBounds(leftBound, rightBound) {
  const width = rightBound - leftBound;
  const total = width * source.height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let best = null;
  for (let start = 0; start < total; start += 1) {
    if (visited[start]) continue;
    const startX = leftBound + (start % width);
    const startY = Math.floor(start / width);
    if (source.data[(startY * source.width + startX) * 4 + 3] === 0) continue;
    let head = 0;
    let tail = 0;
    let left = rightBound;
    let top = source.height;
    let right = leftBound;
    let bottom = -1;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = leftBound + (index % width);
      const y = Math.floor(index / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      const neighbors = [
        x > leftBound ? index - 1 : -1,
        x < rightBound - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < source.height - 1 ? index + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || visited[next]) continue;
        const nextX = leftBound + (next % width);
        const nextY = Math.floor(next / width);
        if (source.data[(nextY * source.width + nextX) * 4 + 3] === 0) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (!best || tail > best.size) {
      best = { size: tail, left, top, right, bottom };
    }
  }
  return best;
}

const binWidth = source.width / frameCount;
const frames = Array.from({ length: frameCount }, (_, index) => {
  const leftBound = Math.floor(index * binWidth);
  const rightBound = Math.floor((index + 1) * binWidth);
  return {
    bounds: visibleBounds(leftBound, rightBound),
    body: largestComponentBounds(leftBound, rightBound),
  };
});
const maxBodyWidth = Math.max(
  ...frames.map(({ body }) => body.right - body.left + 1),
);
const scale = targetBodyWidth / maxBodyWidth;
const maxRightExtent = Math.max(
  ...frames.map(
    ({ bounds, body }) =>
      (bounds.right - (body.left + body.right + 1) / 2) * scale,
  ),
);
const bodyCenterX = frameWidth - 2 - maxRightExtent;
const groundY = Math.max(
  ...frames
    .map(({ body }) => body.bottom)
    .filter((bottom) => bottom >= 0),
);
const sheet = new PNG({
  width: frameWidth * frameCount,
  height: frameHeight,
});

frames.forEach(({ bounds, body }, frameIndex) => {
  const scaledWidth = Math.max(1, Math.round(bounds.width * scale));
  const scaledHeight = Math.max(1, Math.round(bounds.height * scale));
  const bodyCenter = (body.left + body.right + 1) / 2;
  const targetBodyCenter = frameIndex * frameWidth + bodyCenterX;
  const targetLeft = Math.round(
    targetBodyCenter - (bodyCenter - bounds.left) * scale,
  );
  const targetTop = Math.round(
    groundBaseline - (groundY - bounds.top) * scale,
  );
  for (let y = 0; y < scaledHeight; y += 1) {
    const sourceY =
      bounds.top + Math.min(bounds.height - 1, Math.floor(y / scale));
    for (let x = 0; x < scaledWidth; x += 1) {
      const targetX = targetLeft + x;
      if (
        targetX < frameIndex * frameWidth ||
        targetX >= (frameIndex + 1) * frameWidth
      ) {
        continue;
      }
      const sourceX =
        bounds.left + Math.min(bounds.width - 1, Math.floor(x / scale));
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset =
        ((targetTop + y) * sheet.width + targetX) * 4;
      source.data.copy(
        sheet.data,
        targetOffset,
        sourceOffset,
        sourceOffset + 4,
      );
    }
  }
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(sheet));
console.log(
  `Wrote ${outputPath} (${sheet.width}x${sheet.height}, ${frameCount} play frames)`,
);
