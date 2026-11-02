/**
 * Brand color systems and preset palette sizes.
 * The 291-color map and the 72/96/120/144 key lists are adapted from
 * Zippland/perler-beads (https://github.com/Zippland/perler-beads),
 * Copyright (C) Zippland, AGPL-3.0.
 * 96/120/144 include the upstream extra bead T1. T1 is transparent and is
 * excluded from MARD nearest-color matching by code, not by its #FFFFFF hex.
 * The 168-color tier is omitted: no source lists it.
 *
 * colorSystemMapping.json is keyed by one shared hex per row. MARD corrections
 * live in mardAdjustments.json so COCO / 漫漫 / 盼盼 / 咪小窝 keep the row hex.
 */

import adjustmentsJson from "../data/mardAdjustments.json";
import mappingJson from "../data/colorSystemMapping.json";
import presetJson from "../data/palettePresets.json";
import { enrichColor, hexToRgb, type PaletteColor } from "./color";

export const COLOR_SYSTEMS = ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"] as const;
export type ColorSystem = (typeof COLOR_SYSTEMS)[number];

type Mapping = Record<string, Record<ColorSystem, string>>;

const mapping = mappingJson as Mapping;
const presets = presetJson as Record<string, string[]>;
const mardHexOverrides = Object.fromEntries(
  Object.entries(adjustmentsJson.mardHex).map(([key, hex]) => [key, hex.toUpperCase()]),
) as Record<string, string>;
const transparentCodes = new Set(adjustmentsJson.transparentCodes);

/** Removed preset. Saved settings that still say 168 load as the full palette. */
export const REMOVED_PRESET_ID = "168";
export const REMOVED_PRESET_FALLBACK = "291";

export const PALETTE_CHOICES: { id: string; name: string }[] = [
  { id: "72", name: "72 色" },
  { id: "96", name: "96 色" },
  { id: "120", name: "120 色" },
  { id: "144", name: "144 色" },
  { id: "291", name: "291 色（全部）" },
];

let fullPalette: PaletteColor[] | null = null;

export function getAllColors(): PaletteColor[] {
  if (fullPalette) return fullPalette;
  fullPalette = Object.entries(mapping).map(([hex, systems]) => {
    const rowHex = hex.toUpperCase();
    const key = systems.MARD;
    const mardHex = mardHexOverrides[key] ?? rowHex;
    const rgb = hexToRgb(mardHex);
    if (!rgb) throw new Error(`无效色值 ${mardHex}`);
    return enrichColor({
      key,
      hex: mardHex,
      rgb,
      rowHex,
      transparent: transparentCodes.has(key),
    });
  });
  return fullPalette;
}

const byHex = new Map<string, PaletteColor>();
const byKey = new Map<string, PaletteColor>();

function indexes() {
  if (byHex.size > 0) return;
  for (const color of getAllColors()) {
    byHex.set(color.hex, color);
    if (color.rowHex !== color.hex) byHex.set(color.rowHex, color);
    byKey.set(color.key, color);
  }
}

export function getColorByKey(key: string): PaletteColor | undefined {
  indexes();
  return byKey.get(key);
}

export function getColorByHex(hex: string): PaletteColor | undefined {
  indexes();
  return byHex.get(hex.toUpperCase());
}

export function hasPreset(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(presets, id);
}

export function getPalette(id: string): PaletteColor[] {
  indexes();
  const keys = presets[id];
  if (!keys) return getAllColors();
  return keys.map((key) => byKey.get(key)).filter((color): color is PaletteColor => Boolean(color));
}

export function paletteCount(id: string): number {
  return presets[id]?.length ?? getAllColors().length;
}

/** Match hex for one brand. Non-MARD brands keep the shared row hex. */
export function projectForSystem(color: PaletteColor, system: ColorSystem): PaletteColor {
  if (system === "MARD" || color.hex === color.rowHex) {
    return system === "MARD" ? color : { ...color, transparent: false };
  }
  const rgb = hexToRgb(color.rowHex);
  if (!rgb) return { ...color, transparent: false };
  return enrichColor({
    key: color.key,
    hex: color.rowHex,
    rgb,
    rowHex: color.rowHex,
    transparent: false,
  });
}

/**
 * Palette passed to nearest-color matching.
 * MARD skips transparent codes. Other brands keep every row, including the
 * shared #FFFFFF row, on its original hex.
 */
export function paletteForMatching(colors: PaletteColor[], system: ColorSystem = "MARD"): PaletteColor[] {
  const projected = colors.map((color) => projectForSystem(color, system));
  if (system !== "MARD") return projected;
  return projected.filter((color) => !color.transparent);
}

export function resolveRowHex(hex: string): string | undefined {
  return getColorByHex(hex)?.rowHex;
}

export function displayCode(hex: string, system: ColorSystem): string {
  const upper = hex.toUpperCase();
  const direct = mapping[upper]?.[system];
  if (direct) return direct;
  const rowHex = resolveRowHex(upper);
  if (!rowHex) return "?";
  return mapping[rowHex]?.[system] || "?";
}

export interface StoredBeadCell {
  key: string;
  hex: string;
  isExternal: boolean;
}

export interface StoredPattern {
  paletteId?: string;
  excluded?: string[];
  grid?: StoredBeadCell[][];
}

/** Erased cells and transparent beads can share #FFFFFF. The key and flag tell them apart. */
export function migrateStoredCell(cell: StoredBeadCell): StoredBeadCell {
  if (cell.isExternal || cell.key === "ERASE") {
    return { key: "ERASE", hex: "#FFFFFF", isExternal: true };
  }
  const color = (cell.key ? getColorByKey(cell.key) : undefined) ?? getColorByHex(cell.hex);
  if (!color) return { key: cell.key, hex: cell.hex.toUpperCase(), isExternal: false };
  return { key: color.key, hex: color.hex, isExternal: false };
}

/**
 * Hex-identified grids from before the MARD corrections.
 * Nothing in the app persists works today; this is the loader for that shape.
 */
export function migrateStoredPattern(stored: StoredPattern): StoredPattern {
  return {
    paletteId: stored.paletteId === REMOVED_PRESET_ID ? REMOVED_PRESET_FALLBACK : stored.paletteId,
    excluded: stored.excluded?.map((hex) => getColorByHex(hex)?.hex ?? hex.toUpperCase()),
    grid: stored.grid?.map((row) => row.map((cell) => migrateStoredCell(cell))),
  };
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
