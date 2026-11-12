import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePattern } from "../src/lib/generate";
import {
  BRAND_SYSTEMS,
  COMMUNITY_SYSTEMS,
  colorDetail,
  defaultPaletteFor,
  displayCode,
  getPalette,
  paletteChoicesFor,
  paletteForSystem,
  systemNote,
} from "../src/lib/palette";
import { tally, type ImagePixels } from "../src/lib/pixelate";

function noiseImage(width: number, height: number, seed: number): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = s & 255;
    data[i + 1] = (s >> 8) & 255;
    data[i + 2] = (s >> 16) & 255;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

test("each international brand has its own palette and codes", () => {
  assert.deepEqual(BRAND_SYSTEMS, ["Artkal S", "Artkal C", "Artkal M", "Perler", "Hama", "Nabbi"]);
  for (const system of BRAND_SYSTEMS) {
    const id = defaultPaletteFor(system);
    const palette = getPalette(id);
    assert.ok(palette.length >= 25, `${system} ${palette.length}`);
    for (const color of palette) {
      const code = displayCode(color.hex, system);
      assert.notEqual(code, "?", `${system} ${color.hex}`);
      assert.equal(colorDetail(color.hex, system).finish, undefined, "regular palette excludes special finishes");
    }
    assert.match(systemNote(system), /与品牌无关联/);
    assert.match(systemNote(system), /以实物为准/);
  }
});

test("special finishes are opt-in", () => {
  const choices = paletteChoicesFor("Perler");
  assert.equal(choices.length, 2);
  assert.ok(getPalette(choices[1].id).length > getPalette(choices[0].id).length);
  assert.equal(getPalette("perler").length, 125);
  assert.equal(getPalette("perler+special").length, 131);
});

test("brand generation only uses that brand's colors", async () => {
  for (const system of BRAND_SYSTEMS) {
    const paletteId = defaultPaletteFor(system);
    const allowed = new Set(getPalette(paletteId).map((color) => color.hex));
    const grid = await generatePattern(noiseImage(40, 40, 3), { cols: 20, rows: 20, paletteId, excluded: [], mode: "average", threshold: 10, metric: "oklab", removeBg: false, maxColors: 0, minCount: 0 });
    for (const item of tally(grid).counts) {
      assert.ok(allowed.has(item.hex), `${system} produced foreign ${item.hex}`);
      assert.notEqual(displayCode(item.hex, system), "?");
    }
  }
});

test("switching system keeps or resets the palette correctly", () => {
  assert.equal(paletteForSystem("COCO", "96"), "96");
  assert.equal(paletteForSystem("Artkal S", "96"), "artkal-s");
  assert.equal(paletteForSystem("MARD", "artkal-s"), "168");
  for (const system of COMMUNITY_SYSTEMS) assert.match(systemNote(system), /社区参考色卡/);
});

test("known official codes", () => {
  assert.equal(displayCode("#FFFFFF", "Artkal S"), "S01");
  assert.equal(displayCode("#FFF6D4", "Artkal M"), "MA1");
  assert.equal(displayCode("#B0353C", "Perler"), "80-19005");
  assert.equal(colorDetail("#B0353C", "Perler").name, "Red");
  assert.equal(displayCode("#E5ECF1", "Hama"), "H01");
  assert.equal(colorDetail("#E5ECF1", "Hama").name, "White");
  assert.equal(displayCode("#9D5B2E", "Artkal S"), "S63");
  assert.equal(colorDetail("#9D5B2E", "Artkal S").finish, "金属");
  assert.equal(displayCode("#FD543D", "MARD"), "A14");
});
