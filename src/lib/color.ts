/**
 * Color distance and palette matching.
 * Oklab conversion follows Zippland/perler-beads (AGPL-3.0, Copyright (C) Zippland).
 * CIEDE2000 is the roadmap alternative to RGB / Oklab distance.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export type DistanceMetric = "oklab" | "ciede2000";
export type PixelMode = "dominant" | "average";

export interface PaletteColor {
  key: string;
  hex: string;
  rgb: Rgb;
  oklab: Oklab;
  lab: Lab;
  /** Shared mapping-row hex. Other brands stay on this value. */
  rowHex: string;
  /** Transparent beads stay in the list but are skipped by nearest-color matching. */
  transparent: boolean;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#241c16";
  const y = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return y > 0.62 ? "#241c16" : "#ffffff";
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function rgbToOklab(rgb: Rgb): Oklab {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function pivotRgb(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function rgbToLab(rgb: Rgb): Lab {
  const r = pivotRgb(rgb.r);
  const g = pivotRgb(rgb.g);
  const b = pivotRgb(rgb.b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1);
  const fz = f(z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deg(radians: number): number {
  const value = (radians * 180) / Math.PI;
  return value < 0 ? value + 360 : value;
}

/** CIEDE2000 color difference. Identical colors return 0. */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const cBar7 = cBar ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = c1p === 0 ? 0 : deg(Math.atan2(b1, a1p));
  const h2p = c2p === 0 ? 0 : deg(Math.atan2(b2, a2p));

  const dL = L2 - L1;
  const dC = c2p - c1p;
  let dh = 0;
  if (c1p * c2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh * Math.PI) / 360);

  let hBar = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hBar = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) hBar = (h1p + h2p + 360) / 2;
    else hBar = (h1p + h2p - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(((hBar - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hBar) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hBar + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hBar - 63) * Math.PI) / 180);
  const deltaTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const cBarP = (c1p + c2p) / 2;
  const cBarP7 = cBarP ** 7;
  const rc = 2 * Math.sqrt(cBarP7 / (cBarP7 + 25 ** 7));
  const lBar = (L1 + L2) / 2;
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin((2 * deltaTheta * Math.PI) / 180) * rc;
  const value = Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
  return Number.isFinite(value) ? value : 0;
}

export function enrichColor(color: {
  key: string;
  hex: string;
  rgb: Rgb;
  rowHex?: string;
  transparent?: boolean;
}): PaletteColor {
  const hex = color.hex.toUpperCase();
  return {
    key: color.key,
    hex,
    rgb: color.rgb,
    oklab: rgbToOklab(color.rgb),
    lab: rgbToLab(color.rgb),
    rowHex: (color.rowHex ?? hex).toUpperCase(),
    transparent: color.transparent ?? false,
  };
}

/** Oklab distance scaled to about 0–100, matching the upstream threshold slider. */
export function oklabDistance(a: Oklab, b: Oklab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, b.b - a.b) * 100;
}

export function paletteDistance(a: PaletteColor, b: PaletteColor, metric: DistanceMetric): number {
  if (a.hex === b.hex) return 0;
  return metric === "ciede2000" ? ciede2000(a.lab, b.lab) : oklabDistance(a.oklab, b.oklab);
}

export function colorDistance(a: Rgb, b: Rgb, metric: DistanceMetric): number {
  if (a.r === b.r && a.g === b.g && a.b === b.b) return 0;
  return metric === "ciede2000"
    ? ciede2000(rgbToLab(a), rgbToLab(b))
    : oklabDistance(rgbToOklab(a), rgbToOklab(b));
}

export function findClosest(rgb: Rgb, palette: PaletteColor[], metric: DistanceMetric): PaletteColor {
  if (palette.length === 0) {
    throw new Error("色板为空");
  }
  const probe =
    metric === "ciede2000"
      ? { lab: rgbToLab(rgb) }
      : { oklab: rgbToOklab(rgb) };
  let best = palette[0];
  let bestDistance = Infinity;
  for (const color of palette) {
    const distance =
      metric === "ciede2000"
        ? ciede2000(probe.lab as Lab, color.lab)
        : oklabDistance(probe.oklab as Oklab, color.oklab);
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }
  return best;
}
