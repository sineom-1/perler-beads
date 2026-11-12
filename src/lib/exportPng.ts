/**
 * Printable pattern sheet and shopping-list PNG.
 * Grid lines, color codes, and per-color counts follow the upstream exporter
 * in Zippland/perler-beads (AGPL-3.0, Copyright (C) Zippland), without that
 * project's watermarks.
 */

import { contrastText } from "./color";
import { compareCodes } from "./palette";
import type { ColorCount, GridCell } from "./pixelate";

const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export interface PatternExportOptions {
  grid: GridCell[][];
  counts: ColorCount[];
  total: number;
  systemLabel: string;
  paletteLabel: string;
  showCodes: boolean;
  includeStats: boolean;
  gridInterval: number;
  showCoordinates: boolean;
  showGrid?: boolean;
  beadShape?: "round" | "square";
  mirror?: boolean;
  codeFor: (hex: string) => string;
}

function chooseCell(cols: number, rows: number): number {
  let cell = 28;
  while ((cols * cell > 7800 || rows * cell > 7600) && cell > 12) cell -= 1;
  return cell;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
  } else {
    context.rect(x, y, width, height);
  }
}

function drawBeadMark(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "#c2412d";
  roundedRect(context, 0, 0, size, size, size * 0.18);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.85)";
  const bead = size / 5;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      context.fillRect(size * 0.18 + col * bead * 1.35, size * 0.18 + row * bead * 1.35, bead, bead);
    }
  }
  context.restore();
}

