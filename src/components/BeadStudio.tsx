"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Brush, Crop, Eraser, Eye, Grid3x3, Hand, Maximize, Minus, PaintBucket, Pipette, Plus, Redo2, Square, Undo2 } from "lucide-react";
import { assetUrl } from "@/lib/assets";
import type { DistanceMetric, PixelMode } from "@/lib/color";
import { downloadCanvas, renderPatternCanvas, renderShoppingListCanvas } from "@/lib/exportPng";
import { decodeImageFile } from "@/lib/imageFile";
import { renderPrintPdf } from "@/lib/printPdf";
import { PatternCancelled, requestPattern } from "@/lib/patternClient";
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
  cloneGrid,
  floodFillPaint,
  paintCell,
  remapColor,
  replaceHex,
  tally,
  type ColorCount,
  type GridCell,
  type ImagePixels,
} from "@/lib/pixelate";
import { BASE_CELL, drawViewport, fitView, hitCell } from "@/lib/preview";
import { aspectCrop, autoRows, clamp, cropPixels, emptyGrid, fullRect, pixelsToUrl } from "@/lib/imageOps";
import { CROP_RATIOS, STYLE_PRESETS, type CropRatio, type CropRect, type SheetTab, type Shape, type StyleId, type Tool } from "./studio/constants";
import { SourceNote, Tip } from "./studio/ui";
import { AdvancedFields, CleanFields, ColorList, SizeFields, StyleFields } from "./studio/panels";


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
  const [note, setNote] = useState<string | null>(null);
  const beforeGridRef = useRef<GridCell[][] | null>(null);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 3500);
    return () => window.clearTimeout(timer);
  }, [note]);

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
          const next = await requestPattern(
            image,
            {
              cols,
              rows,
              paletteId,
              excluded: excludedRef.current,
              mode,
              threshold,
              metric,
              removeBg: removeBgRef.current,
              maxColors,
              minCount,
            },
            (ratio) => {
              if (seq === runRef.current) setProgress(ratio);
            },
          );
          if (seq !== runRef.current) return;
          undoRef.current = [];
          redoRef.current = [];
          bumpHist();
          const before = beforeGridRef.current;
          beforeGridRef.current = null;
          applyGrid(next);
          setMessage(null);
          if (before && before.length === next.length && before[0]?.length === next[0]?.length) {
            let changed = 0;
            next.forEach((row, r) => row.forEach((cell, c) => { if (cell.hex !== before[r][c].hex) changed++; }));
            setNote(changed === 0 ? "这张图色块很平整，换这个设置图纸没有变化" : `已重新生成，${changed.toLocaleString()} 格颜色有变化`);
          }
        } catch (error) {
          if (seq !== runRef.current || error instanceof PatternCancelled) return;
          notify(error instanceof Error ? error.message : "生成失败");
        } finally {
          if (seq === runRef.current) setProcessing(false);
        }
      })();
    }, 160);
    return () => window.clearTimeout(timer);
  }, [cols, rows, paletteId, mode, threshold, metric, maxColors, minCount, buildToken, applyGrid, notify]);

  // The style chip reflects the current settings directly, so it never drifts.
  const styleId: StyleId =
    (Object.keys(STYLE_PRESETS) as Exclude<StyleId, "custom">[]).find((id) => {
      const preset = STYLE_PRESETS[id];
      return preset.mode === mode && preset.metric === metric && preset.threshold === threshold;
    }) ?? "custom";

  useEffect(() => {
    if (!grid) return;
    const timer = window.setTimeout(() => fit(), 30);
    return () => window.clearTimeout(timer);
    // Fit when the board size changes, not on every paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, Boolean(grid), fit]);

  // The mobile sheet changes the stage height; refit so the board stays in view.
  useEffect(() => {
    if (!gridRef.current) return;
    const timer = window.setTimeout(() => fit(), 30);
    return () => window.clearTimeout(timer);
  }, [sheetOpen, fit]);

  // On phones one finger should move the board, not paint it, until a tool is picked.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setTool("view");
  }, []);

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
      if (key === "v") setTool("view");
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
    const preset = STYLE_PRESETS[id];
    setMode(preset.mode);
    setMetric(preset.metric);
    setThreshold(preset.threshold);
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
    downloadCanvas(canvas, `数豆格-${cols}x${rows}-${colorSystem}.png`);
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
      link.download = `数豆格-1比1打印-${cols}x${rows}-${colorSystem}.pdf`;
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


  const pickAdvanced = (next: { mode?: PixelMode; metric?: DistanceMetric }) => {
    if ((next.mode ?? mode) === mode && (next.metric ?? metric) === metric) return;
    beforeGridRef.current = gridRef.current;
    if (next.mode) setMode(next.mode);
    if (next.metric) setMetric(next.metric);
  };

  const pickListColor = (hex: string) => {
    if (tool === "brush" || tool === "fill") {
      brushRef.current = hex;
      setBrushHex(hex);
      setHighlightHex(hex);
      return;
    }
    setHighlightHex((current) => (current === hex ? null : hex));
  };

  const sizeFields = (
    <SizeFields cols={cols} rows={rows} total={total} lockRatio={lockRatio} onLockRatio={setLockRatio} onCols={updateCols} onRows={updateRows} />
  );
  const styleFields = <StyleFields styleId={styleId} onStyle={applyStyle} />;
  const cleanFields = (
    <CleanFields
      colorCount={counts.length}
      threshold={threshold}
      setThreshold={setThreshold}
      maxColors={maxColors}
      setMaxColors={setMaxColors}
      minCount={minCount}
      setMinCount={setMinCount}
      removeBg={removeBg}
      onToggleBackground={toggleBackground}
    />
  );
  const advancedFields = <AdvancedFields mode={mode} metric={metric} onPick={pickAdvanced} />;
  const colorList = (
    <ColorList
      counts={counts}
      sortedCounts={sortedCounts}
      total={total}
      sortBy={sortBy}
      setSortBy={setSortBy}
      colorQuery={colorQuery}
      setColorQuery={setColorQuery}
      colorSystem={colorSystem}
      highlightHex={highlightHex}
      onPickColor={pickListColor}
      onExclude={excludeColor}
      excluded={excluded}
      onRestore={restoreColor}
      replaceFrom={replaceFrom}
      setReplaceFrom={setReplaceFrom}
      activePalette={activePalette}
      onReplaceAll={replaceAll}
    />
  );

  const tools: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
    { id: "view", label: "查看 · 拖动移动图纸", key: "V", icon: <Eye size={16} /> },
    { id: "brush", label: "画笔", key: "B", icon: <Brush size={16} /> },
    { id: "fill", label: "填充 · 换掉相连的同色", key: "G", icon: <PaintBucket size={16} /> },
    { id: "eraser", label: "橡皮", key: "E", icon: <Eraser size={16} /> },
    { id: "pick", label: "吸管 · 取图上的颜色", key: "I", icon: <Pipette size={16} /> },
  ];

  if (!grid && !crop && !imageLabel) {
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
          <h1>数豆格</h1>
          <p className="tagline">传图生成拼豆图纸，<br />支持 291 色号对照、单色高亮与 1:1 分板打印 PDF</p>
          <p className="muted">支持 MARD / COCO / 漫漫 / 盼盼 / 咪小窝 · 图片只在本机处理，不会上传</p>
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
          <strong>数豆格</strong>
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
          {sideTab === "colors" && <div className="tablet-colors">{colorList}</div>}
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
              {sizeFields}
            </section>
            <section className="section">
              <h2>图案风格 <Tip text="预设只调整取色、色差和合并强度。" /></h2>
              {styleFields}
            </section>
            <section className="section">
              <h2>清理 <Tip text="只清零星杂色，大块不同的颜色会保留。" /></h2>
              {cleanFields}
            </section>
            <details className="section">
              <summary>高级</summary>
              <div style={{ marginTop: 12 }}>{advancedFields}</div>
            </details>
          </div>
        </aside>
        <main className="stage" ref={stageRef}>
          {processing && <div className="progress"><b style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          <div className="tool-pill">
            {tools.map((item) => (
              <button key={item.id} type="button" className="icon-btn" aria-label={item.label} data-tip={`${item.label}　${item.key}`} data-on={tool === item.id} onClick={() => activateTool(item.id)}>{item.icon}</button>
            ))}
            <button type="button" className="icon-btn" aria-label="撤销" data-tip="撤销　⌘Z / Ctrl+Z" onClick={undo} disabled={undoRef.current.length === 0}><Undo2 size={16} /></button>
            <button type="button" className="icon-btn" aria-label="重做" data-tip="重做　⇧⌘Z / Ctrl+Y" onClick={redo} disabled={redoRef.current.length === 0}><Redo2 size={16} /></button>
            <button type="button" className="icon-btn" aria-label="当前颜色" data-tip="当前颜色 · 点击换色" onClick={() => setPickerOpen(true)}>
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
            <button type="button" className="icon-btn" aria-label="缩小" data-tip="缩小" onClick={() => zoomBy(0.9)}><Minus size={16} /></button>
            <span className="muted" style={{ width: 48, textAlign: "center" }}>{zoomPct}%</span>
            <button type="button" className="icon-btn" aria-label="放大" data-tip="放大" onClick={() => zoomBy(1.1)}><Plus size={16} /></button>
            <button type="button" className="icon-btn" aria-label="适应屏幕" data-tip="适应屏幕" onClick={fit}><Grid3x3 size={16} /></button>
            <button type="button" className="icon-btn" data-on={shape === "round"} aria-label="圆豆显示" data-tip="圆豆显示" onClick={() => setShape("round")}><span style={{ width: 12, height: 12, borderRadius: 99, border: "2px solid currentColor", display: "block" }} /></button>
            <button type="button" className="icon-btn" data-on={shape === "square"} aria-label="方格显示" data-tip="方格显示" onClick={() => setShape("square")}><Square size={16} /></button>
            <button type="button" className="icon-btn" data-on={showGrid} aria-label="显示网格" data-tip="显示网格" onClick={() => setShowGrid((value) => !value)}><Grid3x3 size={16} /></button>
            <button type="button" className="icon-btn" data-on={showCodes} aria-label="显示色号" data-tip="显示色号" onClick={() => setShowCodes((value) => !value)}>字</button>
            <button type="button" className="icon-btn" data-on={showBoard} aria-label="显示 29 格板线" data-tip="显示 29 格板线" onClick={() => setShowBoard((value) => !value)}>29</button>
            <button type="button" className="icon-btn" data-on={compareHold} aria-label="按住对比原图" data-tip="按住对比原图" onPointerDown={() => setCompareHold(true)} onPointerUp={() => setCompareHold(false)} onPointerLeave={() => setCompareHold(false)}><Eye size={16} /></button>
          </div>
        </main>
        <aside className="panel right">
          <h2 style={{ marginTop: 0 }}>颜色清单</h2>
          {colorList}
        </aside>
        <section className="sheet mobile-only" data-open={sheetOpen}>
          <button type="button" className="handle" aria-label={sheetOpen ? "收起设置" : "展开设置"} onClick={() => setSheetOpen((value) => !value)}><i /></button>
          <div className="m-toolbar">
            <button type="button" className="icon-btn" data-on={tool === "view"} title="移动" onClick={() => activateTool("view")}><Hand size={18} /></button>
            <button type="button" className="icon-btn" data-on={tool === "brush"} title="画笔" onClick={() => activateTool("brush")}><Brush size={18} /></button>
            <button type="button" className="icon-btn" data-on={tool === "fill"} title="填充" onClick={() => activateTool("fill")}><PaintBucket size={18} /></button>
            <button type="button" className="icon-btn" data-on={tool === "eraser"} title="橡皮" onClick={() => activateTool("eraser")}><Eraser size={18} /></button>
            <button type="button" className="icon-btn" data-on={tool === "pick"} title="吸管" onClick={() => activateTool("pick")}><Pipette size={18} /></button>
            <button type="button" className="icon-btn" title="当前颜色" onClick={() => setPickerOpen(true)}><i className="swatch" style={{ background: brushHex ?? "#fff" }} /></button>
            <span className="m-sep" />
            <button type="button" className="icon-btn" title="撤销" onClick={undo} disabled={undoRef.current.length === 0}><Undo2 size={18} /></button>
            <button type="button" className="icon-btn" title="重做" onClick={redo} disabled={redoRef.current.length === 0}><Redo2 size={18} /></button>
            <button type="button" className="icon-btn" title="适应屏幕" onClick={fit}><Maximize size={18} /></button>
          </div>
          <div className="sheet-tabs">
            {([
              ["size", "尺寸"],
              ["style", "风格"],
              ["clean", "清理"],
              ["colors", "颜色"],
              ["advanced", "高级"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                data-on={sheetOpen && sheetTab === id}
                onClick={() => {
                  if (sheetOpen && sheetTab === id) setSheetOpen(false);
                  else { setSheetTab(id); setSheetOpen(true); }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {sheetOpen && <div className="sheet-body">
            {sheetTab === "size" && <><div className="chips" style={{ marginBottom: 12 }}>{COLOR_SYSTEMS.map((system) => (
              <button key={system} type="button" className="chip" data-on={colorSystem === system} onClick={() => setColorSystem(system)}>{system}</button>
            ))}</div><select className="select" value={paletteId} onChange={(event) => setPaletteId(event.target.value)} style={{ marginBottom: 12 }}>{PALETTE_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select>{sizeFields}</>}
            {sheetTab === "style" && styleFields}
            {sheetTab === "clean" && cleanFields}
            {sheetTab === "colors" && colorList}
            {sheetTab === "advanced" && advancedFields}
          </div>}
        </section>
      </div>
      {hover && <div className="hover-tip" style={{ left: hover.x, top: hover.y }}>{hover.text}</div>}
      {(message ?? note) && <div className="hover-tip" style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)" }}>{message ?? note}</div>}
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
