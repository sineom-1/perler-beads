import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findClosest } from "./color";
import {
  PALETTE_CHOICES,
  REMOVED_PRESET_FALLBACK,
  displayCode,
  getAllColors,
  getColorByHex,
  getColorByKey,
  getPalette,
  hasPreset,
  migrateStoredPattern,
  paletteForMatching,
  type ColorSystem,
} from "./palette";
import { ERASED_CELL, buildPattern, floodErase, paintCell, remapColor, tally, type GridCell } from "./pixelate";

function whiteImage(size = 4) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return { width: size, height: size, data };
}

function bead(key: string): GridCell {
  const color = getColorByKey(key);
  assert.ok(color, key);
  return { key: color.key, hex: color.hex, isExternal: false };
}

const CORRECTIONS = [
  {
    key: "P14",
    hex: "#337BAD",
    rowHex: "#337680",
    brands: { COCO: "M14", 漫漫: "P22", 盼盼: "183", 咪小窝: "183" } as Record<ColorSystem, string>,
  },
  {
    key: "P19",
    hex: "#FFDEE9",
    rowHex: "#FFFEEC",
    brands: { COCO: "M19", 漫漫: "P10", 盼盼: "186", 咪小窝: "186" } as Record<ColorSystem, string>,
  },
  {
    key: "R06",
    hex: "#1EBA93",
    rowHex: "#238891",
    brands: { COCO: "L06", 漫漫: "T4", 盼盼: "69", 咪小窝: "55" } as Record<ColorSystem, string>,
  },
];

describe("MARD hex corrections", () => {
  it("uses the corrected hex for MARD and leaves the shared row for other brands", () => {
    for (const row of CORRECTIONS) {
      const color = getColorByKey(row.key);
      assert.ok(color);
      assert.equal(color.hex, row.hex);
      assert.equal(color.rowHex, row.rowHex);
      assert.equal(getColorByHex(row.hex)?.key, row.key);
      assert.equal(getColorByHex(row.rowHex)?.hex, row.hex);
      assert.equal(displayCode(row.hex, "MARD"), row.key);
      assert.equal(displayCode(row.rowHex, "MARD"), row.key);
      for (const system of ["COCO", "漫漫", "盼盼", "咪小窝"] as const) {
        assert.equal(displayCode(row.rowHex, system), row.brands[system]);
        assert.equal(displayCode(row.hex, system), row.brands[system]);
        const projected = paletteForMatching(getPalette("291"), system).find((item) => item.key === row.key);
        assert.equal(projected?.hex, row.rowHex);
      }
      const mard = paletteForMatching(getPalette("291"), "MARD").find((item) => item.key === row.key);
      assert.equal(mard?.hex, row.hex);
    }
  });

  it("does not retarget H1 or M2", () => {
    assert.equal(getColorByKey("H01")?.hex, "#FDFBFF");
    assert.equal(getColorByKey("H01")?.rowHex, "#FDFBFF");
    assert.equal(getColorByKey("M02")?.hex, "#8AA386");
    assert.equal(getColorByKey("M02")?.rowHex, "#8AA386");
  });

  it("keeps MARD match hexes unique", () => {
    const seen = new Map<string, string>();
    for (const color of getAllColors()) {
      assert.equal(seen.has(color.hex), false, `${color.key} collides with ${seen.get(color.hex)} at ${color.hex}`);
      seen.set(color.hex, color.key);
      if (color.hex !== color.rowHex) {
        assert.equal(
          getAllColors().some((other) => other.key !== color.key && other.rowHex === color.hex),
          false,
          `${color.key} override ${color.hex} is another row`,
        );
      }
    }
  });
});

