import type { UserProfile } from "../types";

export const user: UserProfile = {
  name: "Hà Thái Sơn",
  initial: "S",
  level: 14,
  xp: 2340,
  xpNext: 3000,
  totalXp: 18450,
  badgeCount: 23,
  streak: 12,
  league: "Giải Bạc",
  rank: 37,
  rankDelta: 2,
  weekXp: 1120,
  lessonsDone: 53,
  weekMinutes: [[25, "T2"], [40, "T3"], [18, "T4"], [52, "T5"], [30, "T6"], [45, "T7"], [12, "CN"]],
  recentBadges: [
    { glyph: "10k", name: "10.000 XP", tier: "g" },
    { glyph: "3", name: "Top 50 tuần", tier: "s" },
    { glyph: "?", name: "Hỏi gợi ý hay", tier: "b" },
  ],
};
