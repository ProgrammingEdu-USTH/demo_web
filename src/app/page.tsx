import { connection } from "next/server";
import { Suspense } from "react";
import { preload } from "react-dom";
import { asset, PRELOAD_ASSETS, PRELOAD_MASKS } from "@/features/goc-hoc/config/scene";
import { GocHocApp } from "@/features/goc-hoc/GocHocApp";
import {
  getBadgeSummary,
  getBadges,
  getCurrentLesson,
  getDailyQuests,
  getHintQuestions,
  getLeaderboard,
  getLessonBodies,
  getLessonQuiz,
  getCourses,
  getPracticePage,
  getLaptopCode,
  getNotePool,
  getPracticeSummary,
  getRoadmap,
  getServerTime,
  getUser,
  getWeeklyEvent,
} from "@/features/goc-hoc/data";

/* Dữ liệu theo từng người dùng và có mốc thời gian (đếm ngược) nên render theo request, không prerender. */
async function GocHoc() {
  await connection();
  const [user, lesson, laptopCode, quests, event, roadmap, badges, badgeSummary, practice, hints, notePool, serverNow, lessonBodies, quiz, courses, leaderboard, practicePage] = await Promise.all([
    getUser(),
    getCurrentLesson(),
    getLaptopCode(),
    getDailyQuests(),
    getWeeklyEvent(),
    getRoadmap(),
    getBadges(),
    getBadgeSummary(),
    getPracticeSummary(),
    getHintQuestions(),
    getNotePool(),
    getServerTime(),
    getLessonBodies(),
    getLessonQuiz(),
    getCourses(),
    getLeaderboard(),
    getPracticePage(),
  ]);
  return (
    <GocHocApp
      user={user}
      lesson={lesson}
      laptopCode={laptopCode}
      quests={quests}
      event={event}
      roadmap={roadmap}
      badges={badges}
      pages={{ lessonBodies, quiz, courses, badgeSummary, leaderboard, practice: practicePage }}
      practice={practice}
      hints={hints}
      notePool={notePool}
      serverNow={serverNow}
    />
  );
}

export default function Home() {
  // nằm trong khung tĩnh của trang nên <link rel="preload"> có trong <head> ngay từ đầu
  for (const p of PRELOAD_ASSETS) preload(asset(p), { as: "image", fetchPriority: p === "room.webp" ? "high" : "auto" });
  for (const p of PRELOAD_MASKS) preload(asset(p), { as: "image", crossOrigin: "anonymous" });
  return (
    <Suspense fallback={<div id="app" />}>
      <GocHoc />
    </Suspense>
  );
}
