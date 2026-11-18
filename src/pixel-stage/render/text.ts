// Font pixel vẽ bằng code: thân chữ 5 hàng (hàng 0 = đầu chữ hoa / nét cao, chữ thường cao 4 hàng 1…4),
// hàng 5 cho nét móc dưới. Dấu tiếng Việt được ghép từ NFD: dấu trên chồng lên phía trên, dấu nặng ở dưới.
import type { Ctx } from "./pixel";
import { font, lineH } from "../tokens/size";

const G: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"], N: ["#..#", "##.#", "#.##", "#..#", "#..#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"], "Đ": [".##.", ".#.#", "####", ".#.#", ".##."],
  a: ["...", ".##", "#.#", "#.#", ".##"], b: ["#..", "##.", "#.#", "#.#", "##."], c: ["...", ".##", "#..", "#..", ".##"],
  d: ["..#", ".##", "#.#", "#.#", ".##"], e: ["...", ".#.", "###", "#..", ".##"], f: [".##", ".#.", "###", ".#.", ".#."],
  g: ["...", ".##", "#.#", ".##", "..#", "##."], h: ["#..", "##.", "#.#", "#.#", "#.#"], i: ["#", ".", "#", "#", "#"],
  j: [".#", "..", ".#", ".#", ".#", "#."], k: ["#..", "#.#", "##.", "#.#", "#.#"], l: ["#.", "#.", "#.", "#.", ".#"],
  m: [".....", "####.", "#.#.#", "#.#.#", "#.#.#"], n: ["...", "##.", "#.#", "#.#", "#.#"], o: ["...", ".#.", "#.#", "#.#", ".#."],
  p: ["...", "##.", "#.#", "##.", "#..", "#.."], q: ["...", ".##", "#.#", ".##", "..#", "..#"], r: ["...", "#.#", "##.", "#..", "#.."],
  s: ["...", ".##", "#..", "..#", "##."], t: [".#.", "###", ".#.", ".#.", "..#"], u: ["...", "#.#", "#.#", "#.#", ".##"],
  v: ["...", "#.#", "#.#", "#.#", ".#."], w: [".....", "#...#", "#.#.#", "#.#.#", ".#.#."], x: ["...", "#.#", ".#.", ".#.", "#.#"],
  y: ["...", "#.#", "#.#", ".##", "..#", "##."], z: ["...", "###", "..#", ".#.", "###"], "đ": [".###", ".##.", "#.#.", "#.#.", ".##."],
  "ı": [".", "#", "#", "#", "#"],
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"], 2: ["##.", "..#", ".#.", "#..", "###"],
  3: ["##.", "..#", ".#.", "..#", "##."], 4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "##.", "..#", "##."],
  6: [".##", "#..", "###", "#.#", "###"], 7: ["###", "..#", ".#.", ".#.", ".#."], 8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "##."],
  ".": [".", ".", ".", ".", "#"], ",": [".", ".", ".", ".", "#", "#"], "!": ["#", "#", "#", ".", "#"],
  "?": ["##.", "..#", ".#.", "...", ".#."], ":": [".", "#", ".", "#", "."], "'": ["#", "#", ".", ".", "."],
  '"': ["#.#", "#.#", "...", "...", "..."], "[": ["##", "#.", "#.", "#.", "##"], "]": ["##", ".#", ".#", ".#", "##"],
  "(": [".#", "#.", "#.", "#.", ".#"], ")": ["#.", ".#", ".#", ".#", "#."], "-": ["...", "...", "###", "...", "..."],
  _: ["...", "...", "...", "...", "###"], "=": ["...", "###", "...", "###", "..."], "+": ["...", ".#.", "###", ".#.", "..."],
  "/": ["..#", "..#", ".#.", "#..", "#.."], ">": ["#..", ".#.", "..#", ".#.", "#.."], "<": ["..#", ".#.", "#..", ".#.", "..#"],
  "*": ["...", "#.#", ".#.", "#.#", "..."], "→": ["....", "..#.", "####", "..#.", "...."], "·": [".", ".", "#", ".", "."],
  "{": [".##", ".#.", "##.", ".#.", ".##"], "}": ["##.", ".#.", ".##", ".#.", "##."], "|": ["#", "#", "#", "#", "#"], "#": [".#.#.", "#####", ".#.#.", "#####", ".#.#."], "%": ["#.#", "..#", ".#.", "#..", "#.#"],
};

