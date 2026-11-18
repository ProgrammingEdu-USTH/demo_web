/* Kiểu, tiện ích và hiệu ứng mặc định cho hiệu ứng hiện/ẩn của trang con. Engine (useSceneController) gọi qua fxFor(). */
import { EASE } from "../../anim";
import { HITS, type Box, type ItemKey } from "../../config/scene";
import { rectS, type ScreenRect } from "../../scene/layout";
import type { GoOpts } from "../../targets";
import type { PickEnv, PickState } from "../../transitions/pick";
import type { Route } from "../../types";

export interface FxCtx {
  route: Route;
  opts: GoOpts;
  /** #page */
  page: HTMLElement;
  /** .stagearea đang hiện */
  sa: HTMLElement;
  env: PickEnv;
  pick: PickState;
  /** khung FOCUS của trang theo camera hiện tại (px màn hình) */
  focus: ScreenRect;
}

export interface PageFx {
  /** ZOOM (và đổi tab): nội dung hiện ra từ vùng đồ vật — nhánh theo trang trong reveal() */
  reveal(ctx: FxCtx): Promise<void>;
  /** ZOOM: nội dung thu về đồ vật trước khi camera lùi ra — conceal() */
  conceal(ctx: FxCtx): Promise<void>;
  /** PICK: bản nhân đồ vật bay vào trang (pickHandoff) và phần hiện tiếp theo trong reveal() */
  handoff(ctx: FxCtx): Promise<void>;
  /** PICK: trang thu về thành đồ vật, đồ vật bay về chỗ cũ — pickConceal() */
  pickConceal(ctx: FxCtx): Promise<void>;
  /** Giảm chuyển động: sau khi nội dung hiện (vd. bài học tự Chạy thử) */
  rm?(ctx: FxCtx): void;
}

/* ---------- tiện ích ---------- */

/** Animation giữ trạng thái cuối, easing chung (anim() của prototype). */
export const anim = (el: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions) =>
  el ? el.animate(k, { fill: "forwards", easing: EASE, ...o }).finished.then(() => undefined) : Promise.resolve();

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Phần tử trong trang con. */
export const q = <T extends HTMLElement = HTMLElement>(ctx: FxCtx, sel: string) => ctx.page.querySelector<T>(sel);
/** Phần tử trong #app (vd. #flash). */
export const qa = <T extends HTMLElement = HTMLElement>(ctx: FxCtx, sel: string) => ctx.env.app.querySelector<T>(sel);

/** Hộp room-space → px màn hình theo camera hiện tại. */
export const rect = (ctx: FxCtx, box: Box) => rectS(ctx.env.L, box, ctx.env.cam);

/** Khung màn hình của một cuốn sách trong phòng, theo vùng bấm của nó (bookRect). */
export function bookRect(ctx: FxCtx, k: ItemKey) {
  const ps = HITS[k].flat();
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return rect(ctx, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
}

/** Các phần tử hiện lần lượt (mỗi cái trễ hơn step ms). */
export function stagger(els: Iterable<Element>, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }, step: number, delay0 = 0) {
  [...els].forEach((el, i) => el.animate(k, { easing: EASE, fill: "backwards", ...o, delay: delay0 + i * step }));
}

/* ---------- mặc định ---------- */

/** Dịch từ tâm nội dung tới tâm vùng đồ vật. */
const toFocus = (ctx: FxCtx) => {
  const box = ctx.sa.getBoundingClientRect();
  return `translate(${ctx.focus.cx - box.left - box.width / 2}px,${ctx.focus.cy - box.top - box.height / 2}px) scale(.25)`;
};

/** Phần tử trang mà đồ vật nhấc lên sẽ bay vào: [data-pick-target], không có thì cả nội dung. */
const pickTarget = (ctx: FxCtx) => ctx.sa.querySelector<HTMLElement>("[data-pick-target]") ?? ctx.sa;

export const DEFAULT_FX: PageFx = {
  reveal: (ctx) => anim(ctx.sa, [{ opacity: 0, transform: toFocus(ctx) }, { opacity: 1, transform: "none" }], { duration: 600 }),
  // nhánh chung của conceal() trong prototype
  conceal: (ctx) =>
    anim(ctx.sa, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: toFocus(ctx) }], { duration: 520, easing: "cubic-bezier(.6,0,.4,1)" }),
  handoff: async (ctx) => {
    await ctx.pick.flyInto(ctx.env, pickTarget(ctx), "");
    ctx.pick.clone?.remove();
    ctx.pick.clone = null;
  },
  pickConceal: (ctx) => ctx.pick.flyBack(ctx.env, pickTarget(ctx), ""),
};
