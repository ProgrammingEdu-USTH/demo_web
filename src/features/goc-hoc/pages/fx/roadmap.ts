/* Lộ trình: nền bảng ghim phóng ra từ bảng ghim trong phòng, tờ bản đồ thả xuống ghim 2 đinh đỏ,
   đường nét đứt tự vẽ, chỉ đỏ nối các chặng đã qua, các chặng hiện lần lượt, ghi chú "Chặng 7" dán lên. Port nhánh roadmap của reveal(). */
import { EASE } from "../../anim";
import { q, rect, stagger, type PageFx } from "./base";

export const ROADMAP_FX: Partial<PageFx> = {
  reveal: async (ctx) => {
    const board = q(ctx, "#board"), paper = q(ctx, "#paper");
    if (!board || !paper) return;
    const s = rect(ctx, [456, 354, 721, 1057]);
    const br = board.getBoundingClientRect();
    paper.style.opacity = "0";
    await board.animate(
      [
        { transform: `translate(${s.x - br.left}px,${s.y - br.top}px) scale(${s.w / br.width},${s.h / br.height}) perspective(900px) rotateY(-24deg)`, transformOrigin: "0 0", opacity: 0.7 },
        { transform: "none", transformOrigin: "0 0", opacity: 1 },
      ],
      { duration: 900, easing: EASE, fill: "backwards" },
    ).finished;
    paper.style.opacity = "";
    await paper.animate(
      [
        { transform: "translateY(-40px) rotate(-5deg) scale(1.06)", opacity: 0 },
        { transform: "rotate(-.8deg)", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" },
    ).finished;
    const path = q(ctx, "#rpath") as unknown as SVGPathElement | null;
    const str = q(ctx, "#rstr") as unknown as SVGPathElement | null;
    if (path && str) {
      const L1 = path.getTotalLength(), L2 = str.getTotalLength();
      // đường nét đứt "tự vẽ": phủ một nét màu giấy lên rồi rút dần đi
      const mask = path.cloneNode() as SVGPathElement;
      mask.removeAttribute("id");
      mask.setAttribute("style", `stroke:var(--paper);stroke-width:8;stroke-dasharray:${L1};stroke-dashoffset:0`);
      path.after(mask);
      mask.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -L1 }], { duration: 1300, easing: "ease-in-out", fill: "forwards" });
      str.style.strokeDasharray = String(L2);
      str.animate([{ strokeDashoffset: L2 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 450, easing: "ease-in-out", fill: "both" });
    }
    stagger(ctx.sa.querySelectorAll(".node"), [{ opacity: 0, transform: "scale(1.8) translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 500 }, 120, 150);
    q(ctx, "#note")?.animate([{ opacity: 0, transform: "translateY(20px) rotate(6deg)" }, { opacity: 1, transform: "none" }], {
      duration: 700,
      delay: 1300,
      easing: EASE,
      fill: "backwards",
    });
  },
};
