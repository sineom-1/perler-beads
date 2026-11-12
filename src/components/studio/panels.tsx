import type { Dispatch, SetStateAction } from "react";
import { Minus, Plus } from "lucide-react";
import type { DistanceMetric, PaletteColor, PixelMode } from "@/lib/color";
import { BRAND_SYSTEMS, COMMUNITY_SYSTEMS, colorDetail, displayCode, paletteChoicesFor, systemNote, type ColorSystem } from "@/lib/palette";
import type { ColorCount } from "@/lib/pixelate";
import { BOARDS, STYLE_PRESETS, type Look, type StyleId } from "./constants";
import type { DifficultyReport } from "@/lib/stylize";
import { Tip } from "./ui";

export function BrandFields({ system, paletteId, onSystem, onPalette }: {
  system: ColorSystem;
  paletteId: string;
  onSystem: (value: ColorSystem) => void;
  onPalette: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="field-label" style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>国内品牌（社区参考色卡）</div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {COMMUNITY_SYSTEMS.map((item) => (
          <button key={item} type="button" className="chip" data-on={system === item} onClick={() => onSystem(item)}>{item}</button>
        ))}
      </div>
      <div className="field-label" style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>国际品牌</div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {BRAND_SYSTEMS.map((item) => (
          <button key={item} type="button" className="chip" data-on={system === item} onClick={() => onSystem(item)}>{item}</button>
        ))}
      </div>
      <select className="select" aria-label="色板" value={paletteId} onChange={(event) => onPalette(event.target.value)} style={{ marginBottom: 6 }}>
        {paletteChoicesFor(system).map((choice) => (
          <option key={choice.id} value={choice.id}>{choice.name}</option>
        ))}
      </select>
      <p className="brand-note" style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, margin: 0 }}>{systemNote(system)}</p>
    </div>
  );
}

export function SizeFields({ cols, rows, total, lockRatio, onLockRatio, onCols, onRows }: {
  cols: number;
  rows: number;
  total: number;
  lockRatio: boolean;
  onLockRatio: (value: boolean) => void;
  onCols: (value: number) => void;
  onRows: (value: number) => void;
}) {
  const preset = BOARDS.includes(cols) ? String(cols) : "custom";
  const boardText = `${cols}×${rows} · ${Math.ceil(cols / 29)}×${Math.ceil(rows / 29)} 块 29 板 · ${total.toLocaleString("zh-CN")} 颗`;
  return (
    <div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {BOARDS.map((size) => (
          <button key={size} type="button" className="chip" data-on={preset === String(size)} onClick={() => onCols(size)}>
            {size}
          </button>
        ))}
        <button type="button" className="chip" data-on={preset === "custom"} onClick={() => onCols(cols)}>
          自定义
        </button>
      </div>
      <div className="field">
        <span className="row-label">宽度 {cols}</span>
        <div className="slider-row">
          <button type="button" className="stepper-btn" onClick={() => onCols(cols - 1)}><Minus size={16} /></button>
          <input type="range" min={8} max={180} value={cols} onChange={(event) => onCols(Number(event.target.value))} />
          <button type="button" className="stepper-btn" onClick={() => onCols(cols + 1)}><Plus size={16} /></button>
        </div>
      </div>
      <div className="field">
        <span className="row-label">高度 {rows}</span>
        <div className="slider-row">
          <button type="button" className="stepper-btn" onClick={() => onRows(rows - 1)}><Minus size={16} /></button>
          <input type="range" min={8} max={180} value={rows} onChange={(event) => onRows(Number(event.target.value))} />
          <button type="button" className="stepper-btn" onClick={() => onRows(rows + 1)}><Plus size={16} /></button>
        </div>
      </div>
      <label className="inline" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={lockRatio} onChange={(event) => onLockRatio(event.target.checked)} />
        锁定比例
      </label>
      <p className="muted">{boardText}</p>
    </div>
  );
}

