/* Học tiếp: vào từ laptop thì màn hình phóng ra kèm chớp sáng; vào từ sách thì rút sách, xoay bìa về phía người xem,
   lật bìa lộ trang sách rồi bài học phóng ra từ trang sách. Port nhánh learn của reveal(), pickHandoff(), pickConceal(), coverEl(), openBookEl(). */
import { EASE } from "../../anim";
import { asset, type ItemKey } from "../../config/scene";
import { bookColor, coverColor, SHELVES } from "../../config/shelves";
import { bookRect, q, qa, rect, wait, type FxCtx, type PageFx } from "./base";

/** Bài học tự Chạy thử sau khi hiện ra. */
const run = (ctx: FxCtx) => q(ctx, "#run")?.click();

/** Bìa sách cầm trên tay: ảnh bìa tô màu COVER(key) bằng 2 lớp blend (color, multiply), ghi số và tên bài. */
function coverEl(ctx: FxCtx, k: ItemKey, title: string, num: number) {
  const { L, held } = ctx.env;
  const h = Math.min(L.H * 0.58, 460), w = (h * 651) / 900;
  const d = document.createElement("div");
  d.className = "pcover";
  Object.assign(d.style, { left: L.W / 2 - w * 0.15 + "px", top: L.H * 0.48 - h / 2 + "px", width: w + "px", height: h + "px" });
  d.style.setProperty("--c", coverColor(k));
  const img = document.createElement("img");
  img.src = asset("items/page/book-cover.webp");
  img.alt = "";
  const t1 = document.createElement("i"), t2 = document.createElement("i");
  t1.className = "tint";
  t2.className = "tint m";
  const txt = document.createElement("div");
  txt.className = "txt";
  const n = document.createElement("span"), b = document.createElement("b"), s = document.createElement("span");
  n.className = "n";
  n.textContent = `Bài ${num}`;
  b.textContent = title;
  s.className = "s";
  s.textContent = SHELVES[ctx.opts.shelf ?? 0].name;
  txt.append(n, b, s);
  d.append(img, t1, t2, txt);
  held.appendChild(d);
  ctx.pick.extra.push(d);
  return d;
}

/** Hai trang sách mở, đặt sau bìa (bìa lật đi thì lộ ra). */
function openBookEl(ctx: FxCtx, cv: HTMLElement) {
  const c = cv.getBoundingClientRect();
  const h = c.height * 1.02, w = (h * 1300) / 940;
  const d = document.createElement("img");
  d.className = "pheld popen";
  d.src = asset("items/page/book-open.webp");
  d.alt = "";
  Object.assign(d.style, { left: c.left - w * 0.5 + "px", top: c.top + c.height / 2 - h / 2 + "px", width: w + "px", height: h + "px" });
  ctx.env.held.insertBefore(d, cv);
  ctx.pick.extra.push(d);
  return d;
}

const lessonTitle = (ctx: FxCtx) => {
  const S = SHELVES[ctx.opts.shelf ?? 0], i = ctx.opts.lesson ?? 3;
  return [S.lessons[i][0], i + 1] as const;
};

