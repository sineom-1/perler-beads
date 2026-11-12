import type { CSSProperties } from "react";
import { SOURCE_URL } from "./constants";

export function SourceNote({ style }: { style?: CSSProperties }) {
  return (
    <p className="source-note" style={style}>
      <a href={SOURCE_URL} target="_blank" rel="noreferrer">源码与许可</a>
    </p>
  );
}

export function Tip({ text }: { text: string }) {
  return (
    <span className="tip" tabIndex={0}>
      <i>i</i>
      <span>{text}</span>
    </span>
  );
}
