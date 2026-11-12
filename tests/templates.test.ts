import { test } from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, TEMPLATES, TEMPLATE_COLORS } from "../src/data/templates";
import { generatePattern } from "../src/lib/generate";
import { BRAND_SYSTEMS, defaultPaletteFor } from "../src/lib/palette";
import { nameTagRows, templatePixels } from "../src/lib/templates";

test("templates are rectangular and only use known colors", () => {
  assert.ok(TEMPLATES.filter((item) => item.category === "节日").length >= 6);
  const ids = new Set<string>();
  for (const item of TEMPLATES) {
    assert.ok(!ids.has(item.id), item.id);
    ids.add(item.id);
    const width = item.rows[0].length;
    for (const row of item.rows) {
      assert.equal(row.length, width, item.id);
      for (const ch of row) assert.ok(ch === "." || TEMPLATE_COLORS[ch], `${item.id} ${ch}`);
    }
  }
});

test("a template becomes a bead grid cell for cell, in every brand", async () => {
  const tree = TEMPLATES.find((item) => item.id === "xmas-tree")!;
  for (const paletteId of ["168", ...BRAND_SYSTEMS.map(defaultPaletteFor)]) {
    const grid = await generatePattern(templatePixels(tree.rows), { cols: tree.rows[0].length, rows: tree.rows.length, paletteId, excluded: [], mode: "dominant", threshold: 0, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 });
    tree.rows.forEach((row, r) => [...row].forEach((ch, c) => assert.equal(grid[r][c].isExternal, ch === ".", `${paletteId} ${r},${c}`)));
  }
});

test("name tags render supported text and skip the rest", () => {
  for (const glyph of Object.values(GLYPHS)) assert.equal(glyph.length, 7);
  const rows = nameTagRows("Hi 2026!")!;
  assert.ok(rows.every((row) => row.length === rows[0].length));
  assert.equal(rows.length, 11);
  assert.equal(nameTagRows("你好"), null);
});

test("every template category has several templates", async () => {
  const { TEMPLATE_CATEGORIES } = await import("../src/data/templates");
  for (const category of TEMPLATE_CATEGORIES) assert.ok(TEMPLATES.filter((item) => item.category === category).length >= 4, category);
  assert.ok(TEMPLATES.length >= 35);
});

test("name tag fonts, frames and themes give rectangular rows in known colours", async () => {
  const { buildNameTag, scale2x, TAG_THEMES } = await import("../src/lib/nameTag");
  for (const font of ["standard", "round"] as const) for (const frame of ["plate", "sticker", "shadow"] as const) for (const theme of TAG_THEMES) {
    const rows = buildNameTag("Mia ♥ 1!", { font, frame, theme: theme.id })!;
    assert.ok(rows.every((row) => row.length === rows[0].length), `${font} ${frame} ${theme.id}`);
    for (const row of rows) for (const ch of row) assert.ok(ch === "." || TEMPLATE_COLORS[ch], `${font} ${frame} ${theme.id} ${ch}`);
  }
  assert.equal(buildNameTag("ABCDEFGHIJKL", { font: "round" })!.length, 7 * 2 + 4 + 2);
  // trimmed glyphs: "1!." is narrower than "M"
  const narrow = buildNameTag("1!.")!;
  const wide = buildNameTag("MMM")!;
  assert.ok(narrow[0].length < wide[0].length);
});
