/**
 * Image → bead grid.
 *
 * Dominant-color sampling and border flood-fill follow Zippland/perler-beads
 * (AGPL-3.0, Copyright (C) Zippland). Similar colors are merged with the
 * upstream region walk: 4-connected cells within the threshold of the region
 * seed become one region and take its most frequent bead color.
 */

import {
  findClosest,
  paletteDistance,
  type DistanceMetric,
  type PaletteColor,
  type PixelMode,
  type Rgb,
} from "./color";

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface GridCell {
  key: string;
  hex: string;
  isExternal: boolean;
}

export interface ColorCount {
  hex: string;
  key: string;
  count: number;
}

export const ERASED_CELL: GridCell = { key: "ERASE", hex: "#FFFFFF", isExternal: true };

export interface BuildOptions {
  cols: number;
  rows: number;
  palette: PaletteColor[];
  mode: PixelMode;
  threshold: number;
  metric: DistanceMetric;
  onProgress?: (ratio: number) => void;
  yieldEvery?: number;
  /** Floyd–Steinberg error diffusion strength, 0 (off) to 1 (full). */
  dither?: number;
}

function representative(
  data: Uint8ClampedArray,
  imageWidth: number,
  startX: number,
  startY: number,
  width: number,
  height: number,
  mode: PixelMode,
): Rgb | null {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  const histogram = new Map<number, number>();
  let bestCount = 0;
  let best: Rgb | null = null;
  const endX = startX + width;
  const endY = startY + height;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * imageWidth + x) * 4;
      if (data[index + 3] < 128) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      count++;
      if (mode === "average") {
        rSum += r;
        gSum += g;
        bSum += b;
      } else {
        const packed = (r << 16) | (g << 8) | b;
        const next = (histogram.get(packed) ?? 0) + 1;
        histogram.set(packed, next);
        if (next > bestCount) {
          bestCount = next;
          best = { r, g, b };
        }
      }
    }
  }

  if (count === 0) return null;
  if (mode === "average") {
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    };
  }
  return best;
}

function mergeRegions(
  grid: GridCell[][],
  palette: PaletteColor[],
  threshold: number,
  metric: DistanceMetric,
): GridCell[][] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (threshold <= 0 || rows === 0 || cols === 0) {
    return grid.map((row) => row.map((cell) => ({ ...cell })));
  }

  const byHex = new Map(palette.map((color) => [color.hex, color]));
  const distance = (left: string, right: string) => {
    if (left === right) return 0;
    const a = byHex.get(left);
    const b = byHex.get(right);
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return paletteDistance(a, b, metric);
  };

  const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const merged = grid.map((row) => row.map((cell) => ({ ...cell })));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (visited[row][col]) continue;
      const seed = grid[row][col];
      if (seed.isExternal) {
        visited[row][col] = true;
        continue;
      }

      const region: { r: number; c: number }[] = [];
      const frequency = new Map<string, { count: number; key: string }>();
      const queue = [{ r: row, c: col }];
      let head = 0;
      visited[row][col] = true;

      while (head < queue.length) {
        const current = queue[head++];
        const cell = grid[current.r][current.c];
        if (cell.isExternal) continue;
        const isSeed = current.r === row && current.c === col;
        if (!isSeed && distance(seed.hex, cell.hex) >= threshold) continue;

        region.push(current);
        const previous = frequency.get(cell.hex);
        if (previous) previous.count += 1;
        else frequency.set(cell.hex, { count: 1, key: cell.key });

        const neighbors = [
          [current.r + 1, current.c],
          [current.r - 1, current.c],
          [current.r, current.c + 1],
          [current.r, current.c - 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || visited[nr][nc]) continue;
          const neighbor = grid[nr][nc];
          if (neighbor.isExternal || distance(seed.hex, neighbor.hex) >= threshold) continue;
          visited[nr][nc] = true;
          queue.push({ r: nr, c: nc });
        }
      }

      let dominantHex = seed.hex;
      let dominantKey = seed.key;
      let maxCount = -1;
      for (const [hex, info] of frequency) {
        if (info.count > maxCount) {
          maxCount = info.count;
          dominantHex = hex;
          dominantKey = info.key;
        }
      }
      // Oklab×100 / CIEDE2000 of ~10 is "nearby beads". Yellow vs white is ~22,
      // bright green vs white is ~28. A threshold of 30 therefore reaches
      // clearly different colors. Majority recoloring must not repaint a
      // large area of one of those colors; only speckles may cross that gap.
      const noiseMax = Math.max(8, Math.round((rows * cols) * 0.005));
      const largeGap = Math.min(threshold, 10);
      for (const spot of region) {
        const cell = grid[spot.r][spot.c];
        const count = frequency.get(cell.hex)?.count ?? 0;
        const gap = distance(cell.hex, dominantHex);
        if (count > noiseMax && gap >= largeGap) {
          merged[spot.r][spot.c] = { key: cell.key, hex: cell.hex, isExternal: false };
        } else {
          merged[spot.r][spot.c] = { key: dominantKey, hex: dominantHex, isExternal: false };
        }
      }
    }
  }

  return merged;
}

