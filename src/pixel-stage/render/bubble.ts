// Bong bóng thoại và tấm nhãn: nền paper, viền ink, chữ pixel.
import type { Rect } from "../assets/sheet";
import type { Ctx } from "./pixel";
import { plateBox, rect } from "./pixel";
import { blockH, bodyOffset, drawLinesCentered, measure, wrap } from "./text";
import { base } from "../tokens/palette";
import { bubble, plate, stageH, stageW } from "../tokens/size";
import { popScale } from "../core/ease";

export type PlateStyle = { fill: string; line: string; text: string };
export const PAPER: PlateStyle = { fill: base.paper, line: base.ink, text: base.ink };

const clampX = (x: number, w: number) => Math.max(1, Math.min(stageW - w - 1, x));

/** Kích thước tấm chữ nhiều dòng. */
export function plateSize(lines: string[], extraW = 0): { w: number; h: number } {
  const w = Math.max(...lines.map(measure)) + plate.padX * 2 + 2 + extraW;
  return { w, h: blockH(lines.length) + plate.padY * 2 };
}

/** Tấm chữ căn giữa theo `cx`; `top` là mép trên. Trả về khung đã vẽ. */
export function drawPlate(c: Ctx, lines: string[], cx: number, top: number, st: PlateStyle = PAPER): Rect {
  const { w, h } = plateSize(lines);
  const x = clampX(Math.round(cx - w / 2), w);
  const y = Math.max(1, Math.min(stageH - h - 1, Math.round(top)));
  plateBox(c, x, y, w, h, st.fill, st.line);
  drawLinesCentered(c, lines, x + w / 2, y + plate.padY + bodyOffset, st.text);
  return { x, y, w, h };
}

/** Bong bóng thoại phía trên `target`, đuôi chỉ xuống. `p` = tiến độ xuất hiện. */
export function drawBubble(c: Ctx, text: string, target: Rect, liftBy: number, p: number): void {
  if (p <= 0) return;
  const lines = wrap(text, bubble.maxW - bubble.pad * 2);
  const { w, h } = plateSize(lines);
  const tipX = Math.round(target.x + target.w / 2);
  const tipY = Math.max(h + bubble.tail + 1, Math.round(target.y - bubble.gap - liftBy));
  const x = clampX(Math.round(tipX - w / 2), w);
  const y = tipY - bubble.tail - h;
  c.save();
  const s = popScale(p, Math.max(w, h));
  if (s !== 1) {
    c.translate(tipX, tipY);
    c.scale(s, s);
    c.translate(-tipX, -tipY);
  }
  plateBox(c, x, y, w, h, PAPER.fill, PAPER.line);
  drawLinesCentered(c, lines, x + w / 2, y + plate.padY + bodyOffset, PAPER.text);
  // đuôi: 3 hàng thu hẹp dần
  const tx = Math.max(x + 3, Math.min(x + w - 4, tipX));
  for (let i = 0; i < bubble.tail; i++) {
    const half = bubble.tail - 1 - i;
    rect(c, tx - half - 1, y + h - 1 + i, 1, 1, PAPER.line);
    rect(c, tx + half + 1, y + h - 1 + i, 1, 1, PAPER.line);
    if (half >= 0) rect(c, tx - half, y + h - 1 + i, half * 2 + 1, 1, i === bubble.tail - 1 ? PAPER.line : PAPER.fill);
  }
  c.restore();
}
