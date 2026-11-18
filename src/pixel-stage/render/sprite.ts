// Vẽ một frame của spritesheet. Frame chạy theo spriteFps, không nội suy; vị trí làm tròn về pixel nguyên.
import type { Rect, SpriteSheet } from "../assets/sheet";
import type { Entity } from "../timeline/state";
import type { Ctx } from "./pixel";
import { spriteFps } from "../tokens/motion";
import { phaseOf } from "../core/rng";
import { makeCanvas } from "./pixel";

/** Góc trên trái của sprite theo gốc (chân / tâm). */
export function spriteRect(sheet: SpriteSheet, x: number, y: number): Rect {
  const rx = Math.round(x - sheet.w / 2);
  const ry = Math.round(sheet.origin === "feet" ? y - sheet.h : y - sheet.h / 2);
  return { x: rx, y: ry, w: sheet.w, h: sheet.h };
}

/** Vùng có điểm ảnh của frame đầu (để gắn nhãn / bong bóng sát hình chứ không sát khung). */
export function opaqueBounds(sheet: SpriteSheet): Rect {
  const f = sheet.frames[0];
  const { ctx } = makeCanvas(f.w, f.h);
  ctx.drawImage(sheet.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const d = ctx.getImageData(0, 0, f.w, f.h).data;
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (d[(y * f.w + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? { x: 0, y: 0, w: f.w, h: f.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function frameIndex(sheet: SpriteSheet, en: Entity, t: number, reduced: boolean): number {
  const tag = (en.walking && sheet.tags.walk) || sheet.tags[en.tag] || sheet.tags.idle || { from: 0, to: 0 };
  const n = tag.to - tag.from + 1;
  if (reduced || !en.loop || n <= 1) return tag.from;
  const k = Math.floor((t * spriteFps) / 1000 + phaseOf(en.id) * n);
  return tag.from + (k % n);
}

export function drawEntity(c: Ctx, sheet: SpriteSheet, en: Entity, t: number, reduced: boolean): void {
  if (en.alpha <= 0 || en.scale <= 0) return;
  const f = sheet.frames[frameIndex(sheet, en, t, reduced)];
  const r = spriteRect(sheet, en.x, en.y);
  c.save();
  c.globalAlpha = en.alpha;
  // phóng (pop) quanh gốc của sprite
  const ox = Math.round(en.x), oy = Math.round(en.y);
  c.translate(ox, oy);
  if (en.scale !== 1) c.scale(en.scale, en.scale);
  if (en.flip) c.scale(-1, 1);
  c.drawImage(sheet.image, f.x, f.y, f.w, f.h, r.x - ox, r.y - oy, f.w, f.h);
  c.restore();
}
