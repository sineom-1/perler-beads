/**
 * Runs generatePattern in a Web Worker so big grids don't freeze the page.
 * A newer request terminates any job still running; without Worker support
 * it falls back to the main thread.
 */

import { generatePattern, type GenerateOptions } from "./generate";
import type { GridCell, ImagePixels } from "./pixelate";
import type { PatternResponse } from "../workers/pattern.worker";

export class PatternCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "PatternCancelled";
  }
}

let worker: Worker | null = null;
let seq = 0;
let pending: { id: number; reject: (error: Error) => void } | null = null;

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/pattern.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

export function requestPattern(
  image: ImagePixels,
  options: GenerateOptions,
  onProgress?: (ratio: number) => void,
): Promise<GridCell[][]> {
  const id = ++seq;
  if (pending) {
    // A job is still running: stop it rather than queue behind it.
    pending.reject(new PatternCancelled());
    pending = null;
    worker?.terminate();
    worker = null;
  }
  worker ??= createWorker();
  const active = worker;
  if (!active) return generatePattern(image, options, onProgress, 2);

  return new Promise((resolve, reject) => {
    pending = { id, reject };
    active.onmessage = (event: MessageEvent<PatternResponse>) => {
      const data = event.data;
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress?.(data.ratio);
        return;
      }
      pending = null;
      if (data.type === "done") resolve(data.grid);
      else reject(new Error(data.message));
    };
    active.onerror = (event) => {
      pending = null;
      worker?.terminate();
      worker = null;
      reject(new Error(event.message || "后台计算出错"));
    };
    // Copy the pixels: the caller keeps its own buffer for later runs.
    active.postMessage({ id, image: { width: image.width, height: image.height, data: image.data }, options });
  });
}
