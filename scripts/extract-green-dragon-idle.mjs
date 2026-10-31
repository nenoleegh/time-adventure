import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourcePath =
  process.argv[2] || "/Users/huhu/Downloads/六帧可爱像素恐龙表情图集.png";
const outputPath = path.resolve("assets/dino/animations/idle.png");
const frameCount = 6;
const frameWidth = 120;
const frameHeight = 150;
const horizontalPadding = 6;
const bottomPadding = 6;
const maximumContentHeight = 132;
const minimumAlpha = 60;

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

function contentBounds(leftBound, rightBound) {
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

const binWidth = source.width / frameCount;
const frames = Array.from({ length: frameCount }, (_, index) =>
  contentBounds(
    Math.floor(index * binWidth),
    Math.floor((index + 1) * binWidth),
  ),
);
const maxWidth = Math.max(...frames.map((frame) => frame.width));
const maxHeight = Math.max(...frames.map((frame) => frame.height));
const scale = Math.min(
  (frameWidth - horizontalPadding * 2) / maxWidth,
  maximumContentHeight / maxHeight,
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
    }
  }
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(sheet));
console.log(
  `Wrote ${outputPath} (${sheet.width}x${sheet.height}, ${frameCount} idle frames)`,
);
