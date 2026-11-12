export type Tool = "view" | "brush" | "fill" | "eraser" | "pick";
export type StyleId = "cartoon" | "pixel" | "photo" | "simple" | "custom";
export type Shape = "round" | "square";
export type CropRect = { x: number; y: number; w: number; h: number };
export type CropRatio = "full" | "1:1" | "3:4" | "4:3";
export const CROP_RATIOS: { key: CropRatio; label: string; aspect: [number, number] | null }[] = [
  { key: "full", label: "原图", aspect: null },
  { key: "1:1", label: "1:1", aspect: [1, 1] },
  { key: "3:4", label: "3:4", aspect: [3, 4] },
  { key: "4:3", label: "4:3", aspect: [4, 3] },
];
export type SheetTab = "size" | "style" | "clean" | "colors" | "advanced";

export const BOARDS = [16, 29, 48, 58, 87];

export const STYLE_PRESETS = {
  cartoon: { mode: "dominant", metric: "oklab", threshold: 30 },
  pixel: { mode: "dominant", metric: "oklab", threshold: 0 },
  photo: { mode: "average", metric: "ciede2000", threshold: 15 },
  simple: { mode: "dominant", metric: "oklab", threshold: 50 },
} as const;
export const SOURCE_URL = "https://github.com/sineom-1/perler-beads";
