import { describe, expect, it } from "vitest";
import {
  PDF_DPI,
  boardAxisNumbers,
  boardChipLabel,
  boardPageHeader,
  boardPitch,
  boardsForPitch,
  boldGuideOffsets,
  MIN_CODE_FONT_MM,
  fitBeadCode,
  stripCodePadding,
  legendCapacity,
  parsePdfPrefs,
  planBoards,
  preferredScale,
  serializePdfPrefs,
} from "./boardPdf";
import { COLOR_SYSTEMS, displayCode, getAllColors, getColorByHex, getPalette } from "./palette";
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

  it("splits a 104 grid on 50-boards into 3x3 with a 4-cell edge", () => {
    const boards = planBoards(104, 104, 50);
    expect(boards.map((board) => board.label)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"]);
    expect(boards[0].col1 - boards[0].col0).toBe(50);
    expect(boards[0].row1 - boards[0].row0).toBe(50);
    expect(boards[2].col1 - boards[2].col0).toBe(4);
    expect(boards[6].row1 - boards[6].row0).toBe(4);
    expect(boards[8].col1 - boards[8].col0).toBe(4);
    expect(boards[8].row1 - boards[8].row0).toBe(4);
  });

  it("splits a 104 grid on 52-boards into four full boards", () => {
    const boards = planBoards(104, 104, 52);
    expect(boards.map((board) => board.label)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(boards.every((board) => board.col1 - board.col0 === 52 && board.row1 - board.row0 === 52)).toBe(true);
  });

  it("keeps a partial 52-board edge and prints mini boards at 2.6mm", () => {
    const boards = planBoards(90, 70, 52);
    expect(boards.map((board) => board.label)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(boards[1].col1 - boards[1].col0).toBe(18);
    expect(boards[2].row1 - boards[2].row0).toBe(38);
    expect(boards[3].col1 - boards[3].col0).toBe(18);
    expect(boards[3].row1 - boards[3].row0).toBe(38);
    expect(boardsForPitch("2.6")).toEqual([50, 52]);
    expect(boardsForPitch("5")).toEqual([29, 58, 87]);
    expect(boardPitch(50)).toBe("2.6");
    expect(boardPitch(52)).toBe("2.6");
    expect(boardPitch(29)).toBe("5");
    expect(preferredScale(50, "a4")).toBe("2.6");
    expect(preferredScale(52, "a4")).toBe("2.6");
    expect(preferredScale(52, "letter")).toBe("2.6");
    expect(preferredScale(29, "a4")).toBe("5");
    expect(preferredScale(58, "a4")).toBe("fit");
  });
});

describe("per-board guides", () => {
  it("restarts bold lines and numbers at each board edge and keeps the global range in the header", () => {
    const boards = planBoards(58, 58, 29);
    const second = boards[2];
    expect(second.label).toBe("B1");
    expect(boardPageHeader(second)).toContain("全局行 30–58");
    expect(boardPageHeader(second)).toContain("列 1–29");
    expect(boldGuideOffsets(29)).toEqual([5, 10, 15, 20, 25]);
    expect(boardAxisNumbers(29)).toEqual([1, 5, 10, 15, 20, 25, 29]);
    expect(boardAxisNumbers(second.row1 - second.row0)).toEqual(boardAxisNumbers(29));
    expect(boardAxisNumbers(second.row1 - second.row0)).not.toContain(30);
    expect(boldGuideOffsets(52)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(boardAxisNumbers(52)).toEqual([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 52]);
    expect(boardAxisNumbers(19)).toEqual([1, 5, 10, 15, 19]);
  });
});

describe("small 1:1 codes", () => {
  it("never truncates a code into a different palette code", () => {
    const colliding = new Set(["A26", "A2", "A", "109", "10", "1", "A01", "A1", "T01"]);
    const a26 = fitBeadCode("A26", 2.6, colliding);
    const narrowA26 = fitBeadCode("A26", 1.8, colliding);
    const numeric = fitBeadCode("109", 2.6, colliding);
    const narrowNumeric = fitBeadCode("109", 1.8, colliding);
    expect(a26).toMatchObject({ kind: "text", text: "A26" });
    expect(narrowA26).toEqual({ kind: "dot" });
    expect(numeric).toMatchObject({ kind: "text", text: "109" });
    expect(narrowNumeric).toEqual({ kind: "dot" });
    expect(fitBeadCode("A01", 1.8, colliding)).toEqual({ kind: "dot" });

    const open = new Set(["A01", "A26"]);
    const shortened = fitBeadCode("A01", 1.8, open);
    expect(shortened).toMatchObject({ kind: "text", text: "A1" });
    expect(stripCodePadding("A01")).toBe("A1");
    expect(stripCodePadding("A26")).toBeNull();
    expect(stripCodePadding("109")).toBeNull();

    for (const system of COLOR_SYSTEMS) {
      const codes = new Set(getAllColors().map((color) => displayCode(color.hex, system)));
      for (const code of codes) {
        for (const cell of [1.8, 2.6, 5]) {
          const fitted = fitBeadCode(code, cell, codes);
          expect(fitted).not.toBeNull();
          if (!fitted || fitted.kind === "dot") continue;
          expect(fitted.size).toBeGreaterThanOrEqual(MIN_CODE_FONT_MM);
          const unpadded = stripCodePadding(code);
          expect(fitted.text === code || fitted.text === unpadded).toBe(true);
          if (fitted.text !== code) expect(codes.has(fitted.text)).toBe(false);
          expect(fitted.text.startsWith(code.slice(0, fitted.text.length)) && fitted.text !== code).toBe(false);
        }
      }
    }
    expect(PDF_DPI).toBeGreaterThanOrEqual(200);
  });
});

describe("export preferences", () => {
  it("remembers pitch, board, paper, and scale", () => {
    const raw = serializePdfPrefs({ pitch: "2.6", board: 52, paper: "a4", scale: "2.6" });
    expect(parsePdfPrefs(raw)).toEqual({ pitch: "2.6", board: 52, paper: "a4", scale: "2.6" });
    expect(parsePdfPrefs(JSON.stringify({ board: 50, paper: "letter", scale: "5" }))?.scale).toBe("2.6");
    expect(parsePdfPrefs("{")).toBeNull();
    expect(boardChipLabel(58)).toBe("58 仅支持缩放打印");
    expect(boardChipLabel(87)).toBe("87 仅支持缩放打印");
    expect(boardChipLabel(29)).toBe("29 板");
    expect(boardChipLabel(50)).toBe("50 板");
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
