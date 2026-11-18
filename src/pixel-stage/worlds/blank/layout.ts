// Thế giới trống để thử engine (Phase 0): tường, sàn, một tấm biển và một kệ.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { dither, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageW, tile } from "../../tokens/size";
import { checkerFloor } from "../shared";

export const FLOOR = 112;

export const anchors: Record<string, Anchor> = {
  left: { x: 64, y: 152 },
  center: { x: 160, y: 156 },
  right: { x: 256, y: 152 },
  focus: { x: 240, y: 108 },
  shelf: { x: 264, y: 66, box: { x: 240, y: 58, w: 48, h: 18 } },
  sign: { x: 160, y: 40, box: { x: 132, y: 24, w: 56, h: 32 } },
};
// 5 ô trên tường cho các ký tự của một chuỗi (bài Chuỗi): mỗi ô một hộp, nhãn index bên dưới
for (let i = 0; i < 5; i++) anchors[`ch${i}`] = { x: 88 + i * 36, y: 84 };

export function drawStatic(c: Ctx, acc: AccentSet): void {
  rect(c, 0, 0, stageW, FLOOR, base.ink2);
  for (let x = 0; x < stageW; x += tile) dither(c, x, 0, 1, FLOOR, base.shade, 0.5);
  for (let y = tile; y < FLOOR; y += tile) dither(c, 0, y, stageW, 1, base.shade, 0.5);
  rect(c, 0, FLOOR - 5, stageW, 4, base.wood2);
  rect(c, 0, FLOOR - 5, stageW, 1, base.wood1);
  checkerFloor(c, FLOOR, base.shade, base.mid);
  // biển
  const s = anchors.sign.box!;
  plateBox(c, s.x, s.y, s.w, s.h, base.lav, base.ink);
  rect(c, s.x + 2, s.y + 2, s.w - 4, 2, base.pale);
  const t = "PIXEL";
  drawText(c, t, s.x + Math.round((s.w - measure(t)) / 2), s.y + 13, base.ink);
  rect(c, s.x + 10, s.y + 22, s.w - 20, 1, acc.a1);
  // kệ
  rect(c, 240, 74, 48, 3, base.wood1);
  rect(c, 240, 77, 48, 1, base.wood3);
  rect(c, 244, 78, 2, 6, base.wood3);
  rect(c, 282, 78, 2, 6, base.wood3);
}
