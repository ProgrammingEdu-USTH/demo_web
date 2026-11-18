/* Khóa học: gáy sách trong phòng bay ra đúng chỗ trên kệ của trang (bookRect từ vùng bấm), đổi từ màu gáy sang màu bìa;
   quay lại thì sách bay về kệ trong phòng. Port nhánh courses của reveal() và conceal(). */
import { EASE } from "../../anim";
import type { ItemKey } from "../../config/scene";
import { bookColor, coverColor } from "../../config/shelves";
import { anim, bookRect, type PageFx } from "./base";

export const COURSES_FX: Partial<PageFx> = {
  reveal: async (ctx) => {
    const { sa } = ctx;
    const books = [...sa.querySelectorAll<HTMLElement>(".bk[data-k]")];
    sa.querySelectorAll(".course:not(.room-course)").forEach((c, i) =>
      c.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 1100 + i * 120, easing: EASE, fill: "backwards" }),
    );
    sa.querySelectorAll(".room-course .meta").forEach((m, i) => m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 500 + i * 200, fill: "backwards" }));
    await Promise.all(
      books.map((b, j) => {
        const k = b.dataset.k as ItemKey, i = j * 0.55;
        const s = bookRect(ctx, k), br = b.getBoundingClientRect();
        const kx = s.w / br.width, ky = s.h / br.height, dx = s.x - br.left, dy = s.y - br.top;
        [...b.children].forEach((ch) => ch.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: 1100, delay: i * 70, fill: "backwards" }));
        return b.animate(
          [
            { transform: `translate(${dx}px,${dy}px) scale(${kx},${ky})`, backgroundColor: bookColor(k), offset: 0 },
            { transform: `translate(${dx}px,${dy - 28}px) scale(${kx},${ky})`, backgroundColor: bookColor(k), offset: 0.24 },
            { transform: "none", backgroundColor: coverColor(k), offset: 1 },
          ],
          { duration: 1100, delay: i * 70, easing: EASE, fill: "backwards" },
        ).finished;
      }),
    );
  },

  conceal: async (ctx) => {
    const { sa } = ctx;
    const books = [...sa.querySelectorAll<HTMLElement>(".bk[data-k]")];
    sa.querySelectorAll(".pghead,.course:not(.room-course),.room-course .meta").forEach((h) => anim(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }));
    await Promise.all(
      books.map((b, i) => {
        const k = b.dataset.k as ItemKey;
        const s = bookRect(ctx, k), br = b.getBoundingClientRect();
        [...b.children].forEach((c) => ((c as HTMLElement).style.opacity = "0"));
        return b.animate(
          [
            { transform: "none", backgroundColor: coverColor(k) },
            { transform: `translate(${s.x - br.left}px,${s.y - br.top}px) scale(${s.w / br.width},${s.h / br.height})`, backgroundColor: bookColor(k), opacity: 0.9 },
          ],
          { duration: 750, delay: (books.length - 1 - i) * 22, easing: "cubic-bezier(.6,0,.3,1)", fill: "forwards" },
        ).finished;
      }),
    );
    await anim(sa, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  },
};
