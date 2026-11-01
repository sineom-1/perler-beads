"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";
import type { DistanceMetric, PixelMode } from "@/lib/color";
import { downloadCanvas, renderPatternCanvas, renderShoppingListCanvas } from "@/lib/exportPng";
import { decodeImageFile } from "@/lib/imageFile";
import {
  COLOR_SYSTEMS,
  PALETTE_CHOICES,
  compareCodes,
  displayCode,
  getAllColors,
  getColorByHex,
  getPalette,
  paletteCount,
  type ColorSystem,
} from "@/lib/palette";
import {
  buildPattern,
  cloneGrid,
  floodErase,
  paintCell,
  remapColor,
  removeBorderBackground,
  tally,
  type ColorCount,
  type GridCell,
  type ImagePixels,
} from "@/lib/pixelate";
import { drawPreview } from "@/lib/preview";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function autoRows(columns: number, image: ImagePixels) {
  return clamp(Math.round(columns * (image.height / image.width)), 8, 180);
}

export default function BeadStudio() {
  const imageRef = useRef<ImagePixels | null>(null);
  const gridRef = useRef<GridCell[][] | null>(null);
  const undoRef = useRef<GridCell[][][]>([]);
  const runRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const paintingRef = useRef(false);
  const lastCellRef = useRef("");
  const undoArmedRef = useRef(false);

  const [imageVersion, setImageVersion] = useState(0);
  const [rebuildToken, setRebuildToken] = useState(0);
  const [imageLabel, setImageLabel] = useState<string | null>(null);
  const [cols, setCols] = useState(48);
  const [rows, setRows] = useState(48);
  const [lockRatio, setLockRatio] = useState(true);
  const [threshold, setThreshold] = useState(30);
  const [paletteId, setPaletteId] = useState("168");
  const [colorSystem, setColorSystem] = useState<ColorSystem>("MARD");
  const [mode, setMode] = useState<PixelMode>("dominant");
  const [metric, setMetric] = useState<DistanceMetric>("oklab");
  const [grid, setGrid] = useState<GridCell[][] | null>(null);
  const [counts, setCounts] = useState<ColorCount[]>([]);
  const [total, setTotal] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);
  const excludedRef = useRef<string[]>([]);
  excludedRef.current = excluded;
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<string | "erase">("erase");
  const [floodArmed, setFloodArmed] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [bgSnapshot, setBgSnapshot] = useState<GridCell[][] | null>(null);
  const [highlightHex, setHighlightHex] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [hoverText, setHoverText] = useState("把指针移到格子上可查看色号");
  const [showCodes, setShowCodes] = useState(true);
  const [includeStats, setIncludeStats] = useState(true);
  const [query, setQuery] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);

  const notify = useCallback((text: string) => {
    setMessage(text);
  }, []);

  const applyGrid = useCallback((next: GridCell[][]) => {
    gridRef.current = next;
    setGrid(next);
    const totals = tally(next);
    setCounts(totals.counts);
    setTotal(totals.total);
  }, []);

  const pushUndo = useCallback((snapshot: GridCell[][]) => {
    undoRef.current = [...undoRef.current.slice(-39), snapshot];
    setUndoCount(undoRef.current.length);
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoRef.current.pop();
    setUndoCount(undoRef.current.length);
    if (!snapshot) return;
    applyGrid(snapshot);
  }, [applyGrid]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || imageVersion === 0) return;
    const seq = ++runRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
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
          undoRef.current = [];
          setUndoCount(0);
          setEditing(false);
          setFloodArmed(false);
          setBgSnapshot(null);
          applyGrid(result.grid);
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
  }, [imageVersion, rebuildToken, cols, rows, paletteId, mode, threshold, metric, applyGrid, notify]);

  useEffect(() => {
    if (canvasRef.current && grid) drawPreview(canvasRef.current, grid, editing ? null : highlightHex);
  }, [grid, highlightHex, editing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, undo]);

  const sortedCounts = useMemo(
    () =>
      [...counts].sort((a, b) =>
        compareCodes(displayCode(a.hex, colorSystem), displayCode(b.hex, colorSystem)),
      ),
    [counts, colorSystem],
  );

  const activePalette = useMemo(() => {
    const skip = new Set(excluded);
    return getPalette(paletteId).filter((color) => !skip.has(color.hex));
  }, [paletteId, excluded]);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return activePalette
      .filter((color) => displayCode(color.hex, colorSystem).toLowerCase().includes(term))
      .slice(0, 48);
  }, [query, activePalette, colorSystem]);

  async function useFile(file: File) {
    if (!file.type.startsWith("image/")) {
      notify("请上传 JPG、PNG、GIF 或 WebP 图片。");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      notify("图片超过 25MB，请先压缩后再上传。");
      return;
    }
    try {
      const pixels = await decodeImageFile(file);
      imageRef.current = pixels;
      setImageLabel(`${file.name} · 采样 ${pixels.width}×${pixels.height}`);
      setExcluded([]);
      const nextRows = lockRatio ? autoRows(cols, pixels) : rows;
      setRows(nextRows);
      setImageVersion((value) => value + 1);
      setMessage(null);
    } catch {
      notify("这张图片无法读取，请换一张。");
    }
  }

  async function loadSample() {
    try {
      const response = await fetch(assetUrl("/samples/demo.png"));
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      await useFile(new File([blob], "示例小房子.png", { type: "image/png" }));
    } catch {
      notify("示例图片加载失败。");
    }
  }

  function updateCols(value: number) {
    const next = clamp(value, 8, 180);
    setCols(next);
    if (lockRatio && imageRef.current) setRows(autoRows(next, imageRef.current));
  }

  function updateRows(value: number) {
    setLockRatio(false);
    setRows(clamp(value, 8, 180));
  }

  function describe(row: number, col: number) {
    const cell = gridRef.current?.[row]?.[col];
    if (!cell) return "";
    if (cell.isExternal) return `第 ${row + 1} 行，第 ${col + 1} 列 · 空位`;
    return `第 ${row + 1} 行，第 ${col + 1} 列 · ${displayCode(cell.hex, colorSystem)}`;
  }

  function cellFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const current = gridRef.current;
    if (!canvas || !current?.[0]) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * current[0].length);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * current.length);
    if (row < 0 || col < 0 || row >= current.length || col >= current[0].length) return null;
    return { row, col };
  }

  function paintAt(row: number, col: number) {
    const current = gridRef.current;
    if (!current) return;
    const id = `${row},${col}`;
    if (lastCellRef.current === id) return;
    lastCellRef.current = id;
    const cell = current[row][col];
    if (floodArmed) {
      if (cell.isExternal) return;
      if (!undoArmedRef.current) {
        pushUndo(cloneGrid(current));
        undoArmedRef.current = true;
      }
      applyGrid(floodErase(current, row, col));
      setFloodArmed(false);
      paintingRef.current = false;
      notify(`已擦除连通的 ${displayCode(cell.hex, colorSystem)}`);
      return;
    }
    if (brush !== "erase") {
      if (!cell.isExternal && cell.hex === brush) return;
    } else if (cell.isExternal) {
      return;
    }
    if (!undoArmedRef.current) {
      pushUndo(cloneGrid(current));
      undoArmedRef.current = true;
    }
    const color = brush === "erase" ? null : (getColorByHex(brush) ?? null);
    const next = paintCell(current, row, col, color);
    gridRef.current = next;
    setGrid(next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const spot = cellFromEvent(event);
    if (!spot) return;
    if (!editing) {
      setHoverText(describe(spot.row, spot.col));
      return;
    }
    event.preventDefault();
    paintingRef.current = true;
    undoArmedRef.current = false;
    lastCellRef.current = "";
    canvasRef.current?.setPointerCapture(event.pointerId);
    paintAt(spot.row, spot.col);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const spot = cellFromEvent(event);
    if (!spot) return;
    if (!editing) {
      if (event.pointerType === "mouse") setHoverText(describe(spot.row, spot.col));
      return;
    }
    if (!paintingRef.current) return;
    paintAt(spot.row, spot.col);
  }

  function finishStroke() {
    if (!paintingRef.current && !undoArmedRef.current) return;
    paintingRef.current = false;
    lastCellRef.current = "";
    if (gridRef.current) {
      const totals = tally(gridRef.current);
      setCounts(totals.counts);
      setTotal(totals.total);
    }
  }

  function excludeColor(hex: string) {
    const current = gridRef.current;
    const source = getColorByHex(hex);
    if (!current || !source) return;
    const present = new Set(
      counts.map((item) => item.hex).filter((item) => item !== hex && !excluded.includes(item)),
    );
    const targets = getAllColors().filter((color) => present.has(color.hex));
    if (targets.length === 0) {
      notify("至少保留一种颜色。");
      return;
    }
    const result = remapColor(current, source, targets, metric);
    setExcluded((previous) => [...previous, hex]);
    setBgSnapshot(null);
    applyGrid(result.grid);
    notify(
      `已排除 ${displayCode(hex, colorSystem)}，${result.replaced} 格改为 ${displayCode(result.replacement.hex, colorSystem)}。`,
    );
  }

  function restoreColor(hex?: string) {
    setExcluded((previous) => (hex ? previous.filter((item) => item !== hex) : []));
    setRebuildToken((value) => value + 1);
    notify("正在按原图重新生成，手动修改会被覆盖。");
  }

  function removeBackground() {
    const current = gridRef.current;
    if (!current) return;
    const result = removeBorderBackground(current);
    if (!result.removed || !result.hex) {
      notify("边缘没有可去掉的背景。主体如果贴着边，可以改用手动橡皮擦。");
      return;
    }
    setBgSnapshot(cloneGrid(current));
    applyGrid(result.grid);
    notify(`已去掉边缘连通的 ${displayCode(result.hex, colorSystem)}，共 ${result.removed} 格。`);
  }

  function undoBackground() {
    if (!bgSnapshot) return;
    applyGrid(bgSnapshot);
    setBgSnapshot(null);
    notify("已撤销去背景。");
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
      showCodes,
      includeStats,
      gridInterval: 10,
      showCoordinates: true,
      codeFor: (hex) => displayCode(hex, colorSystem),
    });
    downloadCanvas(canvas, `拼豆图纸-${cols}x${rows}-${colorSystem}.png`);
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
    const lines = sortedCounts.map((item) => `${displayCode(item.hex, colorSystem)}\t${item.count}`);
    const text = [`品牌 ${colorSystem}`, `网格 ${cols}×${rows}`, `合计 ${total}`, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("采购清单已复制。");
    } catch {
      notify("浏览器没有开放剪贴板，请改用下载采购清单。");
    }
  }

  const paletteHelp =
    "96 / 120 / 144 来自上游套装色表，并额外包含白珠 T1。168 色是在 144 色表上补齐后续 23 个 MARD 色号。";

  return (
    <div
      className="min-h-screen"
      onDragOver={(event) => {
        event.preventDefault();
        setDraggingFile(true);
      }}
      onDragLeave={() => setDraggingFile(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDraggingFile(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void useFile(file);
      }}
    >
      <header className="border-b border-[#e4d5bf] bg-[#fffdf8]/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#1f6f6a]">PERLER BEADS</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">拼豆图纸生成器</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#6d6258]">
              上传任意图片，提取每格主色并映射到拼豆色号。可合并相近颜色、去掉边缘背景、逐格修改，再导出带色号的图纸和采购清单。
            </p>
          </div>
          <a
            className="text-sm font-medium text-[#1f6f6a] underline-offset-4 hover:underline"
            href="https://github.com/Zippland/perler-beads"
            target="_blank"
            rel="noreferrer"
          >
            算法与色号来自 Zippland/perler-beads
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 pb-28 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <section className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto lg:pr-1">
          <div
            className={`rounded-2xl border bg-[#fffdf8] p-4 shadow-sm ${draggingFile ? "border-[#c2412d]" : "border-[#e4d5bf]"}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void useFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#d8c6aa] bg-[#fbf7f0] px-4 py-5 text-center"
            >
              <span className="text-base font-semibold">上传图片</span>
              <span className="mt-1 text-xs leading-5 text-[#6d6258]">点击选择，或把文件拖到页面上。手机和电脑都可以。</span>
            </button>
            <button
              type="button"
              onClick={() => void loadSample()}
              className="mt-3 min-h-11 w-full rounded-xl border border-[#1f6f6a] px-3 text-sm font-semibold text-[#1f6f6a]"
            >
              使用示例图片
            </button>
            {imageLabel && <p className="mt-3 text-xs leading-5 text-[#6d6258]">{imageLabel}</p>}
          </div>

          <div className="space-y-4 rounded-2xl border border-[#e4d5bf] bg-[#fffdf8] p-4 shadow-sm">
            <label className="block text-sm font-semibold">
              横向格数 {cols}
              <input
                className="mt-2 w-full"
                type="range"
                min={8}
                max={180}
                value={cols}
                onChange={(event) => updateCols(Number(event.target.value))}
              />
            </label>
            <label className="block text-sm font-semibold">
              纵向格数 {rows}
              <input
                className="mt-2 w-full"
                type="range"
                min={8}
                max={180}
                value={rows}
                onChange={(event) => updateRows(Number(event.target.value))}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lockRatio}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setLockRatio(checked);
                  if (checked && imageRef.current) setRows(autoRows(cols, imageRef.current));
                }}
              />
              按图片比例锁定高度
            </label>
            <label className="block text-sm font-semibold">
              相似色合并阈值 {threshold}
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={80}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-[#6d6258]">
                0 表示不合并。数值越大，相邻且相近的颜色越容易收成同一色号。
              </span>
            </label>

            <label className="block text-sm font-semibold">
              色板规格
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-[#e4d5bf] bg-white px-3"
                value={paletteId}
                onChange={(event) => setPaletteId(event.target.value)}
              >
                {PALETTE_CHOICES.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}（{paletteCount(choice.id)}）
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal leading-5 text-[#6d6258]">{paletteHelp}</span>
            </label>

            <div>
              <p className="text-sm font-semibold">品牌色号</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLOR_SYSTEMS.map((system) => (
                  <button
                    key={system}
                    type="button"
                    onClick={() => setColorSystem(system)}
                    className={`min-h-10 rounded-full px-3 text-sm font-semibold ${
                      colorSystem === system ? "bg-[#1f6f6a] text-white" : "bg-[#f6f0e6] text-[#241c16]"
                    }`}
                  >
                    {system}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">取色方式</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("dominant")}
                  className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${mode === "dominant" ? "bg-[#c2412d] text-white" : "bg-[#f6f0e6]"}`}
                >
                  主色
                </button>
                <button
                  type="button"
                  onClick={() => setMode("average")}
                  className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${mode === "average" ? "bg-[#c2412d] text-white" : "bg-[#f6f0e6]"}`}
                >
                  平均色
                </button>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6d6258]">主色适合像素图和卡通；平均色适合照片。</p>
            </div>

            <div>
              <p className="text-sm font-semibold">色差算法</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetric("oklab")}
                  className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${metric === "oklab" ? "bg-[#241c16] text-white" : "bg-[#f6f0e6]"}`}
                >
                  Oklab
                </button>
                <button
                  type="button"
                  onClick={() => setMetric("ciede2000")}
                  className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${metric === "ciede2000" ? "bg-[#241c16] text-white" : "bg-[#f6f0e6]"}`}
                >
                  CIEDE2000
                </button>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6d6258]">
                {metric === "ciede2000" ? "CIEDE2000 建议把阈值放在 8 到 18。" : "Oklab 与上游阈值手感一致，30 是适中的清理强度。"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!grid || processing}
                onClick={removeBackground}
                className="min-h-11 rounded-xl bg-[#1f6f6a] px-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                去除背景
              </button>
              <button
                type="button"
                disabled={!bgSnapshot}
                onClick={undoBackground}
                className="min-h-11 rounded-xl border border-[#e4d5bf] px-2 text-sm font-semibold disabled:opacity-40"
              >
                撤销去背景
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {!grid && !processing && (
            <div className="rounded-2xl border border-[#e4d5bf] bg-[#fffdf8] p-5 shadow-sm">
              <h2 className="text-lg font-bold">四步得到可打印底稿</h2>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-[#6d6258]">
                <li>1. 上传图片，或先用示例小房子看效果。</li>
                <li>2. 选择 MARD、COCO、漫漫、盼盼或咪小窝，以及 72 到 291 色的色板。</li>
                <li>3. 调整网格和合并阈值。边缘底色可以用「去除背景」从四周向内剥掉。</li>
                <li>4. 下载带色号和网格线的 PNG，或单独导出采购清单。</li>
              </ol>
            </div>
          )}

          {(grid || processing) && (
            <div className="rounded-2xl border border-[#e4d5bf] bg-[#fffdf8] p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">
                    {cols} × {rows} 格
                  </h2>
                  <p className="text-xs text-[#6d6258]">
                    {sortedCounts.length} 色 · {total} 颗{processing ? " · 正在生成" : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-[#6d6258]">
                  预览缩放 {zoom}%
                  <input
                    type="range"
                    min={80}
                    max={240}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                </label>
              </div>
              {processing && (
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#f6f0e6]">
                  <div className="h-full bg-[#c2412d] transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
              <div className="max-h-[70vh] overflow-auto rounded-xl bg-[#efe6d6] p-2">
                <canvas
                  ref={canvasRef}
                  className={`bead-canvas block ${editing ? "cursor-crosshair" : "cursor-crosshair"}`}
                  style={{ width: `${zoom}%`, height: "auto", touchAction: editing ? "none" : "auto" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishStroke}
                  onPointerCancel={finishStroke}
                />
              </div>
              <p className="mt-2 text-sm text-[#6d6258]">{hoverText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing((value) => !value);
                    setFloodArmed(false);
                    if (!editing && sortedCounts[0]) setBrush(sortedCounts[0].hex);
                  }}
                  className="min-h-11 rounded-xl bg-[#241c16] px-4 text-sm font-semibold text-white"
                >
                  {editing ? "完成编辑" : "手动编辑"}
                </button>
                <button
                  type="button"
                  disabled={!grid || processing}
                  onClick={downloadPattern}
                  className="min-h-11 rounded-xl bg-[#c2412d] px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  下载图纸
                </button>
                <button
                  type="button"
                  disabled={!grid || processing}
                  onClick={downloadList}
                  className="min-h-11 rounded-xl border border-[#c2412d] px-4 text-sm font-semibold text-[#c2412d] disabled:opacity-40"
                >
                  下载采购清单
                </button>
                <button
                  type="button"
                  disabled={!grid}
                  onClick={() => void copyList()}
                  className="min-h-11 rounded-xl border border-[#e4d5bf] px-4 text-sm font-semibold disabled:opacity-40"
                >
                  复制清单
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={showCodes} onChange={(event) => setShowCodes(event.target.checked)} />
                  图纸标注色号
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeStats}
                    onChange={(event) => setIncludeStats(event.target.checked)}
                  />
                  图纸附带用量表
                </label>
              </div>
            </div>
          )}

          {editing && grid && (
            <div className="rounded-2xl border border-[#e4d5bf] bg-[#fffdf8] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">逐格上色</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={undoCount === 0}
                    onClick={undo}
                    className="min-h-10 rounded-xl border border-[#e4d5bf] px-3 text-sm font-semibold disabled:opacity-40"
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    onClick={() => setFloodArmed((value) => !value)}
                    className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${floodArmed ? "bg-[#c2412d] text-white" : "bg-[#f6f0e6]"}`}
                  >
                    {floodArmed ? "点击同色区域擦除" : "连通擦除"}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6d6258]">
                选中颜色后点按或拖动格子。橡皮擦会把格子标成空位，不计入用豆。电脑上可以按 Ctrl/⌘+Z 撤销。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SwatchButton
                  selected={brush === "erase"}
                  label="橡皮擦"
                  faint
                  onClick={() => {
                    setBrush("erase");
                    setFloodArmed(false);
                  }}
                />
                {sortedCounts.map((item) => (
                  <SwatchButton
                    key={item.hex}
                    selected={brush === item.hex}
                    hex={item.hex}
                    label={displayCode(item.hex, colorSystem)}
                    count={item.count}
                    onClick={() => {
                      setBrush(item.hex);
                      setFloodArmed(false);
                    }}
                  />
                ))}
              </div>
              <label className="mt-3 block text-sm font-semibold">
                搜索色板里的其他色号
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如 A14 或 65"
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#e4d5bf] px-3 font-normal"
                />
              </label>
              {searchResults.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {searchResults.map((color) => (
                    <SwatchButton
                      key={color.hex}
                      selected={brush === color.hex}
                      hex={color.hex}
                      label={displayCode(color.hex, colorSystem)}
                      onClick={() => setBrush(color.hex)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!editing && sortedCounts.length > 0 && (
            <div className="rounded-2xl border border-[#e4d5bf] bg-[#fffdf8] p-4 shadow-sm">
              <h2 className="text-lg font-bold">用色与排除</h2>
              <p className="mt-1 text-xs leading-5 text-[#6d6258]">
                点一种颜色即可排除，并用色板里最接近的保留色替换它。悬停可以在图纸上高亮。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sortedCounts.map((item) => (
                  <button
                    key={item.hex}
                    type="button"
                    onMouseEnter={() => setHighlightHex(item.hex)}
                    onMouseLeave={() => setHighlightHex(null)}
                    onClick={() => excludeColor(item.hex)}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-[#e4d5bf] bg-white px-2 pr-3 text-left"
                  >
                    <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: item.hex }} />
                    <span className="text-sm font-semibold">{displayCode(item.hex, colorSystem)}</span>
                    <span className="text-xs text-[#6d6258]">{item.count}</span>
                  </button>
                ))}
              </div>
              {excluded.length > 0 && (
                <div className="mt-4 rounded-xl bg-[#f6f0e6] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">已排除 {excluded.length} 色</p>
                    <button type="button" onClick={() => restoreColor()} className="text-sm font-semibold text-[#1f6f6a]">
                      全部恢复
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {excluded.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => restoreColor(hex)}
                        className="flex min-h-10 items-center gap-2 rounded-full bg-white px-2 text-sm"
                      >
                        <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: hex }} />
                        {displayCode(hex, colorSystem)} 恢复
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {message && (
            <p role="status" className="rounded-xl border border-[#e4d5bf] bg-[#fff7ea] px-4 py-3 text-sm leading-6">
              {message}
            </p>
          )}
        </section>
      </main>

      {grid && !editing && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e4d5bf] bg-[#fffdf8]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadPattern}
              className="min-h-11 rounded-xl bg-[#c2412d] text-sm font-semibold text-white"
            >
              下载图纸
            </button>
            <button
              type="button"
              onClick={downloadList}
              className="min-h-11 rounded-xl border border-[#c2412d] text-sm font-semibold text-[#c2412d]"
            >
              采购清单
            </button>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs leading-6 text-[#6d6258]">
        <p>
          本仓库是{" "}
          <a className="underline" href="https://github.com/Zippland/perler-beads" target="_blank" rel="noreferrer">
            Zippland/perler-beads
          </a>{" "}
          的独立衍生作品，不是 GitHub fork。291 色到 MARD / COCO / 漫漫 / 盼盼 / 咪小窝的对照，以及主色提取、区域合并和边缘洪水填充，改编自该项目。
          原始版权归 Zippland，代码以{" "}
          <a className="underline" href="https://github.com/sineom-1/perler-beads/blob/main/LICENSE">
            AGPL-3.0
          </a>{" "}
          授权。源代码：
          <a className="underline" href="https://github.com/sineom-1/perler-beads" target="_blank" rel="noreferrer">
            sineom-1/perler-beads
          </a>
          。
        </p>
      </footer>
    </div>
  );
}

function SwatchButton({
  selected,
  label,
  hex,
  count,
  faint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hex?: string;
  count?: number;
  faint?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-full border px-2 pr-3 ${
        selected ? "border-[#c2412d] ring-2 ring-[#c2412d]" : "border-[#e4d5bf]"
      } ${faint ? "bg-[#f6f0e6]" : "bg-white"}`}
    >
      <span
        className="h-6 w-6 rounded-full border border-black/10"
        style={{
          background: hex ?? "repeating-linear-gradient(45deg,#fff,#fff 4px,#e7dcc8 4px,#e7dcc8 8px)",
        }}
      />
      <span className="text-sm font-semibold">{label}</span>
      {typeof count === "number" && <span className="text-xs text-[#6d6258]">{count}</span>}
    </button>
  );
}
