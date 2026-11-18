/* #side: cột phải (pill, thẻ Học tiếp, menu 5 mục, Nhiệm vụ hôm nay, Thử thách tuần, nhạc lofi). */
"use client";
import { memo, useState, type ReactNode, type Ref } from "react";
import { SHELVES } from "../config/shelves";
import { useIsHl } from "../hover";
import { useNow } from "../scene/useClientValues";
import type { CurrentLesson, DailyQuest, PhoneTab, Route, UserProfile, WeeklyEvent } from "../types";
import { CountUp } from "./CountUp";
import { remaining } from "./format";
import { Icon, type IconName } from "./Icons";

export interface SideData {
  user: UserProfile;
  lesson: CurrentLesson;
  quests: readonly DailyQuest[];
  event: WeeklyEvent;
  /** "Chặng 7/10 · đang học" */
  roadmapSub: string;
  /** "128 bài · 3 gợi ý hôm nay" */
  practiceSub: string;
  /** "23 huy hiệu · 1 sắp mở" */
  achievementsSub: string;
  serverNow: number;
}

interface Props extends SideData {
  onMenuHover: (r: Route | null) => void;
  onGo: (r: Route, tab?: PhoneTab) => void;
  noteCount: number;
  onBell: () => void;
  demoOpen: boolean;
  onToggleDemo: () => void;
  demoBtnRef: Ref<HTMLButtonElement>;
  /** Chuông lắc khi có ghi chú mới */
  bellRef: Ref<HTMLButtonElement>;
  /** Tăng thì các con số đếm lên từ 0 (màn mở đầu) */
  countToken: number;
  rm: boolean;
  /** đang ở trang con / xem lịch / màn mở đầu: cột phải mờ đi, không nhận Tab */
  inert: boolean;
}

/** Nút có data-go: hover làm sáng đồ vật (lightRoute), bấm thì đi tới trang. */
function goProps(r: Route, p: Pick<Props, "onMenuHover" | "onGo">, tab?: PhoneTab) {
  return {
    "data-go": r,
    "data-tab": tab,
    onPointerEnter: () => p.onMenuHover(r),
    onPointerLeave: () => p.onMenuHover(null),
    onClick: () => {
      p.onMenuHover(null);
      p.onGo(r, tab);
    },
  };
}

type NavProps = Pick<Props, "onMenuHover" | "onGo">;

/** Nút [data-go]: tự đọc trạng thái highlight (menuHL) từ HoverStore, chỉ nút đổi trạng thái mới render lại. */
function GoButton({ r, tab, className, p, children }: { r: Route; tab?: PhoneTab; className: string; p: NavProps; children: ReactNode }) {
  const hl = useIsHl(r);
  return (
    <button className={hl ? `${className} hl` : className} {...goProps(r, p, tab)}>
      {children}
    </button>
  );
}

function MenuItem({ r, tab, icon, ic, title, sub, p }: { r: Route; tab?: PhoneTab; icon: IconName; ic: string; title: string; sub: ReactNode; p: NavProps }) {
  return (
    <GoButton className="mi glass" r={r} tab={tab} p={p}>
      <span className={`ic ${ic}`}>
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <Icon name="right" className="i chev" />
    </GoButton>
  );
}

function Music() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`music glass${playing ? " playing" : ""}`} id="music">
      <button className="ib" id="musicBtn" aria-label={playing ? "Tắt nhạc lofi" : "Phát nhạc lofi"} onClick={() => setPlaying((v) => !v)}>
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <div className="eq">
        <i />
        <i />
        <i />
        <i />
      </div>
      <span id="musicTxt">{playing ? "Nhạc lofi · bản mẫu, chưa có âm thanh" : "Nhạc lofi · đang tắt"}</span>
    </div>
  );
}

