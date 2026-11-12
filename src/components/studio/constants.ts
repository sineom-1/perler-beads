export type Tool = "view" | "brush" | "fill" | "eraser" | "pick";
export type StyleId = "cartoon" | "pixel" | "simplePixel" | "photo" | "simple" | "lowColor" | "retro" | "chibi" | "custom";
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

/** Extra style controls applied around the core color matching. */
export interface Look {
  dither: number;
  smooth: number;
  outline: number;
  trim: boolean;
  posterize: number;
}
export const PLAIN_LOOK: Look = { dither: 0, smooth: 0, outline: 0, trim: false, posterize: 0 };

type Preset = { name: string; hint: string; mode: "dominant" | "average"; metric: "oklab" | "ciede2000"; threshold: number; maxColors: number; look: Look; removeBg?: boolean };

export const STYLE_PRESETS: Record<Exclude<StyleId, "custom">, Preset> = {
  cartoon: { name: "卡通", hint: "色块干净，适合插画和表情包", mode: "dominant", metric: "oklab", threshold: 30, maxColors: 0, look: PLAIN_LOOK },
  pixel: { name: "像素画", hint: "逐格取色，适合本来就是像素风的图", mode: "dominant", metric: "oklab", threshold: 0, maxColors: 0, look: PLAIN_LOOK },
  simplePixel: { name: "简化像素", hint: "抹掉零碎单颗，最多 16 色", mode: "dominant", metric: "oklab", threshold: 20, maxColors: 16, look: { ...PLAIN_LOOK, smooth: 1 } },
  photo: { name: "照片", hint: "保留过渡，可配合抖动", mode: "average", metric: "ciede2000", threshold: 15, maxColors: 0, look: PLAIN_LOOK },
  simple: { name: "简洁", hint: "大幅合并相近色", mode: "dominant", metric: "oklab", threshold: 50, maxColors: 0, look: PLAIN_LOOK },
  lowColor: { name: "低色数", hint: "最多 8 色，买豆少、上手快", mode: "dominant", metric: "oklab", threshold: 30, maxColors: 8, look: { ...PLAIN_LOOK, smooth: 1 } },
  retro: { name: "复古 8-bit", hint: "色阶压平，16 色以内的游戏机味", mode: "dominant", metric: "oklab", threshold: 0, maxColors: 16, look: { ...PLAIN_LOOK, posterize: 4 } },
  chibi: { name: "Q 版", hint: "裁到主体放大、去背景、加粗描边、少色。头像建议先裁出头部", mode: "dominant", metric: "oklab", threshold: 30, maxColors: 12, look: { dither: 0, smooth: 1, outline: 1, trim: true, posterize: 0 }, removeBg: true },
};

export function sameLook(a: Look, b: Look): boolean {
  return a.dither === b.dither && a.smooth === b.smooth && a.outline === b.outline && a.trim === b.trim && a.posterize === b.posterize;
}
export const SOURCE_URL = "https://github.com/sineom-1/perler-beads";
