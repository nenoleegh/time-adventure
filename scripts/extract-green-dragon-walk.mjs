import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourcePath =
  process.argv[2] ||
  "/Users/huhu/Downloads/可爱绿龙像素行走动画精灵表.png";
const outputPath = path.resolve("assets/dino/animations/walk.png");
const frameCount = 6;
const frameWidth = 120;
const frameHeight = 150;
const horizontalPadding = 6;
const bottomPadding = 6;
const minimumAlpha = 12;

const source = PNG.sync.read(fs.readFileSync(sourcePath));
const binWidth = source.width / frameCount;

function contentBounds(leftBound, rightBound) {
  let left = rightBound;
  let top = source.height;
  let right = leftBound;
  let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = leftBound; x < rightBound; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] < minimumAlpha) continue;
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

const frames = Array.from({ length: frameCount }, (_, index) => {
  const leftBound = Math.floor(index * binWidth);
  const rightBound = Math.floor((index + 1) * binWidth);
  return contentBounds(leftBound, rightBound);
});

const maxWidth = Math.max(...frames.map((frame) => frame.width));
const maxHeight = Math.max(...frames.map((frame) => frame.height));
const scale = Math.min(
  (frameWidth - horizontalPadding * 2) / maxWidth,
  (frameHeight - bottomPadding * 2) / maxHeight,
);
const sheet = new PNG({
  width: frameWidth * frameCount,
  height: frameHeight,
});

frames.forEach((frame, frameIndex) => {
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
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      const targetOffset =
        ((targetTop + y) * sheet.width + targetLeft + x) * 4;
      source.data.copy(
        sheet.data,
        targetOffset,
        sourceOffset,
        sourceOffset + 4,
      );
      if (sheet.data[targetOffset + 3] < minimumAlpha) {
        sheet.data[targetOffset + 3] = 0;
      }
    }
  }
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(sheet));
console.log(
  `Wrote ${outputPath} (${sheet.width}x${sheet.height}, ${frameCount} equal-scale frames)`,
);
