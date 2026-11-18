/* Kiểu dữ liệu dùng chung cho Góc học. Mock và API thật đều trả về đúng các kiểu này. */

export type LessonState = "done" | "cur" | "lock";

/** Các trang mở từ phòng (thứ tự tab trên thanh trên cùng). */
export type Route = "learn" | "roadmap" | "courses" | "practice" | "achievements" | "phone";
export type PhoneTab = "me" | "rank";

/** Các biến màu giấy note trong tokens.css. */
export type NoteColor = "--note-y" | "--note-p" | "--note-b" | "--note-g";

export interface UserProfile {
  name: string;
  initial: string;
  level: number;
  xp: number;
  xpNext: number;
  totalXp: number;
  badgeCount: number;
  streak: number;
  league: string;
  rank: number;
  rankDelta: number;
  weekXp: number;
  lessonsDone: number;
  /** Phút học mỗi ngày trong tuần, T2 → CN. */
  weekMinutes: readonly (readonly [minutes: number, day: string])[];
  recentBadges: readonly RecentBadge[];
}

export interface RecentBadge {
  glyph: string;
  name: string;
  /** g: vàng, s: bạc, b: đồng */
  tier: "g" | "s" | "b";
}

export interface CurrentLesson {
  shelf: number;
  lesson: number;
  course: string;
  chapter: string;
  title: string;
  file: string;
  /** % hiển thị ở thẻ Học tiếp */
  progress: number;
}

/** Một token tô màu cú pháp: [class, text]; class rỗng là chữ thường. */
export type CodeToken = readonly [cls: "" | "kw" | "st" | "nm" | "cm", text: string];

export interface LessonBody {
  file?: string;
  /** Đoạn văn, có thể chứa <b>. */
  paragraphsHtml: readonly string[];
  /** Mã đã tô màu sẵn bằng <span class="kw|nm|st|cm">, xuống dòng bằng \n. */
  codeHtml: string;
  out: readonly string[];
  /** Có câu hỏi "Thử suy nghĩ" */
  quiz?: boolean;
  /** Bài có màn "Chạy từng dòng" (Pixel Stage): id script và tiêu đề hiển thị. */
  stepScript?: { id: string; title: string };
}

export interface PracticeSummary {
  total: number;
  suggestedToday: number;
}

export interface PracticePage {
  head: string;
  /** level: e = Dễ, m = Vừa */
  suggestions: readonly { title: string; level: "e" | "m" }[];
  questNote: string;
  topics: readonly { name: string; active?: boolean }[];
  /** status: d = đã giải, w = đang làm, "" = chưa làm */
  problems: readonly { title: string; meta: string; xp: number; status: "d" | "w" | "" }[];
}

/** Câu hỏi "Thử suy nghĩ" trong bài học. */
export interface LessonQuiz {
  title: string;
  questionHtml: string;
  options: readonly string[];
  answer: string;
  right: string;
  wrong: string;
}

/** Tóm tắt ở đầu trang Thành tựu. */
export interface BadgeSummary {
  owned: number;
  total: number;
  next: { name: string; progress: string };
  gold: number;
  silver: number;
  bronze: number;
}

export interface DailyQuest {
  title: string;
  xp: number;
  done: boolean;
  /** 0..1 */
  progress: number;
}

export interface WeeklyEvent {
  title: string;
  count: number;
  /** Mốc kết thúc (epoch ms) */
  endsAt: number;
  cta: string;
  route: Route;
}

export interface NoteTarget {
  route: Route;
  tab?: PhoneTab;
}

export interface StickyNote {
  /** Chữ lớn trên tờ note */
  ic: string;
  sh: string;
  l3: string;
  /** Loại thông báo */
  k: string;
  t: string;
  b: string;
  act: string;
  go: NoteTarget | null;
  c: NoteColor;
}

export interface LeaderboardEntry {
  name: string;
  xp: number;
  color: string;
}

export type BadgeTier = "bronze" | "silver" | "gold" | "soon";

export interface Badge {
  glyph: string;
  name: string;
  tier: BadgeTier;
}

export type LabelAnchor = "start" | "middle" | "end";

export interface RoadmapStage {
  name: string;
  /** Toạ độ nút trong SVG viewBox 1000×600 */
  node: readonly [x: number, y: number];
  label: readonly [x: number, y: number, anchor: LabelAnchor];
}

export interface Roadmap {
  course: string;
  /** Chỉ số chặng đang học (0-based) */
  current: number;
  stages: readonly RoadmapStage[];
  note: { title: string; chapter: string; detail: string };
}

/** Khoá có trên kệ trong phòng, trỏ tới SHELVES. */
export interface ShelfCourse {
  shelf: number;
}

/** Khoá chưa có trên kệ. */
export interface ExtraCourse {
  name: string;
  sub: string;
  titles: readonly string[];
  col: readonly string[];
  locked?: boolean;
}

export type Course = ShelfCourse | ExtraCourse;
