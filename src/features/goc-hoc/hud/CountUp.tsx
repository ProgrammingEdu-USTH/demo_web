/* Số đếm lên từ 0 (countUp() của prototype): 1,1 giây, ease-out bậc 3. Chạy lại mỗi khi token đổi; giảm chuyển động thì hiện ngay. */
"use client";
import { useEffect, useState } from "react";
import { fmt } from "./format";

const DUR = 1100;

export function CountUp({ value, token, rm }: { value: number; token: number; rm: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!token || rm) return;
    let raf = 0;
    const t0 = performance.now();
    const f = (n: number) => {
      const t = Math.min(1, (n - t0) / DUR);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [token, value, rm]);
  return <>{fmt(token && !rm ? shown : value)}</>;
}
