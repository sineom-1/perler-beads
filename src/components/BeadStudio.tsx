"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Brush, Crop, Eraser, Eye, Grid3x3, Minus, PaintBucket, Pipette, Plus, Redo2, Square, Undo2 } from "lucide-react";
import { assetUrl } from "@/lib/assets";
import type { DistanceMetric, PixelMode } from "@/lib/color";
import { downloadCanvas, renderPatternCanvas, renderShoppingListCanvas } from "@/lib/exportPng";
import { decodeImageFile } from "@/lib/imageFile";
import { renderPrintPdf } from "@/lib/printPdf";
import {
  COLOR_SYSTEMS,
  PALETTE_CHOICES,
  compareCodes,
  displayCode,
  getColorByHex,
  getPalette,
  type ColorSystem,
} from "@/lib/palette";
import {
  ERASED_CELL,
  buildPattern,
  cloneGrid,
  floodFillPaint,
  paintCell,
  reduceColors,
  remapColor,
  removeBorderBackground,
  replaceHex,
  tally,
  type ColorCount,
  type GridCell,
  type ImagePixels,
} from "@/lib/pixelate";
import { BASE_CELL, drawViewport, fitView, hitCell } from "@/lib/preview";

type Tool = "view" | "brush" | "fill" | "eraser" | "pick";
type StyleId = "cartoon" | "pixel" | "photo" | "simple" | "custom";
type Shape = "round" | "square";
type CropRect = { x: number; y: number; w: number; h: number };
type CropRatio = "full" | "1:1" | "3:4" | "4:3";
const CROP_RATIOS: { key: CropRatio; label: string; aspect: [number, number] | null }[] = [
  { key: "full", label: "原图", aspect: null },
  { key: "1:1", label: "1:1", aspect: [1, 1] },
  { key: "3:4", label: "3:4", aspect: [3, 4] },
  { key: "4:3", label: "4:3", aspect: [4, 3] },
];
type SheetTab = "size" | "style" | "clean" | "colors" | "advanced";

const BOARDS = [16, 29, 48, 58, 87];
const SOURCE_URL = "https://github.com/sineom-1/perler-beads";
const UPSTREAM_URL = "https://github.com/Zippland/perler-beads";

function SourceNote({ style }: { style?: React.CSSProperties }) {
  return (
    <p className="source-note" style={style}>
      开源项目 · AGPL-3.0 · <a href={SOURCE_URL} target="_blank" rel="noreferrer">查看源码</a> · 改编自{" "}
      <a href={UPSTREAM_URL} target="_blank" rel="noreferrer">Zippland/perler-beads</a>
    </p>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function autoRows(columns: number, image: ImagePixels) {
  return clamp(Math.round(columns * (image.height / image.width)), 8, 180);
}

function emptyGrid(cols: number, rows: number): GridCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ...ERASED_CELL })));
}

function pixelsToUrl(pixels: ImagePixels) {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas.toDataURL("image/png");
}

function fullRect(pixels: ImagePixels): CropRect {
  return { x: 0, y: 0, w: pixels.width, h: pixels.height };
}

function aspectCrop(pixels: ImagePixels, aw: number, ah: number): CropRect {
  let w = pixels.width;
  let h = Math.round((w * ah) / aw);
  if (h > pixels.height) {
    h = pixels.height;
    w = Math.round((h * aw) / ah);
  }
  w = Math.max(1, Math.min(pixels.width, w));
  h = Math.max(1, Math.min(pixels.height, h));
  return {
    x: Math.round((pixels.width - w) / 2),
    y: Math.round((pixels.height - h) / 2),
    w,
    h,
  };
}

function cropPixels(pixels: ImagePixels, rect: CropRect): ImagePixels {
  const canvas = document.createElement("canvas");
  canvas.width = rect.w;
  canvas.height = rect.h;
  const context = canvas.getContext("2d");
  const source = document.createElement("canvas");
  source.width = pixels.width;
  source.height = pixels.height;
  source.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  context?.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = context?.getImageData(0, 0, rect.w, rect.h);
  if (!data) return pixels;
  return { width: rect.w, height: rect.h, data: data.data };
}

function Tip({ text }: { text: string }) {
  return (
    <span className="tip" tabIndex={0}>
      <i>i</i>
      <span>{text}</span>
    </span>
  );
}

