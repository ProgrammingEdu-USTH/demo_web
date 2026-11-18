// Phần dùng chung giữa các thế giới: mascot Bit (cùng mặt, tóc, tỉ lệ; chỉ đổi trang phục) và vài hàm vẽ cảnh.
import type { ChibiSpec } from "../assets/placeholder";
import type { Ctx } from "../render/pixel";
import { rect } from "../render/pixel";
import { base } from "../tokens/palette";
import { stageH, stageW, tile } from "../tokens/size";

export const BIT_HAIR = { hair: base.wood2, hairShade: base.wood3 } as const;

export const bitSpec = (outfit: Omit<ChibiSpec, "hair" | "hairShade">): ChibiSpec => ({ ...BIT_HAIR, ...outfit });

/** Sàn ô cờ từ `top` tới đáy cảnh. */
export function checkerFloor(c: Ctx, top: number, a: string, b: string): void {
  for (let y = top; y < stageH; y += tile) {
    for (let x = 0; x < stageW; x += tile) {
      rect(c, x, y, tile, Math.min(tile, stageH - y), ((x + y - top) / tile) % 2 === 0 ? a : b);
    }
  }
  rect(c, 0, top, stageW, 1, base.ink);
}

/** Đường thẳng pixel (Bresenham). */
export function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string): void {
  c.fillStyle = color;
  let x = Math.round(x0), y = Math.round(y0);
  const X = Math.round(x1), Y = Math.round(y1);
  const dx = Math.abs(X - x), dy = -Math.abs(Y - y), sx = x < X ? 1 : -1, sy = y < Y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x, y, 1, 1);
    if (x === X && y === Y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
