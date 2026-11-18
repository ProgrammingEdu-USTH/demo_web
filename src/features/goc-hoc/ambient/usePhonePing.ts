/* Điện thoại sáng lên mỗi 23 giây kèm nhãn hạng, sáng 3,2 giây. Bỏ qua khi giảm chuyển động, tab ẩn hoặc đang ở trang con. */
import { useEffect, useRef, useState } from "react";

const EVERY_MS = 23e3;
const ON_MS = 3200;

export function usePhonePing(opts: { rm: boolean; hidden: boolean; away: boolean }): boolean {
  const [ping, setPing] = useState(false);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    let off: number | undefined;
    const id = window.setInterval(() => {
      const o = optsRef.current;
      if (o.away || o.rm || o.hidden) return;
      setPing(true);
      off = window.setTimeout(() => setPing(false), ON_MS);
    }, EVERY_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(off);
    };
  }, []);
  return ping;
}
