import type { GridCell } from "./pixelate";

export function drawPreview(canvas: HTMLCanvasElement, grid: GridCell[][], highlightHex: string | null) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return;
  const cell = cols > 120 ? 7 : cols > 70 ? 10 : 14;
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.round(cols * cell * dpr);
  canvas.height = Math.round(rows * cell * dpr);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = false;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bead = grid[row][col];
      const x = col * cell;
      const y = row * cell;
      if (bead.isExternal) {
        context.fillStyle = (row + col) % 2 === 0 ? "#f7f1e4" : "#e7dcc8";
      } else {
        context.fillStyle = bead.hex;
      }
      context.fillRect(x, y, cell, cell);
      if (highlightHex && (bead.isExternal || bead.hex !== highlightHex)) {
        context.fillStyle = "rgba(36, 28, 22, 0.55)";
        context.fillRect(x, y, cell, cell);
      }
    }
  }

  if (cell >= 8) {
    context.strokeStyle = "rgba(36, 28, 22, 0.18)";
    context.lineWidth = 1;
    context.beginPath();
    for (let col = 0; col <= cols; col++) {
      const x = col * cell + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, rows * cell);
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * cell + 0.5;
      context.moveTo(0, y);
      context.lineTo(cols * cell, y);
    }
    context.stroke();
  }
}
