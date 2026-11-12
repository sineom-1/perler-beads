import { hexToRgb } from "./color";
import type { ImagePixels } from "./pixelate";
import { GLYPHS, TEMPLATE_COLORS, type BeadTemplate } from "../data/templates";

/** One pixel per bead; empty cells are transparent so they become blank cells. */
export function templatePixels(rows: string[], colors: Record<string, string> = TEMPLATE_COLORS): ImagePixels {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const rgb = ch === "." ? null : hexToRgb(colors[ch] ?? "");
      if (!rgb) return;
      const i = (y * width + x) * 4;
      data[i] = rgb.r;
      data[i + 1] = rgb.g;
      data[i + 2] = rgb.b;
      data[i + 3] = 255;
    });
  });
  return { width, height, data };
}

export function templateImage(template: BeadTemplate): ImagePixels {
  return templatePixels(template.rows);
}

/**
 * A name tag: the text in 5×7 glyphs on a plate with a one-bead border and
 * cut corners. Unsupported characters are skipped; at most 8 characters.
 * Returns null when nothing printable is left.
 */
export function nameTagRows(text: string, ink = "K", plate = "W", border = "R"): string[] | null {
  const chars = [...text.toUpperCase()].filter((ch) => GLYPHS[ch] || ch === " ").slice(0, 8);
  if (!chars.some((ch) => GLYPHS[ch])) return null;
  const blank = Array.from({ length: 7 }, () => "...");
  const lines = Array.from({ length: 7 }, (_, y) =>
    chars.map((ch) => (GLYPHS[ch] ?? blank)[y]).join("."),
  ).map((line) => line.replace(/#/g, ink).replace(/\./g, plate));
  const inner = lines.map((line) => plate + plate + line + plate + plate);
  const width = inner[0].length;
  const pad = plate.repeat(width);
  const framed = [pad, ...inner, pad].map((line) => border + line + border);
  const edge = "." + border.repeat(width) + ".";
  return [edge, ...framed, edge];
}