export function StyleFields({ styleId, onStyle, look, onLook, difficulty }: {
  styleId: StyleId;
  onStyle: (id: Exclude<StyleId, "custom">) => void;
  look: Look;
  onLook: (patch: Partial<Look>) => void;
  difficulty: DifficultyReport | null;
}) {
  const ids = Object.keys(STYLE_PRESETS) as Exclude<StyleId, "custom">[];
  const smoothLabel = ["高", "中", "低"];
  return (
    <div>
      <div className="chips">
        {ids.map((id) => (
          <button key={id} type="button" className="chip" title={STYLE_PRESETS[id].hint} data-on={styleId === id} onClick={() => onStyle(id)}>
            {STYLE_PRESETS[id].name}
          </button>
        ))}
      </div>
      {styleId === "custom" ? (
        <p className="style-note">
          <span className="style-badge">自定义</span>
          已手动调过参数，点上面的风格可恢复预设
        </p>
      ) : (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>{STYLE_PRESETS[styleId].hint}</p>
      )}
      <div className="field" style={{ marginTop: 12 }}>
        <span>细节 <Tip text="细节越低，零碎的单颗越少，越好拼。" /></span>
        <div className="chips">
          {smoothLabel.map((label, value) => (
            <button key={label} type="button" className="chip" data-on={look.smooth === value} onClick={() => onLook({ smooth: value })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span>描边 <Tip text="在主体外围加一圈最深的颜色，会自动去掉背景。" /></span>
        <div className="chips">
          {["无", "1 格", "2 格"].map((label, value) => (
            <button key={label} type="button" className="chip" data-on={look.outline === value} onClick={() => onLook({ outline: value })}>{label}</button>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginTop: 12, display: "block" }}>
        <span>抖动 {Math.round(look.dither * 100)}% <Tip text="用相邻色点交错模拟过渡色，适合照片；拼起来更零碎。" /></span>
        <input type="range" min={0} max={100} step={10} value={Math.round(look.dither * 100)} onChange={(event) => onLook({ dither: Number(event.target.value) / 100 })} style={{ width: "100%" }} />
      </label>
      <label className="inline" style={{ marginTop: 8, gap: 8 }}>
        <input type="checkbox" checked={look.trim} onChange={(event) => onLook({ trim: event.target.checked })} />
        <span>裁到主体放大</span>
      </label>
      {difficulty && (
        <p className="difficulty" data-level={difficulty.level} style={{ marginTop: 12, fontSize: 13 }}>
          <span className="style-badge">难度：{difficulty.label}</span>{" "}
          <span className="muted">{difficulty.reasons.join("，")}</span>
        </p>
      )}
    </div>
  );
}

export function CleanFields({
  colorCount,
  threshold,
  setThreshold,
  maxColors,
  setMaxColors,
  minCount,
  setMinCount,
  removeBg,
  onToggleBackground,
}: {
  colorCount: number;
  threshold: number;
  setThreshold: Dispatch<SetStateAction<number>>;
  maxColors: number;
  setMaxColors: Dispatch<SetStateAction<number>>;
  minCount: number;
  setMinCount: Dispatch<SetStateAction<number>>;
  removeBg: boolean;
  onToggleBackground: () => void;
}) {
  return (
    <div>
      <div className="field">
        <span className="row-label">合并相近色 {threshold} · 当前 {colorCount} 色</span>
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
      <button type="button" className="chip" data-on={removeBg} onClick={onToggleBackground}>去除背景</button>
    </div>
  );
}

export function AdvancedFields({
  mode,
  metric,
  onPick,
}: {
  mode: PixelMode;
  metric: DistanceMetric;
  onPick: (next: { mode?: PixelMode; metric?: DistanceMetric }) => void;
}) {
  const pick = onPick;
  return (
    <div>
      <p className="row-label adv-label">取色方式</p>
      <div className="chips">
        <button type="button" className="chip" data-on={mode === "dominant"} onClick={() => pick({ mode: "dominant" })}>主色</button>
        <button type="button" className="chip" data-on={mode === "average"} onClick={() => pick({ mode: "average" })}>平均色</button>
      </div>
      <p className="adv-hint">主色边缘清晰，适合卡通和像素画；平均色过渡更柔和，适合照片。</p>
      <p className="row-label adv-label">色差算法</p>
      <div className="chips">
        <button type="button" className="chip" data-on={metric === "oklab"} onClick={() => pick({ metric: "oklab" })}>Oklab</button>
        <button type="button" className="chip" data-on={metric === "ciede2000"} onClick={() => pick({ metric: "ciede2000" })}>CIEDE2000</button>
      </div>
      <p className="adv-hint">CIEDE2000 更接近人眼判断，计算稍慢。色块平整的图切换后可能没有变化。</p>
    </div>
  );
}

export function ColorList({
  counts,
  sortedCounts,
  total,
  sortBy,
  setSortBy,
  colorQuery,
  setColorQuery,
  colorSystem,
  highlightHex,
  onPickColor,
  onExclude,
  excluded,
  onRestore,
  replaceFrom,
  setReplaceFrom,
  activePalette,
  onReplaceAll,
}: {
  counts: ColorCount[];
  sortedCounts: ColorCount[];
  total: number;
  sortBy: "count" | "code";
  setSortBy: (value: "count" | "code") => void;
  colorQuery: string;
  setColorQuery: (value: string) => void;
  colorSystem: ColorSystem;
  highlightHex: string | null;
  onPickColor: (hex: string) => void;
  onExclude: (hex: string) => void;
  excluded: string[];
  onRestore: (hex?: string) => void;
  replaceFrom: string | null;
  setReplaceFrom: (hex: string | null) => void;
  activePalette: PaletteColor[];
  onReplaceAll: (fromHex: string, toHex: string) => void;
}) {
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
          const detail = colorDetail(item.hex, colorSystem);
          const extra = [detail.name, detail.finish].filter(Boolean).join(" · ");
          return (
            <div key={item.hex}>
              <button
                type="button"
                className="color-row"
                data-on={highlightHex === item.hex}
                onClick={() => onPickColor(item.hex)}
              >
                <i className="swatch" style={{ background: item.hex }} />
                <span className="code" title={extra || undefined}>{code}{extra && <small className="muted" style={{ marginLeft: 4, fontWeight: 400 }}>{extra}</small>}</span>
                <span className="muted">{item.count}</span>
                <span className="muted">{total ? Math.round((item.count / total) * 100) : 0}%</span>
              </button>
              <div className="inline" style={{ padding: "0 8px 8px" }}>
                <button type="button" className="ghost" style={{ minHeight: 32 }} onClick={() => onExclude(item.hex)}>排除</button>
                <button type="button" className="ghost" style={{ minHeight: 32 }} onClick={() => setReplaceFrom(item.hex)}>全部替换</button>
              </div>
            </div>
          );
        })}
      </div>
      {excluded.length > 0 && (
        <details open>
          <summary>已排除 ({excluded.length})</summary>
          <button type="button" className="ghost" onClick={() => onRestore()}>全部恢复</button>
          {excluded.map((hex) => (
            <button key={hex} type="button" className="color-row" onClick={() => onRestore(hex)}>
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
                <button key={color.hex} type="button" className="chip" onClick={() => onReplaceAll(replaceFrom, color.hex)}>
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