export function renderPatternCanvas(options: PatternExportOptions): HTMLCanvasElement {
  const sourceGrid = options.mirror ? options.grid.map((row) => [...row].reverse()) : options.grid;
  const grid = sourceGrid;
  const { counts, total, systemLabel, paletteLabel, showCodes, includeStats, codeFor } = options;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const showGrid = options.showGrid !== false;
  const round = options.beadShape === "round";
  const cell = chooseCell(cols, rows);
  const interval = Math.max(1, options.gridInterval);
  const axis = options.showCoordinates ? Math.max(26, Math.round(cell * 0.9)) : 0;
  const margin = 32;
  const titleH = 84;
  const gridW = cols * cell;
  const gridH = rows * cell;
  const contentW = gridW + axis * 2;
  const width = Math.max(720, contentW + margin * 2);
  const originX = Math.round((width - contentW) / 2) + axis;
  const originY = titleH + 16 + axis;

  const sorted = [...counts].sort((a, b) => compareCodes(codeFor(a.hex), codeFor(b.hex)));
  const statColumns = Math.max(1, Math.min(4, Math.floor((width - margin * 2) / 220)));
  const statRows = Math.ceil(sorted.length / statColumns) || 0;
  const statsH = includeStats && sorted.length > 0 ? 48 + statRows * 32 + 28 : 0;
  const height = originY + gridH + axis + statsH + 48;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建图纸");
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#241c16";
  context.fillRect(0, 0, width, titleH);
  drawBeadMark(context, 24, 18, 48);
  context.fillStyle = "#fffdf8";
  context.font = `700 28px ${FONT}`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText("数豆格 · 拼豆图纸", 84, 34);
  context.font = `500 16px ${FONT}`;
  context.fillStyle = "rgba(255,253,248,0.82)";
  context.fillText(`${cols} × ${rows} 格 · ${systemLabel} · ${paletteLabel} · ${sorted.length} 色 · ${total} 颗`, 84, 60);

  if (options.showCoordinates) {
    context.fillStyle = "#f6f0e6";
    context.fillRect(originX, titleH + 16, gridW, axis);
    context.fillRect(originX, originY + gridH, gridW, axis);
    context.fillRect(originX - axis, originY, axis, gridH);
    context.fillRect(originX + gridW, originY, axis, gridH);
    context.fillStyle = "#241c16";
    context.font = `600 13px ${FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let col = 0; col < cols; col++) {
      if ((col + 1) % interval !== 0 && col !== 0 && col !== cols - 1) continue;
      const x = originX + col * cell + cell / 2;
      context.fillText(String(col + 1), x, titleH + 16 + axis / 2);
      context.fillText(String(col + 1), x, originY + gridH + axis / 2);
    }
    for (let row = 0; row < rows; row++) {
      if ((row + 1) % interval !== 0 && row !== 0 && row !== rows - 1) continue;
      const y = originY + row * cell + cell / 2;
      context.fillText(String(row + 1), originX - axis / 2, y);
      context.fillText(String(row + 1), originX + gridW + axis / 2, y);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bead = grid[row][col];
      const x = originX + col * cell;
      const y = originY + row * cell;
      if (bead.isExternal || !round) {
        context.fillStyle = bead.isExternal ? "#ffffff" : bead.hex;
        context.fillRect(x, y, cell, cell);
      } else {
        context.fillStyle = "#ffffff";
        context.fillRect(x, y, cell, cell);
        context.beginPath();
        context.fillStyle = bead.hex;
        context.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
        context.fill();
      }
      if (showCodes && !bead.isExternal) {
        const label = codeFor(bead.hex);
        let size = Math.max(8, Math.floor(cell * 0.38));
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `700 ${size}px ${FONT}`;
        while (size > 7 && context.measureText(label).width > cell - 4) {
          size -= 1;
          context.font = `700 ${size}px ${FONT}`;
        }
        if (context.measureText(label).width <= cell - 2) {
          context.fillStyle = contrastText(bead.hex);
          context.fillText(label, x + cell / 2, y + cell / 2 + 0.5);
        }
      }
      if (showGrid && !round) {
        context.strokeStyle = "rgba(42,36,32,0.10)";
        context.lineWidth = 1;
        context.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
    }
  }

  if (showGrid) {
    const strokeGuides = (step: number, color: string, width: number) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      for (let col = step; col < cols; col += step) {
        const x = originX + col * cell;
        context.moveTo(x, originY);
        context.lineTo(x, originY + gridH);
      }
      for (let row = step; row < rows; row += step) {
        const y = originY + row * cell;
        context.moveTo(originX, y);
        context.lineTo(originX + gridW, y);
      }
      context.stroke();
    };
    strokeGuides(5, "rgba(42,36,32,0.45)", 2);
    strokeGuides(10, "rgba(42,36,32,0.8)", 3);
    strokeGuides(29, "rgba(232,112,79,0.85)", 2.5);
    context.strokeStyle = "#2A2420";
    context.lineWidth = 1.5;
    context.strokeRect(originX + 0.5, originY + 0.5, gridW, gridH);
  }

  if (includeStats && sorted.length > 0) {
    const top = originY + gridH + axis + 28;
    context.fillStyle = "#241c16";
    context.font = `700 18px ${FONT}`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("用色统计", margin, top);
    context.strokeStyle = "#e4d5bf";
    context.beginPath();
    context.moveTo(margin, top + 16);
    context.lineTo(width - margin, top + 16);
    context.stroke();

    const columnWidth = (width - margin * 2) / statColumns;
    sorted.forEach((item, index) => {
      const column = index % statColumns;
      const line = Math.floor(index / statColumns);
      const x = margin + column * columnWidth;
      const y = top + 36 + line * 32;
      context.fillStyle = item.hex;
      context.fillRect(x, y - 9, 18, 18);
      context.strokeStyle = "rgba(36,28,22,0.25)";
      context.strokeRect(x + 0.5, y - 8.5, 17, 17);
      context.fillStyle = "#241c16";
      context.font = `600 15px ${FONT}`;
      context.textAlign = "left";
      context.fillText(codeFor(item.hex), x + 26, y);
      context.textAlign = "right";
      context.font = `500 15px ${FONT}`;
      context.fillText(`${item.count} 颗`, x + columnWidth - 16, y);
    });
    const footerY = top + 36 + statRows * 32 + 4;
    context.textAlign = "right";
    context.font = `700 16px ${FONT}`;
    context.fillText(`合计 ${total} 颗`, width - margin, footerY);
  }

  context.fillStyle = "#A0968D";
  context.font = `500 13px ${FONT}`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(`数豆格 · ${new Date().toLocaleDateString("zh-CN")}${options.mirror ? " · 已镜像" : ""} · 屏幕色仅供参考，以实物为准`, margin, height - 18);
  return canvas;
}

export function renderShoppingListCanvas(options: {
  counts: ColorCount[];
  total: number;
  systemLabel: string;
  paletteLabel: string;
  gridLabel: string;
  codeFor: (hex: string) => string;
}): HTMLCanvasElement {
  const sorted = [...options.counts].sort((a, b) => compareCodes(options.codeFor(a.hex), options.codeFor(b.hex)));
  const columns = sorted.length > 28 ? 2 : 1;
  const rows = Math.ceil(sorted.length / columns);
  const width = columns === 2 ? 920 : 560;
  const rowH = 36;
  const header = 108;
  const height = header + rows * rowH + 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建采购清单");
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1f6f6a";
  context.fillRect(0, 0, width, 78);
  context.fillStyle = "#fffdf8";
  context.font = `700 28px ${FONT}`;
  context.textBaseline = "middle";
  context.fillText("拼豆采购清单", 28, 30);
  context.font = `500 15px ${FONT}`;
  context.fillText(`${options.systemLabel} · ${options.paletteLabel} · ${options.gridLabel} · ${sorted.length} 色 · ${options.total} 颗`, 28, 58);

  const columnWidth = (width - 48) / columns;
  sorted.forEach((item, index) => {
    const column = index % columns;
    const line = Math.floor(index / columns);
    const x = 24 + column * columnWidth;
    const y = header + line * rowH;
    if (line % 2 === 0) {
      context.fillStyle = "#f7f1e6";
      context.fillRect(x, y, columnWidth - 12, rowH - 4);
    }
    context.fillStyle = item.hex;
    context.fillRect(x + 8, y + 8, 20, 20);
    context.strokeStyle = "rgba(36,28,22,0.25)";
    context.strokeRect(x + 8.5, y + 8.5, 19, 19);
    context.fillStyle = "#241c16";
    context.font = `650 16px ${FONT}`;
    context.textAlign = "left";
    context.fillText(options.codeFor(item.hex), x + 38, y + rowH / 2 - 2);
    context.textAlign = "right";
    context.font = `600 16px ${FONT}`;
    context.fillText(`${item.count}`, x + columnWidth - 28, y + rowH / 2 - 2);
  });

  context.fillStyle = "#A0968D";
  context.font = `500 13px ${FONT}`;
  context.textAlign = "left";
  context.fillText(`数豆格 · ${new Date().toLocaleDateString("zh-CN")} · 屏幕色仅供参考，以实物为准，与品牌无关联`, 24, height - 22);
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
