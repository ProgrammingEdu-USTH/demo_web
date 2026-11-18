"use client";
/* Khung #app: cảnh phòng + giao diện phủ (HUD). Thứ tự phần tử trong #app giữ như body của prototype. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useBulbTempo } from "./ambient/useBulbTempo";
import { useClouds } from "./ambient/useClouds";
import { useLeaves } from "./ambient/useLeaves";
import { useParallax } from "./ambient/useParallax";
import { usePhonePing } from "./ambient/usePhonePing";
import { useTimeOfDay } from "./ambient/useTimeOfDay";
import { useIntro } from "./intro/useIntro";
import { animate } from "./anim";
import { StickyNotes } from "./notes/StickyNotes";
import { useStickyNotes } from "./notes/useStickyNotes";
import { asset, LAZY_ASSETS, type ItemKey } from "./config/scene";
import { SHELVES } from "./config/shelves";
import { HoverContext, HoverStore } from "./hover";
import { DemoPanel } from "./hud/DemoPanel";
import { Hint } from "./hud/Hint";
import { IconSprite } from "./hud/Icons";
import { CalPop, NotePop, Toast } from "./hud/Popovers";
import { Profile } from "./hud/Profile";
import { Side } from "./hud/Side";
import { Tags } from "./hud/Tags";
import { CAM_REST, computeLayout, w2s } from "./scene/layout";
import { RoomStage } from "./scene/RoomStage";
import { useDocumentHidden, usePrefersReducedMotion, useViewport } from "./scene/useClientValues";
import { goTab, PagesContext, type PageData, type PagesEnv } from "./pages/PagesContext";
import { PageView } from "./pages/PageView";
import { SceneContext } from "./transitions/SceneContext";
import { useSceneController } from "./transitions/useSceneController";
import { logTarget, menuTarget, objectTarget, profileTarget, type Target } from "./targets";
import type {
  Badge,
  CodeToken,
  CurrentLesson,
  DailyQuest,
  PhoneTab,
  PracticeSummary,
  Roadmap,
  Route,
  StickyNote,
  UserProfile,
  WeeklyEvent,
} from "./types";

export interface GocHocAppProps {
  user: UserProfile;
  lesson: CurrentLesson;
  laptopCode: readonly (readonly CodeToken[])[];
  quests: readonly DailyQuest[];
  event: WeeklyEvent;
  roadmap: Roadmap;
  badges: readonly Badge[];
  /** Dữ liệu riêng của các trang con */
  pages: Pick<PageData, "lessonBodies" | "quiz" | "courses" | "badgeSummary" | "leaderboard" | "practice">;
  practice: PracticeSummary;
  hints: readonly string[];
  /** Ghi chú mẫu: 2 tờ đầu dán sẵn, các tờ sau lần lượt thêm vào */
  notePool: readonly StickyNote[];
  /** Thời điểm server render, để đếm ngược khớp lúc hydrate */
  serverNow: number;
}

const TOAST_MS = 2600;
/** Hover cốc: hơi cà phê bốc mạnh trong 2,4 giây */
const PUFF_MS = 2400;
/** Điện thoại rung 0,8 giây khi có ghi chú mới */
const BUZZ_MS = 800;

