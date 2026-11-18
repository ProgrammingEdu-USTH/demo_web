/* Giờ trong ngày: bảng KEYS, sample() nội suy smoothstep, applyTOD() đặt bầu trời, mây, trăng, mặt trời, sao, tint, --b, --s.
   Port nguyên từ prototype. Phòng chỉ đổi màu ánh sáng trên ảnh hoàng hôn; bầu trời đổi theo giờ. */

type Hex = string;
export interface TodKey {
  h: number;
  /** 5 điểm màu gradient trời, trên xuống dưới */
  sky: readonly [Hex, Hex, Hex, Hex, Hex];
  /** màu + độ mờ lớp thân mây (cb, ca) và viền sáng mây (cr, ra) */
  cb: Hex; ca: number; cr: Hex; ra: number;
  /** tint multiply, dim, screen */
  mul: Hex; mo: number; dim: number; scr: Hex; so: number;
  lamp: number; city: number; star: number; moon: number; sun: number;
}

export interface TodSample {
  sky: string[];
  cb: string; ca: number; cr: string; ra: number;
  mul: string; mo: number; dim: number; scr: string; so: number;
  lamp: number; city: number; star: number; moon: number; sun: number;
}

/* prettier-ignore */
export const KEYS: readonly TodKey[] = [
  {h:0,   sky:['#0e1230','#151c44','#202a58','#2c3466','#383c70'], cb:'#262a52', ca:.8, cr:'#3c3f74', ra:.5, mul:'#2a2d72', mo:.6, dim:.2, scr:'#000000', so:0, lamp:1, city:1, star:1, moon:1, sun:0},
  {h:4.8, sky:['#141a44','#262c5e','#433f78','#6e5c8e','#9b7c9e'], cb:'#36335f', ca:.75, cr:'#9a7898', ra:.45, mul:'#2f3074', mo:.45, dim:.12, scr:'#000000', so:0, lamp:1, city:.9, star:.6, moon:.6, sun:0},
  {h:6.3, sky:['#6577b8','#8a95cf','#bcaed4','#efc3c2','#ffd3b2'], cb:'#ae96c4', ca:.8, cr:'#ffd8c2', ra:.75, mul:'#6a5a90', mo:.16, dim:0, scr:'#ffcf9a', so:.08, lamp:.4, city:.35, star:0, moon:0, sun:.55},
  {h:8.5, sky:['#5a9be4','#78afea','#a7c9ee','#d6dcef','#ead9e2'], cb:'#f7f9fd', ca:.9, cr:'#c8d5ea', ra:.55, mul:'#ffffff', mo:0, dim:0, scr:'#fff1d8', so:.15, lamp:0, city:0, star:0, moon:0, sun:.25},
  {h:12.5,sky:['#4b93e8','#6eaaee','#9cc6f2','#cfd9f0','#e6d9e6'], cb:'#ffffff', ca:.92, cr:'#c3d1e8', ra:.6, mul:'#ffffff', mo:0, dim:0, scr:'#ffffff', so:.17, lamp:0, city:0, star:0, moon:0, sun:.15},
  {h:16.3,sky:['#7a98da','#9eaee0','#ccbcdb','#f0ccc6','#ffd8b6'], cb:'#efe3ee', ca:.88, cr:'#e9b6ae', ra:.6, mul:'#ffffff', mo:0, dim:0, scr:'#ffd7a8', so:.09, lamp:.25, city:.15, star:0, moon:0, sun:.45},
  {h:18,  sky:['#8c76bd','#9882c5','#bc9ac6','#cfa6c6','#e1b2bb'], cb:'#a07aae', ca:.95, cr:'#f0c0bc', ra:.55, mul:'#ffffff', mo:0, dim:0, scr:'#000000', so:0, lamp:1, city:.8, star:0, moon:0, sun:0},
  {h:19.6,sky:['#2c2d66','#454384','#74679c','#a17ea6','#c28ea4'], cb:'#574780', ca:.85, cr:'#cf96a6', ra:.42, mul:'#2a2d72', mo:.38, dim:.08, scr:'#000000', so:0, lamp:1, city:1, star:.45, moon:.4, sun:0},
  {h:21.5,sky:['#0e1230','#151c44','#202a58','#2c3466','#383c70'], cb:'#262a52', ca:.8, cr:'#3c3f74', ra:.5, mul:'#2a2d72', mo:.6, dim:.2, scr:'#000000', so:0, lamp:1, city:1, star:1, moon:1, sun:0},
  {h:24,  sky:['#0e1230','#151c44','#202a58','#2c3466','#383c70'], cb:'#262a52', ca:.8, cr:'#3c3f74', ra:.5, mul:'#2a2d72', mo:.6, dim:.2, scr:'#000000', so:0, lamp:1, city:1, star:1, moon:1, sun:0}
];

