/* Luyện tập: cuốn sổ mở ra (ZOOM: phóng từ cuốn sổ trên bàn; PICK: cuốn sổ cầm lên bay vào), trang phải lật sang,
   chữ viết tay hiện lần lượt. Port nhánh practice của reveal(), pickHandoff(), pickConceal(). */
import { EASE } from "../../anim";
import { anim, q, rect, stagger, type FxCtx, type PageFx } from "./base";

const ROT = "rotateX(60deg) rotateZ(-3deg)";

/** Lật trang phải (nửa phải ảnh sổ) rồi cho các dòng viết tay hiện ra. */
async function flipAndWrite(ctx: FxCtx) {
  const flip = q(ctx, "#flip");
  if (flip) {
    await flip.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], { duration: 900, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" }).finished;
    flip.style.display = "none";
  }
  stagger(ctx.sa.querySelectorAll(".leafp .hw li, .plist li"), [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE }, 60);
}

export const PRACTICE_FX: Partial<PageFx> = {
  reveal: async (ctx) => {
    const sp = q(ctx, "#spread");
    if (!sp) return;
    const s = rect(ctx, [1280, 1265, 1625, 1385]);
    const rr = sp.getBoundingClientRect();
    await sp.animate(
      [
        { transform: `translate(${s.x - rr.left}px,${s.y - rr.top}px) scale(${s.w / rr.width},${s.h / rr.height})`, opacity: 0.5 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 900, easing: EASE, fill: "backwards" },
    ).finished;
    await flipAndWrite(ctx);
  },
  handoff: async (ctx) => {
    await ctx.pick.flyInto(ctx.env, q(ctx, "#spread")!, ROT);
    ctx.pick.clone?.remove();
    ctx.pick.clone = null;
    await flipAndWrite(ctx);
  },
  pickConceal: async (ctx) => {
    ctx.sa.querySelectorAll(".pghead").forEach((h) => anim(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }));
    await ctx.pick.flyBack(ctx.env, q(ctx, "#spread"), ROT);
  },
};
