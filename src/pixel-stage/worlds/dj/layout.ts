// Bàn DJ: trên = sequencer 8 ô, giữa = bộ chia tín hiệu if/elif/else, dưới = loa trầm / trống / hi-hat, trước = bàn DJ.
import type { Anchor } from "../types";
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { AccentSet } from "../../tokens/palette";
import { base } from "../../tokens/palette";
import { stageH, stageW } from "../../tokens/size";

export const FLOOR = 132;
export const CELLS = { x: 36, y: 30, w: 28, h: 20, gap: 4, n: 8 } as const;
export const cellX = (i: number) => CELLS.x + i * (CELLS.w + CELLS.gap);
export const SPLIT = { x: 146, y: 70, w: 28, h: 16 } as const;
export const DEVICES = { kick: { x: 56, y: 116, name: "loa trầm" }, snare: { x: 160, y: 116, name: "trống" }, hat: { x: 264, y: 116, name: "hi-hat" } } as const;
export const DECK = { x: 116, y: 148, w: 88, h: 16 } as const;

export const anchors: Record<string, Anchor> = {
  dj: { x: 130, y: 150 },
  splitter: { x: SPLIT.x + SPLIT.w / 2, y: SPLIT.y, box: { x: SPLIT.x, y: SPLIT.y, w: SPLIT.w, h: SPLIT.h } },
  stop: { x: DECK.x + DECK.w - 12, y: DECK.y + 6, box: { x: DECK.x + DECK.w - 18, y: DECK.y + 2, w: 12, h: 9 } },
};
for (let i = 0; i < CELLS.n; i++) {
  anchors[`cell${i}`] = { x: cellX(i) + CELLS.w / 2, y: CELLS.y + CELLS.h / 2, box: { x: cellX(i), y: CELLS.y, w: CELLS.w, h: CELLS.h } };
  anchors[`head${i}`] = { x: cellX(i) + CELLS.w / 2, y: CELLS.y - 9 };
}
// vùng của từng thiết bị theo đúng hình vẽ (bong bóng "Bùm / Chát / Xì" nổi ngay trên đó, không đè bộ chia)
const TOP = { kick: 18, snare: 9, hat: 14 } as const;
for (const [k, d] of Object.entries(DEVICES)) {
  const top = TOP[k as keyof typeof TOP];
  anchors[k] = { x: d.x, y: d.y, box: { x: d.x - 14, y: d.y - top, w: 28, h: top + 16 } };
}

export function drawStatic(c: Ctx, acc: AccentSet): void {
  rect(c, 0, 0, stageW, FLOOR, base.ink2);
  for (let x = 0; x < stageW; x += 32) {
    rect(c, x + 2, 6, 28, FLOOR - 12, base.shade);
    dither(c, x + 2, 6, 28, FLOOR - 12, base.ink2, 0.5);
  }
  for (let y = FLOOR; y < stageH; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < stageW; x += 16) rect(c, x, y, 8, 8, base.ink);
  rect(c, 0, FLOOR, stageW, 1, base.mid);
  // khung sequencer
  plateBox(c, CELLS.x - 6, CELLS.y - 14, CELLS.n * (CELLS.w + CELLS.gap) + 8, CELLS.h + 20, base.ink, base.mid);
  drawText(c, "sequencer: nhip", CELLS.x - 2, CELLS.y + CELLS.h + 2, base.gray1);
  // bộ chia + dây
  for (const d of Object.values(DEVICES)) {
    rect(c, SPLIT.x + SPLIT.w / 2, SPLIT.y + SPLIT.h, 1, 6, base.gray2);
    rect(c, Math.min(d.x, SPLIT.x + SPLIT.w / 2), SPLIT.y + SPLIT.h + 6, Math.abs(d.x - SPLIT.x - SPLIT.w / 2) + 1, 1, base.gray2);
    rect(c, d.x, SPLIT.y + SPLIT.h + 6, 1, d.y - 18 - (SPLIT.y + SPLIT.h + 6), base.gray2);
  }
  plateBox(c, SPLIT.x, SPLIT.y, SPLIT.w, SPLIT.h, base.gray2, base.ink);
  drawText(c, "am?", SPLIT.x + Math.round((SPLIT.w - measure("am?")) / 2), SPLIT.y + 6, base.paper);
  // tên nhánh trên dây: if → loa trầm, elif → trống, else → hi-hat
  // (if / else nằm trên dây ngang; elif nằm cạnh dây dọc vì ngay trên nó là bộ chia)
  const wireY = SPLIT.y + SPLIT.h + 6;
  drawText(c, "if", DEVICES.kick.x + 4, wireY - 7, base.gray1);
  drawText(c, "else", DEVICES.hat.x - measure("else") - 4, wireY - 7, base.gray1);
  drawText(c, "elif", DEVICES.snare.x + 4, wireY + 3, base.gray1);
  // thiết bị
  const k = DEVICES.kick;
  rect(c, k.x - 14, k.y - 18, 28, 34, base.ink);
  rect(c, k.x - 13, k.y - 17, 26, 32, base.shade);
  ellipse(c, k.x, k.y + 6, 8, 8, base.ink2);
  ellipse(c, k.x, k.y - 10, 4, 4, base.ink2);
  const s = DEVICES.snare;
  rect(c, s.x - 1, s.y + 2, 3, 14, base.gray2);
  rect(c, s.x - 12, s.y - 8, 24, 10, base.gray1);
  rect(c, s.x - 12, s.y - 8, 24, 2, base.paper);
  box(c, s.x - 13, s.y - 9, 26, 12, base.ink);
  const h = DEVICES.hat;
  rect(c, h.x, h.y - 14, 1, 30, base.gray2);
  rect(c, h.x - 12, h.y - 14, 25, 2, acc.a3);
  rect(c, h.x - 10, h.y - 10, 21, 2, acc.a3);
  for (const d of Object.values(DEVICES)) {
    const w = measure(d.name) + 6;
    plateBox(c, d.x - Math.round(w / 2), d.y + 18, w, 11, base.paper, base.ink);
    drawText(c, d.name, d.x - Math.round(w / 2) + 3, d.y + 21, base.ink);
  }
}

/** Bàn DJ đè lên chân Bit. */
export function drawDeck(c: Ctx, stopped: boolean, acc: AccentSet): void {
  rect(c, DECK.x, DECK.y, DECK.w, DECK.h, base.gray2);
  rect(c, DECK.x, DECK.y, DECK.w, 2, base.gray1);
  box(c, DECK.x - 1, DECK.y - 1, DECK.w + 2, DECK.h + 2, base.ink);
  ellipse(c, DECK.x + 14, DECK.y + 8, 6, 5, base.ink2);
  ellipse(c, DECK.x + 40, DECK.y + 8, 6, 5, base.ink2);
  const b = anchors.stop.box!;
  // nút STOP: bấm xuống thì lún 1px và sáng viền
  rect(c, b.x, b.y + (stopped ? 1 : 0), b.w, b.h - (stopped ? 1 : 0), base.err);
  box(c, b.x - 1, b.y - 1, b.w + 2, b.h + 2, stopped ? acc.a3 : base.ink);
}
