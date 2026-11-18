/* #calPop (chuỗi ngày học), #notePop (chi tiết ghi chú), #toast. */
"use client";
import { useState, type CSSProperties, type Ref } from "react";
import type { StickyNote } from "../types";

const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function CalPop({ streak, open, peek, style }: { streak: number; open: boolean; peek?: boolean; style: CSSProperties }) {
  return (
    <div id="calPop" className={`glass${peek ? " peek" : ""}`} hidden={!open} style={style}>
      <h4>Chuỗi {streak} ngày</h4>
      <p>Học xong 1 bài hôm nay để chuỗi lên {streak + 1} ngày.</p>
      <div className="week">
        {WEEK.map((d, i) => (
          <span key={d}>
            <i className={i < 6 ? "d" : "t"} />
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

interface NotePopProps {
  note: StickyNote | null;
  popRef: Ref<HTMLDivElement>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onGo: () => void;
  onRemove: () => void;
}

export function NotePop({ note, popRef, onPointerEnter, onPointerLeave, onGo, onRemove }: NotePopProps) {
  // đóng thì chỉ mờ đi: giữ nội dung tờ vừa xem cho tới khi mở tờ khác
  const [shown, setShown] = useState(note);
  if (note && note !== shown) setShown(note);
  return (
    <div
      id="notePop"
      ref={popRef}
      className={`glass${note ? " on" : ""}`}
      role="dialog"
      aria-label="Chi tiết ghi chú"
      aria-hidden={!note}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="k" id="npK">
        {shown?.k}
      </div>
      <h4 id="npT">{shown?.t}</h4>
      <p id="npB">{shown?.b}</p>
      <div className="row">
        <button className="btn" id="npGo" onClick={onGo} tabIndex={note ? undefined : -1}>
          {shown?.act}
        </button>
        <button className="btn ghost" id="npDel" onClick={onRemove} tabIndex={note ? undefined : -1}>
          Gỡ ghi chú
        </button>
      </div>
    </div>
  );
}

export function Toast({ text, on }: { text: string; on: boolean }) {
  return (
    <div id="toast" className={`glass${on ? " on" : ""}`} role="status">
      {text}
    </div>
  );
}
