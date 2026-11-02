/**
 * Per-board PDF sheets. Pages are drawn on canvas so Chinese text uses the
 * browser font, then placed into a lazily loaded jsPDF document.
 */

import { contrastText } from "./color";
import { compareCodes } from "./palette";
import type { GridCell } from "./pixelate";

const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';

export type PdfBoardSize = 29 | 58 | 87;
export type PdfPaper = "a4" | "letter";
export type PdfScale = "fit" | "2.6" | "5";

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

function paperSize(paper: PdfPaper): { w: number; h: number } {
  return paper === "letter" ? { w: 215.9, h: 279.4 } : { w: 210, h: 297 };
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

function legendHeight(count: number, width: number, rowH: number) {
  if (count === 0) return 0;
  const columns = width > 170 ? 3 : 2;
  return Math.ceil(count / columns) * rowH;
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

function renderOverview(
  grid: GridCell[][],
  boards: BoardSlice[],
  legend: LegendItem[],
  page: { w: number; h: number },
  subtitle: string,
): HTMLCanvasElement {
  const sheet = new Sheet(page.w, page.h, 140 / 25.4);
  const margin = 12;
  sheet.text("拼豆图纸", margin, 14, 8, "#2A2420", 700);
  sheet.text(subtitle, margin, 22, 3.4, "#6E645C", 500);
  const contentW = page.w - margin * 2;
  const rowH = legend.length > 48 ? 4.2 : 5.4;
  const fullLegendH = legendHeight(legend.length, contentW, rowH) + 8;
  const room = page.h - 30 - margin - 8;
  const legendH = Math.min(fullLegendH, Math.max(24, room * 0.42));
  const thumbTop = 30;
  const thumbH = Math.max(60, page.h - thumbTop - legendH - margin);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cell = Math.min((contentW - 2) / cols, (thumbH - 2) / rows);
  const gridW = cols * cell;
  const gridH = rows * cell;
  const originX = margin + (contentW - gridW) / 2;
  const originY = thumbTop + (thumbH - gridH) / 2;
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
  const legendTop = thumbTop + thumbH;
  sheet.text("色号", margin, legendTop + 3, 3.6, "#2A2420", 700);
  drawLegend(sheet, legend, margin, legendTop + 6, contentW, rowH);
  return sheet.canvas;
}

function renderBoardPage(
  grid: GridCell[][],
  board: BoardSlice,
  boards: BoardSlice[],
  page: { w: number; h: number },
  showCodes: boolean,
  scale: PdfScale,
  codeFor: (hex: string) => string,
): { canvas: HTMLCanvasElement; scaledDown: boolean } {
  const sheet = new Sheet(page.w, page.h, 140 / 25.4);
  const margin = 10;
  const boardRows = board.row1 - board.row0;
  const boardCols = board.col1 - board.col0;
  const cells: GridCell[] = [];
  for (let row = board.row0; row < board.row1; row++) {
    for (let col = board.col0; col < board.col1; col++) cells.push(grid[row][col]);
  }
  const legend = legendOf(cells, codeFor);
  const contentW = page.w - margin * 2;
  const rowH = 5.2;
  const legendH = legendHeight(legend.length, contentW, rowH) + 8;
  const headerH = 16;
  const axis = 8;
  const availW = contentW - axis;
  const availH = page.h - margin * 2 - headerH - axis - legendH;
  const wanted = scale === "5" ? 5 : scale === "2.6" ? 2.6 : 0;
  let cell = Math.min(availW / boardCols, availH / boardRows);
  let scaledDown = scale === "fit";
  if (wanted > 0 && boardCols * wanted <= availW + 0.1 && boardRows * wanted <= availH + 0.1) {
    cell = wanted;
    scaledDown = false;
  } else if (wanted > 0) {
    scaledDown = true;
  }
  const originX = margin + axis + Math.max(0, (availW - boardCols * cell) / 2);
  const originY = margin + headerH + axis;

  sheet.text(board.label, margin, margin + 5, 7, "#2A2420", 700);
  sheet.text(
    `总览第 ${board.boardRow + 1} 行第 ${board.boardCol + 1} 列 · 全局行 ${board.row0 + 1}–${board.row1} · 列 ${board.col0 + 1}–${board.col1}`,
    margin + 16,
    margin + 5.2,
    3.1,
    "#6E645C",
  );
  const note = scaledDown && scale !== "fit"
    ? `已按页面缩放（${scale}mm 放不下）`
    : scale === "fit"
      ? "按页面缩放"
      : `1:1 · ${scale}mm`;
  sheet.text(note, page.w - margin, margin + 5.2, 3, "#A0968D", 500, "right");
  drawOverviewMap(sheet, boards, board, page.w - margin - 22, margin + 8, 18);

  drawAxes(sheet, originX, originY, cell, board.row0, board.row1, board.col0, board.col1);
  drawPattern(sheet, grid, originX, originY, cell, board.row0, board.row1, board.col0, board.col1, showCodes, codeFor);

  const legendTop = originY + boardRows * cell + 4;
  sheet.text(`本板 ${legend.reduce((sum, item) => sum + item.count, 0)} 颗`, margin, legendTop + 2, 3.3, "#2A2420", 700);
  drawLegend(sheet, legend, margin, legendTop + 4, contentW, rowH);
  return { canvas: sheet.canvas, scaledDown };
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
  const overview = renderOverview(grid, boards, legend, page, subtitle);
  const doc = new jsPDF({ unit: "mm", format: options.paper === "letter" ? "letter" : "a4", compress: true });
  const place = (canvas: HTMLCanvasElement) => {
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, page.w, page.h, undefined, "FAST");
  };
  place(overview);
  boards.forEach((board) => {
    doc.addPage();
    place(renderBoardPage(grid, board, boards, page, options.showCodes, options.scale, options.codeFor).canvas);
  });
  doc.save(`拼豆分板-${cols}x${rows}-${options.boardSize}-${options.systemLabel}.pdf`);
}
