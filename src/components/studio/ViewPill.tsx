"use client";

import { Eye, Grid3x3, Minus, Plus, Square } from "lucide-react";
import type { Shape } from "./constants";

/** Bottom canvas bar: zoom, bead shape and overlay toggles. */
export function ViewPill(props: {
  zoomPct: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
  shape: Shape;
  onShape: (shape: Shape) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showCodes: boolean;
  onToggleCodes: () => void;
  showBoard: boolean;
  onToggleBoard: () => void;
  compareHold: boolean;
  onCompare: (hold: boolean) => void;
}) {
  const { zoomPct, onZoom, onFit, shape, onShape, showGrid, onToggleGrid, showCodes, onToggleCodes, showBoard, onToggleBoard, compareHold, onCompare } = props;
  return (
    <div className="view-pill">
      <button type="button" className="icon-btn" aria-label="缩小" data-tip="缩小" onClick={() => onZoom(0.9)}><Minus size={16} /></button>
      <span className="muted" style={{ width: 48, textAlign: "center" }}>{zoomPct}%</span>
      <button type="button" className="icon-btn" aria-label="放大" data-tip="放大" onClick={() => onZoom(1.1)}><Plus size={16} /></button>
      <button type="button" className="icon-btn" aria-label="适应屏幕" data-tip="适应屏幕" onClick={onFit}><Grid3x3 size={16} /></button>
      <button type="button" className="icon-btn" data-on={shape === "round"} aria-label="圆豆显示" data-tip="圆豆显示" onClick={() => onShape("round")}><span style={{ width: 12, height: 12, borderRadius: 99, border: "2px solid currentColor", display: "block" }} /></button>
      <button type="button" className="icon-btn" data-on={shape === "square"} aria-label="方格显示" data-tip="方格显示" onClick={() => onShape("square")}><Square size={16} /></button>
      <button type="button" className="icon-btn" data-on={showGrid} aria-label="显示网格" data-tip="显示网格" onClick={() => onToggleGrid()}><Grid3x3 size={16} /></button>
      <button type="button" className="icon-btn" data-on={showCodes} aria-label="显示色号" data-tip="显示色号" onClick={() => onToggleCodes()}>字</button>
      <button type="button" className="icon-btn" data-on={showBoard} aria-label="显示 29 格板线" data-tip="显示 29 格板线" onClick={() => onToggleBoard()}>29</button>
      <button type="button" className="icon-btn" data-on={compareHold} aria-label="按住对比原图" data-tip="按住对比原图" onPointerDown={() => onCompare(true)} onPointerUp={() => onCompare(false)} onPointerLeave={() => onCompare(false)}><Eye size={16} /></button>
    </div>
  );
}
