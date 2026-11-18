/* Giấy note thông báo dưới cửa sổ: port addNote / removeNote / layoutNotes / showPop / hidePop của prototype.
   Tối đa 4 tờ, căn phải theo NOTE_SLOTS. Tờ đang bóc ra vẫn được render (để chạy hết animation rơi) rồi mới xoá khỏi state. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { animate, EASE } from "../anim";
import { MAX_NOTES, NOTE_SLOTS } from "../config/scene";
import { seeded } from "../ambient/random";
import type { StickyNote } from "../types";
import { subscribeNotes } from "./notesBus";

export interface NoteItem {
  id: number;
  note: StickyNote;
  /** độ nghiêng ngẫu nhiên -2,5..2,5 độ (có seed theo id để server và client giống nhau) */
  rot: string;
  /** vị trí x room-space; giữ nguyên khi đang bóc ra */
  left: number;
  z: number;
  /** đang bóc ra và rơi */
  leaving: boolean;
  /** bay vào khi vừa thêm */
  flyIn: boolean;
}

const HIDE_DELAY_MS = 220;
const POP_W = 268;
const AFTER_START = [
  [5000, 3],
  [24000, 4],
] as const; // [sau bao lâu, chỉ thêm nếu đang có ít hơn n tờ]

const rotFor = (id: number) => (seeded(id * 7919)() * 5 - 2.5).toFixed(1) + "deg";

/** Xếp lại các tờ còn dán: căn phải vào các ô cuối của NOTE_SLOTS. */
function layout(items: NoteItem[]): NoteItem[] {
  const live = items.filter((n) => !n.leaving);
  return items.map((n) => {
    if (n.leaving) return n;
    const i = live.indexOf(n);
    return { ...n, left: NOTE_SLOTS[NOTE_SLOTS.length - live.length + i], z: i + 1 };
  });
}

interface Opts {
  pool: readonly StickyNote[];
  rm: boolean;
  /** đang ở trang con / tab ẩn: lớp ghi chú ẩn, popover đóng */
  away: boolean;
  sideLeft: number | null;
  /** màn mở đầu đã xong (hoặc được bỏ qua): bắt đầu hẹn giờ thêm ghi chú */
  started: boolean;
  onGo: (note: StickyNote) => void;
  onEmptyBell: () => void;
  /** tờ mới dán: điện thoại rung + chuông lắc */
  onArrive: () => void;
}

