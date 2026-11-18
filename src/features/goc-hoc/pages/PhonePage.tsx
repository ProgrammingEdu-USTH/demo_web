/* Điện thoại: khung phone-frame.webp, màn hình (left 10%, top 6%, width 80%, height 86.8%) có 2 tab Hồ sơ / Xếp hạng. Port body('phone').
   Đổi tab cập nhật ?tab= trên URL (không chuyển cảnh). */
import { useLayoutEffect, useRef, useState } from "react";
import { EASE } from "../anim";
import { asset } from "../config/scene";
import { fmt } from "../hud/format";
import { useScene } from "../transitions/SceneContext";
import type { GoOpts } from "../targets";
import type { PhoneTab } from "../types";
import { usePages } from "./PagesContext";

const TODAY = 6; // cột CN được tô như "hôm nay", như prototype

export function PhonePage({ opts }: { opts: GoOpts }) {
  const { data, rm } = usePages();
  const scene = useScene();
  const { user, leaderboard } = data;
  const [tab, setTab] = useState<PhoneTab>(opts.tab === "rank" ? "rank" : "me");
  const meRef = useRef<HTMLDivElement>(null);
  const rankRef = useRef<HTMLDivElement>(null);

  // đổi tab: nội dung mới trượt vào từ phía tab được chọn (không chạy lúc mới mở trang)
  const shownTab = useRef(tab);
  useLayoutEffect(() => {
    if (shownTab.current === tab) return;
    shownTab.current = tab;
    const el = tab === "me" ? meRef.current : rankRef.current;
    if (!rm) el?.animate([{ opacity: 0, transform: `translateX(${tab === "me" ? -16 : 16}px)` }, { opacity: 1, transform: "none" }], { duration: 350, easing: EASE });
  }, [tab, rm]);

  const pick = (t: PhoneTab) => {
    setTab(t);
    scene.updateOpts({ tab: t });
  };
  const xpPct = Math.round((user.xp / user.xpNext) * 100);

  return (
    <div className="pg">
      <div className="phonewrap">
        <div className="phone" id="phone">
          <img className="pframe" src={asset("items/page/phone-frame.webp")} alt="" />
          <div className="scr">
            <div className="hd">
              <div className="seg" role="tablist">
                <button role="tab" data-pt="me" aria-selected={tab === "me"} onClick={() => pick("me")}>
                  Hồ sơ
                </button>
                <button role="tab" data-pt="rank" aria-selected={tab === "rank"} onClick={() => pick("rank")}>
                  Xếp hạng
                </button>
              </div>
            </div>
            <div className="pv" id="pvMe" hidden={tab !== "me"} ref={meRef}>
              <div className="prof">
                <div className="who">
                  <span className="a">{user.initial}</span>
                  <div>
                    <b>{user.name}</b>
                    <small>
                      Lv. {user.level} · {user.league}
                    </small>
                  </div>
                </div>
                <div>
                  <div className="xpb">
                    <i style={{ width: `${xpPct}%` }} />
                  </div>
                  <div className="xpl">
                    <span>
                      {fmt(user.xp)} / {fmt(user.xpNext)} XP
                    </span>
                    <span>
                      còn {fmt(user.xpNext - user.xp)} XP lên Lv. {user.level + 1}
                    </span>
                  </div>
                </div>
                <div className="stats">
                  <div>
                    <b>{user.streak}</b>
                    <small>ngày liên tiếp</small>
                  </div>
                  <div>
                    <b>{fmt(user.totalXp)}</b>
                    <small>tổng XP</small>
                  </div>
                  <div>
                    <b>{user.badgeCount}</b>
                    <small>huy hiệu</small>
                  </div>
                  <div>
                    <b>{user.lessonsDone}</b>
                    <small>bài đã học</small>
                  </div>
                </div>
                <div className="act">
                  <h5>Huy hiệu gần đây</h5>
                  <div className="rb">
                    {user.recentBadges.map((b) => (
                      <span key={b.name}>
                        <i className={b.tier}>{b.glyph}</i>
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="act">
                  <h5>Phút học tuần này</h5>
                  <div className="bars">
                    {user.weekMinutes.map(([m, d], i) => (
                      <span key={d} className={i === TODAY ? "t" : undefined}>
                        <i style={{ height: `${m * 1.1}px` }} />
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="pv" id="pvRank" hidden={tab !== "rank"} ref={rankRef}>
              <ul className="lb">
                {leaderboard.map((p, i) => (
                  <li key={p.name}>
                    <span className="rk">{i + 1}</span>
                    <span className="av" style={{ background: p.color }}>
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <span>{p.name}</span>
                    <span className="xp2">{fmt(p.xp)} XP</span>
                  </li>
                ))}
              </ul>
              <div className="me">
                <span className="rk">{user.rank}</span>
                <span className="av">{user.initial}</span>
                <span>
                  Bạn <span className="up">↑{user.rankDelta}</span>
                </span>
                <span>{fmt(user.weekXp)} XP</span>
              </div>
              <div className="sample">Tên người chơi là dữ liệu mẫu</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
