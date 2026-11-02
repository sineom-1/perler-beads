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
  /** Every display code in the active brand, used to reject unsafe abbreviations. */
  paletteCodes?: readonly string[];
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

/** 58 and 87 are 5mm boards that do not fit a page at 1:1, so the chip says scaled print only. */
export function boardChipLabel(size: PdfBoardSize): string {
  if (size === 58 || size === 87) return `${size} 仅支持缩放打印`;
  return `${size} 板`;
}

/** Interior bold grid lines, counted from this board's own edge (5, 10, 15, …). */
export function boldGuideOffsets(length: number): number[] {
  const marks: number[] = [];
  for (let local = 5; local < length; local += 5) marks.push(local);
  return marks;
}

/** 1-based axis numbers for one board: the first cell, every fifth, and the last cell. */
export function boardAxisNumbers(length: number): number[] {
  const numbers: number[] = [];
  for (let n = 1; n <= length; n++) {
    if (n === 1 || n === length || n % 5 === 0) numbers.push(n);
  }
  return numbers;
}

/** Global placement stays in the header; the grid itself is numbered per board. */
export function boardPageHeader(board: BoardSlice): string {
  return `总览第 ${board.boardRow + 1} 行第 ${board.boardCol + 1} 列 · 全局行 ${board.row0 + 1}–${board.row1} · 列 ${board.col0 + 1}–${board.col1}`;
}

const PDF_EXPORT_PREFS_KEY = "perler-pdf-export";

export function pdfExportPrefsKey(): string {
  return PDF_EXPORT_PREFS_KEY;
}

export interface PdfExportPrefs {
  pitch: BeadPitch;
  board: PdfBoardSize;
  paper: PdfPaper;
  scale: PdfScale;
}

const PDF_BOARD_SIZES = new Set<number>([...STANDARD_BOARDS, ...MINI_BOARDS]);

export function parsePdfPrefs(raw: string | null): PdfExportPrefs | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { board?: unknown; paper?: unknown; scale?: unknown };
    if (typeof data.board !== "number" || !PDF_BOARD_SIZES.has(data.board)) return null;
    if (data.paper !== "a4" && data.paper !== "letter") return null;
    if (data.scale !== "fit" && data.scale !== "2.6" && data.scale !== "5") return null;
    const board = data.board as PdfBoardSize;
    const pitch = boardPitch(board);
    const scale = data.scale === "fit" || data.scale === pitch ? data.scale : preferredScale(board, data.paper);
    return { pitch, board, paper: data.paper, scale };
  } catch {
    return null;
  }
}

export function serializePdfPrefs(prefs: PdfExportPrefs): string {
  return JSON.stringify({ pitch: prefs.pitch, board: prefs.board, paper: prefs.paper, scale: prefs.scale });
}

/** 200dpi so 2.6mm codes have enough pixels. One canvas is reused for every page. */
export const PDF_DPI = 200;
export const PDF_PX_PER_MM = PDF_DPI / 25.4;

/** Smallest bead-code font that stays legible at 1:1. Below this, draw a dot instead of text. */
export const MIN_CODE_FONT_MM = 1;

export type FittedBeadCode = { kind: "text"; text: string; size: number } | { kind: "dot" };

/** A01 -> A1. Returns null when the code has no zero padding to remove. */
export function stripCodePadding(code: string): string | null {
  const full = code.trim();
  const unpadded = full.replace(/^([A-Za-z]+)0+(\d+)$/, "$1$2");
  return unpadded !== full ? unpadded : null;
}

function collidesWithPalette(label: string, original: string, paletteCodes: ReadonlySet<string>): boolean {
  const upper = label.toUpperCase();
  for (const code of paletteCodes) {
    if (code === original) continue;
    if (code === label || code.toUpperCase() === upper) return true;
  }
  return false;
}

function estimateTextWidth(text: string, size: number): number {
  let width = 0;
  for (const char of text) width += char.charCodeAt(0) > 255 ? size : size * 0.62;
  return width;
}

/**
 * Fit a bead code into a cell. The only abbreviation is stripping zero-padding
 * (A01 -> A1), and only when that shorter form is not some other code in the
 * same brand. Otherwise the cell gets a dot and the legend carries the code.
 */
