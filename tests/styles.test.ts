import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePattern, type GenerateOptions } from "../src/lib/generate";
import { getPalette } from "../src/lib/palette";
import { tally, type GridCell, type ImagePixels } from "../src/lib/pixelate";
import { addOutline, assessDifficulty, darkestColor, posterize, smoothGrid, trimToSubject } from "../src/lib/stylize";
import { STYLE_PRESETS } from "../src/components/studio/constants";

/** A white canvas with a colored disc in the middle, like a sticker or pet photo. */
function disc(size: number, radius: number): ImagePixels {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = (x - size / 2) ** 2 + (y - size / 2) ** 2 < radius ** 2;
      data[i] = inside ? 230 - (x % 7) * 9 : 255;
      data[i + 1] = inside ? 90 + (y % 5) * 11 : 255;
      data[i + 2] = inside ? 60 : 255;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

const base: GenerateOptions = { cols: 30, rows: 30, paletteId: "168", excluded: [], mode: "dominant", threshold: 0, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 };

test("trim crops to the subject and keeps the board aspect", () => {
  const out = trimToSubject(disc(200, 30), 30, 20);
  assert.ok(out.width < 120 && out.height < 120, `${out.width}x${out.height}`);
  assert.ok(Math.abs(out.width / out.height - 1.5) < 0.05);
});

test("posterize keeps alpha and limits levels", () => {
  const out = posterize(disc(20, 6), 4);
  const levels = new Set<number>();
  for (let i = 0; i < out.data.length; i += 4) levels.add(out.data[i]);
  assert.ok(levels.size <= 4);
});

test("outline only adds beads outside the subject, in the darkest color", async () => {
  const palette = getPalette("168");
  const ink = darkestColor(palette)!;
  const plain = await generatePattern(disc(120, 30), { ...base, removeBg: true });
  const { grid, added } = addOutline(plain, ink, 1);
  assert.ok(added > 0);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (!plain[r][c].isExternal) assert.equal(grid[r][c].hex, plain[r][c].hex, "subject untouched");
    }
  }
  assert.equal(tally(grid).total, tally(plain).total + added);
});

test("lower detail reduces scattered beads", async () => {
  const sharp = await generatePattern(disc(120, 45), base);
  const soft = smoothGrid(sharp, 2);
  assert.ok(assessDifficulty(soft).scattered <= assessDifficulty(sharp).scattered);
});

test("dithering changes the result but stays inside the palette", async () => {
  const allowed = new Set(getPalette("72").map((color) => color.hex));
  const flat = await generatePattern(disc(90, 40), { ...base, paletteId: "72", mode: "average" });
  const dithered = await generatePattern(disc(90, 40), { ...base, paletteId: "72", mode: "average", dither: 1 });
  let changed = 0;
  dithered.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell.isExternal) assert.ok(allowed.has(cell.hex));
    if (cell.hex !== flat[r][c].hex) changed += 1;
  }));
  assert.ok(changed > 0);
});

test("every style preset generates within its color cap", async () => {
  for (const [id, preset] of Object.entries(STYLE_PRESETS)) {
    const grid = await generatePattern(disc(120, 40), { ...base, mode: preset.mode, metric: preset.metric, threshold: preset.threshold, maxColors: preset.maxColors, removeBg: Boolean(preset.removeBg), ...preset.look });
    const { counts, total } = tally(grid);
    assert.ok(total > 0, id);
    if (preset.maxColors > 0) assert.ok(counts.length <= preset.maxColors + (preset.look.outline ? 1 : 0), `${id} ${counts.length}`);
  }
});

test("difficulty grows with size and colors", () => {
  const cell = (hex: string): GridCell => ({ key: hex, hex, isExternal: false });
  const small = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => cell("#000000")));
  const busy = Array.from({ length: 60 }, (_, r) => Array.from({ length: 60 }, (_, c) => cell(`#${((r * 60 + c) % 30).toString(16).padStart(2, "0")}0000`)));
  assert.equal(assessDifficulty(small).level, "easy");
  assert.equal(assessDifficulty(busy).level, "hard");
});

test("use presets point at real styles and sensible widths", async () => {
  const { USE_PRESETS } = await import("../src/components/studio/constants");
  const { systemPitchMm } = await import("../src/lib/palette");
  for (const preset of Object.values(USE_PRESETS)) {
    assert.ok(STYLE_PRESETS[preset.style], preset.name);
    assert.ok(preset.cols >= 8 && preset.cols <= 180);
  }
  assert.equal(systemPitchMm("Artkal C"), 2.6);
  assert.equal(systemPitchMm("Perler"), 5);
  assert.equal(systemPitchMm("MARD"), undefined);
});
