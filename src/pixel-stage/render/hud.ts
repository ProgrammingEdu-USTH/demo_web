// Nhãn gắn vào vật, đồng hồ đếm trên vật, khung highlight.
import type { Rect } from "../assets/sheet";
import type { Ctx } from "./pixel";
import { dither, plateBox, rect } from "./pixel";
import { drawPlate, plateSize } from "./bubble";
import { drawText, measure } from "./text";
import { base } from "../tokens/palette";
import { blinkCount, dur } from "../tokens/motion";
import { plate, stageW } from "../tokens/size";

const CLOCK = [".###.", "#.#.#", "#.##.", "#...#", ".###."];

export function drawLabel(c: Ctx, text: string, target: Rect, place: "above" | "below"): Rect {
  const lines = text.split("\n");
  const { h } = plateSize(lines);
  const top = place === "below" ? target.y + target.h + plate.gap : target.y - plate.gap - h;
  return drawPlate(c, lines, target.x + target.w / 2, top);
}

/** Đồng hồ trên vật: biểu tượng + "3s". Trả về chiều cao đã chiếm phía trên vật. */
export function drawTimer(c: Ctx, seconds: number, total: number, target: Rect, accent: string): number {
  const text = `${seconds}s`;
  const w = 5 + 2 + measure(text) + plate.padX * 2 + 2;
  const h = 5 + plate.padY * 2 + 2;
  const x = Math.max(1, Math.min(stageW - w - 1, Math.round(target.x + target.w / 2 - w / 2)));
  const y = Math.max(1, Math.round(target.y - plate.gap - h));
  plateBox(c, x, y, w, h, base.ink2, accent);
  c.fillStyle = base.paper;
  CLOCK.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") c.fillRect(x + 1 + plate.padX + i, y + 1 + plate.padY + j, 1, 1); });
  drawText(c, text, x + 1 + plate.padX + 7, y + 1 + plate.padY, base.paper);
  // vạch tiến độ: phần thời gian còn lại so với lúc bắt đầu
  const bw = w - 4;
  const fill = Math.max(1, Math.round((bw * seconds) / Math.max(seconds, total)));
  rect(c, x + 2, y + h - 2, bw, 1, base.shade);
  rect(c, x + 2, y + h - 2, fill, 1, accent);
  return h + plate.gap;
}

/** Khung highlight: nháy vài lần (mỗi dur.xs) rồi sáng đều; 4 góc đậm, cạnh dither. */
export function drawHighlight(c: Ctx, target: Rect, color: string, age: number): void {
  const blinking = age < blinkCount * 2 * dur.xs;
  if (blinking && Math.floor(age / dur.xs) % 2 === 1) return;
  const x = target.x - 2, y = target.y - 2, w = target.w + 4, h = target.h + 4;
  dither(c, x, y, w, 1, color, 0.5);
  dither(c, x, y + h - 1, w, 1, color, 0.5);
  dither(c, x, y, 1, h, color, 0.5);
  dither(c, x + w - 1, y, 1, h, color, 0.5);
  const L = 3;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]] as const) {
    rect(c, sx > 0 ? cx : cx - L + 1, cy, L, 1, color);
    rect(c, cx, sy > 0 ? cy : cy - L + 1, 1, L, color);
  }
}
