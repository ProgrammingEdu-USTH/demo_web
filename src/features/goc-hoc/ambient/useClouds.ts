/* Mây trôi: vị trí theo giờ (TOD*90) cộng trôi chậm 3,5 px/s (16 px/s khi mở cửa sổ), lặp chu kỳ 648px,
   lệch thêm theo parallax. Dừng khi tab ẩn; giảm chuyển động thì không trôi (vẫn theo giờ). */
import { useEffect, useRef, type RefObject } from "react";
import type { Par } from "./useParallax";

const TILE = 648;

interface Opts {
  todRef: RefObject<number>;
  par: RefObject<Par>;
  windowOpen: boolean;
  rm: boolean;
  hidden: boolean;
  /** đang ở trang con / chuyển cảnh: bỏ parallax */
  frozen: boolean;
}

export function useClouds(appRef: RefObject<HTMLElement | null>, opts: Opts) {
  const optsRef = useRef(opts);
  const drift = useRef(0);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const app = appRef.current;
    if (!app || opts.hidden) return;
    const clouds = [app.querySelector<HTMLElement>("#clB"), app.querySelector<HTMLElement>("#clR")];
    let last = performance.now();
    let raf = 0;
    const frame = (n: number) => {
      const o = optsRef.current;
      const dt = Math.min(0.1, (n - last) / 1000);
      last = n;
      if (!o.rm) drift.current += dt * (o.windowOpen ? 16 : 3.5);
      const x = -((((o.todRef.current * 90 + drift.current) % TILE) + TILE) % TILE);
      const px = o.frozen ? 0 : o.par.current.x * 14;
      const t = `translateX(${(x + px).toFixed(1)}px)`;
      clouds.forEach((c) => c && (c.style.transform = t));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [appRef, opts.hidden]);
}
