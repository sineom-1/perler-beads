/**
 * 1:1 printable PDF, one pegboard per A4 page.
 *
 * Every page is drawn on a canvas at a fixed DPI and embedded as a JPEG, so
 * Chinese labels need no font embedding. Cell size equals the real bead pitch,
 * so a page printed at "actual size / 100%" can sit directly under a board.
 */

import { contrastText } from "./color";
import { compareCodes } from "./palette";
import type { GridCell } from "./pixelate";

const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif';
const DPI = 200;
const PX_PER_MM = DPI / 25.4;
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PAGE_W_PT = 595.28;
const PAGE_H_PT = 841.89;
const MARGIN_MM = 12;

export interface PrintPdfOptions {
  grid: GridCell[][];
  pitchMm: number;
  board: number;
  mirror: boolean;
  systemLabel: string;
  paletteLabel: string;
  codeFor: (hex: string) => string;
  onProgress?: (ratio: number) => void;
}

interface Page {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

const mm = (value: number) => value * PX_PER_MM;

function newPage(): Page {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mm(PAGE_W_MM));
  canvas.height = Math.round(mm(PAGE_H_MM));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建打印页");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "middle";
  return { canvas, context };
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, sizeMm: number, options: { weight?: number; align?: CanvasTextAlign; color?: string } = {}) {
  context.font = `${options.weight ?? 500} ${mm(sizeMm)}px ${FONT}`;
  context.textAlign = options.align ?? "left";
  context.fillStyle = options.color ?? "#241c16";
  context.fillText(value, x, y);
}

function footer(page: Page, pageNo: number, pageCount: number) {
  const { context } = page;
  const y = mm(PAGE_H_MM - 8);
  // Calibration bar: exactly 100 mm when printed at 100%.
  const barX = mm(MARGIN_MM);
  const barY = mm(PAGE_H_MM - 20);
  context.fillStyle = "#241c16";
  context.fillRect(barX, barY, mm(100), mm(1.2));
  for (let i = 0; i <= 10; i++) context.fillRect(barX + mm(i * 10) - mm(0.15), barY - mm(i % 5 === 0 ? 2 : 1.2), mm(0.3), mm(i % 5 === 0 ? 2 : 1.2));
  text(context, "10 cm", barX + mm(103), barY + mm(0.6), 2.6, { weight: 700 });
  text(context, "打印时选「实际大小 / 100%」，别选「适合页面」；打完量一下左边这条线，应正好 10 厘米。", mm(PAGE_W_MM - MARGIN_MM), barY - mm(3.5), 2.4, { align: "right", color: "#6e645c" });
  text(context, `${pageNo} / ${pageCount}`, mm(PAGE_W_MM - MARGIN_MM), y, 2.6, { align: "right", color: "#6e645c" });
}

function countColors(cells: GridCell[]) {
  const map = new Map<string, number>();
  for (const cell of cells) {
    if (cell.isExternal) continue;
    map.set(cell.hex, (map.get(cell.hex) ?? 0) + 1);
  }
  return map;
}

/** Draws a color list from `top`; returns entries that did not fit. */
function drawLegend(
  page: Page,
  entries: [string, number][],
  top: number,
  bottom: number,
  codeFor: (hex: string) => string,
): [string, number][] {
  const { context } = page;
  const columns = 4;
  const rowH = mm(6.5);
  const colW = (mm(PAGE_W_MM) - mm(MARGIN_MM) * 2) / columns;
  const fitRows = Math.max(0, Math.floor((bottom - top) / rowH));
  const capacity = fitRows * columns;
  entries.slice(0, capacity).forEach(([hex, count], index) => {
    const col = Math.floor(index / fitRows);
    const row = index % fitRows;
    const x = mm(MARGIN_MM) + col * colW;
    const y = top + row * rowH + rowH / 2;
    context.fillStyle = hex;
    context.fillRect(x, y - mm(2.2), mm(4.4), mm(4.4));
    context.strokeStyle = "rgba(36,28,22,0.35)";
    context.lineWidth = 1;
    context.strokeRect(x, y - mm(2.2), mm(4.4), mm(4.4));
    text(context, codeFor(hex), x + mm(6), y, 3.2, { weight: 700 });
    text(context, `${count} 颗`, x + colW - mm(4), y, 3, { align: "right" });
  });
  return entries.slice(capacity);
}

