import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = PNG.sync.read(readFileSync(join(root, "assets", "icon.png")));
const targets = [
  ["drawable-mdpi", 288],
  ["drawable-hdpi", 432],
  ["drawable-xhdpi", 576],
  ["drawable-xxhdpi", 864],
  ["drawable-xxxhdpi", 1152]
];

for (const [folder, size] of targets) {
  const output = resizeCover(source, size, size);
  writeFileSync(join(root, "android", "app", "src", "main", "res", folder, "splashscreen_logo.png"), PNG.sync.write(output));
}

function resizeCover(input, outWidth, outHeight) {
  const output = new PNG({ width: outWidth, height: outHeight });
  const scale = Math.max(outWidth / input.width, outHeight / input.height);
  const scaledWidth = input.width * scale;
  const scaledHeight = input.height * scale;
  const offsetX = (outWidth - scaledWidth) / 2;
  const offsetY = (outHeight - scaledHeight) / 2;

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const srcX = clamp(Math.round((x - offsetX) / scale), 0, input.width - 1);
      const srcY = clamp(Math.round((y - offsetY) / scale), 0, input.height - 1);
      const src = (srcY * input.width + srcX) << 2;
      const dst = (y * outWidth + x) << 2;
      output.data[dst] = input.data[src];
      output.data[dst + 1] = input.data[src + 1];
      output.data[dst + 2] = input.data[src + 2];
      output.data[dst + 3] = input.data[src + 3];
    }
  }

  return output;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
