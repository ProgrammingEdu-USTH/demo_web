/* Laptop tự gõ code bài đang học (typeS): 70–200ms một ký tự, xuống dòng nghỉ 0,6–1,1 giây,
   gõ hết thì dừng 7 giây rồi quay lại dòng 6. Tạm dừng khi giảm chuyển động, tab ẩn hoặc đang ở trang con. */
import { useEffect, useRef, useState } from "react";
import type { CodeToken } from "../types";

const START_LINE = 5;
const FIRST_DELAY_MS = 3400;

export function useLaptopTyping(code: readonly (readonly CodeToken[])[], paused: boolean) {
  const [pos, setPos] = useState({ sl: START_LINE, sc: 0 });
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  });

  useEffect(() => {
    const len = code.map((l) => l.reduce((a, t) => a + t[1].length, 0));
    let sl = START_LINE, sc = 0, timer = 0;
    const at = (ms: number, f: () => void) => (timer = window.setTimeout(f, ms));
    const typeS = () => {
      if (pausedRef.current) return at(900, typeS);
      if (sl >= code.length) {
        const restart = () => {
          if (pausedRef.current) return at(900, restart);
          sl = START_LINE;
          sc = 0;
          setPos({ sl, sc });
          at(1200, typeS);
        };
        return at(7000, restart);
      }
      sc++;
      if (sc > len[sl]) {
        sl++;
        sc = 0;
        setPos({ sl, sc });
        return at(600 + Math.random() * 500, typeS);
      }
      setPos({ sl, sc });
      at(70 + Math.random() * 130, typeS);
    };
    at(FIRST_DELAY_MS, typeS);
    return () => window.clearTimeout(timer);
  }, [code]);

  return pos;
}