export function tally(grid: GridCell[][]): { counts: ColorCount[]; total: number } {
  const map = new Map<string, ColorCount>();
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.isExternal || cell.key === "ERASE") continue;
      total += 1;
      const current = map.get(cell.hex);
      if (current) current.count += 1;
      else map.set(cell.hex, { hex: cell.hex, key: cell.key, count: 1 });
    }
  }
  return { counts: [...map.values()], total };
}

export async function buildPattern(
  image: ImagePixels,
  options: BuildOptions,
): Promise<{ grid: GridCell[][]; counts: ColorCount[]; total: number }> {
  const { width, height, data } = image;
  const { cols, rows, palette, mode, threshold, metric, onProgress, yieldEvery = 0 } = options;
  const dither = Math.max(0, Math.min(1, options.dither ?? 0));
  let errorRow = new Float32Array((cols + 2) * 3);
  let errorNext = new Float32Array((cols + 2) * 3);
  if (palette.length === 0) throw new Error("当前色板没有可用颜色");
  if (cols < 1 || rows < 1) throw new Error("网格尺寸无效");

  const cache = new Map<string, PaletteColor>();
  const closest = (rgb: Rgb) => {
    const id = `${rgb.r},${rgb.g},${rgb.b}`;
    const hit = cache.get(id);
    if (hit) return hit;
    const found = findClosest(rgb, palette, metric);
    cache.set(id, found);
    return found;
  };

  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const grid: GridCell[][] = [];

  for (let row = 0; row < rows; row++) {
    const line: GridCell[] = [];
    const startY = Math.floor(row * cellHeight);
    const endY = Math.min(height, Math.ceil((row + 1) * cellHeight));
    const sampleHeight = Math.max(1, endY - startY);
    for (let col = 0; col < cols; col++) {
      const startX = Math.floor(col * cellWidth);
      const endX = Math.min(width, Math.ceil((col + 1) * cellWidth));
      const sampleWidth = Math.max(1, endX - startX);
      const rgb = representative(data, width, startX, startY, sampleWidth, sampleHeight, mode);
      if (!rgb) {
        line.push({ ...ERASED_CELL });
      } else if (dither > 0) {
        const at = (col + 1) * 3;
        const want = {
          r: Math.max(0, Math.min(255, Math.round(rgb.r + errorRow[at] * dither))),
          g: Math.max(0, Math.min(255, Math.round(rgb.g + errorRow[at + 1] * dither))),
          b: Math.max(0, Math.min(255, Math.round(rgb.b + errorRow[at + 2] * dither))),
        };
        const bead = closest(want);
        line.push({ key: bead.key, hex: bead.hex, isExternal: false });
        const diff = [want.r - bead.rgb.r, want.g - bead.rgb.g, want.b - bead.rgb.b];
        for (let k = 0; k < 3; k++) {
          errorRow[at + 3 + k] += (diff[k] * 7) / 16;
          errorNext[at - 3 + k] += (diff[k] * 3) / 16;
          errorNext[at + k] += (diff[k] * 5) / 16;
          errorNext[at + 3 + k] += diff[k] / 16;
        }
      } else {
        const bead = closest(rgb);
        line.push({ key: bead.key, hex: bead.hex, isExternal: false });
      }
    }
    grid.push(line);
    if (dither > 0) {
      [errorRow, errorNext] = [errorNext, errorRow];
      errorNext.fill(0);
    }
    if (yieldEvery > 0 && row % yieldEvery === 0) {
      onProgress?.(0.05 + (row / rows) * 0.8);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(0.9);
  const merged = mergeRegions(grid, palette, threshold, metric);
  const totals = tally(merged);
  onProgress?.(1);
  return { grid: merged, ...totals };
}

export function removeBorderBackground(grid: GridCell[][]): {
  grid: GridCell[][];
  removed: number;
  hex: string | null;
} {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return { grid, removed: 0, hex: null };

  const borderCounts = new Map<string, number>();
  const consider = (row: number, col: number) => {
    const cell = grid[row][col];
    if (!cell || cell.isExternal) return;
    borderCounts.set(cell.hex, (borderCounts.get(cell.hex) ?? 0) + 1);
  };
  for (let col = 0; col < cols; col++) {
    consider(0, col);
    if (rows > 1) consider(rows - 1, col);
  }
  for (let row = 1; row < rows - 1; row++) {
    consider(row, 0);
    if (cols > 1) consider(row, cols - 1);
  }
  if (borderCounts.size === 0) return { grid, removed: 0, hex: null };

  let hex = "";
  let best = -1;
  for (const [candidate, count] of borderCounts) {
    if (count > best) {
      best = count;
      hex = candidate;
    }
  }

  const next = grid.map((row) => row.map((cell) => ({ ...cell })));
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack: { r: number; c: number }[] = [];
  const push = (row: number, col: number) => {
    if (row < 0 || col < 0 || row >= rows || col >= cols || seen[row][col]) return;
    const cell = next[row][col];
    if (!cell || cell.isExternal || cell.hex !== hex) return;
    seen[row][col] = true;
    stack.push({ r: row, c: col });
  };
  for (let col = 0; col < cols; col++) {
    push(0, col);
    if (rows > 1) push(rows - 1, col);
  }
  for (let row = 1; row < rows - 1; row++) {
    push(row, 0);
    if (cols > 1) push(row, cols - 1);
  }

  let removed = 0;
  while (stack.length > 0) {
    const { r, c } = stack.pop()!;
    next[r][c] = { ...ERASED_CELL };
    removed += 1;
    push(r - 1, c);
    push(r + 1, c);
    push(r, c - 1);
    push(r, c + 1);
  }
  return { grid: next, removed, hex };
}

export function remapColor(
  grid: GridCell[][],
  source: PaletteColor,
  targets: PaletteColor[],
  metric: DistanceMetric,
): { grid: GridCell[][]; replaced: number; replacement: PaletteColor } {
  const replacement = findClosest(source.rgb, targets, metric);
  let replaced = 0;
  const next = grid.map((row) =>
    row.map((cell) => {
      if (!cell.isExternal && cell.hex === source.hex) {
        replaced += 1;
        return { key: replacement.key, hex: replacement.hex, isExternal: false };
      }
      return { ...cell };
    }),
  );
  return { grid: next, replaced, replacement };
}

export function paintCell(grid: GridCell[][], row: number, col: number, color: PaletteColor | null): GridCell[][] {
  return grid.map((line, r) =>
    line.map((cell, c) => {
      if (r !== row || c !== col) return cell;
      if (!color) return { ...ERASED_CELL };
      return { key: color.key, hex: color.hex, isExternal: false };
    }),
  );
}

export function replaceHex(
  grid: GridCell[][],
  fromHex: string,
  color: PaletteColor,
): { grid: GridCell[][]; replaced: number } {
  let replaced = 0;
  const next = grid.map((row) =>
    row.map((cell) => {
      if (!cell.isExternal && cell.hex === fromHex) {
        replaced += 1;
        return { key: color.key, hex: color.hex, isExternal: false };
      }
      return { ...cell };
    }),
  );
  return { grid: next, replaced };
}

export function floodFillPaint(grid: GridCell[][], row: number, col: number, color: PaletteColor): GridCell[][] {
  const start = grid[row]?.[col];
  if (!start) return grid;
  if (!start.isExternal && start.hex === color.hex) return grid;
  const rows = grid.length;
  const cols = grid[0].length;
  const same = (cell: GridCell) =>
    start.isExternal ? cell.isExternal : !cell.isExternal && cell.hex === start.hex;
  const next = cloneGrid(grid);
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack = [{ r: row, c: col }];
  seen[row][col] = true;
  while (stack.length > 0) {
    const current = stack.pop()!;
    next[current.r][current.c] = { key: color.key, hex: color.hex, isExternal: false };
    for (const [nr, nc] of [
      [current.r + 1, current.c],
      [current.r - 1, current.c],
      [current.r, current.c + 1],
      [current.r, current.c - 1],
    ]) {
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen[nr][nc]) continue;
      if (!same(next[nr][nc])) continue;
      seen[nr][nc] = true;
      stack.push({ r: nr, c: nc });
    }
  }
  return next;
}

export function floodErase(grid: GridCell[][], row: number, col: number): GridCell[][] {
  const start = grid[row]?.[col];
  if (!start || start.isExternal) return grid;
  const rows = grid.length;
  const cols = grid[0].length;
  const hex = start.hex;
  const next = grid.map((line) => line.map((cell) => ({ ...cell })));
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack = [{ r: row, c: col }];
  seen[row][col] = true;
  while (stack.length > 0) {
    const current = stack.pop()!;
    next[current.r][current.c] = { ...ERASED_CELL };
    const neighbors = [
      [current.r + 1, current.c],
      [current.r - 1, current.c],
      [current.r, current.c + 1],
      [current.r, current.c - 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen[nr][nc]) continue;
      const cell = next[nr][nc];
      if (!cell.isExternal && cell.hex === hex) {
        seen[nr][nc] = true;
        stack.push({ r: nr, c: nc });
      }
    }
  }
  return next;
}

export function cloneGrid(grid: GridCell[][]): GridCell[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * Cap the number of colors and fold rare colors into their nearest neighbor.
 * Repeatedly takes the least-used color; while it is under `minCount` beads or
 * the pattern still has more than `maxColors` colors, its cells become the
 * closest color that remains in the pattern. 0 disables either limit.
 */
export function reduceColors(
  grid: GridCell[][],
  maxColors: number,
  minCount: number,
  metric: DistanceMetric,
  lookup: (hex: string) => PaletteColor | undefined,
): { grid: GridCell[][]; merged: number } {
  const { counts } = tally(grid);
  const live = new Map(counts.map((item) => [item.hex, item.count]));
  const remap = new Map<string, string>();
  let merged = 0;
  while (live.size > 1) {
    let rareHex = "";
    let rareCount = Number.POSITIVE_INFINITY;
    for (const [hex, count] of live) {
      if (count < rareCount) {
        rareCount = count;
        rareHex = hex;
      }
    }
    const tooMany = maxColors > 0 && live.size > maxColors;
    const tooRare = minCount > 0 && rareCount < minCount;
    if (!tooMany && !tooRare) break;
    const source = lookup(rareHex);
    let targetHex = "";
    let best = Number.POSITIVE_INFINITY;
    for (const hex of live.keys()) {
      if (hex === rareHex) continue;
      const candidate = lookup(hex);
      const gap = source && candidate ? paletteDistance(source, candidate, metric) : Number.POSITIVE_INFINITY;
      if (!targetHex || gap < best) {
        best = gap;
        targetHex = hex;
      }
    }
    live.delete(rareHex);
    live.set(targetHex, (live.get(targetHex) ?? 0) + rareCount);
    remap.set(rareHex, targetHex);
    merged += 1;
  }
  if (remap.size === 0) return { grid, merged: 0 };
  const resolve = (hex: string) => {
    let current = hex;
    while (remap.has(current)) current = remap.get(current)!;
    return current;
  };
  const next = grid.map((row) =>
    row.map((cell) => {
      if (cell.isExternal || !remap.has(cell.hex)) return { ...cell };
      const hex = resolve(cell.hex);
      const color = lookup(hex);
      return { key: color?.key ?? cell.key, hex, isExternal: false };
    }),
  );
  return { grid: next, merged };
}
