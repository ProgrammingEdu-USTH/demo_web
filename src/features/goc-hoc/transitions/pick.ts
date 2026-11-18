/* PICK: nhấc đồ vật lên, bay về phía người xem rồi biến thành phần tử của trang; quay lại thì bay về chỗ cũ.
   Port itemRect, makeClone, hideItem, pickStart, flyInto, flyBack, pickEnd, heldImg, LIFT của prototype. */
import { asset, isBookKey, ITEMS, type ItemKey } from "../config/scene";
import { HELD_IMG } from "../config/objects";
import { CAM_REST, rectS, type Cam, type RoomLayout, type ScreenRect } from "../scene/layout";
import { EASE } from "../anim";

export interface PickEnv {
  app: HTMLElement;
  held: HTMLElement;
  L: RoomLayout;
  cam: Cam;
  rm: boolean;
}

/** Khung màn hình của đồ vật k với camera c. */
export function itemRect(env: PickEnv, k: ItemKey, c: Cam = env.cam): ScreenRect {
  const [x, y, w, h] = ITEMS[k];
  return rectS(env.L, [x, y, x + w, y + h], c);
}

/** Độ nhấc: sách rút lên 42% chiều cao và nghiêng, đồ khác nâng 14px. */
export function LIFT(env: PickEnv, k: ItemKey): string {
  return isBookKey(k) ? `translateY(${-Math.round(itemRect(env, k).h * 0.42)}px) rotate(-3deg)` : "translateY(-14px) scale(1.05)";
}

/** Trạng thái đồ vật đang cầm (PK). */
export class PickState {
  k: ItemKey | null = null;
  clone: HTMLElement | null = null;
  extra: HTMLElement[] = [];

