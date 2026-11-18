// Giao thông đô thị nhìn từ trên: ngã tư = đỉnh, đường = cạnh. Dưới cùng là làn xe xếp hàng (deque) ở cổng kho.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageH, stageW, tile } from "../../tokens/size";

export const NODES: Record<string, { x: number; y: number }> = {
  Kho: { x: 64, y: 84 }, A: { x: 140, y: 40 }, B: { x: 140, y: 120 },
  C: { x: 220, y: 40 }, D: { x: 220, y: 120 }, "Khách": { x: 292, y: 80 },
};
export const EDGES: [string, string][] = [["Kho", "A"], ["Kho", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "Khách"], ["D", "Khách"]];
export const edgeKey = (a: string, b: string) => `${a}-${b}`;
export const LANE = { y: 162, top: 152, slots: [64, 128, 192, 256] } as const;
const ROAD = 6;

export const anchors: Record<string, Anchor> = {
  office: { x: 26, y: 140 },
  result: { x: 176, y: 2, box: { x: 176, y: 2, w: 1, h: 1 } },
};
for (const [k, n] of Object.entries(NODES)) {
  anchors[`node.${k}`] = { x: n.x, y: n.y, box: { x: n.x - 7, y: n.y - 7, w: 15, h: 15 } };
  anchors[`flag.${k}`] = { x: n.x + 10, y: n.y + 5 };
}
LANE.slots.forEach((x, i) => { anchors[`q${i}`] = { x, y: LANE.y }; });
anchors.gate = { x: NODES.Kho.x, y: LANE.y - 16 };

/** Đường dày `w` px nối hai điểm (đặt hình vuông dọc theo đường thẳng pixel). */
export function road(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  c.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    c.fillRect(x - (w >> 1), y - (w >> 1), w, w);
  }
}

export function drawStatic(c: Ctx, _acc: AccentSet): void {
  void _acc;
  rect(c, 0, 0, stageW, stageH, base.ink2);
  // khối nhà / công viên giữa các con đường
  for (let y = 0; y < LANE.top - 4; y += tile) for (let x = 0; x < stageW; x += tile) {
    if (((x / tile) * 7 + (y / tile) * 3) % 5 === 0) {
      rect(c, x + 2, y + 2, tile - 4, tile - 4, ((x + y) / tile) % 2 ? base.shade : base.mid);
      rect(c, x + 2, y + 2, tile - 4, 1, base.lav);
    }
  }
  dither(c, 0, 0, stageW, LANE.top - 4, base.shade, 0.25);
  // đường: viền ink rồi mặt đường
  for (const [a, b] of EDGES) road(c, NODES[a].x, NODES[a].y, NODES[b].x, NODES[b].y, ROAD + 2, base.ink);
  road(c, NODES.Kho.x, NODES.Kho.y, NODES.Kho.x, LANE.y, ROAD + 2, base.ink);
  for (const [a, b] of EDGES) road(c, NODES[a].x, NODES[a].y, NODES[b].x, NODES[b].y, ROAD, base.gray2);
  road(c, NODES.Kho.x, NODES.Kho.y, NODES.Kho.x, LANE.y, ROAD, base.gray2);
  // làn xếp hàng
  rect(c, 0, LANE.top, stageW, stageH - LANE.top, base.ink);
  rect(c, 0, LANE.top + 1, stageW, stageH - LANE.top - 2, base.gray2);
  for (let x = 4; x < stageW; x += 12) rect(c, x, LANE.y + 8, 6, 1, base.pale);
  drawText(c, "hang_doi", 4, LANE.top + 3, base.paper);
  // kho và nhà khách
  rect(c, 6, 60, 34, 40, base.wood2);
  rect(c, 6, 60, 34, 6, base.wood3);
  rect(c, 14, 80, 18, 20, base.ink2);
  box(c, 5, 59, 36, 42, base.ink);
  plateBox(c, 9, 68, 28, 10, base.paper, base.ink);
  drawText(c, "KHO", 23 - Math.round(measure("KHO") / 2), 70, base.ink);
  rect(c, 304, 66, 14, 28, base.pale);
  rect(c, 302, 62, 18, 5, base.wood2);
  rect(c, 308, 82, 6, 12, base.wood3);
  box(c, 303, 65, 16, 30, base.ink);
  // ngã tư + tên
  for (const [k, n] of Object.entries(NODES)) {
    ellipse(c, n.x, n.y, 7, 7, base.ink);
    ellipse(c, n.x, n.y, 6, 6, base.gray1);
    const w = measure(k);
    const ty = n.y < 60 ? n.y + 10 : n.y - 17;
    plateBox(c, n.x - Math.round(w / 2) - 3, ty, w + 6, 11, base.paper, base.ink);
    drawText(c, k, n.x - Math.round(w / 2), ty + 3, base.ink);
  }
}
