/**
 * Brand color systems and preset palette sizes.
 * The 291-color map and the 72/96/120/144 key lists are adapted from
 * Zippland/perler-beads (https://github.com/Zippland/perler-beads),
 * Copyright (C) Zippland, AGPL-3.0.
 * The published 168-color array upstream only contained 144 codes; this app
 * extends that 144-color list with the next 23 MARD codes so the 168 option
 * really enables 168 colors. 96/120/144 include the upstream extra white bead T1.
 */

import mappingJson from "../data/colorSystemMapping.json";
import presetJson from "../data/palettePresets.json";
import { enrichColor, hexToRgb, type PaletteColor } from "./color";

export const COLOR_SYSTEMS = ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"] as const;
export type ColorSystem = (typeof COLOR_SYSTEMS)[number];

type Mapping = Record<string, Record<ColorSystem, string>>;

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

function indexes() {
  if (byHex.size > 0) return;
  for (const color of getAllColors()) {
    byHex.set(color.hex, color);
    byKey.set(color.key, color);
  }
}

export function getColorByHex(hex: string): PaletteColor | undefined {
  indexes();
  return byHex.get(hex.toUpperCase());
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

export function displayCode(hex: string, system: ColorSystem): string {
  const row = mapping[hex.toUpperCase()];
  return row?.[system] || "?";
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
