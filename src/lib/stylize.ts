/**
 * Style helpers around the core pipeline: image pre-processing before the grid
 * is sampled, and grid post-processing after colors are matched.
 * All functions are pure so they run in the worker and in tests.
 */

import type { PaletteColor } from "./color";
import type { GridCell, ImagePixels } from "./pixelate";

function colorGap(data: Uint8ClampedArray, i: number, r: number, g: number, b: number): number {
  return Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
}

/**
 * Crops the image to the subject so it fills the board. The subject is every
 * opaque pixel that differs from the dominant border color; the box is grown
 * to the board's aspect ratio and a small margin so nothing touches the edge.
 */
export function trimToSubject(image: ImagePixels, cols: number, rows: number, tolerance = 48): ImagePixels {
  const { width, height, data } = image;
  if (width < 4 || height < 4) return image;

  const border = new Map<number, number>();
  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) return;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    border.set(key, (border.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  let bgKey = -1;
  let best = 0;
  for (const [key, count] of border) {
    if (count > best) {
      best = count;
      bgKey = key;
    }
  }
  const bg = bgKey < 0 ? null : { r: ((bgKey >> 8) & 15) * 16 + 8, g: ((bgKey >> 4) & 15) * 16 + 8, b: (bgKey & 15) * 16 + 8 };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      if (bg && colorGap(data, i, bg.r, bg.g, bg.b) <= tolerance) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return image;

  let boxW = maxX - minX + 1;
  let boxH = maxY - minY + 1;
  const margin = 1 + 2 / Math.max(cols, rows);
  boxW *= margin;
  boxH *= margin;
  const aspect = cols / rows;
  if (boxW / boxH > aspect) boxH = boxW / aspect;
  else boxW = boxH * aspect;
  boxW = Math.min(width, Math.round(boxW));
  boxH = Math.min(height, Math.round(boxH));
  if (boxW >= width * 0.97 && boxH >= height * 0.97) return image;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x0 = Math.max(0, Math.min(width - boxW, Math.round(cx - boxW / 2)));
  const y0 = Math.max(0, Math.min(height - boxH, Math.round(cy - boxH / 2)));
  const out = new Uint8ClampedArray(boxW * boxH * 4);
  for (let y = 0; y < boxH; y++) {
    const from = ((y0 + y) * width + x0) * 4;
    out.set(data.subarray(from, from + boxW * 4), y * boxW * 4);
  }
  return { width: boxW, height: boxH, data: out };
}

/** Rounds each channel to a few levels for a flat, retro console look. */
export function posterize(image: ImagePixels, levels: number): ImagePixels {
  if (levels < 2) return image;
  const step = 255 / (levels - 1);
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(image.data[i] / step) * step;
    data[i + 1] = Math.round(image.data[i + 1] / step) * step;
    data[i + 2] = Math.round(image.data[i + 2] / step) * step;
    data[i + 3] = image.data[i + 3];
  }
  return { width: image.width, height: image.height, data };
}

/**
 * Lower detail: each pass replaces isolated beads and beads outvoted by a
 * clear majority of their 3×3 neighbours. Background cells are never filled or created.
 */
export function smoothGrid(grid: GridCell[][], passes: number): GridCell[][] {
  let current = grid;
  for (let pass = 0; pass < passes; pass++) {
    const rows = current.length;
    const cols = current[0]?.length ?? 0;
    const next = current.map((row) => row.map((cell) => ({ ...cell })));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = current[r][c];
        if (cell.isExternal) continue;
        const votes = new Map<string, { n: number; cell: GridCell }>();
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nb = current[r + dr]?.[c + dc];
            if (!nb || nb.isExternal) continue;
            const hit = votes.get(nb.hex);
            if (hit) hit.n += 1;
            else votes.set(nb.hex, { n: 1, cell: nb });
          }
        }
        let top: { n: number; cell: GridCell } | null = null;
        for (const vote of votes.values()) if (!top || vote.n > top.n) top = vote;
        // A bead with no same-color 4-neighbour is fiddly to place: give it the
        // most common neighbour color. Otherwise only flip on a clear majority.
        const lonely = ![current[r - 1]?.[c], current[r + 1]?.[c], current[r]?.[c - 1], current[r]?.[c + 1]]
          .some((nb) => nb && !nb.isExternal && nb.hex === cell.hex);
        if (top && top.cell.hex !== cell.hex && (top.n >= 5 || (lonely && top.n >= 2))) {
          next[r][c] = { key: top.cell.key, hex: top.cell.hex, isExternal: false };
        }
      }
    }
    current = next;
  }
  return current;
}

