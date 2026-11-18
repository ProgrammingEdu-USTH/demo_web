/* Các phần tử nền rải ngẫu nhiên như prototype (sao, giọt mưa, hơi cà phê, bụi sáng, nhịp đèn dây).
   Chuyển động là keyframes CSS trong room.css; ở đây chỉ dựng phần tử và biến CSS. */
import { memo, type CSSProperties } from "react";
import { BULBS } from "../config/scene";
import { seeded } from "./random";

const cssVars = (v: Record<string, string>) => v as CSSProperties;

const STARS = (() => {
  const r = seeded(11);
  const out: { x: number; y: number; delay: string }[] = [];
  for (let i = 0; i < 26; i++) {
    const x = r() * 788, y = 10 + r() * 380;
    const delay = (-r() * 3.4).toFixed(2) + "s";
    if (x > 352 && x < 420) continue; // chừa khe giữa hai cánh cửa
    out.push({ x, y, delay });
  }
  return out;
})();

/* các lớp này không có props: memo để không render lại theo từng lần đổi state của cảnh */
export const Stars = memo(function Stars() {
  return (
    <>
      {STARS.map((s, i) => (
        <i key={i} className="star" style={{ left: s.x, top: s.y, animationDelay: s.delay }} />
      ))}
    </>
  );
});

const DROPS = [0, 1].map((k) => {
  const r = seeded(21 + k);
  return Array.from({ length: 70 }, () => {
    const x = 1040 + r() * 800, y = 130 + r() * 1920, l = 26 + r() * 30;
    return [x, y, x - 6, y + l] as const;
  });
});

/** 2 lớp giọt mưa lệch pha nhau, rơi trong khung cửa sổ. */
export const RainDrops = memo(function RainDrops() {
  return (
    <>
      {DROPS.map((lines, k) => (
        <g key={k} className="drops" style={{ animationDelay: -k * 0.31 + "s" }}>
          {lines.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(220,230,255,.42)" strokeWidth={1.6} />
          ))}
        </g>
      ))}
    </>
  );
});

/** 4 làn hơi bốc lên từ cốc cà phê. */
export const SteamWisps = memo(function SteamWisps() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="wisp" style={{ animationDelay: i * 1.4 + "s", left: -30 + (i % 2 ? 8 : -6) + "px" }} />
      ))}
    </>
  );
});

const MOTES = (() => {
  const r = seeded(31);
  return Array.from({ length: 16 }, () => ({
    left: 880 + r() * 380,
    top: 960 + r() * 260,
    vars: cssVars({
      "--d": (7 + r() * 7).toFixed(1) + "s",
      "--dl": (-r() * 10).toFixed(1) + "s",
      "--mx": (r() * 60 - 30).toFixed(0) + "px",
      "--my": (-20 - r() * 50).toFixed(0) + "px",
    }),
  }));
})();

/** Bụi sáng lơ lửng trong vùng đèn bàn. */
export const DustMotes = memo(function DustMotes() {
  return (
    <>
      {MOTES.map((m, i) => (
        <div key={i} className="mote" style={{ left: m.left, top: m.top, ...m.vars }} />
      ))}
    </>
  );
});

const BULB_TEMPO = (() => {
  const r = seeded(41);
  return BULBS.map(() => cssVars({ "--d": (2.5 + r() * 3).toFixed(2) + "s", "--dl": (-r() * 4).toFixed(2) + "s" }));
})();

/** Đèn dây quanh khung cửa sổ, mỗi bóng nhấp nháy một nhịp. */
export const Bulbs = memo(function Bulbs() {
  return (
    <>
      {BULBS.map(([x, y], i) => (
        <div key={i} className="bulb" style={{ left: x, top: y }}>
          <i style={BULB_TEMPO[i]} />
        </div>
      ))}
    </>
  );
});
