/**
 * Per-board PDF sheets. Pages are drawn on canvas so Chinese text uses the
 * browser font, then placed into a lazily loaded jsPDF document.
 */

import { contrastText } from "./color";
import { compareCodes } from "./palette";
import type { GridCell } from "./pixelate";

const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';

/** 5mm pegboards are 29/58/87. 2.6mm mini boards are 50 or 52 and do not share that pitch. */
export const STANDARD_BOARDS = [29, 58, 87] as const;
export const MINI_BOARDS = [50, 52] as const;
export type PdfBoardSize = (typeof STANDARD_BOARDS)[number] | (typeof MINI_BOARDS)[number];
export type PdfPaper = "a4" | "letter";
export type PdfScale = "fit" | "2.6" | "5";
export type BeadPitch = "5" | "2.6";

export function boardPitch(size: PdfBoardSize): BeadPitch {
  return size === 50 || size === 52 ? "2.6" : "5";
}

export function boardsForPitch(pitch: BeadPitch): readonly PdfBoardSize[] {
  return pitch === "2.6" ? MINI_BOARDS : STANDARD_BOARDS;
}

export interface BoardSlice {
  label: string;
  boardRow: number;
  boardCol: number;
  row0: number;
  row1: number;
  col0: number;
  col1: number;
}

