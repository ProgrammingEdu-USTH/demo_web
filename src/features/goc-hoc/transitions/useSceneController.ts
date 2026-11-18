/* Engine chuyển cảnh: port go(), back(), sibling(), reveal(), conceal(), uiOut()/uiIn(), setHole(), cùng lịch (peekCal/unpeek/bigCal)
   và cốc cà phê (sipMug) của prototype.
   Mọi yêu cầu điều hướng (bấm, Esc, nút back trình duyệt) chỉ đặt "đích mong muốn"; drive() chạy từng chuyển cảnh
   cho tới khi trang đang hiện khớp đích. Yêu cầu đến giữa lúc chuyển cảnh được làm sau, nên không bao giờ kẹt state. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { EASE } from "../anim";
import { FOCUS, ROUTES, type FocusKey } from "../config/objects";
import { SHELVES } from "../config/shelves";
import { fxFor, type FxCtx } from "../pages/fx";
import type { PageState } from "../pages/PageView";
import { asset, CALENDAR } from "../config/scene";
import { calSvgMarkup, monthCells } from "../scene/calendar";
import { CAM_REST, camTransform, rectS, type Cam, type RoomLayout } from "../scene/layout";
import type { GoOpts } from "../targets";
import type { Route } from "../types";
import { focusCam, tweenCam } from "./camera";
import { PickState, itemRect, type PickEnv } from "./pick";
import { currentEntryIsOurs, destToQuery, parseLocation, pushDest, replaceDest, sameDest, type Dest } from "./url";

interface Deps {
  appRef: RefObject<HTMLElement | null>;
  layout: RoomLayout | null;
  rm: boolean;
  /** Rời phòng: đóng bảng tuỳ chỉnh, bỏ hover, đóng popover ghi chú */
  onLeaveRoom: () => void;
  /** Esc khi đang ở phòng (không có trang con): đóng lịch/popover */
  onEscInRoom: () => void;
  /** Esc trong màn mở đầu: bỏ qua */
  onEscIntro: () => void;
  toast: (text: string) => void;
  /** Số ngày chuỗi học (vẽ trên tờ lịch phóng to) */
  streak: number;
}

/** #calPop khi xem lịch: vị trí cạnh tờ lịch phóng to */
export interface CalPopState {
  left: number;
  top: number;
}

const FLAME = '<svg viewBox="0 0 24 24"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-6 1-8.5z"/></svg>';

const anim = (el: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions) =>
  el ? el.animate(k, { fill: "forwards", easing: EASE, ...o }).finished.then(() => undefined) : Promise.resolve();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Khung FOCUS của trang: vào bài học từ sách thì zoom vào kệ của sách đó. */
const focusKey = (r: Route, o: GoOpts): FocusKey => (r === "learn" && o.from === "book" ? SHELVES[o.shelf ?? 0].focus : r);

