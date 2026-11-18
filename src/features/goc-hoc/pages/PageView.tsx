/* #page: lớp trang con phủ trên cảnh — thanh trên (nút "Góc học", tab 6 khu, pill streak và XP) + .stagearea (topBar() + body() của prototype). */
import { memo } from "react";
import { ROUTE_NAMES, ROUTES } from "../config/objects";
import { Icon } from "../hud/Icons";
import { fmt } from "../hud/format";
import type { GoOpts } from "../targets";
import type { Route, UserProfile } from "../types";
import { AchievementsPage } from "./AchievementsPage";
import { CoursesPage } from "./CoursesPage";
import { LearnPage } from "./LearnPage";
import { PhonePage } from "./PhonePage";
import { PracticePage } from "./PracticePage";
import { RoadmapPage } from "./RoadmapPage";

export interface PageState {
  route: Route;
  opts: GoOpts;
  /** false: đang đổi tab, nội dung cũ đã trượt đi, nội dung mới chưa hiện */
  content: boolean;
  /** tăng mỗi lần dựng lại nội dung (để .stagearea là phần tử mới) */
  seq: number;
}

interface Props {
  state: PageState | null;
  user: UserProfile;
  onBack: () => void;
  onTab: (r: Route) => void;
}

function Body({ route, opts }: { route: Route; opts: GoOpts }) {
  switch (route) {
    case "learn":
      return <LearnPage opts={opts} />;
    case "roadmap":
      return <RoadmapPage />;
    case "courses":
      return <CoursesPage />;
    case "practice":
      return <PracticePage />;
    case "achievements":
      return <AchievementsPage />;
    case "phone":
      return <PhonePage opts={opts} />;
  }
}

/* memo: trang con không render lại theo mỗi lần app render (toast, ghi chú, hẹn giờ…), chỉ khi state trang đổi */
export const PageView = memo(function PageView({ state, user, onBack, onTab }: Props) {
  return (
    <div id="page" className={state ? "live" : undefined} aria-live="polite">
      {state && (
        <>
          <div className="top" id="topbar">
            <button className="back glass" id="backBtn" onClick={onBack}>
              <Icon name="left" />
              Góc học
            </button>
            <nav className="tabs glass" aria-label="Các khu trong phòng">
              {ROUTES.map((x) => (
                <button key={x} className="tab" data-tab={x} aria-current={x === state.route ? "page" : undefined} onClick={() => onTab(x)}>
                  {ROUTE_NAMES[x]}
                </button>
              ))}
            </nav>
            <div className="pill st">
              <Icon name="flame" />
              {user.streak}
            </div>
            <div className="pill xpp">
              <Icon name="bolt" />
              {fmt(user.totalXp)}
            </div>
          </div>
          {state.content && (
            <div className="stagearea" key={state.seq}>
              <Body route={state.route} opts={state.opts} />
            </div>
          )}
        </>
      )}
    </div>
  );
});
