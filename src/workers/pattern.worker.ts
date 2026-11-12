/// <reference lib="webworker" />
import { generatePattern, type GenerateOptions } from "../lib/generate";
import type { ImagePixels } from "../lib/pixelate";

export type PatternRequest = { id: number; image: ImagePixels; options: GenerateOptions };
export type PatternResponse =
  | { id: number; type: "progress"; ratio: number }
  | { id: number; type: "done"; grid: import("../lib/pixelate").GridCell[][] }
  | { id: number; type: "error"; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<PatternRequest>) => {
  const { id, image, options } = event.data;
  let last = 0;
  try {
    const grid = await generatePattern(image, options, (ratio) => {
      if (ratio - last < 0.02 && ratio < 1) return;
      last = ratio;
      scope.postMessage({ id, type: "progress", ratio } satisfies PatternResponse);
    });
    scope.postMessage({ id, type: "done", grid } satisfies PatternResponse);
  } catch (error) {
    scope.postMessage({ id, type: "error", message: error instanceof Error ? error.message : "生成失败" } satisfies PatternResponse);
  }
};
