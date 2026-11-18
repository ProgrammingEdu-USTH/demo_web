/* Giờ trong ngày: mặc định theo giờ thật (cập nhật mỗi 30 giây), chỉnh tay thì chuyển dần 1,6 giây.
   Giờ được áp thẳng lên DOM (applyTOD) như prototype để không render lại cả cây React mỗi khung hình;
   đồng hồ trong bảng tuỳ chỉnh đọc qua todStore. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { nowHours } from "../scene/useClientValues";
import { applyTOD, wrapHours } from "./timeOfDay";

const TWEEN_MS = 1600;
const REAL_TICK_MS = 30e3;
/** Giờ hiển thị trước khi client đo được giờ thật (giá trị mặc định của prototype). */
export const SERVER_TOD = 18;

/** Store nhỏ cho giờ đang hiển thị và cờ ban đêm; component nào cần thì subscribe. */
export interface TodStore {
  get: () => number;
  night: () => boolean;
  subscribe: (cb: () => void) => () => void;
}

function createTodStore() {
  let tod = SERVER_TOD, night = false;
  const subs = new Set<() => void>();
  return {
    get: () => tod,
    night: () => night,
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    set(h: number, n: boolean) {
      tod = h;
      night = n;
      subs.forEach((cb) => cb());
    },
  };
}

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function useTimeOfDay(appRef: RefObject<HTMLElement | null>, rm: boolean) {
  const [store] = useState(createTodStore);
  const [realTime, setRealTime] = useState(true);
  const todRef = useRef(SERVER_TOD);
  const anim = useRef<number | null>(null);
  const rmRef = useRef(rm);
  const realRef = useRef(realTime);
  useEffect(() => {
    rmRef.current = rm;
    realRef.current = realTime;
  });

  const apply = useCallback(
    (h: number) => {
      todRef.current = h;
      const night = appRef.current ? applyTOD(appRef.current, h) : false;
      store.set(wrapHours(h), night);
    },
    [appRef, store],
  );

  const stopTween = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  /** setTOD(h, animate): đi đường ngắn nhất qua nửa đêm khi chuyển dần. */
  const setTod = useCallback(
    (h: number, animate: boolean) => {
      stopTween();
      if (!animate || rmRef.current) return apply(h);
      let from = todRef.current, to = h;
      if (to - from > 12) from += 24;
      if (from - to > 12) to += 24;
      const t0 = performance.now();
      const f = (n: number) => {
        const t = Math.min(1, (n - t0) / TWEEN_MS);
        apply(from + (to - from) * easeInOutQuad(t));
        if (t < 1) anim.current = requestAnimationFrame(f);
        else {
          anim.current = null;
          apply(wrapHours(to));
        }
      };
      f(t0);
    },
    [apply],
  );

  // Lúc vào: lấy giờ thật trước khi vẽ khung hình đầu; sau đó 30 giây cập nhật một lần nếu đang theo giờ thật.
  useLayoutEffect(() => {
    apply(nowHours());
    const id = window.setInterval(() => {
      if (realRef.current && anim.current === null) apply(nowHours());
    }, REAL_TICK_MS);
    return () => {
      window.clearInterval(id);
      stopTween();
    };
  }, [apply]);

  /** Thanh trượt: đổi ngay. Preset Sáng/Trưa/…: chuyển dần. Cả hai đều tắt "Theo giờ thật". */
  const setManual = useCallback(
    (h: number, animate: boolean) => {
      setRealTime(false);
      setTod(h, animate);
    },
    [setTod],
  );

  const toggleReal = useCallback(() => {
    const v = !realRef.current;
    setRealTime(v);
    if (v) setTod(nowHours(), true);
  }, [setTod]);

  return { store, realTime, setManual, toggleReal, todRef };
}
