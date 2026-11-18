/* Dữ liệu và dịch vụ dùng chung cho 6 trang con (lấy từ data.ts ở server, truyền xuống một lần). */
"use client";
import { createContext, useContext } from "react";
import type { GoOpts } from "../targets";
import type { useScene } from "../transitions/SceneContext";
import type {
  Badge,
  BadgeSummary,
  Course,
  LeaderboardEntry,
  LessonBody,
  LessonQuiz,
  PracticePage,
  Roadmap,
  Route,
  UserProfile,
} from "../types";

export interface PageData {
  user: UserProfile;
  /** khoá "kệ:bài" */
  lessonBodies: Readonly<Record<string, LessonBody>>;
  quiz: LessonQuiz;
  roadmap: Roadmap;
  courses: readonly Course[];
  badges: readonly Badge[];
  badgeSummary: BadgeSummary;
  leaderboard: readonly LeaderboardEntry[];
  practice: PracticePage;
}

export interface PagesEnv {
  data: PageData;
  toast: (text: string) => void;
  rm: boolean;
}

export const PagesContext = createContext<PagesEnv | null>(null);

export function usePages(): PagesEnv {
  const v = useContext(PagesContext);
  if (!v) throw new Error("usePages() phải nằm trong <PagesContext.Provider>");
  return v;
}

/** Nút có data-tab (thanh tab, nút "Học tiếp" trên lộ trình): đổi sang trang khác; bấm lại "Học tiếp" mở bài đang học. */
export function goTab(scene: ReturnType<typeof useScene>, r: Route) {
  if (r !== scene.route || r === "learn") scene.sibling(r, r === "learn" ? ({ lesson: 3 } satisfies GoOpts) : {});
}
