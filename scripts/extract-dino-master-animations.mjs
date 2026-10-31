import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourcePath = path.resolve("docs/design/assets/dino-master-animation-reference.png");
const outputDir = path.resolve("assets/dino/animations");
const source = PNG.sync.read(fs.readFileSync(sourcePath));
const frameWidth = 120;
const frameHeight = 150;

const leftX = [7, 133, 259, 385, 511, 637];
const rightX = [777, 903, 1029, 1155, 1281, 1407];
const animations = {
  walk: {
    x: leftX,
    y: 58,
    width: 120,
    height: 160,
    inset: 4,
    cleanTitle: true,
  },
  selfClean: {
    x: rightX,
    y: 58,
    width: 120,
    height: 160,
    inset: 4,
    cleanTitle: true,
  },
  headPet: {
    x: leftX,
    y: 345,
    width: 120,
    height: 145,
    inset: 4,
    cleanTitle: true,
  },
  sleep: {
    x: rightX,
    y: 345,
    width: 120,
    height: 145,
    inset: 4,
    cleanTitle: true,
  },
  cute: { x: leftX, y: 650, width: 120, height: 145, inset: 4 },
  play: { x: rightX, y: 650, width: 120, height: 145, inset: 4 },
  thirsty: {
    x: [13, 74, 135, 196, 257, 318],
    y: 884,
    width: 58,
    height: 110,
    inset: 0,
    cleanTitle: true,
  },
  hungry: {
    x: [396, 457, 518, 579, 640, 701],
    y: 884,
    width: 58,
    height: 110,
    inset: 0,
    cleanTitle: true,
  },
  dirty: {
    x: [792, 853, 914, 975, 1036, 1097],
    y: 884,
    width: 58,
    height: 110,
    inset: 0,
    cleanTitle: true,
  },
  sick: {
    x: [1160, 1221, 1299, 1360, 1421, 1476],
    y: 884,
    width: 60,
    height: 110,
    inset: 0,
    cleanTitle: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });

function cropFrame({ x, y, width, height, inset = 0, cleanTitle = false }) {
  const frame = new PNG({ width, height });
  PNG.bitblt(source, frame, x, y, width, height, 0, 0);
  for (let index = 3; index < frame.data.length; index += 4) {
    if (frame.data[index] < 80) frame.data[index] = 0;
  }
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (
        row < inset ||
        row >= height - inset ||
        column < inset ||
        column >= width - inset
      ) {
        frame.data[(row * width + column) * 4 + 3] = 0;
      }
    }
  }
  if (cleanTitle) {
    for (let row = 0; row < 18; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const offset = (row * width + column) * 4;
        frame.data[offset + 3] = 0;
      }
    }
  }
  removeConnectedBackdrop(frame);
  removeFrameArtifacts(frame);
  return frame;
}

function contentBounds(frame) {
  let left = frame.width;
  let top = frame.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (frame.data[(y * frame.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left ? null : { left, top, right, bottom };
}

function removeConnectedBackdrop(frame) {
  const { width, height, data } = frame;
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
    if (alpha < 30) return true;
    return (
      Math.min(red, green, blue) > 120 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) < 75
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

function removeFrameArtifacts(frame) {
  const { width, height, data } = frame;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const total = width * height;
  const isOpaque = (index) => data[index * 4 + 3] >= 30;
  for (let start = 0; start < total; start += 1) {
    if (visited[start] || !isOpaque(start)) continue;
    let head = 0;
    let tail = 0;
    let touchesEdge = false;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) {
        touchesEdge = true;
      }
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const next of neighbors) {
        if (next >= 0 && !visited[next] && isOpaque(next)) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;
    const looksLikeBorder =
      (boxWidth > width * 0.7 && boxHeight < 18) ||
      (boxHeight > height * 0.7 && boxWidth < 18);
    if (touchesEdge && (tail < total * 0.22 || looksLikeBorder)) {
      for (let index = 0; index < tail; index += 1) {
        data[queue[index] * 4 + 3] = 0;
      }
    }
  }
}

function clearFrameEdges(sheet) {
  for (let frame = 0; frame < 6; frame += 1) {
    for (let row = 0; row < sheet.height; row += 1) {
      for (let column = 0; column < frameWidth; column += 1) {
        if (
          row < 8 ||
          row >= sheet.height - 8 ||
          column < 8 ||
          column >= frameWidth - 8
        ) {
          const x = frame * frameWidth + column;
          sheet.data[(row * sheet.width + x) * 4 + 3] = 0;
        }
      }
    }
  }
}

function drawNearest(target, frame, left, top, width, height) {
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(frame.height - 1, Math.floor((y / height) * frame.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor((x / width) * frame.width));
      const sourceOffset = (sourceY * frame.width + sourceX) * 4;
      const targetOffset = ((top + y) * target.width + left + x) * 4;
      frame.data.copy(
        target.data,
        targetOffset,
        sourceOffset,
        sourceOffset + 4,
      );
    }
  }
}

for (const [name, geometry] of Object.entries(animations)) {
  const sheet = new PNG({
    width: frameWidth * geometry.x.length,
    height: frameHeight,
  });
  geometry.x.forEach((x, index) => {
    const fullFrame = cropFrame({ ...geometry, x });
    const bounds = contentBounds(fullFrame);
    if (!bounds) return;
    const sourceWidth = bounds.right - bounds.left + 1;
    const sourceHeight = bounds.bottom - bounds.top + 1;
    const scale = Math.min(100 / sourceWidth, 130 / sourceHeight);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    const left = index * frameWidth + Math.floor((frameWidth - width) / 2);
    const top = frameHeight - 10 - height;
    const content = new PNG({
      width: sourceWidth,
      height: sourceHeight,
    });
    PNG.bitblt(
      fullFrame,
      content,
      bounds.left,
      bounds.top,
      sourceWidth,
      sourceHeight,
      0,
      0,
    );
    drawNearest(sheet, content, left, top, width, height);
  });
  clearFrameEdges(sheet);
  const target = path.join(outputDir, `${name}.png`);
  fs.writeFileSync(target, PNG.sync.write(sheet));
  console.log(`Wrote ${target}`);
}
