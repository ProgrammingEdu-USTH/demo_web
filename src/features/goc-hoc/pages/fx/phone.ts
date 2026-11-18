/* Điện thoại: máy cầm lên bay vào giữa màn hình (PICK) hoặc xoay ra từ chỗ trên bàn (ZOOM), nội dung hiện lần lượt.
   Port nhánh phone của reveal(), pickHandoff(), pickConceal(). */
import { EASE } from "../../anim";
import { q, rect, stagger, type FxCtx, type PageFx } from "./base";

const ROT = "rotateX(55deg) rotateZ(-28deg)";

const listIn = (ctx: FxCtx) =>
  stagger(
    ctx.sa.querySelectorAll(".pv:not([hidden]) .lb li, .pv:not([hidden]) .me, .pv:not([hidden]) .prof > *"),
    [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
    { duration: 450, easing: EASE },
    55,
  );

export const PHONE_FX: Partial<PageFx> = {
  reveal: async (ctx) => {
    const ph = q(ctx, "#phone");
    if (!ph) return;
    const s = rect(ctx, [1683, 1298, 1845, 1386]);
    const pr = ph.getBoundingClientRect();
    const k = (Math.hypot(s.w, s.h) * 0.62) / pr.height;
    await ph.animate(
      [
        { transform: `translate(${s.cx - (pr.left + pr.width / 2)}px,${s.cy - (pr.top + pr.height / 2)}px) rotate(-60deg) scale(${k})`, opacity: 0.6 },
        { transform: "translateY(-10px) rotate(4deg)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 1050, easing: EASE, fill: "backwards" },
    ).finished;
    listIn(ctx);
  },
  handoff: async (ctx) => {
    await ctx.pick.flyInto(ctx.env, q(ctx, "#phone")!, ROT);
    ctx.pick.clone?.remove();
    ctx.pick.clone = null;
    listIn(ctx);
  },
  pickConceal: async (ctx) => {
    ctx.sa.querySelectorAll<HTMLElement>(".pghead").forEach((h) => (h.style.opacity = "0"));
    await ctx.pick.flyBack(ctx.env, q(ctx, "#phone"), ROT);
  },
};
