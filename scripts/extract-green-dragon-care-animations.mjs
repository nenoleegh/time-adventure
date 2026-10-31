import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const frameCount = 6;
const frameWidth = 120;
const frameHeight = 150;
const horizontalPadding = 4;
const bottomPadding = 6;
const minimumAlpha = 12;
const jobs = [
  {
    source:
      process.argv[2] ||
      "/Users/huhu/Downloads/像素小龙喝水动画序列.png",
    output: path.resolve("assets/dino/animations/thirsty.png"),
  },
  {
    source:
      process.argv[3] ||
      "/Users/huhu/Downloads/六帧像素恐龙进食动画 北京快.png",
    output: path.resolve("assets/dino/animations/hungry.png"),
  },
].map((job) => ({
  ...job,
  png: PNG.sync.read(fs.readFileSync(job.source)),
  frames: [],
}));

function removeLightBackdrop(png) {
  const { width, height, data } = png;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (
      alpha < 240 &&
      Math.min(red, green, blue) >= 238 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) < 14
    ) {
      data[offset + 3] = 0;
    }
  }
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const isBackdrop = (index) => {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    return (
      alpha < minimumAlpha ||
      (red >= 238 &&
        green >= 238 &&
        blue >= 238 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) < 14)
    );
  };
  const enqueue = (index) => {
    if (!visited[index] && isBackdrop(index)) {
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
}

function contentBounds(png, leftBound, rightBound) {
  let left = rightBound;
  let top = png.height;
  let right = leftBound;
  let bottom = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = leftBound; x < rightBound; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] < minimumAlpha) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    throw new Error(`No visible pixels found between x=${leftBound} and x=${rightBound}.`);
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

for (const job of jobs) {
  removeLightBackdrop(job.png);
  const binWidth = job.png.width / frameCount;
  job.frames = Array.from({ length: frameCount }, (_, index) =>
    contentBounds(
      job.png,
      Math.floor(index * binWidth),
      Math.floor((index + 1) * binWidth),
    ),
  );
}

const allFrames = jobs.flatMap((job) => job.frames);
const maxWidth = Math.max(...allFrames.map((frame) => frame.width));
const maxHeight = Math.max(...allFrames.map((frame) => frame.height));
const sharedScale = Math.min(
  (frameWidth - horizontalPadding * 2) / maxWidth,
  (frameHeight - bottomPadding * 2) / maxHeight,
);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const jobMedians = jobs.map((job) => ({
  job,
  height: median(job.frames.map((frame) => frame.height)),
  width: Math.max(...job.frames.map((frame) => frame.width)),
}));
const referenceHeight = Math.max(...jobMedians.map((item) => item.height));

for (const { job, height, width } of jobMedians) {
  const scale = Math.min(
    sharedScale * (referenceHeight / height),
    (frameWidth - horizontalPadding * 2) / width,
  );
  const sheet = new PNG({
    width: frameWidth * frameCount,
    height: frameHeight,
  });
  job.frames.forEach((frame, frameIndex) => {
    const scaledWidth = Math.max(1, Math.round(frame.width * scale));
    const scaledHeight = Math.max(1, Math.round(frame.height * scale));
    const targetLeft =
      frameIndex * frameWidth + Math.round((frameWidth - scaledWidth) / 2);
    const targetTop = frameHeight - bottomPadding - scaledHeight;
    for (let y = 0; y < scaledHeight; y += 1) {
      const sourceY =
        frame.top + Math.min(frame.height - 1, Math.floor(y / scale));
      for (let x = 0; x < scaledWidth; x += 1) {
        const sourceX =
          frame.left + Math.min(frame.width - 1, Math.floor(x / scale));
        const sourceOffset = (sourceY * job.png.width + sourceX) * 4;
        const targetOffset =
          ((targetTop + y) * sheet.width + targetLeft + x) * 4;
        job.png.data.copy(
          sheet.data,
          targetOffset,
          sourceOffset,
          sourceOffset + 4,
        );
        if (sheet.data[targetOffset + 3] < minimumAlpha) {
          sheet.data[targetOffset] = 0;
          sheet.data[targetOffset + 1] = 0;
          sheet.data[targetOffset + 2] = 0;
          sheet.data[targetOffset + 3] = 0;
        } else {
          sheet.data[targetOffset + 3] = 255;
        }
      }
    }
  });
  fs.mkdirSync(path.dirname(job.output), { recursive: true });
  fs.writeFileSync(job.output, PNG.sync.write(sheet));
  console.log(`Wrote ${job.output} (${sheet.width}x${sheet.height})`);
}
