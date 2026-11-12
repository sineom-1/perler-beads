/**
 * The full image → pattern pipeline, free of DOM and React so it can run in a
 * Web Worker, on the main thread as a fallback, and in tests.
 */

import type { DistanceMetric, PixelMode } from "./color";
import { getColorByHex, getPalette } from "./palette";
import { buildPattern, reduceColors, removeBorderBackground, type GridCell, type ImagePixels } from "./pixelate";
import { addOutline, darkestColor, posterize, smoothGrid, trimToSubject } from "./stylize";

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
  /** Floyd–Steinberg strength 0–1. */
  dither?: number;
  /** Majority-filter passes: 0 keeps every detail, 2 is the simplest. */
  smooth?: number;
  /** Outline thickness in beads around the subject; needs a removed background. */
  outline?: number;
  /** Crop the image to the subject before sampling (Q-style close-up). */
  trim?: boolean;
  /** Levels per channel for a retro look; 0 is off. */
  posterize?: number;
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
  let source = image;
  if (options.trim) source = trimToSubject(source, options.cols, options.rows);
  if (options.posterize && options.posterize > 1) source = posterize(source, options.posterize);
  const result = await buildPattern(source, {
    cols: options.cols,
    rows: options.rows,
    palette: active,
    mode: options.mode,
    threshold: options.threshold,
    metric: options.metric,
    yieldEvery,
    onProgress,
    dither: options.dither,
  });
  let next = result.grid;
  if (options.removeBg || (options.outline ?? 0) > 0) next = removeBorderBackground(next).grid;
  if (options.smooth && options.smooth > 0) next = smoothGrid(next, options.smooth);
  if (options.maxColors > 0 || options.minCount > 0) {
    next = reduceColors(next, options.maxColors, options.minCount, options.metric, getColorByHex).grid;
  }
  if (options.outline && options.outline > 0) {
    const ink = darkestColor(active);
    if (ink) next = addOutline(next, ink, options.outline).grid;
  }
  return next;
}