export function fitBeadCode(code: string, cellMm: number, paletteCodes: ReadonlySet<string> = new Set()): FittedBeadCode | null {
  const full = code.trim();
  if (!full || !(cellMm > 0)) return null;
  const labels = [full];
  const unpadded = stripCodePadding(full);
  if (unpadded && !collidesWithPalette(unpadded, full, paletteCodes)) labels.push(unpadded);
  const maxWidth = Math.max(0.4, cellMm - 0.22);
  const heightCap = cellMm * 0.72;
  if (heightCap < MIN_CODE_FONT_MM) return { kind: "dot" };
  for (const text of labels) {
    let size = Math.min(heightCap, 3.2);
    while (estimateTextWidth(text, size) > maxWidth && size > MIN_CODE_FONT_MM) {
      size = Math.round((size - 0.05) * 100) / 100;
    }
    if (size + 0.001 >= MIN_CODE_FONT_MM && estimateTextWidth(text, size) <= maxWidth + 0.01) {
      return { kind: "text", text, size };
    }
  }
  return { kind: "dot" };
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
    this.clear();
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.pxPerMm, 0, 0, this.pxPerMm, 0, 0);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.textBaseline = "middle";
    this.ctx.lineWidth = 0.2;
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

function drawCodeDot(sheet: Sheet, fill: string, cx: number, cy: number, cell: number) {
  const radius = Math.min(0.42, Math.max(0.22, cell * 0.16));
  sheet.ctx.beginPath();
  sheet.ctx.fillStyle = fill;
  sheet.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  sheet.ctx.fill();
}

function drawBeadCode(sheet: Sheet, code: string, hex: string, x: number, y: number, cell: number, paletteCodes: ReadonlySet<string>) {
  const fitted = fitBeadCode(code, cell, paletteCodes);
  const fill = contrastText(hex);
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  if (!fitted || fitted.kind === "dot") {
    if (fitted) drawCodeDot(sheet, fill, cx, cy, cell);
    return;
  }
  const maxWidth = Math.max(0.4, cell - 0.22);
  let size = fitted.size;
  sheet.ctx.textAlign = "center";
  sheet.ctx.textBaseline = "middle";
  const measure = () => {
    sheet.ctx.font = `700 ${size}px ${FONT}`;
    return sheet.ctx.measureText(fitted.text).width;
  };
  while (size > MIN_CODE_FONT_MM && measure() > maxWidth) size = Math.round((size - 0.05) * 100) / 100;
  if (measure() > maxWidth || size + 0.001 < MIN_CODE_FONT_MM) {
    drawCodeDot(sheet, fill, cx, cy, cell);
    return;
  }
  sheet.ctx.lineWidth = Math.max(0.12, size * 0.14);
  sheet.ctx.strokeStyle = fill === "#ffffff" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)";
  sheet.ctx.strokeText(fitted.text, cx, cy);
  sheet.ctx.fillStyle = fill;
  sheet.ctx.fillText(fitted.text, cx, cy);
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
  paletteCodes: ReadonlySet<string>,
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
      if (showCodes && !empty) drawBeadCode(sheet, codeFor(bead.hex), bead.hex, x, y, cell, paletteCodes);
    }
  }

  const boldCols = new Set(boldGuideOffsets(boardCols));
  const boldRows = new Set(boldGuideOffsets(boardRows));
  const stroke = (kind: "all" | "bold", color: string, width: number) => {
    sheet.ctx.strokeStyle = color;
    sheet.ctx.lineWidth = width;
    sheet.ctx.beginPath();
    for (let col = col0; col <= col1; col++) {
      const local = col - col0;
      if (kind === "bold" && !boldCols.has(local)) continue;
      const x = originX + local * cell;
      sheet.ctx.moveTo(x, originY);
      sheet.ctx.lineTo(x, originY + boardRows * cell);
    }
    for (let row = row0; row <= row1; row++) {
      const local = row - row0;
      if (kind === "bold" && !boldRows.has(local)) continue;
      const y = originY + local * cell;
      sheet.ctx.moveTo(originX, y);
      sheet.ctx.lineTo(originX + boardCols * cell, y);
    }
    sheet.ctx.stroke();
  };
  stroke("all", "rgba(42,36,32,0.12)", 0.08);
  stroke("bold", "rgba(42,36,32,0.75)", 0.35);
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
  const columns = new Set(boardAxisNumbers(col1 - col0));
  const rows = new Set(boardAxisNumbers(row1 - row0));
  for (let col = col0; col < col1; col++) {
    const number = col - col0 + 1;
    if (!columns.has(number)) continue;
    if (cell < 2.4 && number % 5 !== 0) continue;
    const x = originX + (number - 1) * cell + cell / 2;
    sheet.ctx.fillText(String(number), x, originY - 3.2);
  }
  for (let row = row0; row < row1; row++) {
    const number = row - row0 + 1;
    if (!rows.has(number)) continue;
    if (cell < 2.4 && number % 5 !== 0) continue;
    const y = originY + (number - 1) * cell + cell / 2;
    sheet.ctx.fillText(String(number), originX - 4.2, y);
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
  sheet: Sheet,
  grid: GridCell[][],
  boards: BoardSlice[],
  legend: LegendItem[],
  page: { w: number; h: number },
  subtitle: string,
  pageIndex: number,
  pageCount: number,
): number {
  sheet.clear();
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
  drawPattern(sheet, grid, originX, originY, cell, 0, rows, 0, cols, false, () => "", new Set());
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
  return shown.length;
}

