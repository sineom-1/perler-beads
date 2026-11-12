import { hexToRgb } from "./color";
import type { ImagePixels } from "./pixelate";
import { buildNameTag } from "./nameTag";
import { TEMPLATE_COLORS, type BeadTemplate } from "../data/templates";

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
 * A name tag: the text on a rounded plate. Kept for callers that only need the
 * classic look; see buildNameTag for fonts, frames and colour themes.
 */
export function nameTagRows(text: string): string[] | null {
  return buildNameTag(text);
}
