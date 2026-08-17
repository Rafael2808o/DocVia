import { createRequire } from "node:module";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("C:/Users/Rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const directory = path.dirname(fileURLToPath(import.meta.url));

function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [hue, max ? delta / max : 0, max];
}

function hsvToRgb(hue, saturation, value) {
  const chroma = value * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const pairs = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  const [r, g, b] = pairs[Math.floor(section) % 6];
  const match = value - chroma;
  return [r, g, b].map((channel) => Math.round((channel + match) * 255));
}

const files = (await readdir(directory)).filter((name) => /^screenshot-.*\.png$/i.test(name));
for (const name of files) {
  const file = path.join(directory, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const [hue, saturation, value] = rgbToHsv(data[index], data[index + 1], data[index + 2]);
    if (hue >= 225 && hue <= 315 && saturation >= 0.16) {
      const targetHue = 187 + (hue - 265) * 0.06;
      const targetValue = saturation >= 0.45 && value >= 0.65 ? Math.min(value, 0.58) : value;
      const [red, green, blue] = hsvToRgb(targetHue, Math.min(1, saturation * 0.92), targetValue);
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
    }
  }
  const output = await sharp(data, { raw: info }).png().toBuffer();
  await writeFile(file, output);
}

console.log(`${files.length} capturas atualizadas para a identidade azul-petróleo.`);
