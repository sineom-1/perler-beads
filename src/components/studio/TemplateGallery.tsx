"use client";

import { useMemo, useState } from "react";
import { TEMPLATES, TEMPLATE_AUTHOR, TEMPLATE_LICENSE } from "@/data/templates";
import { nameTagRows, templatePixels } from "@/lib/templates";
import { pixelsToUrl } from "@/lib/imageOps";

const CATEGORIES = ["节日", "宠物", "美食", "字母"] as const;
type Category = (typeof CATEGORIES)[number];

/** Picks an original template or builds a name tag; the result is handed back as bead rows. */
export function TemplateGallery({ onClose, onPick }: { onClose: () => void; onPick: (name: string, rows: string[]) => void }) {
  const [category, setCategory] = useState<Category>("节日");
  const [text, setText] = useState("HELLO");
  const previews = useMemo(
    () => (typeof document === "undefined" ? new Map<string, string>() : new Map(TEMPLATES.map((item) => [item.id, pixelsToUrl(templatePixels(item.rows))]))),
    [],
  );
  const tag = nameTagRows(text);
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
            <input className="select" value={text} maxLength={8} placeholder="输入英文字母或数字，最多 8 个" onChange={(event) => setText(event.target.value)} />
            <p className="muted" style={{ fontSize: 12 }}>支持 A–Z、0–9 和 ♥，适合名字牌、门牌。</p>
            {tag && tagUrl ? (
              <button type="button" className="ghost" style={{ display: "block", padding: 8, height: "auto" }} onClick={() => onPick(`字母牌 ${text}`, tag)}>
                <img src={tagUrl} alt={text} style={{ imageRendering: "pixelated", width: Math.min(480, tag[0].length * 8), display: "block" }} />
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
