import type { GridCell } from "./pixelate";

export const BASE_CELL = 16;
export const RULER = 28;

export interface ViewportDraw {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  zoom: number;
  panX: number;
  panY: number;
  highlightHex: string | null;
  shape: "round" | "square";
  showGrid: boolean;
  showCodes: boolean;
  showBoard: boolean;
  showRulers: boolean;
  compare: CanvasImageSource | null;
  compareAlpha: number;
  codeFor: (hex: string) => string;
}

export function hitCell(
  localX: number,
  localY: number,
  zoom: number,
  panX: number,
  panY: number,
  cols: number,
  rows: number,
): { row: number; col: number } | null {
  const cell = BASE_CELL * zoom;
  const col = Math.floor((localX - panX) / cell);
  const row = Math.floor((localY - panY) / cell);
  if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
  return { row, col };
}

export function fitView(
  cssWidth: number,
  cssHeight: number,
  cols: number,
  rows: number,
  showRulers: boolean,
  inset: { top: number; bottom: number; side: number; minZoom?: number } = { top: 64, bottom: 72, side: 16, minZoom: 0.25 },
) {
  const ruler = showRulers ? RULER : 0;
  const availW = Math.max(40, cssWidth - ruler - inset.side * 2);
  const availH = Math.max(40, cssHeight - ruler - inset.top - inset.bottom);
  const zoom = Math.min(8, Math.max(inset.minZoom ?? 0.25, Math.min(availW / (cols * BASE_CELL), availH / (rows * BASE_CELL))));
  const cell = BASE_CELL * zoom;
  return {
    zoom,
    panX: ruler + inset.side + Math.max(0, (availW - cols * cell) / 2),
    panY: ruler + inset.top + Math.max(0, (availH - rows * cell) / 2),
  };
}

export function drawViewport(canvas: HTMLCanvasElement, grid: GridCell[][], options: ViewportDraw) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return;
  const { cssWidth, cssHeight, dpr, zoom, panX, panY, highlightHex, shape, showGrid, showCodes, showBoard, showRulers, compare, compareAlpha, codeFor } = options;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = "#F3EEE7";
  context.fillRect(0, 0, cssWidth, cssHeight);

  const cell = BASE_CELL * zoom;
  const ruler = showRulers ? RULER : 0;

  if (compare && compareAlpha > 0) {
    context.save();
    context.globalAlpha = compareAlpha;
    context.drawImage(compare, panX, panY, cols * cell, rows * cell);
    context.restore();
  }

  const x0 = Math.max(0, Math.floor((0 - panX) / cell));
  const y0 = Math.max(0, Math.floor((0 - panY) / cell));
  const x1 = Math.min(cols, Math.ceil((cssWidth - panX) / cell));
  const y1 = Math.min(rows, Math.ceil((cssHeight - panY) / cell));

  for (let row = y0; row < y1; row++) {
    for (let col = x0; col < x1; col++) {
      const bead = grid[row][col];
      const x = panX + col * cell;
      const y = panY + row * cell;
      context.beginPath();
      if (shape === "round") {
        context.arc(x + cell / 2, y + cell / 2, Math.max(0.5, cell * 0.46), 0, Math.PI * 2);
      } else {
        context.rect(x, y, cell, cell);
      }
      if (bead.isExternal) {
        context.fillStyle = (row + col) % 2 === 0 ? "#F7F2EB" : "#EFE7DC";
      } else {
        context.fillStyle = bead.hex;
      }
      context.fill();
      if (shape === "round" && !bead.isExternal && cell >= 10) {
        context.beginPath();
        context.fillStyle = "rgba(255,255,255,0.35)";
        context.arc(x + cell * 0.42, y + cell * 0.38, cell * 0.12, 0, Math.PI * 2);
        context.fill();
      }
      if (highlightHex && (bead.isExternal || bead.hex !== highlightHex)) {
        context.beginPath();
        if (shape === "round") {
          context.arc(x + cell / 2, y + cell / 2, Math.max(0.5, cell * 0.46), 0, Math.PI * 2);
        } else {
          context.rect(x, y, cell, cell);
        }
        context.fillStyle = "rgba(42,36,32,0.55)";
        context.fill();
      }
      if (showCodes && !bead.isExternal && cell >= 14) {
        const label = codeFor(bead.hex);
        let size = Math.max(8, Math.floor(cell * 0.34));
        context.font = `600 ${size}px ui-monospace, "JetBrains Mono", monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        while (size > 7 && context.measureText(label).width > cell - 4) {
          size -= 1;
          context.font = `600 ${size}px ui-monospace, "JetBrains Mono", monospace`;
        }
        if (context.measureText(label).width <= cell - 2) {
          const yiq = bead.hex.replace("#", "");
          const r = parseInt(yiq.slice(0, 2), 16);
          const g = parseInt(yiq.slice(2, 4), 16);
          const b = parseInt(yiq.slice(4, 6), 16);
          context.fillStyle = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? "#2A2420" : "#ffffff";
          context.fillText(label, x + cell / 2, y + cell / 2);
        }
      }
    }
  }

  if (showGrid && cell >= 4) {
    const strokeGuides = (step: number, color: string, width: number) => {
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = width;
      for (let col = 0; col <= cols; col += step) {
        const x = panX + col * cell + 0.5;
        context.moveTo(x, panY);
        context.lineTo(x, panY + rows * cell);
      }
      for (let row = 0; row <= rows; row += step) {
        const y = panY + row * cell + 0.5;
        context.moveTo(panX, y);
        context.lineTo(panX + cols * cell, y);
      }
      context.stroke();
    };
    strokeGuides(1, "rgba(42,36,32,0.10)", 1);
    if (cell >= 6) strokeGuides(5, "rgba(42,36,32,0.35)", 1.5);
    if (cell >= 3) strokeGuides(10, "rgba(42,36,32,0.7)", 2);
    if (showBoard) strokeGuides(29, "rgba(232,112,79,0.7)", 2);
  }

  if (showRulers) {
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, cssWidth, ruler);
    context.fillRect(0, 0, ruler, cssHeight);
    context.fillStyle = "#6E645C";
    context.font = `600 11px ui-monospace, "JetBrains Mono", monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const labelStep = cell >= 14 ? 1 : cell >= 8 ? 5 : 10;
    for (let col = 0; col < cols; col++) {
      if (col % labelStep !== 0 && col !== cols - 1) continue;
      const x = panX + col * cell + cell / 2;
      if (x < ruler || x > cssWidth) continue;
      context.fillText(String(col + 1), x, ruler / 2);
    }
    for (let row = 0; row < rows; row++) {
      if (row % labelStep !== 0 && row !== rows - 1) continue;
      const y = panY + row * cell + cell / 2;
      if (y < ruler || y > cssHeight) continue;
      context.fillText(String(row + 1), ruler / 2, y);
    }
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, ruler, ruler);
  }
}
