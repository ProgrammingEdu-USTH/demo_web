import type { DailyQuest, WeeklyEvent } from "../types";

export const dailyQuests: readonly DailyQuest[] = [
  { title: "Hoàn thành 2 bài học", xp: 60, done: true, progress: 1 },
  { title: "Giải 3 bài Luyện tập", xp: 40, done: false, progress: 0.33 },
  { title: "Đạt 100% một bài kiểm tra", xp: 80, done: false, progress: 0 },
];

/** Thử thách tuần kết thúc sau 5 ngày 14 giờ 20 phút kể từ lúc tải dữ liệu. */
export const WEEKLY_EVENT_REMAINING_MS = (5 * 24 + 14) * 3600e3 + 20 * 60e3;

export const weeklyEvent: Omit<WeeklyEvent, "endsAt"> = {
  title: "Thử thách tuần: Đệ quy",
  count: 5,
  cta: "Tham gia",
  route: "practice",
};