/* memo: GocHocApp truyền prop ổn định (callback qua ref), cột phải chỉ render lại khi dữ liệu của nó đổi */
export const Side = memo(function Side({ demoBtnRef, bellRef, ...p }: Props) {
  const { user, lesson, quests, event } = p;
  const now = useNow(p.serverNow);
  const shelf = SHELVES[lesson.shelf];
  const done = quests.filter((q) => q.done).length;

  return (
    <aside id="side" className="ui" inert={p.inert}>
      <div className="pills">
        <div className="pill glass st mob" title="Chuỗi ngày học">
          <Icon name="flame" />
          {user.streak}
        </div>
        <div className="pill glass xpp" title="Tổng XP">
          <Icon name="bolt" />
          <span data-count={user.totalXp}>
            <CountUp value={user.totalXp} token={p.countToken} rm={p.rm} />
          </span>&nbsp;XP
        </div>
        <div className="pill glass bd" title="Huy hiệu">
          <Icon name="medal" />
          <span data-count={user.badgeCount}>
            <CountUp value={user.badgeCount} token={p.countToken} rm={p.rm} />
          </span>
        </div>
        <span className="sp" />
        <button ref={bellRef} className="ib glass" id="bellBtn" aria-label="Ghi chú thông báo" onClick={p.onBell}>
          <Icon name="bell" />
          <span className="badge" id="badge" hidden={!p.noteCount}>
            {p.noteCount}
          </span>
        </button>
        <button
          ref={demoBtnRef}
          className="ib glass"
          id="demoBtn"
          aria-label="Tùy chỉnh khung cảnh"
          aria-expanded={p.demoOpen}
          onClick={p.onToggleDemo}
        >
          <Icon name="sliders" />
        </button>
      </div>

      <GoButton className="hero" r="learn" p={p}>
        <div className="eyebrow">
          {lesson.course} · {lesson.chapter}
        </div>
        <h2>Học tiếp</h2>
        <div className="sub">
          Bài {lesson.lesson + 1}/{shelf.lessons.length} · {lesson.title}
        </div>
        <div className="row">
          <div className="prog">
            <i style={{ width: `${lesson.progress}%` }} />
          </div>
          <span className="pct">{lesson.progress}%</span>
          <span className="play">
            <Icon name="play" />
          </span>
        </div>
      </GoButton>

      <nav className="menu" aria-label="Điều hướng">
        <MenuItem r="roadmap" icon="map" ic="c-map" title="Lộ trình" sub={p.roadmapSub} p={p} />
        <MenuItem r="courses" icon="book" ic="c-book" title="Khóa học" sub="Mỗi cuốn sách là một bài học" p={p} />
        <MenuItem r="practice" icon="pen" ic="c-pen" title="Luyện tập" sub={p.practiceSub} p={p} />
        <MenuItem r="achievements" icon="trophy" ic="c-tro" title="Thành tựu" sub={p.achievementsSub} p={p} />
        <MenuItem r="phone" tab="rank" icon="phone" ic="c-ph" title="Bảng xếp hạng" sub={`Hạng ${user.rank} · ${user.league}`} p={p} />
      </nav>

      <section className="today glass" aria-label="Nhiệm vụ hôm nay">
        <h3>
          Nhiệm vụ hôm nay{" "}
          <span>
            {done}/{quests.length} xong
          </span>
        </h3>
        {quests.map((q) =>
          q.done ? (
            <div key={q.title} className="q done">
              <span className="ck">
                <Icon name="check" />
              </span>
              <span className="t">{q.title}</span>
              <span className="xpv">+{q.xp}</span>
            </div>
          ) : (
            <div key={q.title} className="q">
              <span className="ck" />
              <span>
                <span className="t">{q.title}</span>
                <div className="mini">
                  <i style={{ width: `${Math.round(q.progress * 100)}%` }} />
                </div>
              </span>
              <span className="xpv">+{q.xp}</span>
            </div>
          ),
        )}
        <div className="event">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{event.title}</b>
            <small>
              {event.count} bài · còn <span id="cd">{remaining(event.endsAt - now)}</span>
            </small>
          </div>
          <GoButton className="btn" r={event.route} p={p}>
            {event.cta}
          </GoButton>
        </div>
      </section>

      <Music />
    </aside>
  );
});