export function columnLetters(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Board rows are letters (A, B, …) and board columns are numbers (1, 2, …). */
export function planBoards(rows: number, cols: number, size: number): BoardSlice[] {
  const across = Math.max(1, Math.ceil(cols / size));
  const down = Math.max(1, Math.ceil(rows / size));
  const boards: BoardSlice[] = [];
  for (let boardRow = 0; boardRow < down; boardRow++) {
    for (let boardCol = 0; boardCol < across; boardCol++) {
      boards.push({
        label: `${columnLetters(boardRow)}${boardCol + 1}`,
        boardRow,
        boardCol,
        row0: boardRow * size,
        row1: Math.min(rows, (boardRow + 1) * size),
        col0: boardCol * size,
        col1: Math.min(cols, (boardCol + 1) * size),
      });
    }
  }
  return boards;
}

interface LegendItem {
  hex: string;
  code: string;
  count: number;
}

export interface BoardPdfOptions {
  grid: GridCell[][];
  total: number;
  systemLabel: string;
  paletteLabel: string;
  showCodes: boolean;
  mirror: boolean;
  boardSize: PdfBoardSize;
  paper: PdfPaper;
  scale: PdfScale;
  codeFor: (hex: string) => string;
}

const MARGIN = 10;
const FOOTER = 14;
const HEADER = 20;
const AXIS = 8;

function paperSize(paper: PdfPaper): { w: number; h: number } {
  return paper === "letter" ? { w: 215.9, h: 279.4 } : { w: 210, h: 297 };
}

/** True when a full board of this size fits at the given pitch, including axes and the calibration ruler. */
export function pitchFits(boardSize: number, paper: PdfPaper, pitch: number): boolean {
  const page = paperSize(paper);
  const availW = page.w - MARGIN * 2 - AXIS;
  const availH = page.h - MARGIN - FOOTER - HEADER - AXIS;
  return boardSize * pitch <= availW + 0.01 && boardSize * pitch <= availH + 0.01;
}

/** Native pitch for this board when a full board fits on the page, otherwise shrink to the page. */
export function preferredScale(boardSize: PdfBoardSize, paper: PdfPaper): PdfScale {
  const pitch = boardPitch(boardSize);
  return pitchFits(boardSize, paper, pitch === "5" ? 5 : 2.6) ? pitch : "fit";
}

function orient(grid: GridCell[][], mirror: boolean): GridCell[][] {
  return mirror ? grid.map((row) => [...row].reverse()) : grid;
}

function legendOf(cells: GridCell[], codeFor: (hex: string) => string): LegendItem[] {
  const map = new Map<string, LegendItem>();
  for (const cell of cells) {
    if (!cell || cell.isExternal || cell.key === "ERASE") continue;
    const hex = cell.hex.toUpperCase();
    const current = map.get(hex);
    if (current) current.count += 1;
    else map.set(hex, { hex, code: codeFor(hex), count: 1 });
  }
  return [...map.values()].sort((a, b) => compareCodes(a.code, b.code));
}

class Sheet {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(widthMm: number, heightMm: number, private readonly pxPerMm: number) {
    this.width = widthMm;
    this.height = heightMm;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.max(1, Math.round(widthMm * pxPerMm));
    this.canvas.height = Math.max(1, Math.round(heightMm * pxPerMm));
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建 PDF 页面");
    this.ctx = context;
    this.ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, widthMm, heightMm);
    this.ctx.textBaseline = "middle";
  }

  text(value: string, x: number, y: number, size: number, color = "#2A2420", weight = 500, align: CanvasTextAlign = "left") {
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px ${FONT}`;
    this.ctx.textAlign = align;
    this.ctx.fillText(value, x, y);
  }

  swatch(hex: string, x: number, y: number, size: number) {
    this.ctx.fillStyle = hex;
    this.ctx.fillRect(x, y, size, size);
    this.ctx.strokeStyle = "rgba(42,36,32,0.25)";
    this.ctx.lineWidth = 0.15;
    this.ctx.strokeRect(x, y, size, size);
  }
}

function drawCalibrationRuler(sheet: Sheet) {
  const x0 = MARGIN;
  const y = sheet.height - 7;
  sheet.ctx.strokeStyle = "#2A2420";
  sheet.ctx.lineWidth = 0.35;
  sheet.ctx.beginPath();
  sheet.ctx.moveTo(x0, y);
  sheet.ctx.lineTo(x0 + 50, y);
  sheet.ctx.stroke();
  for (let mark = 0; mark <= 50; mark += 10) {
    sheet.ctx.beginPath();
    sheet.ctx.moveTo(x0 + mark, y);
    sheet.ctx.lineTo(x0 + mark, y - 2.4);
    sheet.ctx.stroke();
    sheet.text(String(mark), x0 + mark, y + 2.3, 2.2, "#2A2420", 500, "center");
  }
  sheet.text("50mm", x0 + 25, y - 3.6, 2.3, "#6E645C", 500, "center");
}

function drawPageNumber(sheet: Sheet, pageIndex: number, pageCount: number) {
  sheet.text(`${pageIndex}/${pageCount}`, sheet.width - MARGIN, sheet.height - 7, 3.4, "#2A2420", 700, "right");
  drawCalibrationRuler(sheet);
}

function drawLegend(sheet: Sheet, items: LegendItem[], x: number, y: number, width: number, rowH: number) {
  const columns = width > 170 ? 3 : 2;
  const columnW = width / columns;
  items.forEach((item, index) => {
    const column = index % columns;
    const line = Math.floor(index / columns);
    const left = x + column * columnW;
    const top = y + line * rowH;
    sheet.swatch(item.hex, left, top + 0.6, rowH - 1.6);
    sheet.text(item.code, left + rowH, top + rowH / 2, Math.min(3.4, rowH * 0.55), "#2A2420", 650);
    sheet.text(String(item.count), left + columnW - 2, top + rowH / 2, Math.min(3.2, rowH * 0.5), "#6E645C", 500, "right");
  });
}

function drawPattern(
  sheet: Sheet,
  grid: GridCell[][],
  originX: number,
  originY: number,
  cell: number,
  row0: number,
  row1: number,
  col0: number,
  col1: number,
  showCodes: boolean,
  codeFor: (hex: string) => string,
) {
  const boardRows = row1 - row0;
  const boardCols = col1 - col0;
  for (let row = row0; row < row1; row++) {
    for (let col = col0; col < col1; col++) {
      const bead = grid[row]?.[col];
      const x = originX + (col - col0) * cell;
      const y = originY + (row - row0) * cell;
      const empty = !bead || bead.isExternal || bead.key === "ERASE";
      sheet.ctx.fillStyle = empty ? "#F7F2EB" : bead.hex;
      sheet.ctx.fillRect(x, y, cell, cell);
      if (showCodes && !empty && cell >= 3.1) {
        const label = codeFor(bead.hex);
        let size = Math.min(cell * 0.38, 3.2);
        sheet.ctx.textAlign = "center";
        sheet.ctx.textBaseline = "middle";
        sheet.ctx.font = `700 ${size}px ${FONT}`;
        while (size > 1.4 && sheet.ctx.measureText(label).width > cell - 0.4) {
          size -= 0.15;
          sheet.ctx.font = `700 ${size}px ${FONT}`;
        }
        if (sheet.ctx.measureText(label).width <= cell - 0.3) {
          sheet.ctx.fillStyle = contrastText(bead.hex);
          sheet.ctx.fillText(label, x + cell / 2, y + cell / 2);
        }
      }
    }
  }

  const stroke = (stepMatch: (global: number) => boolean, color: string, width: number) => {
    sheet.ctx.strokeStyle = color;
    sheet.ctx.lineWidth = width;
    sheet.ctx.beginPath();
    for (let col = col0; col <= col1; col++) {
      if (!stepMatch(col) && col !== col0 && col !== col1) continue;
      const x = originX + (col - col0) * cell;
      sheet.ctx.moveTo(x, originY);
      sheet.ctx.lineTo(x, originY + boardRows * cell);
    }
    for (let row = row0; row <= row1; row++) {
      if (!stepMatch(row) && row !== row0 && row !== row1) continue;
      const y = originY + (row - row0) * cell;
      sheet.ctx.moveTo(originX, y);
      sheet.ctx.lineTo(originX + boardCols * cell, y);
    }
    sheet.ctx.stroke();
  };
  stroke(() => true, "rgba(42,36,32,0.12)", 0.08);
  stroke((index) => index % 5 === 0, "rgba(42,36,32,0.75)", 0.35);
  sheet.ctx.strokeStyle = "#2A2420";
  sheet.ctx.lineWidth = 0.4;
  sheet.ctx.strokeRect(originX, originY, boardCols * cell, boardRows * cell);
}

function drawAxes(
  sheet: Sheet,
  originX: number,
  originY: number,
  cell: number,
  row0: number,
  row1: number,
  col0: number,
  col1: number,
) {
  sheet.ctx.fillStyle = "#6E645C";
  sheet.ctx.textAlign = "center";
  sheet.ctx.textBaseline = "middle";
  const size = Math.min(2.6, cell * 0.55);
  sheet.ctx.font = `600 ${size}px ${FONT}`;
  const mark = (index: number, edge: boolean) => edge || (index + 1) % 5 === 0 || index === 0;
  for (let col = col0; col < col1; col++) {
    if (!mark(col, col === col1 - 1)) continue;
    const x = originX + (col - col0) * cell + cell / 2;
    if (cell < 2.4 && (col + 1) % 5 !== 0) continue;
    sheet.ctx.fillText(String(col + 1), x, originY - 3.2);
  }
  for (let row = row0; row < row1; row++) {
    if (!mark(row, row === row1 - 1)) continue;
    const y = originY + (row - row0) * cell + cell / 2;
    if (cell < 2.4 && (row + 1) % 5 !== 0) continue;
    sheet.ctx.fillText(String(row + 1), originX - 4.2, y);
  }
}

function drawOverviewMap(sheet: Sheet, boards: BoardSlice[], active: BoardSlice | null, x: number, y: number, size: number) {
  const rows = Math.max(...boards.map((board) => board.boardRow)) + 1;
  const cols = Math.max(...boards.map((board) => board.boardCol)) + 1;
  const cell = size / Math.max(rows, cols);
  boards.forEach((board) => {
    const left = x + board.boardCol * cell;
    const top = y + board.boardRow * cell;
    const on = active && board.label === active.label;
    sheet.ctx.fillStyle = on ? "#E8704F" : "#F7F2EB";
    sheet.ctx.fillRect(left, top, cell - 0.4, cell - 0.4);
    sheet.ctx.strokeStyle = "#D9CEC1";
    sheet.ctx.lineWidth = 0.15;
    sheet.ctx.strokeRect(left, top, cell - 0.4, cell - 0.4);
    if (cell > 6) {
      sheet.text(board.label, left + (cell - 0.4) / 2, top + (cell - 0.4) / 2, Math.min(2.4, cell * 0.28), on ? "#ffffff" : "#2A2420", 700, "center");
    }
  });
}

const LEGEND_ROW = 5.2;

function legendColumns(width: number) {
  return width > 170 ? 3 : 2;
}

export function legendCapacity(page: { w: number; h: number }, top: number, rowH = LEGEND_ROW) {
  const width = page.w - MARGIN * 2;
  const rows = Math.max(0, Math.floor((page.h - FOOTER - top) / rowH));
  return rows * legendColumns(width);
}

function renderOverview(
  grid: GridCell[][],
  boards: BoardSlice[],
  legend: LegendItem[],
  page: { w: number; h: number },
  subtitle: string,
  pageIndex: number,
  pageCount: number,
): { canvas: HTMLCanvasElement; shown: number } {
  const sheet = new Sheet(page.w, page.h, 140 / 25.4);
  sheet.text("拼豆图纸", MARGIN, 12, 8, "#2A2420", 700);
  sheet.text(subtitle, MARGIN, 20, 3.3, "#6E645C", 500);
  const contentW = page.w - MARGIN * 2;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const thumbTop = 28;
  const thumbBox = Math.min(118, page.h * 0.42);
  const cell = Math.min(contentW / cols, thumbBox / rows);
  const gridW = cols * cell;
  const gridH = rows * cell;
  const originX = MARGIN + (contentW - gridW) / 2;
  const originY = thumbTop;
  drawPattern(sheet, grid, originX, originY, cell, 0, rows, 0, cols, false, () => "");
  sheet.ctx.strokeStyle = "rgba(232,112,79,0.9)";
  sheet.ctx.lineWidth = 0.45;
  boards.forEach((board) => {
    const x = originX + board.col0 * cell;
    const y = originY + board.row0 * cell;
    const w = (board.col1 - board.col0) * cell;
    const h = (board.row1 - board.row0) * cell;
    sheet.ctx.strokeRect(x, y, w, h);
    const labelSize = Math.min(w, h) * 0.22;
    if (labelSize >= 2) {
      sheet.ctx.lineWidth = 0.5;
      sheet.ctx.strokeStyle = "#ffffff";
      sheet.ctx.font = `700 ${labelSize}px ${FONT}`;
      sheet.ctx.textAlign = "center";
      sheet.ctx.textBaseline = "middle";
      sheet.ctx.strokeText(board.label, x + w / 2, y + h / 2);
      sheet.ctx.fillStyle = "#E8704F";
      sheet.ctx.fillText(board.label, x + w / 2, y + h / 2);
      sheet.ctx.strokeStyle = "rgba(232,112,79,0.9)";
    }
  });
  const legendTop = originY + gridH + 6;
  const capacity = legendCapacity(page, legendTop + 6);
  const shown = legend.slice(0, capacity);
  sheet.text(`采购清单 · ${legend.length} 色`, MARGIN, legendTop + 2, 3.6, "#2A2420", 700);
  drawLegend(sheet, shown, MARGIN, legendTop + 5, contentW, LEGEND_ROW);
  drawPageNumber(sheet, pageIndex, pageCount);
  return { canvas: sheet.canvas, shown: shown.length };
}

function renderLegendPage(
  items: LegendItem[],
  page: { w: number; h: number },
  title: string,
  pageIndex: number,
  pageCount: number,
): { canvas: HTMLCanvasElement; shown: number } {
  const sheet = new Sheet(page.w, page.h, 140 / 25.4);
  sheet.text(title, MARGIN, 12, 6, "#2A2420", 700);
  const capacity = legendCapacity(page, 20);
  const shown = items.slice(0, capacity);
  drawLegend(sheet, shown, MARGIN, 18, page.w - MARGIN * 2, LEGEND_ROW);
  drawPageNumber(sheet, pageIndex, pageCount);
  return { canvas: sheet.canvas, shown: shown.length };
}

function renderBoardPage(
  grid: GridCell[][],
  board: BoardSlice,
  boards: BoardSlice[],
  page: { w: number; h: number },
  showCodes: boolean,
  scale: PdfScale,
  codeFor: (hex: string) => string,
  pageIndex: number,
  pageCount: number,
): HTMLCanvasElement {
  const sheet = new Sheet(page.w, page.h, 140 / 25.4);
  const boardRows = board.row1 - board.row0;
  const boardCols = board.col1 - board.col0;
  const cells: GridCell[] = [];
  for (let row = board.row0; row < board.row1; row++) {
    for (let col = board.col0; col < board.col1; col++) cells.push(grid[row][col]);
  }
  const legend = legendOf(cells, codeFor);
  const availW = page.w - MARGIN * 2 - AXIS;
  const availH = page.h - MARGIN - FOOTER - HEADER - AXIS;
  const wanted = scale === "5" ? 5 : scale === "2.6" ? 2.6 : 0;
  let cell = Math.min(availW / boardCols, availH / boardRows);
  let scaledDown = scale === "fit";
  if (wanted > 0 && boardCols * wanted <= availW + 0.01 && boardRows * wanted <= availH + 0.01) {
    cell = wanted;
    scaledDown = false;
  } else if (wanted > 0) {
    scaledDown = true;
  }
  const originX = MARGIN + AXIS + Math.max(0, (availW - boardCols * cell) / 2);
  const originY = MARGIN + HEADER + AXIS;

  sheet.text(board.label, MARGIN, MARGIN + 5, 7, "#2A2420", 700);
  sheet.text(
    `总览第 ${board.boardRow + 1} 行第 ${board.boardCol + 1} 列 · 全局行 ${board.row0 + 1}–${board.row1} · 列 ${board.col0 + 1}–${board.col1}`,
    MARGIN + 16,
    MARGIN + 5.2,
    3.1,
    "#6E645C",
  );
  const note = scaledDown && scale !== "fit"
    ? `已按页面缩放（${scale}mm 放不下）`
    : scale === "fit"
      ? "按页面缩放"
      : `1:1 · ${scale}mm · 100% 打印`;
  sheet.text(note, page.w - MARGIN - 24, MARGIN + 5.2, 2.8, "#A0968D", 500, "right");
  drawOverviewMap(sheet, boards, board, page.w - MARGIN - 20, MARGIN + 8, 16);

  drawAxes(sheet, originX, originY, cell, board.row0, board.row1, board.col0, board.col1);
  drawPattern(sheet, grid, originX, originY, cell, board.row0, board.row1, board.col0, board.col1, showCodes, codeFor);

  const legendTop = originY + boardRows * cell + 4;
  const capacity = legendCapacity(page, legendTop + 5);
  const shown = legend.slice(0, capacity);
  const beadCount = legend.reduce((sum, item) => sum + item.count, 0);
  sheet.text(
    shown.length < legend.length ? `本板 ${beadCount} 颗 · 其余见采购清单` : `本板 ${beadCount} 颗`,
    MARGIN,
    legendTop + 2,
    3.2,
    "#2A2420",
    700,
  );
  drawLegend(sheet, shown, MARGIN, legendTop + 5, page.w - MARGIN * 2, LEGEND_ROW);
  drawPageNumber(sheet, pageIndex, pageCount);
  return sheet.canvas;
}

export async function downloadBoardPdf(options: BoardPdfOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const grid = orient(options.grid, options.mirror);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) throw new Error("没有可导出的图纸");
  const boards = planBoards(rows, cols, options.boardSize);
  const page = paperSize(options.paper);
  const legend = legendOf(grid.flat(), options.codeFor);
  const subtitle = `${cols}×${rows} · ${options.systemLabel} · ${options.paletteLabel} · ${options.total} 颗 · ${legend.length} 色 · 分板 ${options.boardSize}`;
  const probe = renderOverview(grid, boards, legend, page, subtitle, 1, 1);
  const firstLegend = probe.shown;
  const rest: LegendItem[][] = [];
  let cursor = firstLegend;
  while (cursor < legend.length) {
    const capacity = legendCapacity(page, 20);
    rest.push(legend.slice(cursor, cursor + capacity));
    cursor += capacity;
  }
  const pageCount = 1 + rest.length + boards.length;
  const canvases: HTMLCanvasElement[] = [
    renderOverview(grid, boards, legend, page, subtitle, 1, pageCount).canvas,
  ];
  rest.forEach((items, index) => {
    canvases.push(renderLegendPage(items, page, "采购清单（续）", canvases.length + 1, pageCount).canvas);
  });
  boards.forEach((board) => {
    canvases.push(
      renderBoardPage(grid, board, boards, page, options.showCodes, options.scale, options.codeFor, canvases.length + 1, pageCount),
    );
  });
  if (canvases.length !== pageCount) throw new Error("分页数量不一致");
  const doc = new jsPDF({ unit: "mm", format: options.paper === "letter" ? "letter" : "a4", compress: true });
  doc.viewerPreferences({ PrintScaling: "None" });
  canvases.forEach((canvas, index) => {
    if (index > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, page.w, page.h, undefined, "FAST");
  });
  doc.save(`拼豆分板-${cols}x${rows}-${options.boardSize}-${options.systemLabel}.pdf`);
}
