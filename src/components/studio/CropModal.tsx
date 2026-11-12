"use client";

import { useRef } from "react";
import type { ImagePixels } from "@/lib/pixelate";
import { aspectCrop, clamp, fullRect } from "@/lib/imageOps";
import { CROP_RATIOS, type CropRatio, type CropRect } from "./constants";

export interface CropState {
  pixels: ImagePixels;
  rect: CropRect;
  url: string;
  name: string;
  ratio: CropRatio;
}

/** Crop dialog: pick a ratio, move the box, drag the corner to resize. */
export function CropModal({ crop, onChange, onCancel, onConfirm }: {
  crop: CropState;
  onChange: (next: CropState) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cropDrag = useRef<{ x: number; y: number; rect: CropRect; mode: "move" | "resize" } | null>(null);
  const setCrop = onChange;
  const confirmCrop = onConfirm;
  return (
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
          <button type="button" className="ghost" onClick={onCancel}>取消</button>
          <button type="button" className="primary" onClick={confirmCrop}>确定</button>
        </div>
      </div>
    </div>
  );
}