export function useStickyNotes({ pool, rm, away, sideLeft, started, onGo, onEmptyBell, onArrive }: Opts) {
  const nextId = useRef(3);
  const poolI = useRef(2);
  const [items, setItems] = useState<NoteItem[]>(() =>
    layout(pool.slice(0, 2).map((note, i) => ({ id: i + 1, note, rot: rotFor(i + 1), left: 0, z: 0, leaving: false, flyIn: false }))),
  );
  const [pop, setPop] = useState<{ id: number; pinned: boolean } | null>(null);
  const popT = useRef<number | undefined>(undefined);
  const els = useRef(new Map<number, HTMLButtonElement>());
  const popRef = useRef<HTMLDivElement>(null);
  const live = items.filter((n) => !n.leaving);

  // sang trang con hoặc ẩn tab: đóng popover (điều chỉnh state ngay lúc render khi away đổi)
  const [prevAway, setPrevAway] = useState(away);
  if (prevAway !== away) {
    setPrevAway(away);
    if (away) setPop(null);
  }

  const rmRef = useRef(rm);
  const cb = useRef({ onGo, onEmptyBell, onArrive });
  useEffect(() => {
    rmRef.current = rm;
    cb.current = { onGo, onEmptyBell, onArrive };
  });

  /** Gỡ một tờ: bóc ra và rơi (giảm chuyển động thì biến mất luôn). */
  const removeNote = useCallback((id: number) => {
    setPop((p) => (p?.id === id ? null : p));
    setItems((xs) => layout(rmRef.current ? xs.filter((n) => n.id !== id) : xs.map((n) => (n.id === id ? { ...n, leaving: true } : n))));
  }, []);

  /** Tờ đã rơi xong. */
  const gone = useCallback((id: number) => setItems((xs) => xs.filter((n) => n.id !== id)), []);

  const addNote = useCallback((note: StickyNote, animateIn = true) => {
    const id = nextId.current++;
    const flyIn = animateIn && !rmRef.current;
    setItems((xs) => {
      let next = xs;
      const liveNow = xs.filter((n) => !n.leaving);
      if (liveNow.length >= MAX_NOTES) {
        const oldest = liveNow[0].id;
        next = rmRef.current ? xs.filter((n) => n.id !== oldest) : xs.map((n) => (n.id === oldest ? { ...n, leaving: true } : n));
      }
      return layout([...next, { id, note, rot: rotFor(id), left: 0, z: 0, leaving: false, flyIn }]);
    });
    if (flyIn) cb.current.onArrive();
  }, []);

  const nextNote = useCallback(() => addNote(pool[poolI.current++ % pool.length]), [addNote, pool]);

  // pushNote() từ ngoài + 2 tờ hẹn giờ từ NOTE_POOL
  const countRef = useRef(live.length);
  useEffect(() => {
    countRef.current = live.length;
  });
  useEffect(() => subscribeNotes((n) => addNote(n)), [addNote]);
  // hẹn giờ tính từ lúc màn mở đầu xong lần đầu (notesStarted của prototype), chỉ lên lịch một lần
  const scheduled = useRef<number[] | null>(null);
  useEffect(() => {
    if (!started || scheduled.current) return;
    scheduled.current = AFTER_START.map(([ms, below]) => window.setTimeout(() => countRef.current < below && nextNote(), ms));
  }, [started, nextNote]);
  useEffect(() => () => scheduled.current?.forEach(window.clearTimeout), []);

  /* ---------- popover ---------- */
  const show = useCallback((id: number, pinned = false) => {
    window.clearTimeout(popT.current);
    setPop((p) => ({ id, pinned: pinned || (p?.pinned ?? false) }));
  }, []);
  const hide = useCallback((force = false) => setPop((p) => (p && p.pinned && !force ? p : null)), []);
  const hideLater = useCallback(() => {
    window.clearTimeout(popT.current);
    popT.current = window.setTimeout(() => hide(), HIDE_DELAY_MS);
  }, [hide]);

  const noteHandlers = (id: number) => ({
    onPointerEnter: () => (pop?.pinned ? undefined : show(id)),
    onPointerLeave: () => (pop?.pinned ? undefined : hideLater()),
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      show(id, true);
      // bấm bằng bàn phím (Enter/Space): đưa focus vào nút đầu tiên của popover vừa ghim
      if (e.detail === 0) requestAnimationFrame(() => popRef.current?.querySelector<HTMLButtonElement>("#npGo")?.focus());
    },
    onFocus: (e: FocusEvent<HTMLButtonElement>) => e.currentTarget.matches(":focus-visible") && show(id),
    // Tab rời tờ note (không vào popover) thì đóng popover chưa ghim
    onBlur: (e: FocusEvent<HTMLButtonElement>) => {
      if (!popRef.current?.contains(e.relatedTarget as Node | null)) hide();
    },
  });

  const popHandlers = {
    onPointerEnter: () => window.clearTimeout(popT.current),
    onPointerLeave: () => (pop?.pinned ? undefined : hideLater()),
  };

  // Ghim rồi thì bấm ra ngoài (không phải popover, không phải tờ note) mới đóng
  useEffect(() => {
    if (!pop?.pinned) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!popRef.current?.contains(t) && !t.closest(".snote")) hide(true);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pop?.pinned, hide]);

  // Đặt popover phía trên tờ note, không lấn sang cột phải (placeNotePop)
  useLayoutEffect(() => {
    const el = pop && els.current.get(pop.id);
    const box = popRef.current;
    if (!el || !box || sideLeft === null) return;
    const r = el.getBoundingClientRect();
    // giống prototype: đo ngay khi tờ note vừa nhận .on (scale 1.2 còn đang transition)
    const x = Math.max(12, Math.min(r.left + r.width / 2 - POP_W / 2, sideLeft - POP_W - 12));
    box.style.left = x + "px";
    box.style.top = Math.max(12, r.top - box.offsetHeight - 14) + "px";
  }, [pop, sideLeft, items]);

  // tờ đang bóc ra (vd. bị tờ mới đẩy ra khi đủ 4) thì không còn popover
  const popNote = pop ? (items.find((n) => n.id === pop.id && !n.leaving)?.note ?? null) : null;

  return {
    items,
    count: live.length,
    popId: pop?.id ?? null,
    popNote,
    popRef,
    els,
    noteHandlers,
    popHandlers,
    nextNote,
    gone,
    /** Đóng popover (Esc, rời phòng). Nếu focus đang ở trong popover thì trả về tờ note. */
    hidePop: () => {
      if (pop && popRef.current?.contains(document.activeElement)) els.current.get(pop.id)?.focus({ preventScroll: true });
      hide(true);
    },
    /** Nút "đi tới trang" trong popover */
    goFromPop: () => {
      if (!pop || !popNote) return;
      hide(true);
      removeNote(pop.id);
      if (popNote.go) cb.current.onGo(popNote);
    },
    removeFromPop: () => pop && removeNote(pop.id),
    /** Bấm chuông: mở tờ mới nhất (ghim), các tờ nhún một lượt */
    bell: () => {
      if (!live.length) return cb.current.onEmptyBell();
      if (!rmRef.current)
        live.forEach((n, i) =>
          animate(els.current.get(n.id), [{ transform: "none" }, { transform: "translateY(-10px) rotate(-4deg)" }, { transform: "none" }], {
            duration: 500,
            delay: i * 80,
            easing: EASE,
          }),
        );
      show(live[live.length - 1].id, true);
    },
  };
}

export type StickyNotesApi = ReturnType<typeof useStickyNotes>;
