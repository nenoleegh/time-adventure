import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const sourcePath = path.resolve("docs/design/assets/dino-needs-reference.png");
const outputDir = path.resolve("assets/dino/states");
const source = PNG.sync.read(fs.readFileSync(sourcePath));
const frameWidth = 130;
const frameHeight = 190;
const states = {
  thirsty: {
    y: 99,
    x: [29, 181, 332, 483, 634],
  },
  hungry: {
    y: 99,
    x: [797, 949, 1100, 1251, 1402],
  },
  dirty: {
    y: 547,
    x: [29, 181, 332, 483, 634],
  },
  sick: {
    y: 547,
    x: [797, 949, 1100, 1251, 1402],
  },
};

fs.mkdirSync(outputDir, { recursive: true });

function isSimilar(data, offset, target) {
  const red = data[offset] - target[0];
  const green = data[offset + 1] - target[1];
  const blue = data[offset + 2] - target[2];
  return red * red + green * green + blue * blue < 75 * 75;
}

function transparentCell(x, y) {
  const cell = new PNG({ width: frameWidth, height: frameHeight });
  PNG.bitblt(source, cell, x, y, frameWidth, frameHeight, 0, 0);
  const { width, height, data } = cell;
  const corner = [data[0], data[1], data[2]];
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (!visited[index] && isSimilar(data, index * 4, corner)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let px = 0; px < width; px += 1) {
    enqueue(px);
    enqueue((height - 1) * width + px);
  }
  for (let py = 0; py < height; py += 1) {
    enqueue(py * width);
    enqueue(py * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    data[index * 4 + 3] = 0;
    const px = index % width;
    if (px > 0) enqueue(index - 1);
    if (px < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < width * (height - 1)) enqueue(index + width);
  }
  return cell;
}

for (const [state, geometry] of Object.entries(states)) {
  const sheet = new PNG({
    width: frameWidth * geometry.x.length,
    height: frameHeight,
  });
  geometry.x.forEach((x, index) => {
    const cell = transparentCell(x, geometry.y);
    PNG.bitblt(
      cell,
      sheet,
      0,
      0,
      frameWidth,
      frameHeight,
      index * frameWidth,
      0,
    );
  });
  const target = path.join(outputDir, `${state}.png`);
  fs.writeFileSync(target, PNG.sync.write(sheet));
  console.log(`Wrote ${target}`);
}
