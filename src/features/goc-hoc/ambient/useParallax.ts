/* Parallax theo chuột: phòng lệch tối đa 6px ngang / 4px dọc, UI (.ui) lệch ngược 3px / 2px, làm mượt 6% mỗi khung hình.
   Vòng lặp chỉ chạy khi còn đang trôi về đích và dừng khi tab ẩn. Tắt khi giảm chuyển động hoặc mobile (về giữa ngay, không trôi). */
import { useEffect, useRef, type RefObject } from "react";

export interface Par {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const SMOOTH = 0.06;
const EPS = 1e-4;

function place(app: HTMLElement, p: Par) {
  const room = app.querySelector<HTMLElement>("#room");
  if (room) room.style.translate = `${-p.x * 6}px ${-p.y * 4}px`;
  app.querySelectorAll<HTMLElement>(".ui").forEach((u) => (u.style.translate = `${p.x * 3}px ${p.y * 2}px`));
}

export function useParallax(appRef: RefObject<HTMLElement | null>, opts: { enabled: boolean; hidden: boolean; frozen: boolean }) {
  const par = useRef<Par>({ x: 0, y: 0, tx: 0, ty: 0 });
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const app = appRef.current;
    if (!app || opts.hidden) return;
    let raf: number | null = null;
    const p = par.current;
    const frame = () => {
      p.x += (p.tx - p.x) * SMOOTH;
      p.y += (p.ty - p.y) * SMOOTH;
      // đang chuyển cảnh (frozen) thì không đụng vào vị trí phòng/UI
      if (!optsRef.current.frozen) place(app, p);
      raf = Math.abs(p.tx - p.x) > EPS || Math.abs(p.ty - p.y) > EPS ? requestAnimationFrame(frame) : null;
    };
    const onMove = (e: PointerEvent) => {
      if (!optsRef.current.enabled) return;
      p.tx = (e.clientX / app.clientWidth - 0.5) * 2;
      p.ty = (e.clientY / app.clientHeight - 0.5) * 2;
      if (raf === null) raf = requestAnimationFrame(frame);
    };
    app.addEventListener("pointermove", onMove);
    return () => {
      app.removeEventListener("pointermove", onMove);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [appRef, opts.hidden]);

  useEffect(() => {
    const app = appRef.current;
    if (opts.enabled || !app) return;
    Object.assign(par.current, { x: 0, y: 0, tx: 0, ty: 0 });
    place(app, par.current);
  }, [opts.enabled, appRef]);

  return par;
}
