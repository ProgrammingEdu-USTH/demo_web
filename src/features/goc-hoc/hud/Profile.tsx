/* #profile: avatar có vòng level, tên, level, thanh XP. Bấm để mở Hồ sơ trên điện thoại. */
import { memo } from "react";
import type { UserProfile } from "../types";
import { CountUp } from "./CountUp";
import { fmt } from "./format";

const RING = 150.8; // chu vi vòng r=24

/** countToken: tăng thì số XP đếm lên từ 0 (màn mở đầu) */
/** inert: đang ở trang con / xem lịch / màn mở đầu — nút đang mờ thì không nhận Tab */
export const Profile = memo(function Profile({ user, onOpen, countToken, rm, inert }: { user: UserProfile; onOpen: () => void; countToken: number; rm: boolean; inert: boolean }) {
  const p = user.xp / user.xpNext;
  return (
    <button id="profile" className="glass ui" aria-label="Mở hồ sơ trên điện thoại" onClick={onOpen} inert={inert}>
      <div className="ava">
        <svg viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(p * RING).toFixed(1)} ${RING}`}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <span>{user.initial}</span>
      </div>
      <div>
        <div className="pname">
          {user.name} <span className="lv">Lv. {user.level}</span>
        </div>
        <div className="xp">
          <div className="xpbar">
            <i style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span>
            <b data-count={user.xp}>
              <CountUp value={user.xp} token={countToken} rm={rm} />
            </b> / {fmt(user.xpNext)} XP
          </span>
        </div>
      </div>
    </button>
  );
});
