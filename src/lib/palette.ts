/**
 * Brand color systems and preset palette sizes.
 * The 291-color map and the 72/96/120/144 key lists are adapted from
 * Zippland/perler-beads (https://github.com/Zippland/perler-beads),
 * Copyright (C) Zippland, AGPL-3.0.
 * The published 168-color array upstream only contained 144 codes; this app
 * extends that 144-color list with the next 23 MARD codes so the 168 option
 * really enables 168 colors. 96/120/144 include the upstream extra white bead T1.
 *
 * Artkal S/C/M colors come from Artkal's published RGB charts, partly via
 * HansBug/pindou-color-data (MIT, Copyright (c) 2026 HansBug). Perler colors are
 * sampled from the official product swatch photos and are estimates.
 * This app is not affiliated with any bead brand.
 */

import mappingJson from "../data/colorSystemMapping.json";
import brandJson from "../data/brandPalettes.json";
import presetJson from "../data/palettePresets.json";
import { enrichColor, hexToRgb, type PaletteColor } from "./color";

/** Domestic systems share one community-maintained 291-color base and only differ in codes. */
export const COMMUNITY_SYSTEMS = ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"] as const;
type CommunitySystem = (typeof COMMUNITY_SYSTEMS)[number];

export interface BrandColor {
  code: string;
  hex: string;
  name?: string;
  finish?: string;
  estimated?: boolean;
}

interface BrandPalette {
  id: string;
  label: string;
  brand: string;
  series: string;
  source: string;
  colors: BrandColor[];
}

const brands = brandJson as BrandPalette[];

/** International brands keep their own colors; codes are matched only inside the chosen brand. */
export const BRAND_SYSTEMS = brands.map((item) => item.label);

export const COLOR_SYSTEMS: string[] = [...COMMUNITY_SYSTEMS, ...BRAND_SYSTEMS];
export type ColorSystem = string;

type Mapping = Record<string, Record<CommunitySystem, string>>;

const mapping = mappingJson as Mapping;
const presets = presetJson as Record<string, string[]>;

export const PALETTE_CHOICES: { id: string; name: string }[] = [
  { id: "72", name: "72 色" },
  { id: "96", name: "96 色" },
  { id: "120", name: "120 色" },
  { id: "144", name: "144 色" },
  { id: "168", name: "168 色" },
  { id: "291", name: "291 色（全部）" },
];

export const SPECIAL_FINISH_LABEL: Record<string, string> = {
  transparent: "透明",
  clear: "透明",
  glow: "夜光",
  metallic: "金属",
  pearl: "珠光",
  glitter: "闪粉",
};

const SPECIAL_SUFFIX = "+special";

function brandBySystem(system: ColorSystem): BrandPalette | undefined {
  return brands.find((item) => item.label === system);
}

function brandByPaletteId(id: string): { brand: BrandPalette; special: boolean } | undefined {
  const special = id.endsWith(SPECIAL_SUFFIX);
  const base = special ? id.slice(0, -SPECIAL_SUFFIX.length) : id;
  const brand = brands.find((item) => item.id === base);
  return brand ? { brand, special } : undefined;
}

export function isCommunitySystem(system: ColorSystem): boolean {
  return (COMMUNITY_SYSTEMS as readonly string[]).includes(system);
}

/** Palette options for the size dropdown of a given system. */
export function paletteChoicesFor(system: ColorSystem): { id: string; name: string }[] {
  const brand = brandBySystem(system);
  if (!brand) return PALETTE_CHOICES;
  const plain = brand.colors.filter((color) => !color.finish).length;
  const choices = [{ id: brand.id, name: `${plain} 色（常规色）` }];
  if (plain < brand.colors.length) {
    choices.push({ id: brand.id + SPECIAL_SUFFIX, name: `${brand.colors.length} 色（含透明/夜光/金属等）` });
  }
  return choices;
}

export function defaultPaletteFor(system: ColorSystem): string {
  return isCommunitySystem(system) ? "168" : paletteChoicesFor(system)[0].id;
}

/** Keeps the current palette when it belongs to the system, otherwise falls back to its default. */
export function paletteForSystem(system: ColorSystem, paletteId: string): string {
  return paletteChoicesFor(system).some((choice) => choice.id === paletteId) ? paletteId : defaultPaletteFor(system);
}

export function paletteLabel(system: ColorSystem, paletteId: string): string {
  return paletteChoicesFor(system).find((choice) => choice.id === paletteId)?.name ?? "";
}

