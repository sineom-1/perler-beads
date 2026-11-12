"use client";

import { useMemo, useState } from "react";
import { TEMPLATES, TEMPLATE_AUTHOR, TEMPLATE_CATEGORIES, TEMPLATE_LICENSE } from "@/data/templates";
import { templatePixels } from "@/lib/templates";
import { buildNameTag, TAG_MAX_CHARS, TAG_THEMES, type TagFont, type TagFrame } from "@/lib/nameTag";
import { pixelsToUrl } from "@/lib/imageOps";

const CATEGORIES = [...TEMPLATE_CATEGORIES, "字母"] as const;
const FONTS: [TagFont, string][] = [["standard", "标准"], ["round", "圆润大字"]];
const FRAMES: [TagFrame, string][] = [["plate", "圆角底板"], ["sticker", "贴纸描边"], ["shadow", "立体阴影"]];
type Category = (typeof CATEGORIES)[number];

/** Picks an original template or builds a name tag; the result is handed back as bead rows. */
export function TemplateGallery({ onClose, onPick }: { onClose: () => void; onPick: (name: string, rows: string[]) => void }) {
  const [category, setCategory] = useState<Category>("节日");
  const [text, setText] = useState("HELLO");
  const previews = useMemo(
    () => (typeof document === "undefined" ? new Map<string, string>() : new Map(TEMPLATES.map((item) => [item.id, pixelsToUrl(templatePixels(item.rows))]))),
    [],
  );
  const [font, setFont] = useState<TagFont>("standard");
  const [frame, setFrame] = useState<TagFrame>("plate");
  const [theme, setTheme] = useState(TAG_THEMES[0].id);
  const tag = buildNameTag(text, { font, frame, theme });
  const tagUrl = useMemo(() => (tag && typeof document !== "undefined" ? pixelsToUrl(templatePixels(tag)) : null), [tag?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>原创模板</h3>
        <div className="chips" style={{ marginBottom: 12 }}>
          {CATEGORIES.map((item) => (
            <button key={item} type="button" className="chip" data-on={category === item} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
        {category === "字母" ? (
          <div>
            <input className="select" value={text} maxLength={TAG_MAX_CHARS.standard} placeholder="输入英文字母或数字" onChange={(event) => setText(event.target.value)} />
            <p className="muted" style={{ fontSize: 12 }}>支持 A–Z、0–9 和 ♥ ★ ! ? . -，标准字最多 {TAG_MAX_CHARS.standard} 个，圆润大字最多 {TAG_MAX_CHARS.round} 个。</p>
            {[
              ["字体", FONTS, font, setFont],
              ["样式", FRAMES, frame, setFrame],
              ["配色", TAG_THEMES.map((item) => [item.id, item.name]), theme, setTheme],
            ].map(([label, options, value, set]) => (
              <div key={label as string} className="inline" style={{ gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 12, minWidth: 28 }}>{label as string}</span>
                <div className="chips">
                  {(options as [string, string][]).map(([id, name]) => (
                    <button key={id} type="button" className="chip" data-on={value === id} onClick={() => (set as (v: string) => void)(id)}>{name}</button>
                  ))}
                </div>
              </div>
            ))}
            {tag && tagUrl ? (
              <button type="button" className="ghost" style={{ display: "block", padding: 8, height: "auto" }} onClick={() => onPick(`字母牌 ${text}`, tag)}>
                <img src={tagUrl} alt={text} style={{ imageRendering: "pixelated", width: Math.min(480, tag[0].length * 8), maxWidth: "100%", display: "block" }} />
                <span className="muted" style={{ fontSize: 12 }}>{tag[0].length}×{tag.length} · 点击使用</span>
              </button>
            ) : (
              <p className="muted">没有可用的字符。</p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {TEMPLATES.filter((item) => item.category === category).map((item) => (
              <button key={item.id} type="button" className="ghost" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, height: "auto" }} onClick={() => onPick(item.name, item.rows)}>
                {previews.get(item.id) && <img src={previews.get(item.id)} alt={item.name} style={{ imageRendering: "pixelated", width: 80, height: 80, objectFit: "contain" }} />}
                <span>{item.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{item.rows[0].length}×{item.rows.length}</span>
              </button>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>{TEMPLATE_AUTHOR} · {TEMPLATE_LICENSE}。颜色会自动换成你选的品牌色号。</p>
        <div className="inline" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