function renderLegendPage(
  sheet: Sheet,
  items: LegendItem[],
  page: { w: number; h: number },
  title: string,
  pageIndex: number,
  pageCount: number,
) {
  sheet.clear();
  sheet.text(title, MARGIN, 12, 6, "#2A2420", 700);
  const capacity = legendCapacity(page, 20);
  const shown = items.slice(0, capacity);
  drawLegend(sheet, shown, MARGIN, 18, page.w - MARGIN * 2, LEGEND_ROW);
  drawPageNumber(sheet, pageIndex, pageCount);
}

function renderBoardPage(
  sheet: Sheet,
  grid: GridCell[][],
  board: BoardSlice,
  boards: BoardSlice[],
  page: { w: number; h: number },
  showCodes: boolean,
  scale: PdfScale,
  codeFor: (hex: string) => string,
  paletteCodes: ReadonlySet<string>,
  pageIndex: number,
  pageCount: number,
) {
  sheet.clear();
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
  sheet.text(boardPageHeader(board), MARGIN + 16, MARGIN + 5.2, 3.1, "#6E645C");
  const note = scaledDown && scale !== "fit"
    ? `已按页面缩放（${scale}mm 放不下）`
    : scale === "fit"
      ? "按页面缩放"
      : `1:1 · ${scale}mm · 100% 打印`;
  sheet.text(note, page.w - MARGIN - 24, MARGIN + 5.2, 2.8, "#A0968D", 500, "right");
  drawOverviewMap(sheet, boards, board, page.w - MARGIN - 20, MARGIN + 8, 16);

  drawAxes(sheet, originX, originY, cell, board.row0, board.row1, board.col0, board.col1);
  drawPattern(sheet, grid, originX, originY, cell, board.row0, board.row1, board.col0, board.col1, showCodes, codeFor, paletteCodes);

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
  const paletteCodes = new Set(options.paletteCodes ?? []);
  const sheet = new Sheet(page.w, page.h, PDF_PX_PER_MM);
  const firstLegend = renderOverview(sheet, grid, boards, legend, page, subtitle, 1, 1);
  const rest: LegendItem[][] = [];
  let cursor = firstLegend;
  while (cursor < legend.length) {
    const capacity = legendCapacity(page, 20);
    rest.push(legend.slice(cursor, cursor + capacity));
    cursor += capacity;
  }
  const pageCount = 1 + rest.length + boards.length;
  const doc = new jsPDF({ unit: "mm", format: options.paper === "letter" ? "letter" : "a4", compress: true });
  doc.viewerPreferences({ PrintScaling: "None" });
  let drawn = 0;
  const commit = () => {
    if (drawn > 0) doc.addPage();
    doc.addImage(sheet.canvas.toDataURL("image/png"), "PNG", 0, 0, page.w, page.h, undefined, "FAST");
    drawn += 1;
  };
  renderOverview(sheet, grid, boards, legend, page, subtitle, 1, pageCount);
  commit();
  rest.forEach((items) => {
    renderLegendPage(sheet, items, page, "采购清单（续）", drawn + 1, pageCount);
    commit();
  });
  boards.forEach((board) => {
    renderBoardPage(sheet, grid, board, boards, page, options.showCodes, options.scale, options.codeFor, paletteCodes, drawn + 1, pageCount);
    commit();
  });
  if (drawn !== pageCount) throw new Error("分页数量不一致");
  doc.save(`拼豆分板-${cols}x${rows}-${options.boardSize}-${options.systemLabel}.pdf`);
}
