/* Các tờ note trong lớp #notes (room-space). Tờ mới bay vào rồi dán xuống; tờ bị gỡ bóc ra và rơi. Keyframes chép từ addNote/removeNote. */
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { NOTE_SLOTS, NOTE_TOP } from "../config/scene";
import type { NoteItem, StickyNotesApi } from "./useStickyNotes";

const FLY_IN: Keyframe[] = [
  { transform: "translate(60px,-430px) rotate(38deg) scale(1.9)", opacity: 0 },
  { transform: "translate(20px,-200px) rotate(-12deg) scale(1.45)", opacity: 1, offset: 0.45 },
  { transform: "translate(0,6px) rotate(3deg) scale(1.02,.94)", offset: 0.82 },
  { transform: "none" },
];
const PEEL: Keyframe[] = [
  { transform: "none", opacity: 1 },
  { transform: "rotate(-22deg) translate(-6px,4px)", opacity: 1, offset: 0.25 },
  { transform: "translate(-60px,330px) rotate(-70deg)", opacity: 0 },
];

function Note({ n, on, away, api }: { n: NoteItem; on: boolean; away: boolean; api: StickyNotesApi }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { gone, els } = api;

  // bay vào một lần khi vừa dán
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !n.flyIn) return;
    const a = el.animate(FLY_IN, { duration: 1150, easing: "cubic-bezier(.3,.7,.3,1)" });
    return () => a.cancel();
  }, [n.flyIn]);

  // bóc ra rồi rơi, xong thì xoá khỏi state
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !n.leaving) return;
    let done = false;
    const a = el.animate(PEEL, { duration: 1000, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" });
    a.finished.then(() => !done && gone(n.id), () => {});
    return () => {
      done = true;
    };
  }, [n.leaving, n.id, gone]);

  useLayoutEffect(() => {
    const map = els.current;
    if (ref.current && !n.leaving) map.set(n.id, ref.current);
    return () => void map.delete(n.id);
  }, [n.id, n.leaving, els]);

  // tờ đang rơi, hoặc đang ở trang con (lớp ghi chú ẩn): không bấm/Tab được
  const inert = n.leaving || away;
  // đặt mọi tờ ở ô đầu rồi dịch bằng translate (có transition) tới ô của nó
  const style = {
    left: NOTE_SLOTS[0],
    translate: `${n.left - NOTE_SLOTS[0]}px 0`,
    top: NOTE_TOP,
    zIndex: n.z,
    "--nc": `var(${n.note.c})`,
    "--rot": n.rot,
  } as CSSProperties;
  return (
    <button
      ref={ref}
      className={`snote${on ? " on" : ""}`}
      aria-label={`${n.note.k}: ${n.note.t}`}
      style={inert ? { ...style, pointerEvents: "none" } : style}
      tabIndex={inert ? -1 : undefined}
      {...(inert ? {} : api.noteHandlers(n.id))}
    >
      <i>{n.note.ic}</i>
      <i>{n.note.sh}</i>
      <i>{n.note.l3 || ""}</i>
    </button>
  );
}

export function StickyNotes({ api, away }: { api: StickyNotesApi; away: boolean }) {
  return (
    <>
      {api.items.map((n) => (
        <Note key={n.id} n={n} on={api.popId === n.id && !n.leaving} away={away} api={api} />
      ))}
    </>
  );
}
