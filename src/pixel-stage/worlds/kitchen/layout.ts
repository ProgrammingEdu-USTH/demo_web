// Bếp nhà hàng 320×180: trái = ray ticket + cửa, giữa = bàn sơ chế + 2 lò, phải = bàn ra món, trên = đồng hồ, đèn.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { box, ellipse, rect } from "../../render/pixel";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageW } from "../../tokens/size";
import { checkerFloor } from "../shared";

export const FLOOR = 112;
const BASE = 124; // chân đồ đạc sát tường
export const OVENS = [134, 176] as const;
export const LAMP = { x: 112, y: 20 } as const;
export const CLOCK = { x: 160, y: 18, r: 9 } as const;
export const TRAY = { x: 236, y: 96, w: 68, slots: [254, 286] } as const;
export const HOOK = { x: 100, y: 70 } as const;
/** bảng so sánh thời gian (script tuần tự) */
export const BARS = { x: 196, y: 6, w: 120, unit: 18 } as const;

const ovenBox = (x0: number) => ({ x: x0 - 1, y: 58, w: 34, h: BASE - 58 + 1 });

export const anchors: Record<string, Anchor> = {
  door: { x: 24, y: 140, box: { x: 6, y: 54, w: 36, h: 58 } },
  door2: { x: 46, y: 158 },
  // script threading: móc treo chảo có khóa trên tường sau bàn sơ chế
  hook: { x: HOOK.x, y: HOOK.y + 8, box: { x: HOOK.x - 9, y: HOOK.y - 2, w: 26, h: 20 } },
  stove: { x: 106, y: 94 },
  wait: { x: 140, y: 152 },
  out1: { x: 252, y: 150 },
  out2: { x: 290, y: 154 },
  center: { x: 142, y: 166 },
  rail: { x: 50, y: 146, box: { x: 8, y: 26, w: 84, h: 8 } },
  ticket1: { x: 28, y: 42 },
  ticket2: { x: 72, y: 42 },
  prep: { x: 106, y: 146, box: { x: 86, y: 96, w: 40, h: 28 } },
  oven1: { x: OVENS[0] + 16, y: 146, box: ovenBox(OVENS[0]) },
  oven2: { x: OVENS[1] + 16, y: 146, box: ovenBox(OVENS[1]) },
  "oven1.in": { x: OVENS[0] + 16, y: 97 },
  "oven2.in": { x: OVENS[1] + 16, y: 97 },
  "oven1.vent": { x: OVENS[0] + 16, y: 56 },
  "oven2.vent": { x: OVENS[1] + 16, y: 56 },
  look1: { x: 132, y: 166 },
  look2: { x: 214, y: 166 },
  tray: { x: 270, y: 146, box: { x: 234, y: 86, w: 72, h: 16 } },
  "tray.top": { x: 270, y: 92 },
  "tray.1": { x: TRAY.slots[0], y: 90 },
  "tray.2": { x: TRAY.slots[1], y: 90 },
  clock: { x: CLOCK.x, y: CLOCK.y, box: { x: CLOCK.x - CLOCK.r - 1, y: CLOCK.y - CLOCK.r - 1, w: CLOCK.r * 2 + 3, h: CLOCK.r * 2 + 3 } },
};

function table(c: Ctx, x: number, w: number): void {
  rect(c, x - 2, 100, w + 4, 3, base.wood1);
  rect(c, x - 2, 103, w + 4, 1, base.wood3);
  rect(c, x, 104, w, BASE - 104, base.wood2);
  rect(c, x, 112, w, 1, base.wood3);
  rect(c, x + w - 2, 104, 2, BASE - 104, base.wood3);
  box(c, x - 3, 99, w + 6, BASE - 99 + 1, base.ink);
}