const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixC = (a: string, b: string, t: number) => {
  const A = hx(a), B = hx(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Nội suy giữa 2 mốc KEYS bao quanh giờ h (0..24), làm mượt bằng smoothstep. */
export function sample(h: number): TodSample {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - A.h) / (B.h - A.h))), s = t * t * (3 - 2 * t);
  const col = (k: "cb" | "cr" | "mul" | "scr") => mixC(A[k], B[k], s);
  const num = (k: "ca" | "ra" | "mo" | "dim" | "so" | "lamp" | "city" | "star" | "moon" | "sun") => lerp(A[k], B[k], s);
  return {
    sky: A.sky.map((c, j) => mixC(c, B.sky[j], s)),
    cb: col("cb"), ca: num("ca"), cr: col("cr"), ra: num("ra"),
    mul: col("mul"), mo: num("mo"), dim: num("dim"), scr: col("scr"), so: num("so"),
    lamp: num("lamp"), city: num("city"), star: num("star"), moon: num("moon"), sun: num("sun"),
  };
}

export const wrapHours = (h: number) => ((h % 24) + 24) % 24;

/** Đặt mọi thứ theo giờ h lên cây DOM trong #app. Trả về true nếu là đêm (có sao). */
export function applyTOD(app: HTMLElement, h: number): boolean {
  const o = sample(wrapHours(h));
  const $ = (id: string) => app.querySelector<HTMLElement>("#" + id);
  const st = (id: string, s: Partial<CSSStyleDeclaration>) => {
    const e = $(id);
    if (e) Object.assign(e.style, s);
  };
  st("sgrad", { background: `linear-gradient(180deg,${o.sky[0]} 0%,${o.sky[1]} 10%,${o.sky[2]} 41%,${o.sky[3]} 58%,${o.sky[4]} 74%,${o.sky[4]} 100%)` });
  st("clB", { background: o.cb, opacity: String(o.ca) });
  st("clR", { background: o.cr, opacity: String(o.ra) });
  st("stars", { opacity: String(o.star) });
  const hh = wrapHours(h);
  const mp = (hh >= 18 ? hh - 18 : hh + 6) / 12;
  st("moon", { opacity: String(o.moon), left: 80 + mp * 560 + "px", top: 230 - Math.sin(mp * Math.PI) * 170 + "px" });
  const sp = Math.min(1, Math.max(0, (hh - 6) / 12));
  st("sun", { opacity: String(o.sun), left: 120 + sp * 560 + "px", top: 560 - Math.sin(sp * Math.PI) * 430 + "px" });
  st("tMul", { background: o.mul, opacity: String(o.mo) });
  st("tDim", { opacity: String(o.dim) });
  app.style.setProperty("--mulc", o.mul);
  app.style.setProperty("--mo", String(o.mo));
  app.style.setProperty("--dimo", String(o.dim));
  app.style.setProperty("--scrc", o.scr);
  app.style.setProperty("--so", String(o.so));
  st("tScr", { background: o.scr, opacity: String(o.so) });
  st("lampPool", { opacity: String(o.lamp) });
  st("lampHalo", { opacity: String(o.lamp) });
  st("bulbG", { opacity: String(0.3 + 0.7 * o.lamp) });
  st("cityG", { opacity: String(o.city) });
  const b = 1 - o.mo * 0.62 - o.dim * 0.7 + o.so * 0.5, s = 1 - o.mo * 0.25;
  app.style.setProperty("--b", b.toFixed(3));
  app.style.setProperty("--s", s.toFixed(3));
  return o.star > 0.5;
}
