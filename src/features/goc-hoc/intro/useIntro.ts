/* Màn mở đầu (lần đầu trong phiên): phòng tối, đèn bàn bật "tách", vùng sáng lan ra (--r), đèn dây sáng lần lượt dọc khung cửa,
   laptop bừng lên, phòng sáng dần, UI trồi vào, số đếm lên, khoanh ngày hôm nay. Khoảng 3 giây, bỏ qua được.
   Port runIntro(), finishIntro(), drawCal() của prototype. */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { sample, wrapHours } from "../ambient/timeOfDay";
import { EASE } from "../anim";
import { BULBS } from "../config/scene";

const SEEN_KEY = "gocHoc.introSeen";
const FINISH_MS = 3100;
const COUNT_AT_MS = 2200;

function readSeen() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function saveSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* chế độ riêng tư / chặn storage: lần sau xem lại cũng không sao */
  }
}

/** Quyết định một lần mỗi lần tải trang: link thẳng ?p= hoặc đã xem trong phiên thì bỏ qua. */
type Mode = "play" | "skip";
let decided: Mode | undefined;
const decide = (): Mode => (decided ??= new URLSearchParams(window.location.search).has("p") || readSeen() ? "skip" : "play");
const noopSubscribe = () => () => {};

/** Thứ tự đèn dây sáng: dọc thanh ngang trên (trái → phải) rồi xuống hai bên khung cửa. */
const BULB_ORDER = BULBS.map((p, i) => ({ i, t: p[1] < 205 ? ((p[0] - 980) / 900) * 0.45 : 0.45 + ((p[1] - 205) / 870) * 0.55 })).sort((a, b) => a.t - b.t);

interface Opts {
  appRef: RefObject<HTMLElement | null>;
  /** đã đo được khung nhìn (phòng đã hiện) */
  ready: boolean;
  rm: boolean;
  todRef: RefObject<number>;
  /** báo engine: đang chạy màn mở đầu thì chặn hover/click/điều hướng */
  setBlocked: (v: boolean) => void;
  /** đóng popover ghi chú khi bắt đầu */
  onStart: () => void;
}