/** The darkest color of a palette, used for outlines. */
export function darkestColor(palette: PaletteColor[]): PaletteColor | undefined {
  let best: PaletteColor | undefined;
  for (const color of palette) if (!best || color.oklab.l < best.oklab.l) best = color;
  return best;
}

/**
 * Draws an outline around the subject on the background side, so the subject
 * itself keeps every bead. Needs a transparent background to have any effect.
 */
export function addOutline(grid: GridCell[][], color: PaletteColor, width: number): { grid: GridCell[][]; added: number } {
  let current = grid;
  let added = 0;
  for (let ring = 0; ring < width; ring++) {
    const rows = current.length;
    const cols = current[0]?.length ?? 0;
    const next = current.map((row) => row.map((cell) => ({ ...cell })));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!current[r][c].isExternal) continue;
        const touches = [current[r - 1]?.[c], current[r + 1]?.[c], current[r]?.[c - 1], current[r]?.[c + 1]]
          .some((nb) => nb && !nb.isExternal);
        if (touches) {
          next[r][c] = { key: color.key, hex: color.hex, isExternal: false };
          added += 1;
        }
      }
    }
    current = next;
  }
  return { grid: current, added };
}

export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyReport {
  level: Difficulty;
  label: string;
  beads: number;
  colors: number;
  /** Share of beads with no same-color neighbour: these are the fiddly ones. */
  scattered: number;
  reasons: string[];
}

/** A rough, explainable difficulty hint from size, color count and scattered beads. */
export function assessDifficulty(grid: GridCell[][]): DifficultyReport {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const colors = new Set<string>();
  let beads = 0;
  let lonely = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.isExternal) continue;
      beads += 1;
      colors.add(cell.hex);
      const same = [grid[r - 1]?.[c], grid[r + 1]?.[c], grid[r]?.[c - 1], grid[r]?.[c + 1]].some(
        (nb) => nb && !nb.isExternal && nb.hex === cell.hex,
      );
      if (!same) lonely += 1;
    }
  }
  const scattered = beads ? lonely / beads : 0;
  let score = 0;
  const reasons: string[] = [];
  if (beads > 2500) {
    score += 2;
    reasons.push(`豆子多（${beads} 颗）`);
  } else if (beads > 900) {
    score += 1;
    reasons.push(`豆子较多（${beads} 颗）`);
  }
  if (colors.size > 24) {
    score += 2;
    reasons.push(`颜色多（${colors.size} 色）`);
  } else if (colors.size > 12) {
    score += 1;
    reasons.push(`颜色较多（${colors.size} 色）`);
  }
  if (scattered > 0.15) {
    score += 2;
    reasons.push(`零散单颗多（${Math.round(scattered * 100)}%）`);
  } else if (scattered > 0.06) {
    score += 1;
    reasons.push(`有些零散单颗（${Math.round(scattered * 100)}%）`);
  }
  const level: Difficulty = score >= 4 ? "hard" : score >= 2 ? "medium" : "easy";
  const label = level === "hard" ? "较难" : level === "medium" ? "中等" : "入门";
  if (reasons.length === 0) reasons.push("尺寸小、颜色少、色块完整");
  return { level, label, beads, colors: colors.size, scattered, reasons };
}