export default function BeadStudio() {
  const imageRef = useRef<ImagePixels | null>(null);
  const originalRef = useRef<ImagePixels | null>(null);
  const gridRef = useRef<GridCell[][] | null>(null);
  const blankRef = useRef(false);
  const undoRef = useRef<GridCell[][][]>([]);
  const redoRef = useRef<GridCell[][][]>([]);
  const runRef = useRef(0);
  const excludedRef = useRef<string[]>([]);
  const removeBgRef = useRef(false);
  const styleLock = useRef<StyleId | null>("cartoon");
  const skipStyle = useRef(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compareRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef({ zoom: 1, panX: 40, panY: 40 });
  const spaceRef = useRef(false);
  const paintingRef = useRef(false);
  const strokeRef = useRef(false);
  const lastCellRef = useRef("");
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(null);
  const lastTapRef = useRef(0);

  const [buildToken, setBuildToken] = useState(0);
  const [cols, setCols] = useState(48);
  const [rows, setRows] = useState(48);
  const [lockRatio, setLockRatio] = useState(true);
  const [threshold, setThreshold] = useState(30);
  const [paletteId, setPaletteId] = useState("168");
  const [colorSystem, setColorSystem] = useState<ColorSystem>("MARD");
  const [mode, setMode] = useState<PixelMode>("dominant");
  const [metric, setMetric] = useState<DistanceMetric>("oklab");
  const [styleId, setStyleId] = useState<StyleId>("cartoon");
  const [removeBg, setRemoveBg] = useState(false);
  const [maxColors, setMaxColors] = useState(0);
  const [minCount, setMinCount] = useState(0);
  const [pitchMm, setPitchMm] = useState(5);
  const [pdfBusy, setPdfBusy] = useState<number | null>(null);
  const [grid, setGrid] = useState<GridCell[][] | null>(null);
  const [counts, setCounts] = useState<ColorCount[]>([]);
  const [total, setTotal] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushHex, setBrushHex] = useState<string | null>(null);
  const [highlightHex, setHighlightHex] = useState<string | null>(null);
  const [shape, setShape] = useState<Shape>("square");
  const [showGrid, setShowGrid] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [compareHold, setCompareHold] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [hist, setHist] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ pixels: ImagePixels; rect: CropRect; url: string; name: string; ratio: CropRatio } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCodes, setExportCodes] = useState(true);
  const [exportGrid, setExportGrid] = useState(true);
  const [exportCoords, setExportCoords] = useState(true);
  const [exportShape, setExportShape] = useState<Shape>("square");
  const [exportMirror, setExportMirror] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab>("size");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sideTab, setSideTab] = useState<"settings" | "colors">("settings");
  const [sortBy, setSortBy] = useState<"count" | "code">("count");
  const [colorQuery, setColorQuery] = useState("");
  const [replaceFrom, setReplaceFrom] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportPreviewRef = useRef<HTMLDivElement>(null);
  const brushRef = useRef<string | null>(null);
  const activateToolRef = useRef<(next: Tool) => void>(() => {});
  const cropDrag = useRef<{ x: number; y: number; rect: CropRect; mode: "move" | "resize" } | null>(null);

  excludedRef.current = excluded;
  removeBgRef.current = removeBg;
  brushRef.current = brushHex;

  const notify = useCallback((text: string) => setMessage(text), []);

  const applyGrid = useCallback((next: GridCell[][]) => {
    gridRef.current = next;
    setGrid(next);
    const totals = tally(next);
    setCounts(totals.counts);
    setTotal(totals.total);
  }, []);

  const bumpHist = () => setHist(undoRef.current.length * 100 + redoRef.current.length);

  const pushUndo = (snapshot: GridCell[][]) => {
    undoRef.current = [...undoRef.current.slice(-39), snapshot];
    redoRef.current = [];
    bumpHist();
  };

  const undo = useCallback(() => {
    const snapshot = undoRef.current.pop();
    if (!snapshot || !gridRef.current) {
      bumpHist();
      return;
    }
    redoRef.current.push(cloneGrid(gridRef.current));
    applyGrid(snapshot);
    bumpHist();
  }, [applyGrid]);

  const redo = useCallback(() => {
    const snapshot = redoRef.current.pop();
    if (!snapshot || !gridRef.current) {
      bumpHist();
      return;
    }
    undoRef.current.push(cloneGrid(gridRef.current));
    applyGrid(snapshot);
    bumpHist();
  }, [applyGrid]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const current = gridRef.current;
    if (!canvas || !stage || !current) return;
    const bounds = stage.getBoundingClientRect();
    drawViewport(canvas, current, {
      cssWidth: bounds.width,
      cssHeight: bounds.height,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      zoom: viewRef.current.zoom,
      panX: viewRef.current.panX,
      panY: viewRef.current.panY,
      highlightHex,
      shape,
      showGrid,
      showCodes,
      showBoard,
      showRulers,
      compare: compareHold ? compareRef.current : null,
      compareAlpha: compareHold ? 1 : 0,
      codeFor: (hex) => displayCode(hex, colorSystem),
    });
  }, [highlightHex, shape, showGrid, showCodes, showBoard, showRulers, compareHold, colorSystem]);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    const current = gridRef.current;
    if (!stage || !current?.[0]) return;
    const bounds = stage.getBoundingClientRect();
    const narrow = bounds.width < 768;
    viewRef.current = fitView(bounds.width, bounds.height, current[0].length, current.length, showRulers, {
      top: narrow ? 12 : 64,
      bottom: narrow ? 28 : 72,
      side: 12,
    });
    setZoomPct(Math.round(viewRef.current.zoom * 100));
    redraw();
  }, [redraw, showRulers]);

  useEffect(() => {
    document.body.classList.toggle("workspace-lock", Boolean(grid));
    return () => document.body.classList.remove("workspace-lock");
  }, [grid]);

  useEffect(() => {
    if (blankRef.current || !imageRef.current) return;
    const seq = ++runRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        const image = imageRef.current;
        if (!image) return;
        setProcessing(true);
        setProgress(0.04);
        try {
          const skip = new Set(excludedRef.current);
          const active = getPalette(paletteId).filter((color) => !skip.has(color.hex));
          if (active.length === 0) {
            notify("可用颜色为空，请先恢复已排除的颜色。");
            return;
          }
          const result = await buildPattern(image, {
            cols,
            rows,
            palette: active,
            mode,
            threshold,
            metric,
            yieldEvery: 2,
            onProgress: (ratio) => {
              if (seq === runRef.current) setProgress(ratio);
            },
          });
          if (seq !== runRef.current) return;
          let next = result.grid;
          if (removeBgRef.current) next = removeBorderBackground(next).grid;
          if (maxColors > 0 || minCount > 0) next = reduceColors(next, maxColors, minCount, metric, getColorByHex).grid;
          undoRef.current = [];
          redoRef.current = [];
          bumpHist();
          applyGrid(next);
          setMessage(null);
        } catch (error) {
          if (seq !== runRef.current) return;
          notify(error instanceof Error ? error.message : "生成失败");
        } finally {
          if (seq === runRef.current) setProcessing(false);
        }
      })();
    }, 160);
    return () => window.clearTimeout(timer);
  }, [cols, rows, paletteId, mode, threshold, metric, maxColors, minCount, buildToken, applyGrid, notify]);

  useEffect(() => {
    if (skipStyle.current) {
      skipStyle.current = false;
      return;
    }
    if (styleLock.current) {
      styleLock.current = null;
      return;
    }
    setStyleId("custom");
  }, [mode, threshold, metric]);

  useEffect(() => {
    if (!grid) return;
    const timer = window.setTimeout(() => fit(), 30);
    return () => window.clearTimeout(timer);
    // Fit when the board size changes, not on every paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, Boolean(grid), fit]);

  useEffect(() => {
    redraw();
  }, [redraw, grid, hist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const oldZoom = viewRef.current.zoom;
      const nextZoom = Math.min(8, Math.max(0.25, oldZoom * (event.deltaY < 0 ? 1.08 : 0.92)));
      const oldCell = BASE_CELL * oldZoom;
      const newCell = BASE_CELL * nextZoom;
      const worldX = (localX - viewRef.current.panX) / oldCell;
      const worldY = (localY - viewRef.current.panY) / oldCell;
      viewRef.current.zoom = nextZoom;
      viewRef.current.panX = localX - worldX * newCell;
      viewRef.current.panY = localY - worldY * newCell;
      setZoomPct(Math.round(nextZoom * 100));
      redraw();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [redraw, grid]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === "Space") {
        spaceRef.current = true;
        if (!typing) event.preventDefault();
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      if (key === "b") activateToolRef.current("brush");
      if (key === "g") activateToolRef.current("fill");
      if (key === "e") setTool("eraser");
      if (key === "i") setTool("pick");
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [undo, redo]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith("image/"))?.getAsFile();
      if (file) {
        event.preventDefault();
        void openCrop(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const box = exportPreviewRef.current;
    const canvas = exportCanvasRef.current;
    const current = gridRef.current;
    if (!box || !canvas || !current?.[0]) return;
    const draw = () => {
      const bounds = box.getBoundingClientRect();
      const cssWidth = Math.max(160, Math.floor(bounds.width));
      const cssHeight = Math.max(160, Math.floor(bounds.height));
      const fitted = fitView(cssWidth, cssHeight, current[0].length, current.length, false, {
        top: 12,
        bottom: 12,
        side: 12,
        minZoom: 0.02,
      });
      drawViewport(canvas, current, {
        cssWidth,
        cssHeight,
        dpr: Math.min(2, window.devicePixelRatio || 1),
        zoom: fitted.zoom,
        panX: fitted.panX,
        panY: fitted.panY,
        highlightHex: null,
        shape: exportShape,
        showGrid: exportGrid,
        showCodes: false,
        showBoard: true,
        showRulers: false,
        compare: null,
        compareAlpha: 0,
        codeFor: (hex) => displayCode(hex, colorSystem),
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [exportOpen, grid, exportShape, exportGrid, cols, rows, colorSystem, hist]);

  function rememberImage(pixels: ImagePixels) {
    const canvas = document.createElement("canvas");
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    compareRef.current = canvas;
    setThumbUrl(canvas.toDataURL("image/png"));
  }

  function beginFromPixels(pixels: ImagePixels, name: string) {
    blankRef.current = false;
    imageRef.current = pixels;
    excludedRef.current = [];
    setExcluded([]);
    setImageLabel(`${name} · ${pixels.width}×${pixels.height}`);
    rememberImage(pixels);
    if (lockRatio) setRows(autoRows(cols, pixels));
    setBuildToken((value) => value + 1);
  }

  async function openCrop(file: File) {
    if (!file.type.startsWith("image/")) {
      notify("请上传图片。");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      notify("图片超过 25MB。");
      return;
    }
    try {
      const pixels = await decodeImageFile(file);
      originalRef.current = pixels;
      setCrop({ pixels, rect: fullRect(pixels), ratio: "full", url: pixelsToUrl(pixels), name: file.name });
    } catch {
      notify("这张图片无法读取。");
    }
  }

  function confirmCrop() {
    if (!crop) return;
    const next = cropPixels(crop.pixels, crop.rect);
    setCrop(null);
    beginFromPixels(next, crop.name);
  }

  async function loadSample() {
    const response = await fetch(assetUrl("/samples/demo.png"));
    const blob = await response.blob();
    await openCrop(new File([blob], "示例.png", { type: "image/png" }));
  }

  function makeBlank() {
    blankRef.current = true;
    imageRef.current = null;
    compareRef.current = null;
    setThumbUrl(null);
    setImageLabel("空白画布");
    setExcluded([]);
    undoRef.current = [];
    redoRef.current = [];
    applyGrid(emptyGrid(cols, rows));
  }

  function updateCols(value: number) {
    const next = clamp(value, 8, 180);
    setCols(next);
    if (blankRef.current) {
      const height = lockRatio ? next : rows;
      if (lockRatio) setRows(height);
      applyGrid(emptyGrid(next, height));
      return;
    }
    if (lockRatio && imageRef.current) setRows(autoRows(next, imageRef.current));
  }

  function updateRows(value: number) {
    const next = clamp(value, 8, 180);
    setLockRatio(false);
    setRows(next);
    if (blankRef.current) applyGrid(emptyGrid(cols, next));
  }

  function applyStyle(id: Exclude<StyleId, "custom">) {
    styleLock.current = id;
    setStyleId(id);
    if (id === "cartoon") {
      setMode("dominant");
      setMetric("oklab");
      setThreshold(30);
    } else if (id === "pixel") {
      setMode("dominant");
      setMetric("oklab");
      setThreshold(0);
    } else if (id === "photo") {
      setMode("average");
      setMetric("ciede2000");
      setThreshold(15);
    } else {
      setMode("dominant");
      setMetric("oklab");
      setThreshold(50);
    }
  }

  function zoomBy(factor: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const localX = bounds.width / 2;
    const localY = bounds.height / 2;
    const oldZoom = viewRef.current.zoom;
    const nextZoom = Math.min(8, Math.max(0.25, oldZoom * factor));
    const oldCell = BASE_CELL * oldZoom;
    const newCell = BASE_CELL * nextZoom;
    const worldX = (localX - viewRef.current.panX) / oldCell;
    const worldY = (localY - viewRef.current.panY) / oldCell;
    viewRef.current.zoom = nextZoom;
    viewRef.current.panX = localX - worldX * newCell;
    viewRef.current.panY = localY - worldY * newCell;
    setZoomPct(Math.round(nextZoom * 100));
    redraw();
  }

  function cellFromPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const current = gridRef.current;
    if (!canvas || !current?.[0]) return null;
    const rect = canvas.getBoundingClientRect();
    return hitCell(event.clientX - rect.left, event.clientY - rect.top, viewRef.current.zoom, viewRef.current.panX, viewRef.current.panY, current[0].length, current.length);
  }

  function ensureBrush(): string | null {
    if (brushRef.current && getColorByHex(brushRef.current)) return brushRef.current;
    const top = [...counts].sort((a, b) => b.count - a.count)[0]?.hex ?? getPalette(paletteId)[0]?.hex ?? null;
    if (!top) {
      notify("请先选择颜色");
      return null;
    }
    brushRef.current = top;
    setBrushHex(top);
    return top;
  }

  function activateTool(next: Tool) {
    if ((next === "brush" || next === "fill") && !ensureBrush()) return;
    setTool(next);
  }
  activateToolRef.current = activateTool;

  function editAt(row: number, col: number) {
    const current = gridRef.current;
    if (!current) return;
    const cell = current[row][col];
    const id = `${row},${col}`;
    if (tool === "brush" || tool === "eraser") {
      if (lastCellRef.current === id) return;
      lastCellRef.current = id;
    }
    if (tool === "pick") {
      if (!cell.isExternal) {
        brushRef.current = cell.hex;
        setBrushHex(cell.hex);
        setTool("brush");
      }
      return;
    }
    if (tool === "fill") {
      const hex = ensureBrush();
      const color = hex ? getColorByHex(hex) : undefined;
      if (!color) return;
      pushUndo(cloneGrid(current));
      applyGrid(floodFillPaint(current, row, col, color));
      return;
    }
    if (tool === "eraser") {
      if (cell.isExternal) return;
      if (!strokeRef.current) {
        pushUndo(cloneGrid(current));
        strokeRef.current = true;
      }
      const next = paintCell(current, row, col, null);
      gridRef.current = next;
      setGrid(next);
      return;
    }
    if (tool === "brush") {
      const hex = ensureBrush();
      const color = hex ? getColorByHex(hex) : undefined;
      if (!color || (!cell.isExternal && cell.hex === color.hex)) return;
      if (!strokeRef.current) {
        pushUndo(cloneGrid(current));
        strokeRef.current = true;
      }
      const next = paintCell(current, row, col, color);
      gridRef.current = next;
      setGrid(next);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: viewRef.current.zoom,
        panX: viewRef.current.panX,
        panY: viewRef.current.panY,
      };
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 280) fit();
    lastTapRef.current = now;
    if (tool === "view" || spaceRef.current || event.button === 1) {
      paintingRef.current = false;
      (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
      return;
    }
    const spot = cellFromPointer(event);
    if (!spot) return;
    paintingRef.current = true;
    strokeRef.current = false;
    lastCellRef.current = "";
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    editAt(spot.row, spot.col);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const nextZoom = Math.min(8, Math.max(0.25, pinchRef.current.zoom * (dist / pinchRef.current.dist)));
      viewRef.current.zoom = nextZoom;
      viewRef.current.panX = pinchRef.current.panX + (a.x + b.x) / 2 - (event.currentTarget.getBoundingClientRect().left + event.currentTarget.clientWidth / 2);
      setZoomPct(Math.round(nextZoom * 100));
      redraw();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const spot = cellFromPointer(event);
    if (spot && gridRef.current) {
      const cell = gridRef.current[spot.row][spot.col];
      const code = cell.isExternal ? "空" : displayCode(cell.hex, colorSystem);
      setHover({ x: event.clientX + 12, y: event.clientY + 12, text: `${code} · 第${spot.row + 1}行 第${spot.col + 1}列` });
    } else setHover(null);
    if (tool === "view" || spaceRef.current) {
      if (event.buttons === 1) {
        viewRef.current.panX += event.movementX;
        viewRef.current.panY += event.movementY;
        redraw();
      }
      return;
    }
    if (!paintingRef.current || !spot) return;
    if (tool === "brush" || tool === "eraser") editAt(spot.row, spot.col);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (strokeRef.current && gridRef.current) {
      const totals = tally(gridRef.current);
      setCounts(totals.counts);
      setTotal(totals.total);
    }
    paintingRef.current = false;
    strokeRef.current = false;
    lastCellRef.current = "";
  }

  function excludeColor(hex: string) {
    const current = gridRef.current;
    const source = getColorByHex(hex);
    if (!current || !source) return;
    const skip = new Set([...excluded, hex]);
    const targets = getPalette(paletteId).filter((color) => !skip.has(color.hex));
    if (targets.length === 0) {
      notify("至少保留一种颜色。");
      return;
    }
    pushUndo(cloneGrid(current));
    const result = remapColor(current, source, targets, metric);
    setExcluded((previous) => [...previous, hex]);
    applyGrid(result.grid);
    notify(`已排除 ${displayCode(hex, colorSystem)}，改为 ${displayCode(result.replacement.hex, colorSystem)}。`);
  }

  function restoreColor(hex?: string) {
    const next = hex ? excluded.filter((item) => item !== hex) : [];
    excludedRef.current = next;
    setExcluded(next);
    if (!blankRef.current && imageRef.current) setBuildToken((value) => value + 1);
    notify(hex ? "已恢复该颜色，正在按原图重算。" : "已恢复全部颜色。");
  }

  function toggleBackground() {
    const next = !removeBg;
    removeBgRef.current = next;
    setRemoveBg(next);
    if (!blankRef.current && imageRef.current) setBuildToken((value) => value + 1);
  }

  function replaceAll(fromHex: string, toHex: string) {
    const current = gridRef.current;
    const color = getColorByHex(toHex);
    if (!current || !color) return;
    pushUndo(cloneGrid(current));
    const result = replaceHex(current, fromHex, color);
    applyGrid(result.grid);
    setReplaceFrom(null);
    notify(`已替换 ${result.replaced} 格。`);
  }

  function downloadPattern() {
    const current = gridRef.current;
    if (!current) return;
    const paletteLabel = PALETTE_CHOICES.find((item) => item.id === paletteId)?.name ?? "";
    const canvas = renderPatternCanvas({
      grid: current,
      counts,
      total,
      systemLabel: colorSystem,
      paletteLabel,
      showCodes: exportCodes,
      includeStats: true,
      gridInterval: 5,
      showCoordinates: exportCoords,
      showGrid: exportGrid,
      beadShape: exportShape,
      mirror: exportMirror,
      codeFor: (hex) => displayCode(hex, colorSystem),
    });
    downloadCanvas(canvas, `拼豆图纸-${cols}x${rows}-${colorSystem}.png`);
  }

  async function downloadPdf() {
    const current = gridRef.current;
    if (!current || pdfBusy !== null) return;
    const paletteLabel = PALETTE_CHOICES.find((item) => item.id === paletteId)?.name ?? "";
    setPdfBusy(0);
    try {
      const { blob, pages } = await renderPrintPdf({
        grid: current,
        pitchMm,
        board: 29,
        mirror: exportMirror,
        systemLabel: colorSystem,
        paletteLabel,
        codeFor: (hex) => displayCode(hex, colorSystem),
        onProgress: (ratio) => setPdfBusy(ratio),
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `拼豆图纸-1比1打印-${cols}x${rows}-${colorSystem}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      notify(`已生成 ${pages} 页 PDF。打印时选「实际大小 / 100%」。`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "PDF 生成失败");
    } finally {
      setPdfBusy(null);
    }
  }

  function downloadList() {
    if (!gridRef.current) return;
    const paletteLabel = PALETTE_CHOICES.find((item) => item.id === paletteId)?.name ?? "";
    const canvas = renderShoppingListCanvas({
      counts,
      total,
      systemLabel: colorSystem,
      paletteLabel,
      gridLabel: `${cols}×${rows}`,
      codeFor: (hex) => displayCode(hex, colorSystem),
    });
    downloadCanvas(canvas, `拼豆采购清单-${colorSystem}.png`);
  }

  async function copyList() {
    const lines = sortedCounts.map((item) => `${colorSystem} ${displayCode(item.hex, colorSystem)} ×${item.count}`);
    lines.push(`合计 ${total}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      notify("清单已复制。");
    } catch {
      notify("无法写入剪贴板。");
    }
  }

  const sortedCounts = useMemo(() => {
    const list = counts.filter((item) => displayCode(item.hex, colorSystem).toLowerCase().includes(colorQuery.trim().toLowerCase()));
    return list.sort((a, b) =>
      sortBy === "count"
        ? b.count - a.count
        : compareCodes(displayCode(a.hex, colorSystem), displayCode(b.hex, colorSystem)),
    );
  }, [counts, colorSystem, sortBy, colorQuery]);

  const activePalette = useMemo(() => {
    const skip = new Set(excluded);
    return getPalette(paletteId).filter((color) => !skip.has(color.hex));
  }, [paletteId, excluded]);

  const preset = BOARDS.includes(cols) ? String(cols) : "custom";
  const boardText = `${cols}×${rows} · ${Math.ceil(cols / 29)}×${Math.ceil(rows / 29)} 块 29 板 · ${total.toLocaleString("zh-CN")} 颗`;

  function SizeFields() {
    return (
      <div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {BOARDS.map((size) => (
            <button key={size} type="button" className="chip" data-on={preset === String(size)} onClick={() => updateCols(size)}>
              {size}
            </button>
          ))}
          <button type="button" className="chip" data-on={preset === "custom"} onClick={() => updateCols(cols)}>
            自定义
          </button>
        </div>
        <div className="field">
          <span className="row-label">宽度 {cols}</span>
          <div className="slider-row">
            <button type="button" className="stepper-btn" onClick={() => updateCols(cols - 1)}><Minus size={16} /></button>
            <input type="range" min={8} max={180} value={cols} onChange={(event) => updateCols(Number(event.target.value))} />
            <button type="button" className="stepper-btn" onClick={() => updateCols(cols + 1)}><Plus size={16} /></button>
          </div>
        </div>
        <div className="field">
          <span className="row-label">高度 {rows}</span>
          <div className="slider-row">
            <button type="button" className="stepper-btn" onClick={() => updateRows(rows - 1)}><Minus size={16} /></button>
            <input type="range" min={8} max={180} value={rows} onChange={(event) => updateRows(Number(event.target.value))} />
            <button type="button" className="stepper-btn" onClick={() => updateRows(rows + 1)}><Plus size={16} /></button>
          </div>
        </div>
        <label className="inline" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={lockRatio} onChange={(event) => setLockRatio(event.target.checked)} />
          锁定比例
        </label>
        <p className="muted">{boardText}</p>
      </div>
    );
  }

  function StyleFields() {
    const styles: { id: Exclude<StyleId, "custom">; name: string }[] = [
      { id: "cartoon", name: "卡通" },
      { id: "pixel", name: "像素画" },
      { id: "photo", name: "照片" },
      { id: "simple", name: "简洁" },
    ];
    return (
      <div className="chips">
        {styles.map((item) => (
          <button key={item.id} type="button" className="chip" data-on={styleId === item.id} onClick={() => applyStyle(item.id)}>
            {item.name}
          </button>
        ))}
        {styleId === "custom" && <span className="chip" data-on="true">自定义</span>}
      </div>
    );
  }

  function CleanFields() {
    return (
      <div>
        <div className="field">
          <span className="row-label">合并相近色 {threshold} · 当前 {counts.length} 色</span>
          <div className="slider-row">
            <button type="button" className="stepper-btn" onClick={() => setThreshold((value) => Math.max(0, value - 1))}><Minus size={16} /></button>
            <input type="range" min={0} max={80} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
            <button type="button" className="stepper-btn" onClick={() => setThreshold((value) => Math.min(80, value + 1))}><Plus size={16} /></button>
          </div>
        </div>
        <div className="field">
          <span className="row-label">最多用几种颜色 {maxColors === 0 ? "不限" : maxColors} <Tip text="超出的颜色从用得最少的开始，并到最接近的颜色。" /></span>
          <div className="slider-row">
            <button type="button" className="stepper-btn" onClick={() => setMaxColors((value) => (value <= 2 ? 0 : value - 1))}><Minus size={16} /></button>
            <input type="range" min={0} max={60} value={maxColors} onChange={(event) => { const value = Number(event.target.value); setMaxColors(value === 1 ? 2 : value); }} />
            <button type="button" className="stepper-btn" onClick={() => setMaxColors((value) => (value === 0 ? 2 : Math.min(60, value + 1)))}><Plus size={16} /></button>
          </div>
        </div>
        <div className="field">
          <span className="row-label">少于 {minCount === 0 ? "—" : minCount} 颗的颜色并到相近色 <Tip text="省得为了几颗豆专门买一包。0 表示不合并。" /></span>
          <div className="slider-row">
            <button type="button" className="stepper-btn" onClick={() => setMinCount((value) => Math.max(0, value - 1))}><Minus size={16} /></button>
            <input type="range" min={0} max={30} value={minCount} onChange={(event) => setMinCount(Number(event.target.value))} />
            <button type="button" className="stepper-btn" onClick={() => setMinCount((value) => Math.min(30, value + 1))}><Plus size={16} /></button>
          </div>
        </div>
        <button type="button" className="chip" data-on={removeBg} onClick={toggleBackground}>去除背景</button>
      </div>
    );
  }

  function AdvancedFields() {
    return (
      <div>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" data-on={mode === "dominant"} onClick={() => setMode("dominant")}>主色</button>
          <button type="button" className="chip" data-on={mode === "average"} onClick={() => setMode("average")}>平均色</button>
        </div>
        <div className="chips">
          <button type="button" className="chip" data-on={metric === "oklab"} onClick={() => setMetric("oklab")}>Oklab</button>
          <button type="button" className="chip" data-on={metric === "ciede2000"} onClick={() => setMetric("ciede2000")}>CIEDE2000</button>
        </div>
      </div>
    );
  }

  function ColorList() {
    return (
      <div>
        <div className="inline" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <strong>{counts.length} 色 · {total.toLocaleString("zh-CN")} 颗</strong>
          <select className="sort-select" aria-label="排序" value={sortBy} onChange={(event) => setSortBy(event.target.value as "count" | "code")}>
            <option value="count">按数量</option>
            <option value="code">按色号</option>
          </select>
        </div>
        <p className="muted" style={{ margin: "0 0 8px" }}>点一下颜色，画布只亮这一色，方便一色一色地拼。</p>
        <input className="select" placeholder="搜索色号" value={colorQuery} onChange={(event) => setColorQuery(event.target.value)} />
        <div style={{ marginTop: 8 }}>
          {sortedCounts.map((item) => {
            const code = displayCode(item.hex, colorSystem);
            return (
              <div key={item.hex}>
                <button
                  type="button"
                  className="color-row"
                  data-on={highlightHex === item.hex}
                  onClick={() => {
                    if (tool === "brush" || tool === "fill") {
                      brushRef.current = item.hex;
                      setBrushHex(item.hex);
                      setHighlightHex(item.hex);
                      return;
                    }
                    setHighlightHex((current) => (current === item.hex ? null : item.hex));
                  }}
                >
                  <i className="swatch" style={{ background: item.hex }} />
                  <span className="code">{code}</span>
                  <span className="muted">{item.count}</span>
                  <span className="muted">{total ? Math.round((item.count / total) * 100) : 0}%</span>
                </button>
                <div className="inline" style={{ padding: "0 8px 8px" }}>
                  <button type="button" className="ghost" style={{ minHeight: 32 }} onClick={() => excludeColor(item.hex)}>排除</button>
                  <button type="button" className="ghost" style={{ minHeight: 32 }} onClick={() => setReplaceFrom(item.hex)}>全部替换</button>
                </div>
              </div>
            );
          })}
        </div>
        {excluded.length > 0 && (
          <details open>
            <summary>已排除 ({excluded.length})</summary>
            <button type="button" className="ghost" onClick={() => restoreColor()}>全部恢复</button>
            {excluded.map((hex) => (
              <button key={hex} type="button" className="color-row" onClick={() => restoreColor(hex)}>
                <i className="swatch" style={{ background: hex }} />
                <span className="code">{displayCode(hex, colorSystem)}</span>
                <span className="muted">恢复</span>
                <span />
              </button>
            ))}
          </details>
        )}
        {replaceFrom && (
          <div className="modal-back" onClick={() => setReplaceFrom(null)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <h3>替换 {displayCode(replaceFrom, colorSystem)}</h3>
              <div className="chips">
                {activePalette.slice(0, 80).map((color) => (
                  <button key={color.hex} type="button" className="chip" onClick={() => replaceAll(replaceFrom, color.hex)}>
                    <i className="swatch" style={{ background: color.hex, display: "inline-block", marginRight: 6 }} />
                    {displayCode(color.hex, colorSystem)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const tools: { id: Tool; label: string; icon: ReactNode }[] = [
    { id: "view", label: "查看", icon: <Eye size={16} /> },
    { id: "brush", label: "画笔", icon: <Brush size={16} /> },
    { id: "fill", label: "填充", icon: <PaintBucket size={16} /> },
    { id: "eraser", label: "橡皮", icon: <Eraser size={16} /> },
    { id: "pick", label: "吸管", icon: <Pipette size={16} /> },
  ];

  if (!grid && !crop) {
    return (
      <div
        className="shell empty"
        onDragOver={(event) => {
          event.preventDefault();
          setDraggingFile(true);
        }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDraggingFile(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void openCrop(file);
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void openCrop(file);
        }} />
        <div className="empty-card" style={{ outline: draggingFile ? "2px solid var(--primary)" : undefined }}>
          <div className="beads" aria-hidden>
            {["#E8704F", "#F2C14E", "#2F7D6D", "#3D7EC9", "#F4A3B5", "#2A2420", "#F7F2EB", "#8D6E63", "#7BC67E"].map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </div>
          <h1>照片一键变拼豆图纸</h1>
          <p>支持 MARD / COCO / 漫漫 / 盼盼 / 咪小窝 · 图片只在本机处理，不会上传</p>
          <div className="inline" style={{ justifyContent: "center" }}>
            <button type="button" className="primary" onClick={() => fileRef.current?.click()}>上传图片</button>
            <button type="button" className="ghost" onClick={() => void loadSample()}>试试示例</button>
            <button type="button" className="ghost" onClick={makeBlank}>空白画布</button>
          </div>
          <p className="muted" style={{ marginTop: 16 }}>拖放图片到此处，或按 Ctrl/Cmd+V 粘贴</p>
        </div>
        <SourceNote style={{ position: "fixed", bottom: 12, left: 0, right: 0, textAlign: "center" }} />
        {message && <p className="hover-tip" style={{ position: "fixed", bottom: 24, left: "50%" }}>{message}</p>}
      </div>
    );
  }

  return (
    <div
      className="shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void openCrop(file);
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void openCrop(file);
      }} />
      <header className="topbar">
        <div className="brand">
          <span className="beads" aria-hidden style={{ gridTemplateColumns: "repeat(3, 8px)", gap: 3 }}>
            {["#E8704F", "#F2C14E", "#2F7D6D", "#3D7EC9", "#F4A3B5", "#2A2420", "#fff", "#8D6E63", "#7BC67E"].map((color) => (
              <i key={color} style={{ background: color, width: 8, height: 8 }} />
            ))}
          </span>
          <strong>拼豆图纸</strong>
        </div>
        <div className="stepper">
          <span className="on">① 选图</span>
          <span className="on">② 调整</span>
          <span className={exportOpen ? "on" : undefined}>③ 导出</span>
        </div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>更换图片</button>
          <button type="button" className="primary" onClick={() => setExportOpen(true)}>导出</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="panel">
          <div className="side-tabs">
            <button type="button" className="chip" data-on={sideTab === "settings"} onClick={() => setSideTab("settings")}>设置</button>
            <button type="button" className="chip" data-on={sideTab === "colors"} onClick={() => setSideTab("colors")}>颜色</button>
          </div>
          {sideTab === "colors" && <div className="tablet-colors"><ColorList /></div>}
          <div className={sideTab === "colors" ? "settings-block" : undefined} style={sideTab === "colors" ? { display: "none" } : undefined}>
            <div className="thumb">
              {thumbUrl ? <img src={thumbUrl} alt="" /> : <div style={{ width: 72, height: 72, borderRadius: 12, background: "var(--surface-2)" }} />}
              <div>
                <div>{imageLabel ?? "画布"}</div>
                <button type="button" className="ghost" style={{ marginTop: 8, minHeight: 32, padding: "0 12px" }} disabled={!originalRef.current} onClick={() => {
                  const pixels = originalRef.current;
                  if (!pixels) return;
                  setCrop({ pixels, rect: fullRect(pixels), ratio: "full", url: pixelsToUrl(pixels), name: imageLabel ?? "图片" });
                }}><Crop size={14} /> 裁剪</button>
              </div>
            </div>
            <section className="section">
              <h2>基础 <Tip text="宽度按拼豆板 29 格对齐，也可自定义。" /></h2>
              <div className="chips" style={{ marginBottom: 12 }}>
                {COLOR_SYSTEMS.map((system) => (
                  <button key={system} type="button" className="chip" data-on={colorSystem === system} onClick={() => setColorSystem(system)}>{system}</button>
                ))}
              </div>
              <select className="select" value={paletteId} onChange={(event) => setPaletteId(event.target.value)} style={{ marginBottom: 12 }}>
                {PALETTE_CHOICES.map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.name}</option>
                ))}
              </select>
              <SizeFields />
            </section>
            <section className="section">
              <h2>图案风格 <Tip text="预设只调整取色、色差和合并强度。" /></h2>
              <StyleFields />
            </section>
            <section className="section">
              <h2>清理 <Tip text="只清零星杂色，大块不同的颜色会保留。" /></h2>
              <CleanFields />
            </section>
            <details className="section">
              <summary>高级</summary>
              <div style={{ marginTop: 12 }}><AdvancedFields /></div>
            </details>
            <SourceNote style={{ marginTop: 16 }} />
          </div>
        </aside>
        <main className="stage" ref={stageRef}>
          {processing && <div className="progress"><b style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          <div className="tool-pill">
            {tools.map((item) => (
              <button key={item.id} type="button" className="icon-btn" title={item.label} data-on={tool === item.id} onClick={() => activateTool(item.id)}>{item.icon}</button>
            ))}
            <button type="button" className="icon-btn" title="撤销" onClick={undo} disabled={undoRef.current.length === 0}><Undo2 size={16} /></button>
            <button type="button" className="icon-btn" title="重做" onClick={redo} disabled={redoRef.current.length === 0}><Redo2 size={16} /></button>
            <button type="button" className="icon-btn" title="当前颜色" onClick={() => setPickerOpen(true)}>
              <i className="swatch" style={{ background: brushHex ?? "#fff" }} />
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="view"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHover(null)}
          />
          {highlightHex && (
            <div className="highlight-pill">
              <i className="swatch" style={{ background: highlightHex }} />
              只看 {displayCode(highlightHex, colorSystem)} · {counts.find((item) => item.hex === highlightHex)?.count ?? 0} 颗
              <button type="button" className="ghost" style={{ minHeight: 28 }} onClick={() => setHighlightHex(null)}>显示全部</button>
            </div>
          )}
          <div className="view-pill">
            <button type="button" className="icon-btn" onClick={() => zoomBy(0.9)}><Minus size={16} /></button>
            <span className="muted" style={{ width: 48, textAlign: "center" }}>{zoomPct}%</span>
            <button type="button" className="icon-btn" onClick={() => zoomBy(1.1)}><Plus size={16} /></button>
            <button type="button" className="icon-btn" title="适应" onClick={fit}><Grid3x3 size={16} /></button>
            <button type="button" className="icon-btn" data-on={shape === "round"} title="圆豆" onClick={() => setShape("round")}><span style={{ width: 12, height: 12, borderRadius: 99, border: "2px solid currentColor", display: "block" }} /></button>
            <button type="button" className="icon-btn" data-on={shape === "square"} title="方格" onClick={() => setShape("square")}><Square size={16} /></button>
            <button type="button" className="icon-btn" data-on={showGrid} title="网格" onClick={() => setShowGrid((value) => !value)}><Grid3x3 size={16} /></button>
            <button type="button" className="icon-btn" data-on={showCodes} title="色号" onClick={() => setShowCodes((value) => !value)}>字</button>
            <button type="button" className="icon-btn" data-on={showBoard} title="板线" onClick={() => setShowBoard((value) => !value)}>29</button>
            <button type="button" className="icon-btn" data-on={compareHold} title="对比原图" onPointerDown={() => setCompareHold(true)} onPointerUp={() => setCompareHold(false)} onPointerLeave={() => setCompareHold(false)}><Eye size={16} /></button>
          </div>
          <div className="mini-tools mobile-only">
            <button type="button" className="icon-btn" data-on={tool === "brush"} onClick={() => activateTool("brush")}><Brush size={16} /></button>
            <button type="button" className="icon-btn" data-on={tool === "fill"} onClick={() => activateTool("fill")}><PaintBucket size={16} /></button>
            <button type="button" className="icon-btn" data-on={tool === "pick"} onClick={() => setTool("pick")}><Pipette size={16} /></button>
            <button type="button" className="icon-btn" onClick={undo}><Undo2 size={16} /></button>
          </div>
        </main>
        <aside className="panel right">
          <h2 style={{ marginTop: 0 }}>颜色清单</h2>
          <ColorList />
        </aside>
        <section className="sheet mobile-only">
          <div className="handle" onClick={() => setSheetOpen((value) => !value)} />
          <div className="sheet-tabs">
            {([
              ["size", "尺寸"],
              ["style", "风格"],
              ["clean", "清理"],
              ["colors", "颜色"],
              ["advanced", "高级"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className="chip" data-on={sheetTab === id} onClick={() => setSheetTab(id)}>{label}</button>
            ))}
          </div>
          <div className="sheet-body" style={{ maxHeight: sheetOpen ? "62vh" : "28vh" }}>
            {sheetTab === "size" && <><div className="chips" style={{ marginBottom: 12 }}>{COLOR_SYSTEMS.map((system) => (
              <button key={system} type="button" className="chip" data-on={colorSystem === system} onClick={() => setColorSystem(system)}>{system}</button>
            ))}</div><select className="select" value={paletteId} onChange={(event) => setPaletteId(event.target.value)} style={{ marginBottom: 12 }}>{PALETTE_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select><SizeFields /></>}
            {sheetTab === "style" && <StyleFields />}
            {sheetTab === "clean" && <CleanFields />}
            {sheetTab === "colors" && <ColorList />}
            {sheetTab === "advanced" && <AdvancedFields />}
          </div>
        </section>
      </div>
      {hover && <div className="hover-tip" style={{ left: hover.x, top: hover.y }}>{hover.text}</div>}
      {message && <div className="hover-tip" style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)" }}>{message}</div>}
      {pickerOpen && (
        <div className="modal-back" onClick={() => setPickerOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>选择颜色</h3>
            <div className="chips">
              {activePalette.slice(0, 120).map((color) => (
                <button key={color.hex} type="button" className="chip" data-on={brushHex === color.hex} onClick={() => { setBrushHex(color.hex); setPickerOpen(false); setTool("brush"); }}>
                  <i className="swatch" style={{ background: color.hex, display: "inline-block", marginRight: 6 }} />
                  {displayCode(color.hex, colorSystem)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {crop && (
        <div className="modal-back">
          <div className="modal">
            <h3>裁剪</h3>
            <div className="chips" style={{ marginBottom: 8 }}>
              {CROP_RATIOS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="chip"
                  data-on={crop.ratio === item.key}
                  onClick={() => setCrop({
                    ...crop,
                    ratio: item.key,
                    rect: item.aspect ? aspectCrop(crop.pixels, item.aspect[0], item.aspect[1]) : fullRect(crop.pixels),
                  })}
                >{item.label}</button>
              ))}
            </div>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              原图 {crop.pixels.width}×{crop.pixels.height} · 选取 {Math.round(crop.rect.w)}×{Math.round(crop.rect.h)}　拖动框可移动，拖右下角可缩放
            </p>
            <div className="crop-stage">
              <div
                className="crop-frame"
                onPointerMove={(event) => {
                  const drag = cropDrag.current;
                  if (!drag) return;
                  const frame = event.currentTarget;
                  const scaleX = crop.pixels.width / frame.clientWidth;
                  const scaleY = crop.pixels.height / frame.clientHeight;
                  const dx = (event.clientX - drag.x) * scaleX;
                  const dy = (event.clientY - drag.y) * scaleY;
                  const start = drag.rect;
                  const W = crop.pixels.width;
                  const H = crop.pixels.height;
                  if (drag.mode === "move") {
                    setCrop({ ...crop, rect: { ...start, x: clamp(start.x + dx, 0, W - start.w), y: clamp(start.y + dy, 0, H - start.h) } });
                    return;
                  }
                  const aspect = CROP_RATIOS.find((item) => item.key === crop.ratio)?.aspect;
                  const minSize = Math.max(4, Math.round(Math.min(W, H) * 0.05));
                  let w = clamp(start.w + dx, minSize, W - start.x);
                  let h = clamp(start.h + dy, minSize, H - start.y);
                  if (aspect) {
                    const r = aspect[0] / aspect[1];
                    h = w / r;
                    if (h > H - start.y) { h = H - start.y; w = h * r; }
                  }
                  setCrop({ ...crop, rect: { ...start, w: Math.round(w), h: Math.round(h) } });
                }}
                onPointerUp={() => { cropDrag.current = null; }}
                onPointerCancel={() => { cropDrag.current = null; }}
              >
                <img src={crop.url} alt="" draggable={false} />
                <div
                  className="crop-box"
                  style={{
                    left: `${(crop.rect.x / crop.pixels.width) * 100}%`,
                    top: `${(crop.rect.y / crop.pixels.height) * 100}%`,
                    width: `${(crop.rect.w / crop.pixels.width) * 100}%`,
                    height: `${(crop.rect.h / crop.pixels.height) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    (event.currentTarget.parentElement as HTMLElement).setPointerCapture(event.pointerId);
                    cropDrag.current = { x: event.clientX, y: event.clientY, rect: crop.rect, mode: "move" };
                  }}
                >
                  <span
                    className="crop-handle"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      (event.currentTarget.closest(".crop-frame") as HTMLElement).setPointerCapture(event.pointerId);
                      cropDrag.current = { x: event.clientX, y: event.clientY, rect: crop.rect, mode: "resize" };
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="inline" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button type="button" className="ghost" onClick={() => setCrop(null)}>取消</button>
              <button type="button" className="primary" onClick={confirmCrop}>确定</button>
            </div>
          </div>
        </div>
      )}
      {exportOpen && (
        <div className="modal-back" onClick={() => setExportOpen(false)}>
          <div className="modal export-modal" onClick={(event) => event.stopPropagation()}>
            <h3>导出</h3>
            <div className="export-layout">
              <div className="export-preview" ref={exportPreviewRef}>
                <canvas ref={exportCanvasRef} style={exportMirror ? { transform: "scaleX(-1)" } : undefined} />
              </div>
              <div className="export-options">
                <div className="chips">
                  <button type="button" className="chip" data-on={exportCodes} onClick={() => setExportCodes((value) => !value)}>显示色号</button>
                  <button type="button" className="chip" data-on={exportGrid} onClick={() => setExportGrid((value) => !value)}>网格线</button>
                  <button type="button" className="chip" data-on={exportCoords} onClick={() => setExportCoords((value) => !value)}>坐标</button>
                  <button type="button" className="chip" data-on={exportShape === "round"} onClick={() => setExportShape((value) => (value === "round" ? "square" : "round"))}>{exportShape === "round" ? "圆豆" : "方格"}</button>
                </div>
                <div className="mirror-box" data-on={exportMirror}>
                  <label className="inline">
                    <input type="checkbox" checked={exportMirror} onChange={(event) => setExportMirror(event.target.checked)} />
                    <strong>镜像（左右翻转）</strong>
                  </label>
                  <p className="muted">如果你的做法会把作品翻过来烫（比如贴美纹纸翻面），成品会左右颠倒。图里有文字或分左右时，记得勾上。</p>
                </div>
                <div className="pdf-box">
                  <strong>1:1 打印 PDF</strong>
                  <p className="muted">每页一块 29×29 板，按实际大小打印后可以直接垫在板下面拼。每页带行列编号，每 5 格、10 格一条粗线。</p>
                  <div className="inline" style={{ flexWrap: "wrap" }}>
                    <button type="button" className="chip" data-on={pitchMm === 5} onClick={() => setPitchMm(5)}>5 mm 豆</button>
                    <button type="button" className="chip" data-on={pitchMm === 2.6} onClick={() => setPitchMm(2.6)}>2.6 mm 迷你豆</button>
                    <label className="inline muted">
                      豆距
                      <input className="num" type="number" min={2} max={6} step={0.1} value={pitchMm} style={{ width: 64 }} onChange={(event) => { const value = Number(event.target.value); if (value >= 2 && value <= 6) setPitchMm(Math.round(value * 10) / 10); }} />
                      mm
                    </label>
                  </div>
                  <p className="muted">不确定就用尺子量板上 10 个钉子的距离，再除以 10。</p>
                </div>
                <div className="export-actions">
                  <button type="button" className="primary" disabled={pdfBusy !== null} onClick={() => void downloadPdf()}>
                    {pdfBusy === null ? "下载 1:1 打印 PDF" : `生成中 ${Math.round(pdfBusy * 100)}%`}
                  </button>
                  <button type="button" className="ghost" onClick={downloadPattern}>下载图纸 PNG</button>
                  <button type="button" className="ghost" onClick={downloadList}>下载采购清单 PNG</button>
                  <button type="button" className="ghost" onClick={() => void copyList()}>复制清单文本</button>
                </div>
                <SourceNote />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
