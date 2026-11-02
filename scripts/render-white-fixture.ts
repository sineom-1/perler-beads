/**
 * Render a pure-white fixture and the bead pattern it maps to.
 * Usage: tsx scripts/render-white-fixture.ts <before|after> <pattern-png> [fixture-png]
 * `before` turns the transparent-bead flag off so pure white still matches T01.
 * `after` uses the current matcher, which skips T01 and lands on H02.
 * The caption prints the bead code because T01 and H02 are both nearly white.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname } from "node:path";
import type { PaletteColor } from "../src/lib/color";
import { getPalette } from "../src/lib/palette";
import { buildPattern } from "../src/lib/pixelate";

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
};

function fixturePixels(size = 64) {
  const data = new Uint8ClampedArray(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const inside = (x - center) ** 2 + (y - center) ** 2 <= radius * radius;
      data[index] = inside ? 220 : 255;
      data[index + 1] = inside ? 30 : 255;
      data[index + 2] = inside ? 40 : 255;
      data[index + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(4 + body.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
}

function writePng(path: string, width: number, height: number, rgba: Uint8ClampedArray) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = row + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
}

function setPixel(image: Uint8ClampedArray, width: number, x: number, y: number, color: [number, number, number, number]) {
  if (x < 0 || y < 0 || x >= width) return;
  const index = (y * width + x) * 4;
  image[index] = color[0];
  image[index + 1] = color[1];
  image[index + 2] = color[2];
  image[index + 3] = color[3];
}

function fillRect(
  image: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number],
) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(image, width, xx, yy, color);
  }
}

function drawText(
  image: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  text: string,
  scale: number,
  color: [number, number, number, number],
) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char] ?? FONT[" "];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] !== "1") continue;
        fillRect(image, width, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function parseHex(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

async function main() {
  const mode = process.argv[2];
  const patternPath = process.argv[3];
  const fixturePath = process.argv[4];
  if ((mode !== "before" && mode !== "after") || !patternPath) {
    throw new Error("用法: tsx scripts/render-white-fixture.ts <before|after> <pattern-png> [fixture-png]");
  }

  const pixels = fixturePixels();
  if (fixturePath) writePng(fixturePath, pixels.width, pixels.height, pixels.data);

  const cols = 16;
  const rows = 16;
  const palette: PaletteColor[] =
    mode === "before"
      ? getPalette("291").map((color) => ({ ...color, transparent: false }))
      : getPalette("291");
  const pattern = await buildPattern(pixels, {
    cols,
    rows,
    palette,
    mode: "dominant",
    threshold: 0,
    metric: "oklab",
  });

  const background = pattern.grid[0][0];
  const expected = mode === "before" ? "T01" : "H02";
  if (background.key !== expected) {
    throw new Error(`${mode} 背景应为 ${expected}，实际 ${background.key}`);
  }
  const cell = 36;
  const titleH = 28;
  const width = cols * cell;
  const height = titleH + rows * cell;
  const image = new Uint8ClampedArray(width * height * 4);
  fillRect(image, width, 0, 0, width, height, [255, 255, 255, 255]);
  fillRect(image, width, 0, 0, width, titleH, [36, 28, 22, 255]);
  drawText(image, width, 8, 6, `BG ${background.key}  ${background.hex}`, 2, [255, 255, 255, 255]);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bead = pattern.grid[row][col];
      const x = col * cell;
      const y = titleH + row * cell;
      const [r, g, b] = parseHex(bead.hex);
      fillRect(image, width, x, y, cell, cell, [r, g, b, 255]);
      fillRect(image, width, x, y, cell, 1, [40, 36, 32, 80]);
      fillRect(image, width, x, y, 1, cell, [40, 36, 32, 80]);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const ink: [number, number, number, number] = luminance > 0.62 ? [36, 28, 22, 255] : [255, 255, 255, 255];
      const label = bead.key;
      const textWidth = label.length * 6 * 2;
      drawText(image, width, x + Math.floor((cell - textWidth) / 2), y + 11, label, 2, ink);
    }
  }

  writePng(patternPath, width, height, image);
  const counts = pattern.counts.map((item) => `${item.key}:${item.count}`).join(",");
  console.log(JSON.stringify({ background: background.key, hex: background.hex, counts }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