  makeClone(env: PickEnv, k: ItemKey, c: Cam = env.cam): HTMLElement {
    const r = itemRect(env, k, c);
    const d = document.createElement("div");
    d.className = "pclone";
    Object.assign(d.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
    const img = document.createElement("img");
    img.src = asset(`items/${k}.webp`);
    img.alt = "";
    d.appendChild(img);
    env.held.appendChild(d);
    return d;
  }

  hideItem(env: PickEnv, k: ItemKey, on: boolean) {
    env.app.querySelectorAll<HTMLElement>(`.item[data-k="${k}"], .glowi[data-k="${k}"]`).forEach((e) => (e.style.visibility = on ? "hidden" : ""));
  }

  /** Nhân bản đồ vật sang #held, ẩn bản gốc, nhấc lên. */
  start(env: PickEnv, k: ItemKey): Promise<void> {
    this.k = k;
    this.clone = this.makeClone(env, k);
    this.hideItem(env, k, true);
    if (env.rm) return Promise.resolve();
    return this.clone
      .animate(
        [
          { transform: "none", filter: "drop-shadow(0 0 0 rgba(0,0,0,0))" },
          { transform: LIFT(env, k), filter: "drop-shadow(0 18px 14px rgba(10,5,20,.45))" },
        ],
        { duration: isBookKey(k) ? 520 : 320, easing: EASE, fill: "forwards" },
      )
      .finished.then(() => undefined);
  }

  /** Bản nhân bay tới target; target lớn lên từ chính chỗ đó (crossfade 22% → 60% thời lượng). */
  async flyInto(env: PickEnv, target: HTMLElement, rot: string, dur = 950) {
    const cl = this.clone;
    if (!cl || !this.k) return;
    const s = cl.getBoundingClientRect(), t = target.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (s.left + s.width / 2), dy = t.top + t.height / 2 - (s.top + s.height / 2);
    const sc = Math.min(t.width / s.width, t.height / s.height);
    const lift = LIFT(env, this.k);
    const prevO = target.style.transformOrigin;
    target.style.transformOrigin = "50% 50%";
    const a1 = cl.animate(
      [
        { transform: lift, opacity: 1 },
        { opacity: 1, offset: 0.28 },
        { transform: `translate(${dx}px,${dy}px) ${lift} scale(${sc * 0.85})`, opacity: 0, offset: 0.6 },
        { transform: `translate(${dx}px,${dy}px) ${lift} scale(${sc})`, opacity: 0 },
      ],
      { duration: dur, easing: EASE, fill: "forwards" },
    );
    const a2 = target.animate(
      [
        { transform: `translate(${-dx}px,${-dy}px) scale(${1 / sc}) ${rot}`, opacity: 0 },
        { opacity: 0, offset: 0.22 },
        { opacity: 1, offset: 0.55 },
        { transform: "none", opacity: 1 },
      ],
      { duration: dur, easing: EASE, fill: "backwards" },
    );
    await Promise.all([a1.finished, a2.finished]);
    target.style.transformOrigin = prevO;
  }

  /** Phần tử trang thu nhỏ về đồ vật; đồ vật đáp về đúng chỗ, nảy nhẹ. target null: bay từ giữa màn hình. */
  async flyBack(env: PickEnv, target: HTMLElement | null, rot: string, dur = 800) {
    const k = this.k;
    if (!k) return;
    const home = itemRect(env, k, CAM_REST);
    const cl = this.makeClone(env, k, CAM_REST);
    this.clone?.remove();
    this.clone = cl;
    const t = target
      ? target.getBoundingClientRect()
      : { left: env.L.W / 2 - home.w, top: env.L.H / 2 - home.h, width: home.w * 2, height: home.h * 2 };
    const dx = t.left + t.width / 2 - (home.x + home.w / 2), dy = t.top + t.height / 2 - (home.y + home.h / 2);
    const sc = Math.min(t.width / home.w, t.height / home.h);
    const lift = LIFT(env, k);
    if (target) {
      target.style.transformOrigin = "50% 50%";
      target.animate(
        [{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.35 }, { transform: `translate(${-dx}px,${-dy}px) scale(${1 / sc}) ${rot}`, opacity: 0 }],
        { duration: dur, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" },
      );
    }
    await cl.animate(
      [
        { transform: `translate(${dx}px,${dy}px) ${lift} scale(${sc})`, opacity: 0 },
        { opacity: 0, offset: 0.35 },
        { opacity: 1, offset: 0.6 },
        { transform: lift, opacity: 1, offset: 0.82 },
        { transform: "none", opacity: 1 },
      ],
      { duration: dur + 380, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" },
    ).finished;
  }

  /** Ảnh đồ vật cầm trên tay (items/held/*), đặt giữa màn hình, cao h px. */
  heldImg(env: PickEnv, k: ItemKey, h: number): HTMLImageElement {
    const name = HELD_IMG[k]!;
    const [nw, nh] = HELD_SIZE[name];
    const im = document.createElement("img");
    im.className = "pheld";
    im.src = asset(`items/held/${name}.webp`);
    im.alt = "";
    const w = (h * nw) / nh;
    Object.assign(im.style, { left: env.L.W / 2 - w / 2 + "px", top: env.L.H * 0.47 - h / 2 + "px", width: w + "px", height: h + "px" });
    env.held.appendChild(im);
    this.extra.push(im);
    return im;
  }

  /** Thả đồ vật: hiện lại bản gốc, dọn #held. */
  end(env: PickEnv) {
    if (this.k) this.hideItem(env, this.k, false);
    this.clone?.remove();
    this.extra.forEach((e) => e.remove());
    this.clone = null;
    this.extra = [];
    this.k = null;
  }
}

/** Kích thước gốc của ảnh items/held/* (để giữ tỉ lệ). */
const HELD_SIZE: Record<string, readonly [number, number]> = {
  mug: [700, 720],
  cupTop: [607, 720],
  cupLow: [547, 720],
  medalTop: [438, 720],
  medalHang: [333, 720],
};
