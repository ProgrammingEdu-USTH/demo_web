// Hầm ngục: trái = bảng bản thiết kế (class) + cây kế thừa, giữa = cổng triệu hồi, phải = sàn đấu; HUD trạng thái góc trên phải.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, rect } from "../../render/pixel";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageH, stageW } from "../../tokens/size";

export const FLOOR = 112;
export const BOARD = { x: 6, y: 8, w: 92, h: 100 } as const;
export const PORTAL = { x: 122, y: 146 } as const;
export const TORCHES = [112, 160] as const;
export const HUD = { x: 168, y: 4, w: 148, row: 15, states: ["tuan_tra", "duoi_theo", "tan_cong"] } as const;
export const STATE_NAME: Record<string, string> = { tuan_tra: "tuần tra", duoi_theo: "đuổi theo", tan_cong: "tấn công" };
/** 1 ô khoảng cách trong code = 20px trên cảnh */
export const UNIT = 20;

export const anchors: Record<string, Anchor> = {
  board: { x: BOARD.x + BOARD.w / 2, y: BOARD.y, box: { x: BOARD.x, y: BOARD.y, w: BOARD.w, h: BOARD.h } },
  portal: { x: PORTAL.x, y: PORTAL.y + 8, box: { x: PORTAL.x - 14, y: PORTAL.y - 22, w: 29, h: 32 } },
  s1spot: { x: 206, y: 160 },
  s2spot: { x: 292, y: 160 },
  chase: { x: 186, y: 160 },
  heroDoor: { x: -10, y: 158 },
  hero: { x: 206 - 3 * UNIT, y: 158 },
};
["s1", "s2"].forEach((id, i) => {
  anchors[`hud.${id}`] = { x: HUD.x + HUD.w / 2, y: HUD.y + 4 + i * HUD.row, box: { x: HUD.x + 2, y: HUD.y + 3 + i * HUD.row, w: HUD.w - 4, h: HUD.row - 2 } };
});

export function drawStatic(c: Ctx, acc: AccentSet): void {
  rect(c, 0, 0, stageW, FLOOR, base.shade);
  for (let y = 0, r = 0; y < FLOOR; y += 10, r++) {
    rect(c, 0, y, stageW, 1, base.ink2);
    for (let x = r % 2 ? 0 : 12; x < stageW; x += 24) rect(c, x, y, 1, 10, base.ink2);
  }
  dither(c, 0, 0, stageW, FLOOR, base.ink, 0.25);
  for (let y = FLOOR; y < stageH; y += 12) for (let x = (y / 12) % 2 ? 0 : 10; x < stageW; x += 20) {
    rect(c, x, y, 19, 11, base.ink2);
    rect(c, x, y, 19, 1, base.shade);
  }
  rect(c, 0, FLOOR, stageW, 1, base.ink);
  // đuốc
  for (const x of TORCHES) {
    rect(c, x - 1, 40, 3, 12, base.wood3);
    rect(c, x - 3, 38, 7, 2, base.gray2);
  }
  // bệ cổng triệu hồi
  ellipse(c, PORTAL.x, PORTAL.y + 10, 18, 4, base.ink);
  ellipse(c, PORTAL.x, PORTAL.y + 9, 16, 3, base.gray2);
  rect(c, PORTAL.x - 16, PORTAL.y - 26, 4, 36, base.gray2);
  rect(c, PORTAL.x + 13, PORTAL.y - 26, 4, 36, base.gray2);
  rect(c, PORTAL.x - 17, PORTAL.y - 30, 35, 5, base.gray1);
  box(c, PORTAL.x - 18, PORTAL.y - 31, 37, 7, base.ink);
  rect(c, PORTAL.x - 1, PORTAL.y - 29, 3, 3, acc.a1);
}
