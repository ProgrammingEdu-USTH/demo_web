// Sprite placeholder vẽ bằng code: chibi đầu to thân nhỏ, viền ink 1px tự động, 2 frame cho mỗi tag.
import type { SpriteSheet } from "./sheet";
import { ACTOR_TAGS } from "./sheet";
import { base, rgbOf } from "../tokens/palette";
import { actorSize, propSize } from "../tokens/size";
import { makeCanvas } from "../render/pixel";

/** Bộ vẽ pixel trên ImageData của một frame. */
export class Painter {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, hex: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgbOf(hex);
    const o = (y * this.w + x) * 4;
    this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = 255;
  }
  filled(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.data[(y * this.w + x) * 4 + 3] > 0;
  }
  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex);
  }
  /** Elip đặc; `pick` chọn màu theo điểm (để đổ bóng). */
  ellipse(cx: number, cy: number, rx: number, ry: number, hex: string | ((x: number, y: number) => string)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof hex === "string" ? hex : hex(x, y));
      }
    }
  }
  /** Mẫu ký tự: '#' = màu `hex`. */
  pattern(x: number, y: number, rows: string[], hex: string): void {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") this.set(x + i, y + j, hex); });
  }
  /** Viền 1px quanh mọi vùng đã tô (4 hướng). */
  outline(hex: string = base.ink): void {
    const edge: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!this.filled(x, y) && (this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1))) edge.push([x, y]);
    }
    for (const [x, y] of edge) this.set(x, y, hex);
  }
}

/** Ghép các frame thành một sheet ngang. */
export function buildSheet(name: string, w: number, h: number, frames: Painter[], tags: SpriteSheet["tags"], origin: SpriteSheet["origin"]): SpriteSheet {
  const { canvas, ctx } = makeCanvas(w * frames.length, h);
  frames.forEach((p, i) => ctx.putImageData(new ImageData(new Uint8ClampedArray(p.data), w, h), i * w, 0));
  return { name, w, h, image: canvas, frames: frames.map((_, i) => ({ x: i * w, y: 0, w, h })), tags, origin };
}

export type ChibiSpec = {
  hair: string; hairShade: string; outfit: string; outfit2: string; pants: string;
  hat?: "chef" | "none";
};

type Tag = (typeof ACTOR_TAGS)[number];
const QUESTION = ["##.", "..#", ".#.", "...", ".#."];

function chibiFrame(s: ChibiSpec, tag: Tag, f: number): Painter {
  const p = new Painter(actorSize, actorSize);
  const b = tag === "idle" ? f : tag === "happy" ? -f : tag === "walk" ? f : 0; // nhún
  // đầu: sáng từ trên-trái, bóng ở dưới-phải
  p.ellipse(16, 13 + b, 8, 7, (x, y) => ((x - 16) / 8 + (y - 13 - b) / 7 > 0.85 ? base.skin2 : base.skin1));
  // tóc: chỏm, mái răng cưa, hai lọn bên
  for (let y = 5 + b; y <= 20 + b; y++) for (let x = 7; x <= 25; x++) {
    const dx = (x - 16) / 8.5, dy = (y - 13 - b) / 7.5;
    if (dx * dx + dy * dy > 1) continue;
    const fringe = y === 11 + b && x % 3 !== 0 && x > 9 && x < 23;
    const side = (x <= 9 || x >= 23) && y <= 16 + b;
    if (y <= 10 + b || fringe || side) p.set(x, y, y >= 10 + b && !fringe ? s.hairShade : s.hair);
  }
  if (s.hat === "chef") {
    p.ellipse(16, 4 + b, 6, 2, base.paper);
    p.rect(11, 6 + b, 11, 2, base.pale);
  }
  // mặt
  if (tag === "happy") {
    p.pattern(11, 13 + b, [".#.", "#.#"], base.ink);
    p.pattern(18, 13 + b, [".#.", "#.#"], base.ink);
    p.pattern(15, 17 + b, ["#.#", ".#."], base.ink);
  } else if (tag === "confused") {
    p.rect(11, 15 + b, 3, 1, base.ink);
    p.rect(19, 14 + b, 1, 2, base.ink);
    p.rect(15, 18 + b, 3, 1, base.ink);
    p.pattern(25, 2 - f, QUESTION, base.amber1);
  } else {
    p.rect(12, 14 + b, 1, 2, base.ink);
    p.rect(19, 14 + b, 1, 2, base.ink);
    p.rect(16, 18 + b, 1, 1, base.skin3);
  }
  p.rect(10, 17 + b, 2, 1, base.skin3);
  p.rect(21, 17 + b, 2, 1, base.skin3);
  // thân
  p.rect(11, 21 + b, 10, 6 - Math.max(0, b), s.outfit);
  p.rect(13, 22 + b, 6, 5 - Math.max(0, b), s.outfit2);
  // tay: lên hoặc xuống
  const arm = (side: -1 | 1, up: boolean) => {
    const x = side < 0 ? 9 : 21;
    const ux = side < 0 ? 8 : 22;
    if (up) { p.rect(ux, 18 + b, 2, 3, s.outfit); p.rect(ux, 17 + b, 2, 1, base.skin1); }
    else { p.rect(x, 21 + b, 2, 4, s.outfit); p.rect(x, 25 + b, 2, 1, base.skin1); }
  };
  const up: Record<Tag, [boolean, boolean]> = {
    idle: [false, false], walk: [false, false], work: f ? [false, true] : [true, false], happy: [true, true], confused: [false, true],
  };
  arm(-1, up[tag][0]);
  arm(1, up[tag][1]);
  // chân
  const legTop = 27 + Math.max(0, b);
  const leg = (x: number, lift: number) => {
    const h = 30 - legTop - lift;
    p.rect(x, legTop, 3, Math.max(1, h - 1), s.pants);
    p.rect(x, legTop + Math.max(1, h - 1), 3, 1, base.wood3);
  };
  if (tag === "walk") { leg(f ? 12 : 11, f ? 1 : 0); leg(f ? 18 : 17, f ? 0 : 1); }
  else { leg(12, 0); leg(17, 0); }
  p.outline();
  return p;
}

export function chibiSheet(name: string, s: ChibiSpec): SpriteSheet {
  const frames: Painter[] = [];
  const tags: SpriteSheet["tags"] = {};
  for (const t of ACTOR_TAGS) {
    tags[t] = { from: frames.length, to: frames.length + 1 };
    frames.push(chibiFrame(s, t, 0), chibiFrame(s, t, 1));
  }
  return buildSheet(name, actorSize, actorSize, frames, tags, "feet");
}

/** Đạo cụ 16×16, tag idle (mặc định 2 frame). `draw(p, f)` vẽ phần thân, viền ink thêm tự động.
 *  Muốn chuyển động chậm hơn spriteFps (ticket lắc) thì cho nhiều frame lặp lại cùng một tư thế. */
export function propSheet(name: string, draw: (p: Painter, f: number) => void, count = 2): SpriteSheet {
  const frames = Array.from({ length: count }, (_, f) => {
    const p = new Painter(propSize, propSize);
    draw(p, f);
    p.outline();
    return p;
  });
  return buildSheet(name, propSize, propSize, frames, { idle: { from: 0, to: count - 1 } }, "center");
}