function drawBoardPage(
  page: Page,
  grid: GridCell[][],
  r0: number,
  c0: number,
  rows: number,
  cols: number,
  options: PrintPdfOptions,
  label: string,
) {
  const { context } = page;
  const { pitchMm, codeFor } = options;
  const cell = mm(pitchMm);
  const axis = mm(6);
  const left = mm(MARGIN_MM) + axis;
  const top = mm(MARGIN_MM + 16) + axis;

  text(context, label, mm(MARGIN_MM), mm(MARGIN_MM + 3), 5, { weight: 700 });
  text(
    context,
    `第 ${c0 + 1}–${c0 + cols} 列 · 第 ${r0 + 1}–${r0 + rows} 行 · 豆距 ${pitchMm} mm${options.mirror ? " · 已镜像" : ""}`,
    mm(MARGIN_MM),
    mm(MARGIN_MM + 10),
    3.2,
    { color: "#6e645c" },
  );

  const cells: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bead = grid[r0 + r][c0 + c];
      cells.push(bead);
      const x = left + c * cell;
      const y = top + r * cell;
      context.fillStyle = bead.isExternal ? "#ffffff" : bead.hex;
      context.fillRect(x, y, cell, cell);
      if (!bead.isExternal) {
        const code = codeFor(bead.hex);
        let size = cell * 0.36;
        context.font = `700 ${size}px ${FONT}`;
        while (size > 6 && context.measureText(code).width > cell * 0.9) {
          size -= 1;
          context.font = `700 ${size}px ${FONT}`;
        }
        context.textAlign = "center";
        context.fillStyle = contrastText(bead.hex);
        context.fillText(code, x + cell / 2, y + cell / 2 + 1);
      }
    }
  }

  const line = (step: number, width: number, color: string) => {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    for (let c = 0; c <= cols; c++) {
      if ((c0 + c) % step !== 0 && c !== 0 && c !== cols) continue;
      const x = left + c * cell;
      context.moveTo(x, top);
      context.lineTo(x, top + rows * cell);
    }
    for (let r = 0; r <= rows; r++) {
      if ((r0 + r) % step !== 0 && r !== 0 && r !== rows) continue;
      const y = top + r * cell;
      context.moveTo(left, y);
      context.lineTo(left + cols * cell, y);
    }
    context.stroke();
  };
  line(1, 1, "rgba(36,28,22,0.25)");
  line(5, 2.5, "rgba(36,28,22,0.6)");
  line(10, 4, "rgba(194,65,45,0.95)");

  const every = pitchMm >= 4 ? 1 : 5;
  context.font = `600 ${Math.min(cell * 0.42, mm(2.6))}px ${FONT}`;
  context.fillStyle = "#241c16";
  context.textAlign = "center";
  for (let c = 0; c < cols; c++) {
    const n = c0 + c + 1;
    if (n % every !== 0 && c !== 0) continue;
    const x = left + c * cell + cell / 2;
    context.fillText(String(n), x, top - axis / 2);
    context.fillText(String(n), x, top + rows * cell + axis / 2);
  }
  for (let r = 0; r < rows; r++) {
    const n = r0 + r + 1;
    if (n % every !== 0 && r !== 0) continue;
    const y = top + r * cell + cell / 2;
    context.fillText(String(n), left - axis / 2, y);
    context.fillText(String(n), left + cols * cell + axis / 2, y);
  }

  const legendTop = top + rows * cell + axis + mm(6);
  text(context, "本块用色", mm(MARGIN_MM), legendTop, 3.6, { weight: 700 });
  const entries = [...countColors(cells)].sort((a, b) => compareCodes(codeFor(a[0]), codeFor(b[0])));
  drawLegend(page, entries, legendTop + mm(3), mm(PAGE_H_MM - 30), codeFor);
}