export function useIntro({ appRef, ready, rm, todRef, setBlocked, onStart }: Opts) {
  // "pending": lúc render ở server và lúc hydrate, chưa biết có chạy màn mở đầu hay không
  const mode = useSyncExternalStore(noopSubscribe, decide, () => "pending" as const);
  const [phase, setPhase] = useState<"auto" | "running" | "done">("auto");
  // giảm chuyển động: màn mở đầu coi như xong ngay (số hiện sẵn, vòng lịch vẽ sẵn), không bao giờ vào trạng thái chạy
  const running = !rm && (phase === "running" || (phase === "auto" && mode === "play"));
  /** Tăng mỗi lần số đếm lên (CountUp chạy lại từ 0) */
  const [countToken, setCountToken] = useState(0);
  /** Màn mở đầu đã xong ít nhất một lần (hoặc được bỏ qua) — để bắt đầu hẹn giờ ghi chú */
  const settled = mode === "skip" || phase === "done" || (rm && mode === "play");

  // giảm chuyển động lúc lần đầu vào phiên: vẫn đánh dấu đã xem
  useEffect(() => {
    if (rm && mode === "play") saveSeen();
  }, [rm, mode]);

  const anims = useRef<Animation[]>([]);
  const timers = useRef<number[]>([]);
  const optsRef = useRef({ rm, setBlocked, onStart });
  useLayoutEffect(() => {
    optsRef.current = { rm, setBlocked, onStart };
  });

  const $ = (sel: string) => appRef.current?.querySelector<HTMLElement>(sel) ?? null;

  /** Khoanh ngày hôm nay trên lịch treo tường. */
  const drawCal = () => {
    const p = $("#calPath");
    p?.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: optsRef.current.rm ? 1 : 900, easing: "ease-in-out", fill: "forwards" });
  };
  const countUp = () => setCountToken((t) => t + 1);

  const finish = (skipped: boolean) => {
    anims.current.forEach((a) => {
      try {
        a.cancel();
      } catch {
        /* đã huỷ */
      }
    });
    anims.current = [];
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const dk = $("#dark");
    if (dk) {
      dk.style.opacity = "0";
      dk.style.setProperty("--r", "0px");
    }
    if (skipped) {
      countUp();
      drawCal();
    }
    saveSeen();
    setPhase("done");
    optsRef.current.setBlocked(false);
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // Chạy chuỗi hiệu ứng khi bắt đầu (lần đầu trong phiên, hoặc "Xem lại màn mở đầu"), trước khi phòng được vẽ ra.
  useLayoutEffect(() => {
    if (!running || !ready) return;
    const app = appRef.current;
    if (!app) return;
    const q = (s: string) => app.querySelector<HTMLElement>(s);
    optsRef.current.setBlocked(true);
    optsRef.current.onStart();
    const cal = q("#calPath");
    if (cal) {
      cal.getAnimations().forEach((a) => a.cancel());
      cal.style.strokeDasharray = "100";
      cal.style.strokeDashoffset = "100";
    }
    const dark = q("#dark")!, pool = q("#lampPool")!, halo = q("#lampHalo")!, scr = q("#screenWrap")!;
    const bulbs = [...app.querySelectorAll<HTMLElement>(".bulb")];
    const ui = [q("#profile")!, q("#side")!, q("#hint")!];
    [dark, pool, halo, scr, ...bulbs, ...ui, q("#tags")!].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
    dark.style.opacity = "1";
    dark.style.setProperty("--r", "-700px");
    const A = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => anims.current.push(el.animate(k, { fill: "both", easing: EASE, ...o }));
    const lf = Math.max(0.35, sample(wrapHours(todRef.current)).lamp);
    // đèn bàn bật "tách" (chớp một nhịp), vùng sáng lan ra
    A(halo, [{ opacity: 0 }, { opacity: lf, offset: 0.2 }, { opacity: 0.7 * lf, offset: 0.35 }, { opacity: lf }], { delay: 450, duration: 500, easing: "linear" });
    A(pool, [{ transform: "scale(.6)" }, { transform: "scale(1)" }], { delay: 500, duration: 900 });
    A(dark, [{ "--r": "-700px" }, { "--r": "420px" }] as Keyframe[], { delay: 500, duration: 1100 });
    // đèn dây sáng lần lượt
    BULB_ORDER.forEach((o, n) => bulbs[o.i] && A(bulbs[o.i], [{ opacity: 0 }, { opacity: 1 }], { delay: 1000 + n * 16, duration: 260 }));
    // laptop bừng lên
    A(scr, [{ opacity: 0 }, { opacity: 0.5, offset: 0.2 }, { opacity: 0.2, offset: 0.35 }, { opacity: 1 }], { delay: 1500, duration: 600, easing: "linear" });
    // phòng sáng dần, UI trồi vào
    A(dark, [{ opacity: 1 }, { opacity: 0 }], { delay: 1900, duration: 900 });
    const from = ["translateY(-14px)", "translateX(26px)", "translateY(14px)"];
    ui.forEach((el, i) => A(el, [{ opacity: 0, transform: from[i] }, { opacity: 1, transform: "none" }], { delay: 2150 + i * 90, duration: 800 }));
    timers.current.push(window.setTimeout(countUp, COUNT_AT_MS));
    timers.current.push(
      window.setTimeout(() => {
        drawCal();
        finishRef.current(false);
      }, FINISH_MS),
    );
    // bị cắt ngang (vd. bật "Giảm chuyển động" giữa chừng): kết thúc như bấm Bỏ qua, không để kẹt trạng thái chặn
    return () => {
      if (timers.current.length) finishRef.current(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi bắt đầu một lượt màn mở đầu
  }, [running, ready]);

  return {
    /** Đang chạy: #app có class .intro */
    running,
    /** Chưa quyết định (server/hydrate) */
    pending: mode === "pending",
    settled,
    countToken,
    /** Nút "Bỏ qua mở đầu", Esc */
    skip: () => running && finish(true),
    /** "Xem lại màn mở đầu" trong bảng tuỳ chỉnh */
    replay: () => {
      if (!rm) return setPhase("running");
      // giảm chuyển động: như prototype (runIntro → finishIntro, drawCal, countUp) — xong ngay
      drawCal();
      countUp();
    },
  };
}