export const LEARN_FX: Partial<PageFx> = {
  reveal: async (ctx) => {
    const les = q(ctx, "#lesson");
    if (!les) return;
    const lr = les.getBoundingClientRect();
    if (ctx.opts.from === "book") {
      // gáy sách phóng thành khung bài học
      const k = `${SHELVES[ctx.opts.shelf ?? 0].key}${ctx.opts.lesson}` as ItemKey;
      const s = bookRect(ctx, k);
      const sp = document.createElement("div");
      sp.className = "spine";
      Object.assign(sp.style, { width: lr.width + "px", height: lr.height + "px", background: coverColor(k) });
      document.body.appendChild(sp);
      les.style.opacity = "0";
      await sp.animate(
        [
          { transform: `translate(${s.x}px,${s.y}px) scale(${s.w / lr.width},${s.h / lr.height})`, backgroundColor: bookColor(k) },
          { transform: `translate(${s.x}px,${s.y - 40}px) scale(${(s.w / lr.width) * 1.1},${s.h / lr.height})`, backgroundColor: bookColor(k), offset: 0.3 },
          { transform: `translate(${lr.left}px,${lr.top}px) scale(1,1)`, backgroundColor: "#121725", borderRadius: "18px" },
        ],
        { duration: 1050, easing: EASE, fill: "forwards" },
      ).finished;
      les.style.opacity = "";
      les.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      sp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => sp.remove());
    } else {
      // màn hình laptop phóng ra, chớp sáng
      const s = rect(ctx, [806, 1066, 1110, 1262]);
      qa(ctx, "#flash")?.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.35 }, { opacity: 0 }], { duration: 800, easing: "ease-out" });
      await les.animate(
        [
          { transform: `translate(${s.x - lr.left}px,${s.y - lr.top}px) scale(${s.w / lr.width},${s.h / lr.height})`, opacity: 0.3, filter: "brightness(2)" },
          { transform: "none", opacity: 1, filter: "brightness(1)" },
        ],
        { duration: 900, easing: EASE, fill: "backwards" },
      ).finished;
    }
    run(ctx);
  },

  handoff: async (ctx) => {
    const { pick, env } = ctx;
    const k = pick.k!;
    const [title, num] = lessonTitle(ctx);
    const cv = coverEl(ctx, k, title, num);
    const les = q(ctx, "#lesson")!;
    les.style.opacity = "0";
    await pick.flyInto(env, cv, "rotateY(80deg)", 900);
    pick.clone?.remove();
    pick.clone = null;
    await wait(260);
    const t = les.getBoundingClientRect();
    const ob = openBookEl(ctx, cv);
    ob.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: "both" });
    cv.style.transformOrigin = "0 50%";
    await cv.animate(
      [
        { transform: "perspective(1600px) rotateY(0)" },
        { transform: "perspective(1600px) rotateY(-150deg)", opacity: 1, offset: 0.8 },
        { transform: "perspective(1600px) rotateY(-178deg)", opacity: 0 },
      ],
      { duration: 900, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" },
    ).finished;
    cv.remove();
    await wait(180);
    const o = ob.getBoundingClientRect();
    les.style.opacity = "";
    les.animate(
      [
        { transform: `translate(${o.left - t.left}px,${o.top - t.top}px) scale(${o.width / t.width},${o.height / t.height})`, opacity: 0, transformOrigin: "0 0" },
        { opacity: 1, offset: 0.5 },
        { transform: "none", opacity: 1, transformOrigin: "0 0" },
      ],
      { duration: 780, easing: EASE, fill: "backwards" },
    );
    await ob.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.15)" }], { duration: 620, easing: EASE, fill: "forwards" }).finished;
    run(ctx);
  },

  pickConceal: async (ctx) => {
    const { pick, env } = ctx;
    const [title, num] = lessonTitle(ctx);
    const cv = coverEl(ctx, pick.k!, title, num);
    const les = q(ctx, "#lesson")!;
    const t = les.getBoundingClientRect();
    cv.style.opacity = "0";
    const ob = openBookEl(ctx, cv);
    const o = ob.getBoundingClientRect();
    ob.animate([{ opacity: 0, transform: "scale(1.15)" }, { opacity: 1, transform: "none" }], { duration: 560, easing: EASE, fill: "both" });
    await les.animate(
      [
        { transform: "none", opacity: 1, transformOrigin: "0 0" },
        { transform: `translate(${o.left - t.left}px,${o.top - t.top}px) scale(${o.width / t.width},${o.height / t.height})`, opacity: 0, transformOrigin: "0 0" },
      ],
      { duration: 560, easing: EASE, fill: "forwards" },
    ).finished;
    cv.style.opacity = "";
    cv.style.transformOrigin = "0 50%";
    ob.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 700, fill: "forwards" });
    await cv.animate(
      [
        { transform: "perspective(1600px) rotateY(-170deg)", opacity: 0 },
        { transform: "perspective(1600px) rotateY(-150deg)", opacity: 1, offset: 0.25 },
        { transform: "perspective(1600px) rotateY(0)", opacity: 1 },
      ],
      { duration: 700, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" },
    ).finished;
    cv.style.transformOrigin = "50% 50%";
    await pick.flyBack(env, cv, "rotateY(80deg)");
  },

  rm: run,
};
