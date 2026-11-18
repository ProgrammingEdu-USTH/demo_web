/* Thành tựu: cúp/huy chương cầm lên chuyển sang ảnh nét (items/held/*), xoay nghiêng bắt sáng rồi bay lên mờ đi;
   kệ huy hiệu hiện ra, vệt sáng quét qua làm huy hiệu đã đạt bừng sáng. Port nhánh achievements của reveal(), pickHandoff(), pickConceal(). */
import { EASE } from "../../anim";
import { asset } from "../../config/scene";
import { HELD_IMG } from "../../config/objects";
import { anim, q, type FxCtx, type PageFx } from "./base";

const SWEEP_MS = 1300;

/** Kệ huy hiệu hiện ra, vệt sáng quét từ trái sang, huy hiệu đã đạt bừng sáng lúc vệt sáng đi qua. */
async function shelfAndSweep(ctx: FxCtx, dur: number) {
  const tr = q(ctx, "#trophy");
  if (!tr) return;
  tr.style.opacity = "";
  await anim(tr, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: dur });
  const tw = tr.getBoundingClientRect();
  // vệt sáng đi từ left -30% tới 110% khối chứa; animate `translate` thay vì left như prototype (khỏi tính lại layout).
  // Không dùng transform: .sweep có rotate:12deg, mà transform áp sau rotate nên vệt sẽ đi xiên 12° thay vì ngang.
  const sweep = q(ctx, "#sweep");
  const cb = sweep?.offsetParent as HTMLElement | null | undefined;
  sweep?.animate([{ translate: "0px 0px" }, { translate: `${(cb?.clientWidth ?? tw.width) * 1.4}px 0px` }], {
    duration: SWEEP_MS,
    easing: "ease-in-out",
    fill: "forwards",
  });
  ctx.sa.querySelectorAll<HTMLElement>(".bdg:not(.soon) .med").forEach((m) => {
    const x = (m.getBoundingClientRect().left - tw.left) / tw.width;
    m.animate(
      [{ filter: "brightness(.32) saturate(.3)" }, { filter: "brightness(1.5) saturate(1.1)", offset: 0.4 }, { filter: "brightness(1) saturate(1)" }],
      { duration: 700, delay: SWEEP_MS * (0.12 + x * 0.78), fill: "forwards", easing: "ease-out" },
    );
  });
}

const heldHeight = (ctx: FxCtx) => Math.min(ctx.env.L.H * 0.5, 400);

export const ACHIEVEMENTS_FX: Partial<PageFx> = {
  reveal: (ctx) => shelfAndSweep(ctx, 600),

  handoff: async (ctx) => {
    const { pick, env, sa } = ctx;
    const k = pick.k!;
    const im = pick.heldImg(env, k, heldHeight(ctx));
    sa.querySelectorAll<HTMLElement>(".pghead,#trophy").forEach((e) => (e.style.opacity = "0"));
    await pick.flyInto(env, im, "", 900);
    sa.querySelectorAll<HTMLElement>(".pghead").forEach((e) => {
      e.style.opacity = "";
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    });
    pick.clone?.remove();
    pick.clone = null;
    // xoay nghiêng bắt sáng (lớp .shiny lấy chính ảnh làm mask)
    im.style.setProperty("--m", `url(${asset(`items/held/${HELD_IMG[k]}.webp`)})`);
    im.classList.add("shiny");
    await im.animate(
      [
        { transform: "perspective(900px) rotateY(0)" },
        { transform: "perspective(900px) rotateY(22deg)", offset: 0.3 },
        { transform: "perspective(900px) rotateY(-16deg)", offset: 0.65 },
        { transform: "perspective(900px) rotateY(0)" },
      ],
      { duration: 1300, easing: "ease-in-out" },
    ).finished;
    im.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-30px) scale(.55)", opacity: 0 }], { duration: 520, easing: EASE, fill: "forwards" });
    await shelfAndSweep(ctx, 500);
  },

  pickConceal: async (ctx) => {
    const { pick, env, sa } = ctx;
    anim(sa, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    const im = pick.heldImg(env, pick.k!, heldHeight(ctx));
    await im.animate([{ transform: "translateY(-30px) scale(.55)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, easing: EASE, fill: "forwards" }).finished;
    await pick.flyBack(env, im, "");
  },
};