export function GocHocApp(props: GocHocAppProps) {
  const { user, lesson } = props;
  const appRef = useRef<HTMLDivElement>(null);
  const vp = useViewport();
  const vw = vp?.W, vh = vp?.H;
  // chỉ tính lại khi kích thước khung nhìn thật sự đổi (engine bám camera theo layout)
  const layout = useMemo(() => (vw && vh ? computeLayout(vw, vh) : null), [vw, vh]);
  const shelf = SHELVES[lesson.shelf];

  const hidden = useDocumentHidden();
  const prefersRm = usePrefersReducedMotion();
  const [rmOverride, setRmOverride] = useState<boolean | null>(null);
  const rm = rmOverride ?? prefersRm;

  /* ---------- toast ---------- */
  const [toast, setToast] = useState({ text: "", on: false });
  const toastT = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    setToast({ text, on: true });
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast((t) => ({ ...t, on: false })), TOAST_MS);
  }, []);

  /* ---------- cửa sổ ---------- */
  const [windowOpen, setWindowOpen] = useState(false);
  const [rain, setRain] = useState(false);
  const toggleWindow = () => {
    const open = !windowOpen;
    setWindowOpen(open);
    if (open && !rm) showToast("Đã mở cửa sổ. Gió vào phòng rồi.");
  };

  /* ---------- hover hai chiều ---------- */
  // Hover nằm ngoài React state: rê chuột không render lại cả app, chỉ đồ vật / nhãn / mục menu đổi trạng thái (xem hover.ts)
  const [hoverStore] = useState(() => new HoverStore());
  const setHover = hoverStore.set;
  const [steamPuff, setSteamPuff] = useState(false);
  const puffT = useRef<number | undefined>(undefined);
  const puff = useCallback((g: string) => {
    if (g !== "mug") return;
    setSteamPuff(true);
    window.clearTimeout(puffT.current);
    puffT.current = window.setTimeout(() => setSteamPuff(false), PUFF_MS);
  }, []);

  /* ---------- bảng tuỳ chỉnh ---------- */
  const [demoOpen, setDemoOpen] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const demoBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!demoOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!demoRef.current?.contains(t) && !demoBtnRef.current?.contains(t)) setDemoOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [demoOpen]);

  /* ---------- engine chuyển cảnh ---------- */
  // popover ghi chú và màn mở đầu được tạo sau nên engine gọi chúng qua ref
  const hideNotePop = useRef<() => void>(() => {});
  const skipIntro = useRef<() => void>(() => {});
  const scene = useSceneController({
    appRef,
    layout,
    rm,
    onLeaveRoom: () => {
      setDemoOpen(false);
      setHover(null);
      hideNotePop.current();
    },
    onEscInRoom: () => hideNotePop.current(),
    onEscIntro: () => skipIntro.current(),
    toast: showToast,
    streak: user.streak,
  });
  // away: tab ẩn, đang ở trang con, đang xem lịch hoặc uống cà phê → chuyển động nền tạm dừng, lớp ghi chú ẩn
  const away = hidden || scene.route !== null || scene.peeking || scene.sipping;
  // frozen: đang chuyển cảnh / ở trang con / xem lịch → phòng đứng yên (không parallax)
  const frozen = scene.route !== null || scene.busy || scene.peeking;

  /** Thực hiện đích của một cú bấm (đồ vật, menu, avatar, ghi chú). */
  const runTarget = (source: string, t: Target | null) => {
    if (!t) return;
    if (t.kind === "go") return scene.go(t.route, t.opts);
    if (t.kind === "locked") return showToast(t.message);
    if (t.kind === "window") return toggleWindow();
    if (t.kind === "peek-calendar") return scene.peekCal();
    if (t.kind === "sip") return scene.sipMug();
    logTarget(source, t);
  };
  // handler của vùng bấm được memo (HitAreas không render lại khi hover) nên đọc bản mới nhất qua ref
  const latest = useRef({ runTarget, isBlocked: scene.isBlocked, scene });
  useEffect(() => {
    latest.current = { runTarget, isBlocked: scene.isBlocked, scene };
  });

  const hit = useMemo(
    () => ({
      onEnter: (g: string) => {
        if (latest.current.isBlocked()) return;
        setHover({ from: "object", g });
        puff(g);
      },
      onLeave: (g: string) => setHover((h) => (h && h.from !== "menu" && h.g === g ? null : h)),
      onFocusVisible: (g: string) => {
        if (latest.current.isBlocked()) return;
        setHover({ from: "focus", g });
        puff(g);
      },
      onBlur: (g: string) => setHover((h) => (h && h.from !== "menu" && h.g === g ? null : h)),
      onActivate: (g: string, key: ItemKey | null) => {
        if (latest.current.isBlocked()) return;
        setHover(null);
        latest.current.runTarget(`đồ vật ${g}`, objectTarget(g, key));
      },
    }),
    [puff, setHover],
  );
  const onMenuHover = useCallback((r: Route | null) => setHover(r ? { from: "menu", r } : null), [setHover]);
  const onGo = useCallback((r: Route, tab?: PhoneTab) => latest.current.runTarget(`menu ${r}`, menuTarget(r, tab)), []);

  /* ---------- chuyển động nền ---------- */
  const tod = useTimeOfDay(appRef, rm);
  const night = useSyncExternalStore(tod.store.subscribe, tod.store.night, () => false);
  const par = useParallax(appRef, { enabled: !rm && !layout?.mobile, hidden, frozen });
  useClouds(appRef, { todRef: tod.todRef, par, windowOpen, rm, hidden, frozen });
  useLeaves(appRef, { windowOpen, rm, hidden, away });
  useBulbTempo(appRef, windowOpen);
  const phonePing = usePhonePing({ rm, hidden, away });

  /* ---------- màn mở đầu ---------- */
  const intro = useIntro({
    appRef,
    ready: !!layout,
    rm,
    todRef: tod.todRef,
    setBlocked: scene.setIntro,
    onStart: () => hideNotePop.current(),
  });
  useEffect(() => {
    skipIntro.current = intro.skip;
  });

  // Màn mở đầu xong: lúc trình duyệt rảnh thì tải trước ảnh cầm tay và ảnh trang con, lần đầu mở trang khỏi khựng chờ ảnh.
  useEffect(() => {
    if (!intro.settled) return;
    const warm = () =>
      LAZY_ASSETS.forEach((p) => {
        const im = new Image();
        im.decoding = "async";
        im.src = asset(p);
      });
    // Safari chưa có requestIdleCallback: dùng setTimeout
    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(warm, { timeout: 4000 }) : window.setTimeout(warm, 1500);
    return () => (idle ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, [intro.settled]);

  /* ---------- giấy note thông báo ---------- */
  const [phoneBuzz, setPhoneBuzz] = useState(false);
  const buzzT = useRef<number | undefined>(undefined);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notes = useStickyNotes({
    pool: props.notePool,
    rm,
    away,
    sideLeft: layout?.sideLeft ?? null,
    started: intro.settled,
    onGo: (n) => n.go && runTarget(`ghi chú "${n.t}"`, { kind: "go", route: n.go.route, opts: n.go.tab ? { tab: n.go.tab } : {} }),
    onEmptyBell: () => showToast("Chưa có ghi chú mới"),
    onArrive: () => {
      setPhoneBuzz(true);
      window.clearTimeout(buzzT.current);
      buzzT.current = window.setTimeout(() => setPhoneBuzz(false), BUZZ_MS);
      animate(bellRef.current, [{ rotate: "0deg" }, { rotate: "14deg" }, { rotate: "-12deg" }, { rotate: "8deg" }, { rotate: "0deg" }], {
        duration: 700,
        easing: "linear",
      });
    },
  });
  const latestNotes = useRef(notes);
  useEffect(() => {
    hideNotePop.current = notes.hidePop;
    latestNotes.current = notes;
  });

  /* ---------- vị trí phần tử neo theo phòng (placeUI) ---------- */
  const demoStyle: CSSProperties = layout ? { right: layout.mobile ? 16 : layout.W - layout.sideLeft + 4, top: 64 } : {};
  const calPopStyle: CSSProperties = (() => {
    if (!layout) return {};
    const [cx, cy] = w2s(layout, 966, 560, CAM_REST);
    return { left: Math.min(cx + 22, layout.sideLeft - 262), top: Math.max(12, cy) };
  })();

  const appClass =
    [intro.running && "intro", windowOpen && "open", rain && "rain", rm && "rm", away && "away", night && "night"].filter(Boolean).join(" ") || undefined;
  // Cột phải desktop rộng clamp(320px, 23vw, 380px); mobile để media query trong tokens.css quyết định.
  const appStyle = layout?.side != null ? ({ "--side": `${layout.side}px` } as CSSProperties) : undefined;
  const soon = props.badges.filter((b) => b.tier === "soon").length;
  // HUD và vùng bấm trong phòng không nhận Tab khi đang ở trang con, xem lịch, uống cà phê hay trong màn mở đầu
  const hudInert = scene.route !== null || scene.peeking || scene.sipping || intro.running;
  // callback ổn định cho các khối memo (Side, Profile, PageView): gọi bản mới nhất qua ref
  const stable = useMemo(
    () => ({
      openProfile: () => latest.current.runTarget("avatar", profileTarget),
      bell: () => latestNotes.current.bell(),
      toggleDemo: () => setDemoOpen((v) => !v),
      back: () => latest.current.scene.back(),
      tab: (r: Route) => goTab(latest.current.scene, r),
    }),
    [],
  );
  const laptop = useMemo(
    () => ({ code: props.laptopCode, file: lesson.file, caption: `${shelf.short} · Bài ${lesson.lesson + 1}/${shelf.lessons.length}` }),
    [props.laptopCode, lesson.file, lesson.lesson, shelf],
  );
  const pagesEnv = useMemo<PagesEnv>(
    () => ({ data: { ...props.pages, user, roadmap: props.roadmap, badges: props.badges }, toast: showToast, rm }),
    [props.pages, user, props.roadmap, props.badges, showToast, rm],
  );

  return (
    <SceneContext.Provider value={scene}>
      <HoverContext.Provider value={hoverStore}>
        <IconSprite />
        <div
          id="app"
          ref={appRef}
          className={appClass}
          style={appStyle}
          // trạng thái engine (để kiểm thử và debug): room | busy | page
          data-scene={scene.busy ? "busy" : scene.route ? "page" : scene.peeking ? "peek" : "room"}
          // chưa biết có chạy màn mở đầu không (server/hydrate): ẩn UI để khỏi chớp lên rồi tắt
          data-intro={intro.pending ? "pending" : undefined}
        >
          <RoomStage
            layout={layout}
            laptop={laptop}
            streak={user.streak}
            windowOpen={windowOpen}
            hit={hit}
            typingPaused={rm || away}
            steamPuff={steamPuff}
            phonePing={phonePing}
            phoneBuzz={phoneBuzz}
            notes={<StickyNotes api={notes} away={away} />}
            tabbable={!hudInert}
          />

          <div id="scrim" />

          <Tags
            layout={layout}
            cam={CAM_REST}
            frozen={frozen}
            windowOpen={windowOpen}
            rankText={`Hạng ${user.rank} · tăng ${user.rankDelta} bậc`}
            rankOn={phonePing}
          />

          <div id="flash" />
          <div id="held" aria-hidden="true" />

          <Profile user={user} onOpen={stable.openProfile} countToken={intro.countToken} rm={rm} inert={hudInert} />

          <Side
            user={user}
            lesson={lesson}
            quests={props.quests}
            event={props.event}
            roadmapSub={`Chặng ${props.roadmap.current + 1}/${props.roadmap.stages.length} · đang học`}
            practiceSub={`${props.practice.total} bài · ${props.practice.suggestedToday} gợi ý hôm nay`}
            achievementsSub={`${props.pages.badgeSummary.owned} huy hiệu · ${soon} sắp mở`}
            serverNow={props.serverNow}
            onMenuHover={onMenuHover}
            onGo={onGo}
            noteCount={notes.count}
            onBell={stable.bell}
            bellRef={bellRef}
            demoOpen={demoOpen}
            onToggleDemo={stable.toggleDemo}
            demoBtnRef={demoBtnRef}
            countToken={intro.countToken}
            rm={rm}
            inert={hudInert}
          />

          <Hint questions={props.hints} rm={rm} inert={hudInert} />

          <CalPop
            streak={user.streak}
            open={!!scene.calPop}
            peek={!!scene.calPop}
            style={scene.calPop ? { left: scene.calPop.left, top: scene.calPop.top } : calPopStyle}
          />
          <NotePop
            note={notes.popNote}
            popRef={notes.popRef}
            {...notes.popHandlers}
            onGo={notes.goFromPop}
            onRemove={notes.removeFromPop}
          />

          <DemoPanel
            open={demoOpen}
            style={demoStyle}
            panelRef={demoRef}
            tod={tod.store}
            realTime={tod.realTime}
            windowOpen={windowOpen}
            rain={rain}
            rm={rm}
            onTodInput={(h) => tod.setManual(h, false)}
            onPreset={(h) => tod.setManual(h, true)}
            onToggleReal={tod.toggleReal}
            onToggleWindow={toggleWindow}
            onToggleRain={() => setRain((v) => !v)}
            onToggleRm={() => setRmOverride(!rm)}
            onAddNote={() => {
              setDemoOpen(false);
              notes.nextNote();
            }}
            onReplayIntro={() => {
              setDemoOpen(false);
              if (!scene.route) intro.replay();
            }}
          />

          <Toast text={toast.text} on={toast.on} />
          <PagesContext.Provider value={pagesEnv}>
            <PageView state={scene.page} user={user} onBack={stable.back} onTab={stable.tab} />
          </PagesContext.Provider>
          {/* chỉ nhận Tab khi đang có màn mở đầu (lúc khác nút ẩn bằng opacity) */}
          <button id="skip" onClick={intro.skip} inert={!intro.running}>
            Bỏ qua mở đầu
          </button>
        </div>
      </HoverContext.Provider>
    </SceneContext.Provider>
  );
}