export function useSceneController({ appRef, layout, rm, onLeaveRoom, onEscInRoom, onEscIntro, toast, streak }: Deps) {
  /* ---------- state cho render ---------- */
  const [route, setRoute] = useState<Route | null>(null);
  const [opts, setOptsState] = useState<GoOpts>({});
  const [busy, setBusyState] = useState(false);
  const [peeking, setPeekingState] = useState(false);
  const [sipping, setSipping] = useState(false);
  const [page, setPage] = useState<PageState | null>(null);
  const [calPop, setCalPop] = useState<CalPopState | null>(null);

  /* ---------- state cho engine (đọc đồng bộ giữa các bước async) ---------- */
  const R = useRef({ route: null as Route | null, opts: {} as GoOpts, busy: false, peeking: false, intro: false });
  const cam = useRef<Cam>(CAM_REST);
  const focusCur = useRef<FocusKey | null>(null);
  const pick = useRef(new PickState());
  const desired = useRef<Dest | null>(null);
  const driving = useRef(false);
  const L = useRef(layout);
  const rmRef = useRef(rm);
  const cbs = useRef({ onLeaveRoom, onEscInRoom, onEscIntro, toast, streak });
  useEffect(() => {
    L.current = layout;
    rmRef.current = rm;
    cbs.current = { onLeaveRoom, onEscInRoom, onEscIntro, toast, streak };
  });
  const setPeeking = (v: boolean) => {
    R.current.peeking = v;
    setPeekingState(v);
  };

  const setBusy = (v: boolean) => {
    R.current.busy = v;
    setBusyState(v);
  };
  const setRouteBoth = (r: Route | null, o: GoOpts) => {
    R.current.route = r;
    R.current.opts = o;
    setRoute(r);
    setOptsState(o);
  };

  /* ---------- dựng trang và chờ React commit xong mới animate ---------- */
  const waiters = useRef<(() => void)[]>([]);
  const seq = useRef(0);
  useLayoutEffect(() => {
    waiters.current.splice(0).forEach((f) => f());
  }, [page, calPop]);
  const commitPage = (p: Omit<PageState, "seq"> | null) =>
    new Promise<void>((res) => {
      waiters.current.push(res);
      setPage(p ? { ...p, seq: ++seq.current } : null);
    });

  const commitCalPop = (p: CalPopState | null) =>
    new Promise<void>((res) => {
      waiters.current.push(res);
      setCalPop(p);
    });

  /* ---------- DOM ---------- */
  const $ = (sel: string) => appRef.current?.querySelector<HTMLElement>(sel) ?? null;
  const applyCam = (c: Cam) => {
    cam.current = c;
    const el = $("#cam");
    if (el) el.style.transform = camTransform(c);
  };
  const env = (): PickEnv => ({ app: appRef.current!, held: $("#held")!, L: L.current!, cam: cam.current, rm: rmRef.current });
  const tween = (to: Cam, dur: number) => tweenCam(cam.current, to, rmRef.current ? 0 : dur, L.current!.W, L.current!.H, applyCam);
  const focusOf = (fk: FocusKey) => focusCam(L.current!, FOCUS[fk], fk === "learn");

  /** Vùng mờ quanh đồ vật: khoét lỗ elip ở khung FOCUS trên lớp room-blur. */
  const setHole = (fk: FocusKey) => {
    const f = FOCUS[fk];
    const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2, rx = (f[2] - f[0]) * 0.9 + 60, ry = (f[3] - f[1]) * 0.9 + 60;
    const m = `radial-gradient(${rx}px ${ry}px at ${cx}px ${cy}px, transparent 55%, #000 100%)`;
    const hole = $("#blurHole");
    if (hole) {
      hole.style.webkitMaskImage = m;
      hole.style.maskImage = m;
    }
  };

  const uiOut = () => {
    const d = rmRef.current ? 1 : 380;
    return Promise.all([
      anim($("#side"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(40px)" }], { duration: d }),
      anim($("#profile"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-16px)" }], { duration: d }),
      anim($("#hint"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px)" }], { duration: d }),
      anim($("#tags"), [{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.6 }),
    ]);
  };
  const uiIn = () => {
    const d = rmRef.current ? 1 : 700;
    const from = ["translateX(30px)", "translateY(-12px)", "translateY(12px)"];
    ["#side", "#profile", "#hint"].forEach((s, i) =>
      anim($(s), [{ opacity: 0, transform: from[i] }, { opacity: 1, transform: "none" }], { duration: d, delay: rmRef.current ? 0 : i * 90 }),
    );
    anim($("#tags"), [{ opacity: 0 }, { opacity: 1 }], { duration: d, delay: rmRef.current ? 0 : 300 });
  };

  const fxCtx = (r: Route): FxCtx => ({
    route: r,
    opts: R.current.opts,
    page: $("#page")!,
    sa: $("#page .stagearea")!,
    env: env(),
    pick: pick.current,
    focus: rectS(L.current!, FOCUS[focusCur.current ?? focusKey(r, R.current.opts)], cam.current),
  });

  /* ---------- reveal / conceal ---------- */
  const reveal = async (r: Route, fresh: boolean) => {
    await commitPage({ route: r, opts: R.current.opts, content: true });
    const RM = rmRef.current;
    const top = $("#topbar");
    if (fresh) anim(top, [{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "none" }], { duration: RM ? 1 : 600, delay: RM ? 0 : 250 });
    const sa = $("#page .stagearea");
    if (!sa) return;
    if (RM) {
      // giảm chuyển động: không có bản nhân bay vào trang, bỏ luôn cho khỏi đè lên trang
      pick.current.clone?.remove();
      pick.current.clone = null;
      await anim(sa, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      fxFor(r).rm?.(fxCtx(r));
      return;
    }
    const head = sa.querySelector(".pghead");
    if (head) anim(head, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 450 });
    const fx = fxFor(r);
    if (R.current.opts.pick && pick.current.clone) return fx.handoff(fxCtx(r));
    return fx.reveal(fxCtx(r));
  };

  const conceal = async (r: Route) => {
    const pg = $("#page");
    if (rmRef.current) {
      if (pg) pg.style.opacity = "0";
      await wait(120);
      if (pg) pg.style.opacity = "";
      return;
    }
    anim($("#topbar"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    await fxFor(r).conceal(fxCtx(r));
  };

  /** Vào phòng lại: hiện UI, mở lại hover/Tab. */
  const backToRoom = () => {
    setRouteBoth(null, {});
    focusCur.current = null;
    uiIn();
  };

  /* ---------- focus bàn phím ---------- */
  // rời phòng: nhớ chỗ đang focus (đồ vật / mục menu) để quay về thì trả lại
  const returnFocus = useRef<HTMLElement | null>(null);
  const rememberFocus = () => {
    const el = document.activeElement;
    returnFocus.current = el instanceof HTMLElement || el instanceof SVGElement ? (el as HTMLElement) : null;
  };
  // trang con hiện ra: focus vào nút "Góc học" để Tab đi tiếp trong trang
  const focusPage = () => $("#backBtn")?.focus({ preventScroll: true });

  /* ---------- go / back / sibling ---------- */
  const go = async (r: Route, o: GoOpts) => {
    const s = R.current;
    if (s.busy || s.route || s.peeking || s.intro || !L.current) return;
    setBusy(true);
    setRouteBoth(r, o);
    rememberFocus();
    cbs.current.onLeaveRoom();
    const room = $("#room");
    if (room) room.style.translate = "0px 0px";
    const RM = rmRef.current;
    if (o.pick) {
      const lift = pick.current.start(env(), o.pick);
      uiOut();
      focusCur.current = focusKey(r, o);
      const p = itemRect(env(), o.pick);
      const kk = 1.06;
      tween({ k: kk, tx: p.cx * (1 - kk), ty: p.cy * (1 - kk) }, 1100);
      anim($("#blurFull"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 700 });
      anim($("#scrim"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 700 });
      await lift;
      await reveal(r, true);
      focusPage();
      setBusy(false);
      return;
    }
    const fk = focusKey(r, o);
    setHole(fk);
    await uiOut();
    focusCur.current = fk;
    const p1 = tween(focusOf(fk), 1000);
    anim($("#blurHole"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 900 });
    await p1;
    anim($("#blurFull"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 500 });
    anim($("#scrim"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 500 });
    await reveal(r, true);
    focusPage();
    setBusy(false);
  };

  const back = async () => {
    const s = R.current;
    if (s.busy || !s.route) return;
    setBusy(true);
    const r = s.route;
    const RM = rmRef.current;
    if (s.opts.pick && pick.current.k) {
      const camBack = tween(CAM_REST, 900);
      const bd = RM ? 0 : r === "learn" ? 950 : r === "achievements" ? 500 : 250;
      anim($("#blurFull"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 700, delay: bd });
      anim($("#scrim"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 700, delay: bd });
      if (!RM) {
        anim($("#topbar"), [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        await fxFor(r).pickConceal(fxCtx(r));
      }
      await commitPage(null);
      await camBack;
      pick.current.end(env());
      backToRoom();
      setBusy(false);
      return;
    }
    await conceal(r);
    await commitPage(null);
    anim($("#blurFull"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 500 });
    anim($("#scrim"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 600 });
    const p = tween(CAM_REST, 950);
    anim($("#blurHole"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 900, delay: RM ? 0 : 150 });
    await p;
    backToRoom();
    setBusy(false);
  };

  const sibling = async (r: Route, o: GoOpts) => {
    const s = R.current;
    if (s.busy || !s.route) return;
    setBusy(true);
    const RM = rmRef.current;
    const dir = ROUTES.indexOf(r) >= ROUTES.indexOf(s.route) ? -1 : 1;
    await anim($("#page .stagearea"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${dir * 60}px)` }], { duration: RM ? 1 : 320 });
    if (s.opts.pick) pick.current.end(env());
    setRouteBoth(r, o);
    const fk = focusKey(r, o);
    setHole(fk);
    focusCur.current = fk;
    await commitPage({ route: r, opts: o, content: false });
    await tween(focusOf(fk), 850);
    await reveal(r, false);
    setBusy(false);
  };

  /* ---------- lịch (PEEK): zoom vào lịch, tờ lịch nét tách khỏi tường phóng ra, không đổi trang ---------- */
  /** Tờ lịch phóng to: ảnh calendar.webp + ngày tháng và vòng chuỗi vẽ theo CALENDAR.src + thẻ "N ngày" (bigCal). */
  const bigCal = () => {
    const Lc = L.current!, src = CALENDAR.src;
    const h = Math.min(Lc.H * 0.8, 660), w = (h * src.w) / src.h;
    const d = document.createElement("div");
    d.className = "pcal";
    Object.assign(d.style, { left: Math.max(16, Lc.W * 0.44 - w / 2 - 150) + "px", top: Lc.H / 2 - h / 2 + "px", width: w + "px", height: h + "px" });
    const [p0x, p0y, p1x, p1y] = src.pic;
    const sx = w / src.w;
    const n = cbs.current.streak;
    const svg = calSvgMarkup(src.cells, src.labels, src.cw, src.cw * 0.3, monthCells(new Date(), n));
    const note = `left:${(p0x + (p1x - p0x) * 0.2) * sx}px;top:${(p0y + (p1y - p0y) * 0.22) * sx}px;width:${(p1x - p0x) * 0.6 * sx}px;height:${(p1y - p0y) * 0.56 * sx}px`;
    d.innerHTML =
      `<img src="${asset("items/page/calendar.webp")}" alt=""><svg viewBox="0 0 ${src.w} ${src.h}">${svg}</svg>` +
      `<div class="bnote" style="${note}">${FLAME}<div><b>${n} ngày</b><small>chuỗi học</small></div></div>`;
    $("#held")!.appendChild(d);
    return d;
  };

  const closeAfterPeek = useRef(false);
  const peekCal = async () => {
    const s = R.current;
    if (s.busy || s.route || s.peeking || s.intro || !L.current) return;
    setBusy(true);
    setPeeking(true);
    rememberFocus();
    cbs.current.onLeaveRoom();
    const room = $("#room");
    if (room) room.style.translate = "0px 0px";
    const RM = rmRef.current;
    uiOut();
    setHole("calendar");
    anim($("#blurHole"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 900 });
    focusCur.current = "calendar";
    await tween(focusOf("calendar"), 950);
    const big = bigCal();
    pick.current.extra.push(big);
    anim($("#blurFull"), [{ opacity: 0 }, { opacity: 1 }], { duration: RM ? 1 : 500 });
    anim($("#scrim"), [{ opacity: 0 }, { opacity: 0.6 }], { duration: RM ? 1 : 500 });
    const r = itemRect(env(), "calendar"), t = big.getBoundingClientRect();
    pick.current.hideItem(env(), "calendar", true);
    await big.animate(
      [
        { transform: `translate(${r.x - t.left}px,${r.y - t.top}px) scale(${r.w / t.width})`, transformOrigin: "0 0" },
        { transform: "translateY(-14px) rotate(-1.5deg)", transformOrigin: "0 0", offset: 0.7 },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: RM ? 1 : 850, easing: EASE, fill: "backwards" },
    ).finished;
    // các vòng đỏ vẽ lần lượt, cách nhau 90ms
    big.querySelectorAll(".ring").forEach((p, i) =>
      p.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: RM ? 1 : 380, delay: RM ? 0 : i * 90, easing: "ease-out", fill: "backwards" }),
    );
    const bt = big.getBoundingClientRect();
    await commitCalPop({ left: Math.min(bt.right + 20, L.current!.W - 320), top: bt.top + bt.height * 0.42 });
    $("#calPop")?.animate([{ opacity: 0, transform: "translateX(-14px) scale(.96)" }, { opacity: 1, transform: "none" }], {
      duration: RM ? 1 : 450,
      delay: RM ? 0 : 500,
      easing: EASE,
      fill: "backwards",
    });
    setBusy(false);
    if (closeAfterPeek.current) void unpeek();
  };

  const unpeek = async () => {
    if (!R.current.peeking) return;
    // đang phóng lịch ra: nhớ yêu cầu, phóng xong thì đóng luôn (prototype bỏ qua, Esc giữa chừng bị nuốt)
    if (R.current.busy) {
      closeAfterPeek.current = true;
      return;
    }
    closeAfterPeek.current = false;
    setBusy(true);
    const RM = rmRef.current;
    await $("#calPop")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 200 }).finished;
    await commitCalPop(null);
    const big = $("#held .pcal");
    anim($("#blurFull"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 500 });
    anim($("#scrim"), [{ opacity: 0.6 }, { opacity: 0 }], { duration: RM ? 1 : 500 });
    if (big) {
      const r = itemRect(env(), "calendar"), t = big.getBoundingClientRect();
      await big.animate(
        [
          { transform: "none", transformOrigin: "0 0" },
          { transform: `translate(${r.x - t.left}px,${r.y - t.top}px) scale(${r.w / t.width})`, transformOrigin: "0 0" },
        ],
        { duration: RM ? 1 : 650, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" },
      ).finished;
    }
    pick.current.end(env());
    pick.current.hideItem(env(), "calendar", false);
    anim($("#blurHole"), [{ opacity: 1 }, { opacity: 0 }], { duration: RM ? 1 : 800 });
    await tween(CAM_REST, 900);
    focusCur.current = null;
    uiIn();
    setPeeking(false);
    setBusy(false);
  };

  /* ---------- cốc cà phê (SIP): nhấc cốc lên uống một ngụm rồi đặt lại ---------- */
  const sipMug = async () => {
    const s = R.current;
    if (s.busy || s.route || s.peeking || s.intro || !L.current) return;
    setBusy(true);
    setSipping(true);
    rememberFocus();
    cbs.current.onLeaveRoom();
    const RM = rmRef.current;
    const pk = pick.current;
    await pk.start(env(), "mug");
    anim($("#blurFull"), [{ opacity: 0 }, { opacity: 0.85 }], { duration: RM ? 1 : 600 });
    anim($("#scrim"), [{ opacity: 0 }, { opacity: 0.55 }], { duration: RM ? 1 : 600 });
    const h = Math.min(L.current.H * 0.42, 340);
    const im = pk.heldImg(env(), "mug", h);
    im.style.top = L.current.H * 0.56 - h / 2 + "px";
    await pk.flyInto(env(), im, "rotateX(25deg)", RM ? 1 : 850);
    pk.clone?.remove();
    pk.clone = null;
    if (!RM) {
      // hơi bốc lên từ miệng cốc, cốc nghiêng -17deg như đang uống
      const st = document.createElement("div");
      st.className = "psteam";
      const r = im.getBoundingClientRect();
      Object.assign(st.style, { left: r.left + r.width * 0.42 + "px", top: r.top - 30 + "px" });
      st.innerHTML = "<i></i><i></i><i></i>";
      $("#held")!.appendChild(st);
      pk.extra.push(st);
      im.style.transformOrigin = "30% 80%";
      await im.animate(
        [
          { transform: "none" },
          { transform: "translate(-10px,-34px) rotate(-17deg)", offset: 0.35 },
          { transform: "translate(-10px,-34px) rotate(-19deg)", offset: 0.6 },
          { transform: "none" },
        ],
        { duration: 1500, easing: "ease-in-out" },
      ).finished;
    }
    cbs.current.toast("Đã nghỉ một ngụm cà phê. Học tiếp nhé!");
    anim($("#blurFull"), [{ opacity: 0.85 }, { opacity: 0 }], { duration: RM ? 1 : 700, delay: RM ? 0 : 200 });
    anim($("#scrim"), [{ opacity: 0.55 }, { opacity: 0 }], { duration: RM ? 1 : 700, delay: RM ? 0 : 200 });
    if (!RM) await pk.flyBack(env(), im, "rotateX(25deg)", 700);
    pk.end(env());
    setSipping(false);
    setBusy(false);
  };

  /* ---------- đối chiếu trang đang hiện với đích mong muốn ---------- */
  const drive = async () => {
    if (driving.current) return;
    driving.current = true;
    try {
      for (let guard = 0; guard < 8; guard++) {
        const s = R.current;
        const d = desired.current;
        const cur = s.route ? { route: s.route, opts: s.opts } : null;
        if (sameDest(d, cur) || s.peeking || s.intro || !L.current) break;
        if (!d) await back();
        else if (!cur) await go(d.route, d.opts);
        else await sibling(d.route, d.opts);
      }
    } finally {
      driving.current = false;
    }
  };

  /* ---------- API cho giao diện ---------- */
  /** Mở trang từ phòng (đồ vật, menu, avatar, ghi chú). Bị bỏ qua nếu đang chuyển cảnh hoặc đã ở trang con. */
  const requestGo = (r: Route, o: GoOpts = {}) => {
    const s = R.current;
    if (s.busy || s.route || s.peeking || s.intro || driving.current) return;
    desired.current = { route: r, opts: o };
    pushDest(desired.current);
    void drive();
  };
  /** Đổi sang trang con khác bằng thanh tab. */
  const requestSibling = (r: Route, o: GoOpts = {}) => {
    if (R.current.busy || !R.current.route) return;
    desired.current = { route: r, opts: o };
    replaceDest(desired.current);
    void drive();
  };
  /** Đổi tuỳ chọn của trang đang mở mà không chuyển cảnh (vd. tab Hồ sơ/Xếp hạng trong điện thoại); URL cập nhật theo. */
  const updateOpts = (o: GoOpts) => {
    const s = R.current;
    if (!s.route) return;
    const next = { ...s.opts, ...o };
    setRouteBoth(s.route, next);
    desired.current = { route: s.route, opts: next };
    replaceDest(desired.current);
  };
  /** Quay lại phòng (nút "Góc học", Esc). Nếu mục lịch sử là do mình thêm thì lùi lịch sử để nút back trình duyệt khớp. */
  const requestBack = () => {
    if (!R.current.route && !desired.current) return;
    if (currentEntryIsOurs()) {
      window.history.back(); // popstate sẽ đặt đích = phòng
      return;
    }
    desired.current = null;
    replaceDest(null);
    void drive();
  };

  // Nút back/forward của trình duyệt
  useEffect(() => {
    const onPop = () => {
      desired.current = parseLocation(window.location.search);
      void drive();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  // Mở thẳng URL có ?p=: vào trang luôn khi đã đo được khung nhìn
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !layout) return;
    started.current = true;
    const d = parseLocation(window.location.search);
    // chuẩn hoá URL: bỏ tham số không hợp lệ (trang lạ, bài chưa mở…)
    if (window.location.search && window.location.search !== (d ? destToQuery(d) : "")) replaceDest(d);
    if (d) {
      desired.current = d;
      void drive();
    }
  });

  // Đổi kích thước khi đang ở trang con: camera bám lại khung FOCUS (layout() của prototype)
  useEffect(() => {
    if (!layout || !R.current.route || R.current.busy || !focusCur.current) return;
    cam.current = focusCam(layout, FOCUS[focusCur.current], focusCur.current === "learn");
    const el = appRef.current?.querySelector<HTMLElement>("#cam");
    if (el) el.style.transform = camTransform(cam.current);
  }, [layout, appRef]);

  // Esc: quay lại / đóng popover
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (R.current.intro) cbs.current.onEscIntro();
      else if (R.current.route || desired.current) requestBack();
      else if (R.current.peeking) void unpeek();
      else cbs.current.onEscInRoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Về lại phòng (sau khi React đã bỏ inert khỏi HUD): trả focus về chỗ cũ
  useEffect(() => {
    if (route || peeking || sipping || busy) return;
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el?.isConnected && !el.closest("[inert]")) el.focus({ preventScroll: true });
  }, [route, peeking, sipping, busy]);

  // Đang xem lịch: bấm ra ngoài #calPop thì lịch bay về tường
  useEffect(() => {
    if (!peeking) return;
    const onDown = (e: PointerEvent) => {
      if (!appRef.current?.querySelector("#calPop")?.contains(e.target as Node)) void unpeek();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  /** Màn mở đầu đang chạy: chặn hover/click và điều hướng; xong thì đi tiếp tới đích đang chờ (nếu có). */
  const setIntro = (v: boolean) => {
    R.current.intro = v;
    if (!v) void drive();
  };

  /** Đang chuyển cảnh hoặc ở trang con: chặn hover/click trong phòng. */
  const isBlocked = useCallback(() => {
    const s = R.current;
    return s.busy || !!s.route || s.peeking || s.intro;
  }, []);

  return {
    route,
    opts,
    busy,
    peeking,
    sipping,
    page,
    calPop,
    peekCal,
    unpeek,
    sipMug,
    setIntro,
    cam,
    go: requestGo,
    back: requestBack,
    sibling: requestSibling,
    updateOpts,
    isBlocked,
  };
}

export type SceneApi = ReturnType<typeof useSceneController>;
