import { GLYPHS } from "../data/templates";

/**
 * Name-tag generator. Letters come from the 5×7 GLYPHS; the "round" size
 * doubles them with EPX smoothing so diagonals and curves come out rounded.
 * All output is bead rows keyed to TEMPLATE_COLORS ('.' = empty cell).
 */

export type TagFont = "standard" | "round";
export type TagFrame = "plate" | "sticker" | "shadow";

export interface TagTheme {
  id: string;
  name: string;
  /** Letter colours; more than one cycles letter by letter. */
  ink: string[];
  plate: string;
  border: string;
  /** Sticker outline colour. */
  edge: string;
  /** Drop-shadow colour, and the letter colour used with it when it differs. */
  shade: string;
  shadeInk?: string[];
}

export const TAG_THEMES: TagTheme[] = [
  { id: "classic", name: "经典红白", ink: ["K"], plate: "W", border: "R", edge: "R", shade: "K", shadeInk: ["R"] },
  { id: "candy", name: "糖果粉", ink: ["M"], plate: "p", border: "M", edge: "p", shade: "r" },
  { id: "mint", name: "薄荷", ink: ["G"], plate: "W", border: "T", edge: "T", shade: "T" },
  { id: "night", name: "夜空", ink: ["Y"], plate: "D", border: "u", edge: "D", shade: "O" },
  { id: "rainbow", name: "彩虹字", ink: ["R", "O", "Y", "g", "u", "V"], plate: "W", border: "N", edge: "W", shade: "K" },
  { id: "cream", name: "奶油咖", ink: ["B"], plate: "C", border: "b", edge: "C", shade: "S" },
];

export interface TagOptions {
  font?: TagFont;
  frame?: TagFrame;
  theme?: string;
}

export const TAG_MAX_CHARS: Record<TagFont, number> = { standard: 10, round: 6 };

const SPACE_WIDTH = 3;

/** Glyph rows without empty side columns, so I, 1 and ! don't sit in wide gaps. */
function trimmedGlyph(ch: string): string[] | null {
  if (ch === " ") return Array.from({ length: 7 }, () => ".".repeat(SPACE_WIDTH));
  const glyph = GLYPHS[ch];
  if (!glyph) return null;
  const width = glyph[0].length;
  let left = 0;
  let right = width - 1;
  while (left < right && glyph.every((row) => row[left] === ".")) left += 1;
  while (right > left && glyph.every((row) => row[right] === ".")) right -= 1;
  return glyph.map((row) => row.slice(left, right + 1));
}

/** EPX / Scale2x: doubles a 1-bit glyph and rounds its stair steps. */
export function scale2x(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x]);
  const out = Array.from({ length: h * 2 }, () => Array<string>(w * 2).fill("."));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p;
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p;
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out.map((row) => row.join(""));
}

/** Supported characters of `text`, upper-cased and capped for the font. */
export function tagChars(text: string, font: TagFont = "standard"): string[] {
  return [...text.toUpperCase()].filter((ch) => GLYPHS[ch] || ch === " ").slice(0, TAG_MAX_CHARS[font]);
}

type Grid = string[][];
const blankGrid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill("."));

/** Lays out the letters with one-bead spacing (two for the round font). */
function letterGrid(chars: string[], font: TagFont, ink: string[]): Grid {
  const scale = font === "round" ? 2 : 1;
  const gap = scale;
  const glyphs = chars.map((ch) => {
    const g = trimmedGlyph(ch)!;
    return scale === 2 ? scale2x(g) : g;
  });
  const height = 7 * scale;
  const width = glyphs.reduce((sum, g) => sum + g[0].length, 0) + gap * Math.max(0, glyphs.length - 1);
  const grid = blankGrid(width, height);
  let x0 = 0;
  let letter = 0;
  glyphs.forEach((g, i) => {
    const colour = ink[letter % ink.length];
    if (chars[i] !== " ") letter += 1;
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#") grid[y][x0 + x] = colour; }));
    x0 += g[0].length + gap;
  });
  return grid;
}

function pad(grid: Grid, n: number, fill = "."): Grid {
  const w = grid[0].length + n * 2;
  const empty = () => Array<string>(w).fill(fill);
  return [
    ...Array.from({ length: n }, empty),
    ...grid.map((row) => [...Array<string>(n).fill(fill), ...row, ...Array<string>(n).fill(fill)]),
    ...Array.from({ length: n }, empty),
  ];
}

/** Rounded plate: a border ring with corner cells cut so the outline reads round. */
function plate(letters: Grid, theme: TagTheme, margin: number): Grid {
  const inner = pad(letters, margin);
  const h = inner.length + 2;
  const w = inner[0].length + 2;
  const out = blankGrid(w, h);
  const r = h >= 14 ? 3 : 2;
  const inside = (x: number, y: number) => {
    const cx = x < r ? r : x > w - 1 - r ? w - 1 - r : x;
    const cy = y < r ? r : y > h - 1 - r ? h - 1 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.6;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      out[y][x] = edge ? theme.border : theme.plate;
    }
  }
  inner.forEach((row, y) => row.forEach((ch, x) => { if (ch !== ".") out[y + 1][x + 1] = ch; }));
  return out;
}

/** Free-standing letters with an edge ring around every stroke (8-neighbour). */
function sticker(letters: Grid, theme: TagTheme): Grid {
  const grid = pad(letters, 1);
  const out = grid.map((row) => [...row]);
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (ch !== ".") return;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (grid[y + dy]?.[x + dx] && grid[y + dy][x + dx] !== ".") out[y][x] = theme.edge;
    }
  }));
  return out;
}

/** Letters with a solid drop shadow one bead down-right, so they read 3D. */
function shadow(letters: Grid, theme: TagTheme, depth: number): Grid {
  const grid = pad(letters, 0);
  const h = grid.length + depth;
  const w = grid[0].length + depth;
  const out = blankGrid(w, h);
  for (let d = depth; d >= 1; d -= 1) {
    grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== ".") out[y + d][x + d] = theme.shade; }));
  }
  grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== ".") out[y][x] = ch; }));
  return out;
}

/**
 * Builds a name tag. Returns null when no supported character is left.
 * Defaults (standard font, plate, classic theme) give the original 11-row tag.
 */
export function buildNameTag(text: string, options: TagOptions = {}): string[] | null {
  const font = options.font ?? "standard";
  const frame = options.frame ?? "plate";
  const theme = TAG_THEMES.find((item) => item.id === options.theme) ?? TAG_THEMES[0];
  const chars = tagChars(text, font);
  if (!chars.some((ch) => GLYPHS[ch])) return null;
  while (chars[0] === " ") chars.shift();
  while (chars[chars.length - 1] === " ") chars.pop();
  const ink = frame === "shadow" && theme.shadeInk ? theme.shadeInk : theme.ink;
  const letters = letterGrid(chars, font, ink);
  const grid =
    frame === "sticker" ? sticker(letters, theme)
    : frame === "shadow" ? shadow(letters, theme, 1)
    : plate(letters, theme, font === "round" ? 2 : 1);
  return grid.map((row) => row.join(""));
}
