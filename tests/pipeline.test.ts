import { test } from "node:test";
import assert from "node:assert/strict";
import { colorDistance, findClosest, type DistanceMetric, type PixelMode } from "../src/lib/color";
import { generatePattern, EmptyPaletteError } from "../src/lib/generate";
import { getColorByHex, getPalette, PALETTE_CHOICES } from "../src/lib/palette";
import { buildPattern, reduceColors, removeBorderBackground, tally, type GridCell, type ImagePixels } from "../src/lib/pixelate";

function noiseImage(width: number, height: number, seed: number): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Smooth gradient blocks plus noise: closer to a real picture than pure noise.
      data[i] = (x * 255) / width + rand() * 40;
      data[i + 1] = (y * 255) / height + rand() * 40;
      data[i + 2] = ((x + y) * 128) / (width + height) + rand() * 40;
      data[i + 3] = rand() < 0.03 ? 0 : 255;
    }
  }
  return { width, height, data };
}

/** The generation code exactly as it was inline in BeadStudio before the worker. */
async function legacyPipeline(
  image: ImagePixels,
  o: { cols: number; rows: number; paletteId: string; excluded: string[]; mode: PixelMode; threshold: number; metric: DistanceMetric; removeBg: boolean; maxColors: number; minCount: number },
) {
  const skip = new Set(o.excluded);
  const active = getPalette(o.paletteId).filter((color) => !skip.has(color.hex));
  const result = await buildPattern(image, { cols: o.cols, rows: o.rows, palette: active, mode: o.mode, threshold: o.threshold, metric: o.metric, yieldEvery: 2 });
  let next = result.grid;
  if (o.removeBg) next = removeBorderBackground(next).grid;
  if (o.maxColors > 0 || o.minCount > 0) next = reduceColors(next, o.maxColors, o.minCount, o.metric, getColorByHex).grid;
  return next;
}

const keyOf = (grid: GridCell[][]) => grid.map((row) => row.map((c) => c.hex + (c.isExternal ? "x" : "")).join(",")).join("\n");

test("generatePattern matches the previous inline pipeline cell for cell", async () => {
  const image = noiseImage(120, 90, 7);
  const cases = [
    { cols: 48, rows: 36, paletteId: "168", excluded: [], mode: "dominant", threshold: 30, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 },
    { cols: 29, rows: 22, paletteId: "291", excluded: ["#FD543D"], mode: "average", threshold: 15, metric: "ciede2000", removeBg: true, maxColors: 12, minCount: 0 },
    { cols: 60, rows: 45, paletteId: "72", excluded: [], mode: "dominant", threshold: 0, metric: "oklab", removeBg: true, maxColors: 0, minCount: 5 },
  ] as const;
  for (const c of cases) {
    const options = { ...c, excluded: [...c.excluded] };
    const next = await generatePattern(image, options);
    const old = await legacyPipeline(image, options);
    assert.equal(keyOf(next), keyOf(old), `mismatch for ${JSON.stringify(c)}`);
    assert.equal(next.length, c.rows);
    assert.equal(next[0].length, c.cols);
  }
});

test("empty palette is reported, not silently drawn", async () => {
  const all = getPalette("72").map((c) => c.hex);
  await assert.rejects(
    generatePattern(noiseImage(10, 10, 1), { cols: 10, rows: 10, paletteId: "72", excluded: all, mode: "dominant", threshold: 0, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 }),
    EmptyPaletteError,
  );
});

test("every palette color matches itself under both metrics", () => {
  for (const { id } of PALETTE_CHOICES) {
    const palette = getPalette(id);
    assert.ok(palette.length > 0, `palette ${id} empty`);
    for (const metric of ["oklab", "ciede2000"] as const) {
      for (const color of palette) {
        assert.equal(findClosest(color.rgb, palette, metric).hex, color.hex, `${id}/${metric}/${color.key}`);
      }
    }
  }
});

test("colour distance is symmetric and zero only for identical colours", () => {
  const a = { r: 10, g: 200, b: 30 };
  const b = { r: 200, g: 20, b: 90 };
  for (const metric of ["oklab", "ciede2000"] as const) {
    assert.equal(colorDistance(a, a, metric), 0);
    assert.ok(Math.abs(colorDistance(a, b, metric) - colorDistance(b, a, metric)) < 1e-9);
    assert.ok(colorDistance(a, b, metric) > 0);
  }
});

test("color cap never exceeds the limit and keeps the bead total", async () => {
  const image = noiseImage(80, 80, 3);
  for (const cap of [2, 5, 8, 20]) {
    const grid = await generatePattern(image, { cols: 40, rows: 40, paletteId: "291", excluded: [], mode: "average", threshold: 0, metric: "oklab", removeBg: false, maxColors: cap, minCount: 0 });
    const t = tally(grid);
    assert.ok(t.counts.length <= cap, `cap ${cap} gave ${t.counts.length}`);
    const uncapped = tally(await generatePattern(image, { cols: 40, rows: 40, paletteId: "291", excluded: [], mode: "average", threshold: 0, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 }));
    assert.equal(t.total, uncapped.total);
  }
});

test("usage list adds up to the beads on the board", async () => {
  const grid = await generatePattern(noiseImage(64, 64, 11), { cols: 32, rows: 32, paletteId: "168", excluded: [], mode: "dominant", threshold: 20, metric: "oklab", removeBg: true, maxColors: 0, minCount: 0 });
  const t = tally(grid);
  const placed = grid.flat().filter((c) => !c.isExternal).length;
  assert.equal(t.total, placed);
  assert.equal(t.counts.reduce((sum, c) => sum + c.count, 0), t.total);
  assert.equal(new Set(t.counts.map((c) => c.hex)).size, t.counts.length, "one row per colour");
});
