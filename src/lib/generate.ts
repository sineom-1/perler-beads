/**
 * The full image → pattern pipeline, free of DOM and React so it can run in a
 * Web Worker, on the main thread as a fallback, and in tests.
 */

import type { DistanceMetric, PixelMode } from "./color";
import { getColorByHex, getPalette } from "./palette";
import { buildPattern, reduceColors, removeBorderBackground, type GridCell, type ImagePixels } from "./pixelate";

export interface GenerateOptions {
  cols: number;
  rows: number;
  paletteId: string;
  excluded: string[];
  mode: PixelMode;
  threshold: number;
  metric: DistanceMetric;
  removeBg: boolean;
  maxColors: number;
  minCount: number;
}

export class EmptyPaletteError extends Error {
  constructor() {
    super("可用颜色为空，请先恢复已排除的颜色。");
    this.name = "EmptyPaletteError";
  }
}

export async function generatePattern(
  image: ImagePixels,
  options: GenerateOptions,
  onProgress?: (ratio: number) => void,
  yieldEvery?: number,
): Promise<GridCell[][]> {
  const skip = new Set(options.excluded);
  const active = getPalette(options.paletteId).filter((color) => !skip.has(color.hex));
  if (active.length === 0) throw new EmptyPaletteError();
  const result = await buildPattern(image, {
    cols: options.cols,
    rows: options.rows,
    palette: active,
    mode: options.mode,
    threshold: options.threshold,
    metric: options.metric,
    yieldEvery,
    onProgress,
  });
  let next = result.grid;
  if (options.removeBg) next = removeBorderBackground(next).grid;
  if (options.maxColors > 0 || options.minCount > 0) {
    next = reduceColors(next, options.maxColors, options.minCount, options.metric, getColorByHex).grid;
  }
  return next;
}
