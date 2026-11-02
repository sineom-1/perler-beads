import { describe, expect, it } from "vitest";
import { legendCapacity, planBoards } from "./boardPdf";
import { getColorByHex, getPalette } from "./palette";
import { buildPattern, remapColor, removeBorderBackground, tally } from "./pixelate";

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const [r, g, b] = paint(x, y);
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("dominant-color pixelation", () => {
  it("uses the most frequent pixel in a cell instead of the average", async () => {
    // Two cells, four pixels each. The right cell is three white pixels and
    // one black pixel, so the mode stays white while the average shifts to gray.
    const pixels = image(8, 1, (x) => (x === 7 ? [0, 0, 0] : [255, 255, 255]));
    const options = {
      cols: 2,
      rows: 1,
      palette: getPalette("291"),
      threshold: 0,
      metric: "oklab" as const,
    };
    const dominant = await buildPattern(pixels, { ...options, mode: "dominant" });
    const average = await buildPattern(pixels, { ...options, mode: "average" });

    expect(dominant.grid[0][0].key).toBe("T01");
    expect(dominant.grid[0][1].key).toBe("T01");
    expect(average.grid[0][0].key).toBe("T01");
    expect(average.grid[0][1].key).not.toBe("T01");
  });
});

describe("region merge", () => {
  it("keeps the yellow smiley face A26 at threshold 30", async () => {
    const side = 24;
    const pixels = image(side, side, (x, y) => {
      const face = x >= 4 && x < 20 && y >= 4 && y < 20;
      return face ? [255, 200, 48] : [255, 255, 255];
    });
    const pattern = await buildPattern(pixels, {
      cols: side,
      rows: side,
      palette: getPalette("168"),
      mode: "dominant",
      threshold: 30,
      metric: "oklab",
    });
    const yellow = pattern.counts.find((item) => item.key === "A26");
    const white = pattern.counts.find((item) => item.key === "T01");
    expect(yellow?.count).toBe(16 * 16);
    expect(white?.count).toBe(side * side - 16 * 16);
  });
});

describe("background flood-fill removal", () => {
  it("removes only the border-connected background color", async () => {
    const pixels = image(12, 12, (x, y) => {
      const border = x < 2 || y < 2 || x >= 10 || y >= 10;
      return border ? [253, 251, 255] : [253, 84, 61];
    });
    const pattern = await buildPattern(pixels, {
      cols: 12,
      rows: 12,
      palette: getPalette("291"),
      mode: "dominant",
      threshold: 0,
      metric: "oklab",
    });
    const removed = removeBorderBackground(pattern.grid);
    const after = tally(removed.grid);
    expect(removed.hex).toBe("#FDFBFF");
    expect(removed.removed).toBe(80);
    expect(after.total).toBe(64);
    expect(after.counts.map((item) => item.key)).toEqual(["A14"]);
  });

  it("does not strip the yellow face after merging", async () => {
    const side = 24;
    const pixels = image(side, side, (x, y) => {
      const face = x >= 4 && x < 20 && y >= 4 && y < 20;
      return face ? [255, 200, 48] : [255, 255, 255];
    });
    const pattern = await buildPattern(pixels, {
      cols: side,
      rows: side,
      palette: getPalette("168"),
      mode: "dominant",
      threshold: 30,
      metric: "oklab",
    });
    const removed = removeBorderBackground(pattern.grid);
    const after = tally(removed.grid);
    expect(after.total).toBe(16 * 16);
    expect(after.counts[0]?.key).toBe("A26");
  });
});

describe("exclude remap", () => {
  it("maps excluded B08 to the nearest remaining palette color B07", () => {
    const palette = getPalette("291");
    const source = getColorByHex("#1C9C4F");
    expect(source?.key).toBe("B08");
    const targets = palette.filter((color) => color.key !== "B08");
    const grid = [[{ key: "B08", hex: source!.hex, isExternal: false }]];
    const result = remapColor(grid, source!, targets, "oklab");
    expect(result.replacement.key).toBe("B07");
    expect(result.replaced).toBe(1);
    expect(result.grid[0][0].key).toBe("B07");
  });
});

describe("board splitting", () => {
  it("splits 48x48 at 29 into A1, A2, B1, B2 with 19-wide edge boards", () => {
    const boards = planBoards(48, 48, 29);
    expect(boards.map((board) => board.label)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(boards[1].col1 - boards[1].col0).toBe(19);
    expect(boards[2].row1 - boards[2].row0).toBe(19);
    expect(boards[3].col1 - boards[3].col0).toBe(19);
    expect(boards[3].row1 - boards[3].row0).toBe(19);
  });
});

describe("legend pagination", () => {
  it("splits a long shopping list across more than one page", () => {
    const page = { w: 210, h: 297 };
    // Page 1 sits under the overview thumbnail; later pages start near the top.
    const firstPage = legendCapacity(page, 150);
    const continuation = legendCapacity(page, 20);
    expect(continuation).toBeGreaterThan(60);
    expect(firstPage).toBeGreaterThan(0);
    expect(firstPage).toBeLessThan(continuation);

    const colorCount = continuation * 2 + 1;
    const pages: number[] = [];
    let cursor = 0;
    const take = (capacity: number) => {
      const count = Math.min(capacity, colorCount - cursor);
      pages.push(count);
      cursor += capacity;
    };
    take(firstPage);
    while (cursor < colorCount) take(continuation);

    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.reduce((sum, count) => sum + count, 0)).toBe(colorCount);
    expect(pages[0]).toBe(firstPage);
    expect(pages.slice(1, -1).every((count) => count === continuation)).toBe(true);
  });
});
