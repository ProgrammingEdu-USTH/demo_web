// Bàn làm việc & kho: trái = bàn (cache), giữa = kệ (RAM), phải = cửa kho xa (disk). Trên trái = bảng nhãn tên biến.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { box, dither, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageH, stageW } from "../../tokens/size";

export const FLOOR = 116;
export const BOARD = { x: 8, y: 8, w: 104, h: 40, slots: [34, 84], tagY: 18 } as const;
export const SHELF = { x: 122, y: 40, w: 94, boards: [70, 104] } as const;

export const anchors: Record<string, Anchor> = {
  desk: { x: 94, y: 156 },
  shelfFront: { x: 170, y: 158 },
  "ram.1": { x: 146, y: 96 },
  "ram.2": { x: 192, y: 96 },
  "ram.3": { x: 146, y: 62 },
  dock: { x: 252, y: 154 },
  bin: { x: 298, y: 150, box: { x: 286, y: 128, w: 26, h: 24 } },
  board: { x: BOARD.x + BOARD.w / 2, y: BOARD.y, box: { x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.h } },
};

const plate = (c: Ctx, text: string, cx: number, y: number) => {
  const w = measure(text) + 6;
  plateBox(c, Math.round(cx - w / 2), y, w, 11, base.paper, base.ink);
  drawText(c, text, Math.round(cx - w / 2) + 3, y + 3, base.ink);
};

export function drawStatic(c: Ctx, acc: AccentSet): void {
  rect(c, 0, 0, stageW, FLOOR, base.ink2);
  for (let x = 6; x < stageW; x += 20) dither(c, x, 0, 2, FLOOR, base.shade, 0.5);
  for (let y = FLOOR; y < stageH; y += 8) {
    rect(c, 0, y, stageW, 8, (y / 8) % 2 ? base.wood2 : base.wood3);
    rect(c, 0, y, stageW, 1, base.wood3);
  }
  rect(c, 0, FLOOR, stageW, 1, base.ink);
  // bảng nhãn tên biến
  rect(c, BOARD.x, BOARD.y, BOARD.w, BOARD.h, base.wood1);
  for (let y = BOARD.y + 4; y < BOARD.y + BOARD.h; y += 6) for (let x = BOARD.x + 4; x < BOARD.x + BOARD.w; x += 6) rect(c, x, y, 1, 1, base.wood3);
  box(c, BOARD.x - 1, BOARD.y - 1, BOARD.w + 2, BOARD.h + 2, base.ink);
  drawText(c, "tên biến", BOARD.x + 3, BOARD.y + BOARD.h - 8, base.ink);
  // bàn = cache
  rect(c, 8, 118, 70, 4, base.wood1);
  rect(c, 10, 122, 66, 18, base.wood2);
  box(c, 7, 117, 72, 24, base.ink);
  rect(c, 60, 104, 2, 14, base.gray2);
  rect(c, 54, 100, 12, 5, acc.a4);
  box(c, 53, 99, 14, 7, base.ink);
  plate(c, "Cache", 30, 126);
  // kệ = RAM
  rect(c, SHELF.x, SHELF.y, 3, FLOOR - SHELF.y, base.wood3);
  rect(c, SHELF.x + SHELF.w - 3, SHELF.y, 3, FLOOR - SHELF.y, base.wood3);
  for (const y of SHELF.boards) {
    rect(c, SHELF.x, y, SHELF.w, 3, base.wood1);
    rect(c, SHELF.x, y + 3, SHELF.w, 1, base.wood3);
  }
  box(c, SHELF.x - 1, SHELF.y - 1, SHELF.w + 2, FLOOR - SHELF.y + 2, base.ink);
  plate(c, "RAM", SHELF.x + SHELF.w / 2, SHELF.y - 12);
  // cửa kho xa = disk
  rect(c, 236, 40, 40, 76, base.ink);
  rect(c, 239, 43, 34, 73, base.shade);
  dither(c, 239, 43, 34, 73, base.ink, 0.5);
  for (const [x, y] of [[244, 96], [256, 100], [262, 88]] as const) { rect(c, x, y, 8, 7, base.wood2); box(c, x - 1, y - 1, 10, 9, base.ink); }
  plate(c, "Disk (xa)", 256, 28);
  // thùng dọn
  rect(c, 287, 130, 24, 20, base.gray2);
  rect(c, 285, 127, 28, 4, base.gray1);
  box(c, 286, 129, 26, 22, base.ink);
  rect(c, 296, 136, 6, 1, base.ink2);
}
