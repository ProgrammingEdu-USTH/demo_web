/* Lớp truy cập dữ liệu. Hiện đọc mock; khi có API thật chỉ cần thay thân các hàm này, giữ nguyên kiểu trả về. */
import { SHELVES } from "./config/shelves";
import * as mock from "./mock";
import type {
  Badge,
  Course,
  CurrentLesson,
  DailyQuest,
  LeaderboardEntry,
  LessonBody,
  PracticePage,
  PracticeSummary,
  Roadmap,
  StickyNote,
  UserProfile,
  WeeklyEvent,
} from "./types";

/** Giờ phía server lúc render; client dùng làm mốc để đếm ngược khớp HTML lúc hydrate. */
export async function getServerTime(): Promise<number> {
  return Date.now();
}

export async function getUser(): Promise<UserProfile> {
  return mock.user;
}

export async function getCurrentLesson(): Promise<CurrentLesson> {
  return mock.currentLesson;
}

/** Nội dung một bài: kệ C++ (shelf 0) có bài viết riêng, các kệ khác dùng GENERIC. */
export async function getLessonBody(shelf: number, lesson: number): Promise<LessonBody | null> {
  if (shelf > 0) return mock.GENERIC(shelf, lesson);
  return mock.LESSON_BODY[lesson] ?? null;
}

export async function getLaptopCode() {
  return mock.LAPTOP_CODE;
}

export async function getLessonQuiz() {
  return mock.LESSON_QUIZ;
}

export async function getDailyQuests(): Promise<readonly DailyQuest[]> {
  return mock.dailyQuests;
}

export async function getWeeklyEvent(): Promise<WeeklyEvent> {
  return { ...mock.weeklyEvent, endsAt: Date.now() + mock.WEEKLY_EVENT_REMAINING_MS };
}

export async function getNotePool(): Promise<readonly StickyNote[]> {
  return mock.NOTE_POOL;
}

export async function getLeaderboard(): Promise<readonly LeaderboardEntry[]> {
  return mock.leaderboard;
}

export async function getBadges(): Promise<readonly Badge[]> {
  return mock.badges;
}

export async function getBadgeSummary() {
  return mock.badgeSummary;
}

export async function getRoadmap(): Promise<Roadmap> {
  return mock.roadmap;
}

export async function getCourses(): Promise<readonly Course[]> {
  return mock.courses;
}

export async function getPracticeSummary(): Promise<PracticeSummary> {
  return mock.practiceSummary;
}

export async function getPracticePage(): Promise<PracticePage> {
  return mock.practicePage;
}

/** Nội dung mọi bài trên 3 kệ, khoá "kệ:bài" (vd. "0:3"), để trang Học tiếp mở bất kỳ bài nào không cần tải thêm. */
export async function getLessonBodies(): Promise<Record<string, LessonBody>> {
  const out: Record<string, LessonBody> = {};
  for (const [s, S] of SHELVES.entries()) {
    for (let i = 0; i < S.lessons.length; i++) {
      const body = await getLessonBody(s, i);
      if (body) out[`${s}:${i}`] = body;
    }
  }
  return out;
}

/** Câu hỏi gợi mở cho ô "Hỏi gợi ý…" (không chứa đáp án). */
export async function getHintQuestions(): Promise<readonly string[]> {
  return mock.hintQuestions;
}