// dấu ghép (NFD) → mẫu 2 hàng; HORN thêm một chấm bên phải đầu chữ
const ABOVE: Record<string, string[]> = {
  "́": [".#", "#."], "̀": ["#.", ".#"], "̉": ["##", ".#", "#."], "̃": [".#.#", "#.#."],
  "̂": [".#.", "#.#"], "̆": ["#.#", ".#."],
};
const DOT_BELOW = "̣";
const HORN = "̛";

type Cluster = { base: string; above: string[]; below: boolean; horn: boolean };

function clusters(text: string): Cluster[] {
  const out: Cluster[] = [];
  for (const ch of text.normalize("NFD")) {
    const last = out[out.length - 1];
    if (ch in ABOVE && last) last.above.push(ch);
    else if (ch === DOT_BELOW && last) last.below = true;
    else if (ch === HORN && last) last.horn = true;
    else out.push({ base: ch, above: [], below: false, horn: false });
  }
  for (const c of out) if (c.base === "i" && c.above.length) c.base = "ı";
  return out;
}

const glyphOf = (ch: string): string[] | null => (ch === " " ? null : G[ch] ?? G["?"]);
const widthOf = (c: Cluster): number => {
  const g = glyphOf(c.base);
  return (g ? g[0].length : font.space) + (c.horn ? 1 : 0);
};

/** Chiều rộng (px) của một dòng chữ. */
export function measure(text: string): number {
  const cs = clusters(text);
  return cs.reduce((w, c) => w + widthOf(c), 0) + Math.max(0, cs.length - 1) * font.gap;
}

/** Ngắt dòng theo từ cho vừa `maxW`. */
export function wrap(text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Cao của khối `n` dòng, tính cả chỗ cho dấu trên và nét móc dưới. */
export const blockH = (n: number): number => n * lineH;
/** Từ đỉnh khối tới đỉnh thân chữ dòng đầu (chừa 2 hàng cho dấu). */
export const bodyOffset = font.ascent - 1;

function paint(c: Ctx, rows: string[], x: number, y: number): void {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === "#") c.fillRect(x + rx, y + ry, 1, 1);
  });
}

/** Vẽ một dòng chữ; (x, y) = góc trên trái của thân chữ. */
export function drawText(c: Ctx, text: string, x: number, y: number, color: string): void {
  c.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const cl of clusters(text)) {
    const g = glyphOf(cl.base);
    const w = widthOf(cl);
    if (g) {
      paint(c, g, cx, cy);
      const gw = g[0].length;
      const top = g.findIndex((r) => r.includes("#"));
      const bottom = cy + top - 2; // chừa 1 hàng trống giữa dấu và thân chữ
      // dấu đầu (mũ / trăng / thanh) căn giữa; dấu thanh thứ hai (ấ, ặ, ở…) đặt lệch sang phải cho khỏi chồng cao
      cl.above.forEach((m, k) => {
        const pat = ABOVE[m];
        const x = k === 0 ? cx + Math.floor((gw - pat[0].length) / 2) : cx + gw - 1;
        paint(c, pat, x, bottom - pat.length + 1 - (k === 0 ? 0 : 1));
      });
      if (cl.horn) c.fillRect(cx + gw, cy + Math.max(0, top) - 1, 1, 1); // móc ơ / ư nhô chéo lên
      if (cl.below) c.fillRect(cx + Math.floor(gw / 2), cy + g.length, 1, 1);
    }
    cx += w + font.gap;
  }
}

/** Vẽ nhiều dòng, căn giữa theo `cx`. */
export function drawLinesCentered(c: Ctx, lines: string[], cx: number, y: number, color: string): void {
  lines.forEach((ln, i) => drawText(c, ln, Math.round(cx - measure(ln) / 2), y + i * lineH, color));
}
