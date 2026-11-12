/** Image helpers for the studio: sizing, cropping and previews. */

import type { CropRect } from "@/components/studio/constants";
import { ERASED_CELL, type GridCell, type ImagePixels } from "./pixelate";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function autoRows(columns: number, image: ImagePixels) {
  return clamp(Math.round(columns * (image.height / image.width)), 8, 180);
}

export function emptyGrid(cols: number, rows: number): GridCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ...ERASED_CELL })));
}

export function pixelsToUrl(pixels: ImagePixels) {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas.toDataURL("image/png");
}

export function fullRect(pixels: ImagePixels): CropRect {
  return { x: 0, y: 0, w: pixels.width, h: pixels.height };
}

export function aspectCrop(pixels: ImagePixels, aw: number, ah: number): CropRect {
  let w = pixels.width;
  let h = Math.round((w * ah) / aw);
  if (h > pixels.height) {
    h = pixels.height;
    w = Math.round((h * aw) / ah);
  }
  w = Math.max(1, Math.min(pixels.width, w));
  h = Math.max(1, Math.min(pixels.height, h));
  return {
    x: Math.round((pixels.width - w) / 2),
    y: Math.round((pixels.height - h) / 2),
    w,
    h,
  };
}

export function cropPixels(pixels: ImagePixels, rect: CropRect): ImagePixels {
  const canvas = document.createElement("canvas");
  canvas.width = rect.w;
  canvas.height = rect.h;
  const context = canvas.getContext("2d");
  const source = document.createElement("canvas");
  source.width = pixels.width;
  source.height = pixels.height;
  source.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  context?.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = context?.getImageData(0, 0, rect.w, rect.h);
  if (!data) return pixels;
  return { width: rect.w, height: rect.h, data: data.data };
}