function oven(c: Ctx, x0: number): void {
  rect(c, x0 + 13, 58, 6, 8, base.gray2); // ống thông hơi
  box(c, x0 + 12, 57, 8, 9, base.ink);
  rect(c, x0, 66, 32, BASE - 66, base.gray2);
  rect(c, x0, 66, 32, 2, base.gray1);
  rect(c, x0, 66, 2, BASE - 66, base.gray1);
  rect(c, x0 + 30, 68, 2, BASE - 68, base.shade);
  box(c, x0 - 1, 65, 34, BASE - 65 + 1, base.ink);
  rect(c, x0 + 2, 68, 28, 8, base.ink2); // bảng điều khiển
  ellipse(c, x0 + 7, 72, 2, 2, base.gray1);
  ellipse(c, x0 + 25, 72, 2, 2, base.gray1);
  rect(c, x0 + 7, 70, 1, 2, base.ink);
  rect(c, x0 + 25, 72, 2, 1, base.ink);
  rect(c, x0 + 3, 79, 26, 41, base.gray1); // cửa lò
  box(c, x0 + 3, 79, 26, 41, base.ink);
  rect(c, x0 + 6, 81, 20, 2, base.paper); // tay nắm
  rect(c, x0 + 6, 85, 20, 22, base.ink2); // kính
  box(c, x0 + 6, 85, 20, 22, base.shade);
  rect(c, x0 + 8, 87, 3, 1, base.mid);
  rect(c, x0 + 3, BASE, 4, 1, base.ink);
  rect(c, x0 + 25, BASE, 4, 1, base.ink);
}

export function drawStatic(c: Ctx, _acc: AccentSet): void {
  void _acc;
  // tường trên, nẹp gỗ, tường gạch men dưới
  rect(c, 0, 0, stageW, 64, base.shade);
  rect(c, 0, 62, stageW, 2, base.wood2);
  rect(c, 0, 64, stageW, FLOOR - 64, base.mid);
  for (let y = 64, row = 0; y < FLOOR; y += 8, row++) {
    rect(c, 0, y, stageW, 1, base.shade);
    for (let x = row % 2 ? 4 : 0; x < stageW; x += 8) rect(c, x, y + 1, 1, 7, base.shade);
  }
  rect(c, 0, 65, stageW, 1, base.lav);
  checkerFloor(c, FLOOR, base.ink2, base.shade);
  // cửa
  rect(c, 6, 54, 36, 58, base.wood3);
  rect(c, 9, 57, 30, 55, base.wood2);
  rect(c, 13, 61, 22, 14, base.pale);
  rect(c, 23, 61, 1, 14, base.ink2);
  rect(c, 13, 67, 22, 1, base.ink2);
  box(c, 12, 60, 24, 16, base.ink);
  rect(c, 13, 80, 22, 26, base.wood1);
  box(c, 12, 79, 24, 28, base.wood3);
  rect(c, 34, 88, 2, 2, base.amber1);
  box(c, 5, 53, 38, 60, base.ink);
  // ray ticket
  rect(c, 8, 30, 84, 2, base.gray1);
  rect(c, 8, 32, 84, 1, base.gray2);
  rect(c, 8, 26, 2, 7, base.gray2);
  rect(c, 90, 26, 2, 7, base.gray2);
  // đồng hồ treo tường (kim vẽ ở ambient)
  ellipse(c, CLOCK.x, CLOCK.y, CLOCK.r, CLOCK.r, base.ink);
  ellipse(c, CLOCK.x, CLOCK.y, CLOCK.r - 1, CLOCK.r - 1, base.paper);
  for (const [dx, dy, w, h] of [[0, -7, 1, 2], [6, 0, 2, 1], [0, 6, 1, 2], [-7, 0, 2, 1]] as const) rect(c, CLOCK.x + dx, CLOCK.y + dy, w, h, base.ink);
  // đèn treo
  rect(c, LAMP.x, 0, 1, LAMP.y, base.ink);
  for (let i = 0; i < 6; i++) rect(c, LAMP.x - 2 - i, LAMP.y + i, 5 + i * 2, 1, i < 2 ? base.amber1 : base.amber2);
  rect(c, LAMP.x - 8, LAMP.y + 6, 17, 1, base.ink);
  // bàn sơ chế, lò, bàn ra món
  table(c, 88, 36);
  rect(c, 92, 97, 14, 3, base.wood1);
  box(c, 91, 96, 16, 5, base.ink);
  ellipse(c, 117, 97, 4, 2, base.gray1);
  rect(c, 113, 95, 9, 1, base.ink);
  OVENS.forEach((x0) => oven(c, x0));
  table(c, 232, 76);
}
