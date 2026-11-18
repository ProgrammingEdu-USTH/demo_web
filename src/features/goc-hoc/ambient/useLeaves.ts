/* Gió qua cửa sổ mở: lá và cánh hoa bay vào phòng (spawnLeaf), mỗi 650ms một chiếc.
   Không chạy khi giảm chuyển động, khi tab ẩn hoặc đang ở trang con. */
import { useEffect, useRef, type RefObject } from "react";

const EVERY_MS = 650;

function spawnLeaf(leafG: HTMLElement) {
  const R = Math.random;
  const el = document.createElement("div");
  el.className = "leaf";
  const pink = R() < 0.65;
  el.style.background = pink ? (R() < 0.5 ? "#ffc3d4" : "#ffd9e3") : R() < 0.5 ? "#9cc58a" : "#b9d79a";
  const x = 1120 + R() * 640, y = 220 + R() * 560;
  const dx = (R() < 0.5 ? -1 : 1) * (220 + R() * 520), dy = 420 + R() * 420;
  const r0 = R() * 360, r1 = r0 + (R() < 0.5 ? -1 : 1) * (240 + R() * 360), sc = 1.4 + R() * 1.2, d = 5200 + R() * 2600;
  leafG.appendChild(el);
  el.animate(
    [
      { transform: `translate(${x}px,${y}px) rotate(${r0}deg) scale(.6)`, opacity: 0 },
      { transform: `translate(${x + dx * 0.35}px,${y + dy * 0.25}px) rotate(${(r0 + r1) / 2}deg) scale(${sc * 0.8})`, opacity: 0.95, offset: 0.25 },
      { transform: `translate(${x + dx * 0.7}px,${y + dy * 0.7}px) rotate(${r1 - 40}deg) scale(${sc})`, opacity: 0.85, offset: 0.7 },
      { transform: `translate(${x + dx}px,${y + dy}px) rotate(${r1}deg) scale(${sc * 1.1})`, opacity: 0 },
    ],
    { duration: d, easing: "ease-in-out" },
  ).finished.then(
    () => el.remove(),
    () => el.remove(),
  );
}

export function useLeaves(appRef: RefObject<HTMLElement | null>, opts: { windowOpen: boolean; rm: boolean; hidden: boolean; away: boolean }) {
  const awayRef = useRef(opts.away);
  useEffect(() => {
    awayRef.current = opts.away;
  });
  useEffect(() => {
    const leafG = appRef.current?.querySelector<HTMLElement>("#leafG");
    if (!leafG || !opts.windowOpen || opts.rm || opts.hidden) return;
    const id = window.setInterval(() => !awayRef.current && spawnLeaf(leafG), EVERY_MS);
    return () => window.clearInterval(id);
  }, [appRef, opts.windowOpen, opts.rm, opts.hidden]);
}