/** Bead pitch implied by the brand series, when the system pins one down. */
export function systemPitchMm(system: ColorSystem): number | undefined {
  const brand = brandBySystem(system);
  if (!brand) return undefined;
  return brand.series.includes("2.6mm") ? 2.6 : 5;
}

/** One-line provenance note shown next to the brand switcher. */
export function systemNote(system: ColorSystem): string {
  const brand = brandBySystem(system);
  if (!brand) return "社区参考色卡：色值来自公开整理，非品牌官方数据。屏幕色仅供参考，以实物为准。";
  const estimate = brand.colors.some((color) => color.estimated) && brand.colors.every((color) => color.estimated)
    ? "色值为估算，偏差可能较大。"
    : "";
  return `${brand.brand} ${brand.series}，${brand.source}。${estimate}屏幕色仅供参考，以实物为准。本站与品牌无关联。`;
}

let fullPalette: PaletteColor[] | null = null;

export function getAllColors(): PaletteColor[] {
  if (fullPalette) return fullPalette;
  fullPalette = Object.entries(mapping).map(([hex, systems]) => {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      throw new Error(`无效色值 ${hex}`);
    }
    return enrichColor({ key: systems.MARD, hex, rgb });
  });
  return fullPalette;
}

const byHex = new Map<string, PaletteColor>();
const byKey = new Map<string, PaletteColor>();
const brandColors = new Map<string, PaletteColor[]>();
const brandCodeByHex = new Map<string, Map<string, BrandColor>>();

function indexes() {
  if (byHex.size > 0) return;
  for (const color of getAllColors()) {
    byHex.set(color.hex, color);
    byKey.set(color.key, color);
  }
  for (const brand of brands) {
    const list: PaletteColor[] = [];
    const codes = new Map<string, BrandColor>();
    for (const item of brand.colors) {
      const rgb = hexToRgb(item.hex);
      if (!rgb) throw new Error(`无效色值 ${brand.label} ${item.code}`);
      const color = enrichColor({ key: item.code, hex: item.hex, rgb });
      list.push(color);
      codes.set(color.hex, item);
      // Shared lookup only needs hex -> rgb/lab; codes are resolved per system in displayCode.
      if (!byHex.has(color.hex)) byHex.set(color.hex, color);
    }
    brandColors.set(brand.id, list);
    brandCodeByHex.set(brand.label, codes);
  }
}

export function getColorByHex(hex: string): PaletteColor | undefined {
  indexes();
  return byHex.get(hex.toUpperCase());
}

export function getPalette(id: string): PaletteColor[] {
  indexes();
  const brand = brandByPaletteId(id);
  if (brand) {
    const list = brandColors.get(brand.brand.id) ?? [];
    if (brand.special) return list;
    return list.filter((_, index) => !brand.brand.colors[index].finish);
  }
  const keys = presets[id];
  if (!keys) return getAllColors();
  return keys.map((key) => byKey.get(key)).filter((color): color is PaletteColor => Boolean(color));
}

export function paletteCount(id: string): number {
  if (brandByPaletteId(id)) return getPalette(id).length;
  return presets[id]?.length ?? getAllColors().length;
}

export function displayCode(hex: string, system: ColorSystem): string {
  if (!isCommunitySystem(system)) {
    indexes();
    return brandCodeByHex.get(system)?.get(hex.toUpperCase())?.code ?? "?";
  }
  const row = mapping[hex.toUpperCase()];
  return row?.[system as CommunitySystem] || "?";
}

/** Brand color name and special finish, when the system has them. */
export function colorDetail(hex: string, system: ColorSystem): { name?: string; finish?: string } {
  if (isCommunitySystem(system)) return {};
  indexes();
  const item = brandCodeByHex.get(system)?.get(hex.toUpperCase());
  return { name: item?.name, finish: item?.finish ? SPECIAL_FINISH_LABEL[item.finish] ?? item.finish : undefined };
}

export function compareCodes(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.match(/^([A-Za-z]*)(\d+)$/);
    if (!match) return null;
    return { prefix: match[1].toUpperCase(), num: parseInt(match[2], 10) };
  };
  const left = parse(a);
  const right = parse(b);
  if (left && right) {
    if (left.prefix !== right.prefix) return left.prefix.localeCompare(right.prefix);
    return left.num - right.num;
  }
  if (left) return -1;
  if (right) return 1;
  return a.localeCompare(b, "zh-CN");
}