describe("transparent T1", () => {
  it("skips T1 by code while pure white maps to H2", async () => {
    const transparent = getAllColors().filter((color) => color.transparent).map((color) => color.key);
    assert.deepEqual(transparent, ["T01"]);
    assert.equal(getColorByKey("T01")?.hex, "#FFFFFF");
    assert.equal(ERASED_CELL.hex, "#FFFFFF");
    assert.notEqual(getColorByKey("T01")?.key, ERASED_CELL.key);

    const raw = findClosest({ r: 255, g: 255, b: 255 }, getPalette("291"), "oklab");
    assert.equal(raw.key, "T01");

    for (const id of ["72", "96", "120", "144", "291"]) {
      for (const metric of ["oklab", "ciede2000"] as const) {
        const pattern = await buildPattern(whiteImage(2), {
          cols: 1,
          rows: 1,
          palette: getPalette(id),
          mode: "dominant",
          threshold: 0,
          metric,
        });
        assert.equal(pattern.grid[0][0].key, "H02", `${id} ${metric}`);
        assert.equal(pattern.grid[0][0].hex, "#FEFFFF");
        assert.equal(pattern.counts.some((item) => item.key === "T01"), false);
      }
    }
  });

  it("still matches the shared white row for other brands", async () => {
    for (const system of ["COCO", "漫漫", "盼盼", "咪小窝"] as const) {
      const pattern = await buildPattern(whiteImage(2), {
        cols: 1,
        rows: 1,
        palette: paletteForMatching(getPalette("291"), system),
        mode: "dominant",
        threshold: 0,
        metric: "oklab",
      });
      assert.equal(pattern.grid[0][0].key, "T01", system);
      assert.equal(pattern.grid[0][0].hex, "#FFFFFF");
    }
    assert.equal(displayCode("#FFFFFF", "COCO"), "L14");
    assert.equal(displayCode("#FFFFFF", "漫漫"), "L6");
    assert.equal(displayCode("#FFFFFF", "盼盼"), "155");
    assert.equal(displayCode("#FFFFFF", "咪小窝"), "51");
  });

  it("keeps erasing distinct from a painted T1 bead", () => {
    const grid: GridCell[][] = [
      [bead("H02"), bead("H02"), bead("T01")],
      [bead("H02"), bead("A14"), bead("A14")],
    ];
    const erased = paintCell(grid, 0, 0, null);
    assert.deepEqual(erased[0][0], { key: "ERASE", hex: "#FFFFFF", isExternal: true });
    assert.equal(erased[0][2].key, "T01");
    assert.equal(erased[0][2].isExternal, false);
    assert.equal(erased[0][0].hex, erased[0][2].hex);
    const totals = tally(erased);
    assert.equal(totals.counts.some((item) => item.key === "ERASE"), false);
    assert.equal(totals.counts.find((item) => item.key === "T01")?.count, 1);
    assert.equal(totals.total, 5);

    const flooded = floodErase(grid, 0, 0);
    assert.equal(flooded[0][0].isExternal, true);
    assert.equal(flooded[0][1].isExternal, true);
    assert.equal(flooded[1][0].isExternal, true);
    assert.equal(flooded[0][2].key, "T01");
    assert.equal(flooded[0][2].isExternal, false);
    assert.equal(flooded[1][1].key, "A14");

    const clearedTransparent = floodErase(grid, 0, 2);
    assert.equal(clearedTransparent[0][2].key, "ERASE");
    assert.equal(clearedTransparent[0][2].isExternal, true);
    assert.equal(clearedTransparent[0][0].key, "H02");
    assert.equal(clearedTransparent[0][0].isExternal, false);
  });

  it("does not remap onto T1", () => {
    const source = getColorByKey("H01");
    assert.ok(source);
    const result = remapColor([[bead("H01")]], source, getPalette("291"), "oklab");
    assert.notEqual(result.replacement.key, "T01");
    assert.equal(result.replaced, 1);
  });
});

describe("stored hex records", () => {
  it("loads pre-change hexes, keeps T1, and still erases", () => {
    const loaded = migrateStoredPattern({
      paletteId: "168",
      excluded: ["#337680", "#FFFEEC", "#238891", "#FFFFFF", "#FEFFFF"],
      grid: [[
        { key: "P14", hex: "#337680", isExternal: false },
        { key: "P19", hex: "#FFFEEC", isExternal: false },
        { key: "R06", hex: "#238891", isExternal: false },
        { key: "T01", hex: "#FFFFFF", isExternal: false },
        { key: "ERASE", hex: "#FFFFFF", isExternal: true },
        { key: "H02", hex: "#FEFFFF", isExternal: false },
        { key: "H01", hex: "#FDFBFF", isExternal: false },
        { key: "M02", hex: "#8AA386", isExternal: false },
      ]],
    });
    assert.equal(loaded.paletteId, REMOVED_PRESET_FALLBACK);
    assert.deepEqual(loaded.excluded, ["#337BAD", "#FFDEE9", "#1EBA93", "#FFFFFF", "#FEFFFF"]);
    assert.deepEqual(loaded.grid?.[0][0], { key: "P14", hex: "#337BAD", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][1], { key: "P19", hex: "#FFDEE9", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][2], { key: "R06", hex: "#1EBA93", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][3], { key: "T01", hex: "#FFFFFF", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][4], { key: "ERASE", hex: "#FFFFFF", isExternal: true });
    assert.deepEqual(loaded.grid?.[0][5], { key: "H02", hex: "#FEFFFF", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][6], { key: "H01", hex: "#FDFBFF", isExternal: false });
    assert.deepEqual(loaded.grid?.[0][7], { key: "M02", hex: "#8AA386", isExternal: false });
    const tallied = tally(loaded.grid ?? []);
    assert.equal(tallied.counts.some((item) => item.key === "T01"), true);
    assert.equal(tallied.counts.some((item) => item.key === "ERASE"), false);
    assert.equal(tallied.total, 7);
  });
});

describe("preset tiers", () => {
  it("drops the 168 tier and keeps the others", () => {
    assert.equal(hasPreset("168"), false);
    assert.equal(PALETTE_CHOICES.some((item) => item.id === "168"), false);
    assert.deepEqual(
      ["72", "96", "120", "144", "291"].map((id) => [id, getPalette(id).length]),
      [
        ["72", 72],
        ["96", 97],
        ["120", 121],
        ["144", 145],
        ["291", 291],
      ],
    );
    assert.equal(getPalette("291").some((color) => color.key === "T01"), true);
    assert.equal(displayCode("#FEFFFF", "MARD"), "H02");
  });
});