function drawCover(
  page: Page,
  grid: GridCell[][],
  boardsX: number,
  boardsY: number,
  boardLabels: Map<string, number>,
  options: PrintPdfOptions,
  entries: [string, number][],
): number {
  const { context } = page;
  const rows = grid.length;
  const cols = grid[0].length;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  text(context, "数豆格 · 1:1 打印版", mm(MARGIN_MM), mm(MARGIN_MM + 3), 6, { weight: 700 });
  text(
    context,
    `${cols} × ${rows} 格 · ${options.systemLabel} · ${options.paletteLabel} · ${entries.length} 色 · ${total} 颗 · 每页一块 ${options.board}×${options.board} 板，共 ${boardLabels.size} 块`,
    mm(MARGIN_MM),
    mm(MARGIN_MM + 11),
    3.2,
    { color: "#6e645c" },
  );
  const finished = `成品约 ${((cols * options.pitchMm) / 10).toFixed(1)} × ${((rows * options.pitchMm) / 10).toFixed(1)} 厘米（豆距 ${options.pitchMm} mm）${options.mirror ? " · 已镜像，适合美纹纸烫" : ""}`;
  text(context, finished, mm(MARGIN_MM), mm(MARGIN_MM + 17), 3.2, { color: "#6e645c" });

  const boxW = mm(PAGE_W_MM - MARGIN_MM * 2);
  const boxH = mm(110);
  const cell = Math.min(boxW / cols, boxH / rows);
  const left = mm(MARGIN_MM) + (boxW - cols * cell) / 2;
  const top = mm(MARGIN_MM + 24);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bead = grid[r][c];
      context.fillStyle = bead.isExternal ? "#f4efe8" : bead.hex;
      context.fillRect(left + c * cell, top + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  context.strokeStyle = "rgba(194,65,45,0.95)";
  context.lineWidth = 3;
  for (let by = 0; by < boardsY; by++) {
    for (let bx = 0; bx < boardsX; bx++) {
      const x = left + bx * options.board * cell;
      const y = top + by * options.board * cell;
      const w = Math.min(options.board, cols - bx * options.board) * cell;
      const h = Math.min(options.board, rows - by * options.board) * cell;
      context.strokeRect(x, y, w, h);
      const pageNo = boardLabels.get(`${by},${bx}`);
      const tag = pageNo ? `第${pageNo}页` : "空";
      context.font = `700 ${Math.max(mm(2.6), Math.min(mm(5), w / 5))}px ${FONT}`;
      const tw = context.measureText(tag).width + mm(2);
      context.fillStyle = "rgba(255,255,255,0.85)";
      context.fillRect(x + w / 2 - tw / 2, y + h / 2 - mm(3), tw, mm(6));
      context.fillStyle = "#c2412d";
      context.textAlign = "center";
      context.fillText(tag, x + w / 2, y + h / 2);
    }
  }

  const listTop = top + rows * cell + mm(8);
  text(context, "全图用色（买豆参考，建议每色多备 10% 左右）", mm(MARGIN_MM), listTop, 3.6, { weight: 700 });
  const rest = drawLegend(page, entries, listTop + mm(3), mm(PAGE_H_MM - 30), options.codeFor);
  return rest.length;
}

function decodeDataUrl(url: string): Uint8Array {
  const binary = atob(url.slice(url.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Minimal PDF 1.4 writer: one full-page JPEG per page. */
export function buildImagePdf(images: { bytes: Uint8Array; width: number; height: number }[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const pageIds = images.map((_, index) => 3 + index * 3);
  object(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${images.length} >>`));
  images.forEach((image, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q ${PAGE_W_PT} 0 0 ${PAGE_H_PT} 0 0 cm /Im0 Do Q`;
    object(pageId, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W_PT} ${PAGE_H_PT}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
    object(contentId, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    object(imageId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      push(image.bytes);
      push("\nendstream");
    });
  });
  const xref = length;
  const count = 3 + images.length * 3;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id++) table += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function renderPrintPdf(options: PrintPdfOptions): Promise<{ blob: Blob; pages: number }> {
  const grid = options.mirror ? options.grid.map((row) => [...row].reverse()) : options.grid;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) throw new Error("没有可打印的图纸");
  const board = options.board;
  if (board * options.pitchMm + 12 > PAGE_W_MM - MARGIN_MM * 2) throw new Error("这个豆距放不下一整块板");
  const boardsX = Math.ceil(cols / board);
  const boardsY = Math.ceil(rows / board);

  const boards: { by: number; bx: number }[] = [];
  for (let by = 0; by < boardsY; by++) {
    for (let bx = 0; bx < boardsX; bx++) {
      let filled = false;
      for (let r = by * board; r < Math.min(rows, (by + 1) * board) && !filled; r++) {
        for (let c = bx * board; c < Math.min(cols, (bx + 1) * board); c++) {
          if (!grid[r][c].isExternal) {
            filled = true;
            break;
          }
        }
      }
      if (filled) boards.push({ by, bx });
    }
  }

  const all = [...countColors(grid.flat())].sort((a, b) => compareCodes(options.codeFor(a[0]), options.codeFor(b[0])));
  const coverPages = 1;
  const labels = new Map(boards.map((item, index) => [`${item.by},${item.bx}`, coverPages + index + 1]));
  const pageCount = coverPages + boards.length;
  const images: { bytes: Uint8Array; width: number; height: number }[] = [];
  const keep = (page: Page, pageNo: number) => {
    footer(page, pageNo, pageCount);
    images.push({ bytes: decodeDataUrl(page.canvas.toDataURL("image/jpeg", 0.9)), width: page.canvas.width, height: page.canvas.height });
    page.canvas.width = 1;
  };

  const cover = newPage();
  const overflow = drawCover(cover, grid, boardsX, boardsY, labels, options, all);
  if (overflow > 0) text(cover.context, `还有 ${overflow} 色见各页“本块用色”`, mm(MARGIN_MM), mm(PAGE_H_MM - 27), 3, { color: "#c2412d" });
  keep(cover, 1);

  for (let index = 0; index < boards.length; index++) {
    const { by, bx } = boards[index];
    const page = newPage();
    const r0 = by * board;
    const c0 = bx * board;
    drawBoardPage(
      page,
      grid,
      r0,
      c0,
      Math.min(board, rows - r0),
      Math.min(board, cols - c0),
      options,
      `第 ${index + 2} 页 · 第 ${by + 1} 排第 ${bx + 1} 块板`,
    );
    keep(page, index + 2);
    options.onProgress?.((index + 1) / boards.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { blob: buildImagePdf(images), pages: pageCount };
}
