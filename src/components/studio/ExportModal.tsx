"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Shape } from "./constants";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** Pegboard sizes offered for the 1:1 PDF; 29 is the common large square board. */
export const PDF_BOARDS = [
  { size: 29, label: "29×29 大方板" },
  { size: 14, label: "14×14 小方板" },
  { size: 58, label: "58×58（仅 2.6 mm 迷你豆）" },
];

export function ExportModal(props: {
  onClose: () => void;
  previewRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  codes: boolean;
  setCodes: Setter<boolean>;
  grid: boolean;
  setGrid: Setter<boolean>;
  coords: boolean;
  setCoords: Setter<boolean>;
  shape: Shape;
  setShape: Setter<Shape>;
  mirror: boolean;
  setMirror: Setter<boolean>;
  pitchMm: number;
  setPitchMm: Setter<number>;
  board: number;
  setBoard: Setter<number>;
  cols: number;
  rows: number;
  pdfBusy: number | null;
  onPdf: () => void;
  onPattern: () => void;
  onList: () => void;
  onCopy: () => void;
}) {
  const { pitchMm, setPitchMm, board, cols, rows } = props;
  const boardsX = Math.ceil(cols / board);
  const boardsY = Math.ceil(rows / board);
  const boardMm = board * pitchMm;
  // Mirrors the guard in printPdf: board plus axis labels must fit the A4 width.
  const fitsA4 = boardMm + 12 <= 186;
  return (
    <div className="modal-back" onClick={props.onClose}>
      <div className="modal export-modal" onClick={(event) => event.stopPropagation()}>
        <h3>导出</h3>
        <div className="export-layout">
          <div className="export-preview" ref={props.previewRef}>
            <canvas ref={props.canvasRef} style={props.mirror ? { transform: "scaleX(-1)" } : undefined} />
          </div>
          <div className="export-options">
            <div className="chips">
              <button type="button" className="chip" data-on={props.codes} onClick={() => props.setCodes((value) => !value)}>显示色号</button>
              <button type="button" className="chip" data-on={props.grid} onClick={() => props.setGrid((value) => !value)}>网格线</button>
              <button type="button" className="chip" data-on={props.coords} onClick={() => props.setCoords((value) => !value)}>坐标</button>
              <button type="button" className="chip" data-on={props.shape === "round"} onClick={() => props.setShape((value) => (value === "round" ? "square" : "round"))}>{props.shape === "round" ? "圆豆" : "方格"}</button>
            </div>
            <div className="mirror-box" data-on={props.mirror}>
              <label className="inline">
                <input type="checkbox" checked={props.mirror} onChange={(event) => props.setMirror(event.target.checked)} />
                <strong>镜像（左右翻转）</strong>
              </label>
              <p className="muted">如果你的做法会把作品翻过来烫（比如贴美纹纸翻面），成品会左右颠倒。图里有文字或分左右时，记得勾上。</p>
            </div>
            <div className="pdf-box">
              <strong>1:1 打印 PDF（多板分页）</strong>
              <p className="muted">
                每页一块板，按实际大小打印后可以直接垫在板下面拼。第一页是总览和全图用色，标出每块板在第几页；每页带行列编号和本块用色。
                当前 {cols}×{rows} 需要 {boardsX}×{boardsY} = {boardsX * boardsY} 块板。
              </p>
              <div className="inline" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                {PDF_BOARDS.map((item) => (
                  <button key={item.size} type="button" className="chip" data-on={board === item.size} onClick={() => props.setBoard(item.size)}>{item.label}</button>
                ))}
              </div>
              <div className="inline" style={{ flexWrap: "wrap" }}>
                <button type="button" className="chip" data-on={pitchMm === 5} onClick={() => setPitchMm(5)}>5 mm 豆</button>
                <button type="button" className="chip" data-on={pitchMm === 2.6} onClick={() => setPitchMm(2.6)}>2.6 mm 迷你豆</button>
                <label className="inline muted">
                  豆距
                  <input className="num" type="number" min={2} max={6} step={0.1} value={pitchMm} style={{ width: 64 }} onChange={(event) => { const value = Number(event.target.value); if (value >= 2 && value <= 6) setPitchMm(Math.round(value * 10) / 10); }} />
                  mm
                </label>
              </div>
              <p className="muted">不确定就用尺子量板上 10 个钉子的距离，再除以 10。{!fitsA4 && `一块板约 ${(boardMm / 10).toFixed(1)} 厘米，超过 A4 可打印宽度，请换小一点的板子或改用迷你豆。`}</p>
            </div>
            <div className="export-actions">
              <button type="button" className="primary" disabled={props.pdfBusy !== null || !fitsA4} onClick={props.onPdf}>
                {props.pdfBusy === null ? "下载 1:1 打印 PDF" : `生成中 ${Math.round(props.pdfBusy * 100)}%`}
              </button>
              <button type="button" className="ghost" onClick={props.onPattern}>下载图纸 PNG</button>
              <button type="button" className="ghost" onClick={props.onList}>下载采购清单 PNG</button>
              <button type="button" className="ghost" onClick={props.onCopy}>复制清单文本</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
