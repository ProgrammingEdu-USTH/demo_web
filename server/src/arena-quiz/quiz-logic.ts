/**
 * Arena · Đoán output — phần THUẦN (không DB), dùng chung cho service và test.
 *
 * Chuyển từ app "Arena" trong máy tính Góc học của pe-usth (nhánh test,
 * frontend/public/goc-hoc/may-tinh/mac.js): 5 câu, mỗi câu 15 giây, đoán đoạn code in ra gì,
 * trả lời đúng được 100 điểm + 10 điểm cho mỗi giây còn lại. Bản đó đấu với bot trên máy;
 * bản này để server giữ đáp án và đồng hồ cho trận online giữa hai người thật.
 *
 * Câu hỏi lấy từ quiz-bank.json (các ví dụ có output cố định trong "Sổ Học" của pe-usth).
 * File JSON đó cũng được frontend nạp cho chế độ đấu với máy (web/src/arena/quiz.js).
 */
import { randomInt } from 'crypto';
import BANK from './quiz-bank.json';

export interface QuizItem {
  id: string;
  group: string;
  name: string;
  code: string;
  output: string;
  lesson: string;
}

export const QUIZ_BANK: readonly QuizItem[] = BANK as QuizItem[];
const BY_ID = new Map(QUIZ_BANK.map((q) => [q.id, q]));
export const getQuizItem = (id: string) => BY_ID.get(id);

export const QUESTIONS_PER_MATCH = 5;
export const OPTIONS_PER_QUESTION = 4;
export const COUNTDOWN_MS = 3_000; // "3-2-1" sau khi ghép xong
export const QUESTION_MS = 15_000; // thời gian trả lời mỗi câu
export const REVEAL_MS = 3_000; // hiện đáp án trước khi sang câu sau
export const WAIT_TTL_MS = 60_000; // phòng chờ quá lâu thì tự huỷ
export const HOST_SEEN_MS = 8_000; // chủ phòng phải poll trong ngần này mới được ghép (đã rời trang thì thôi)
export const DEFAULT_QUIZ_RATING = 1000;
export const QUIZ_ELO_K = 32;
export const QUIZ_XP = { win: 15, draw: 8, loss: 4 } as const;

/** Một câu trong trận: id câu hỏi + 4 lựa chọn đã xáo + vị trí đáp án đúng. */
export interface MatchQuestion {
  qid: string;
  opts: string[];
  answer: number;
}

type Rand = (n: number) => number;
const shuffle = <T>(a: T[], rnd: Rand): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** Chọn câu cho một trận: không trùng câu, 3 đáp án nhiễu lấy từ output của câu khác (khác đáp án đúng). */
export function pickQuestions(
  n = QUESTIONS_PER_MATCH,
  rnd: Rand = randomInt,
  bank: readonly QuizItem[] = QUIZ_BANK,
): MatchQuestion[] {
  const items = shuffle([...bank], rnd).slice(0, n);
  return items.map((q) => {
    const wrong = shuffle(
      [...new Set(bank.map((x) => x.output).filter((o) => o !== q.output))],
      rnd,
    ).slice(0, OPTIONS_PER_QUESTION - 1);
    const opts = shuffle([q.output, ...wrong], rnd);
    return { qid: q.id, opts, answer: opts.indexOf(q.output) };
  });
}

/** Một lượt trả lời đã ghi (đủ để dựng lịch thời gian và điểm). */
export interface AnswerRec {
  userId: number;
  qIndex: number;
  choice: number;
  correct: boolean;
  points: number;
  at: number; // ms
}

export interface QuestionSlot {
  index: number;
  openAt: number;
  closeAt: number; // hết giờ, hoặc sớm hơn khi cả hai đã trả lời
  revealUntil: number;
}

/**
 * Dựng lịch các câu từ thời điểm bắt đầu và các câu trả lời đã có. Câu i mở khi câu i-1 hết phần
 * hiện đáp án; đóng sau QUESTION_MS hoặc ngay khi CẢ HAI người đã trả lời (như bản pe-usth).
 */
export function timeline(
  startedAt: number,
  answers: AnswerRec[],
  players: number[],
  n = QUESTIONS_PER_MATCH,
): QuestionSlot[] {
  const slots: QuestionSlot[] = [];
  let openAt = startedAt;
  for (let i = 0; i < n; i++) {
    const deadline = openAt + QUESTION_MS;
    const mine = answers.filter((a) => a.qIndex === i && a.at < deadline);
    const all =
      players.length > 1 && players.every((p) => mine.some((a) => a.userId === p));
    const closeAt = all ? Math.max(...mine.map((a) => a.at)) : deadline;
    const revealUntil = closeAt + REVEAL_MS;
    slots.push({ index: i, openAt, closeAt, revealUntil });
    openAt = revealUntil;
  }
  return slots;
}

export type Phase = 'countdown' | 'question' | 'reveal' | 'done';

export function phaseAt(
  slots: QuestionSlot[],
  now: number,
): { phase: Phase; slot: QuestionSlot | null } {
  if (!slots.length || now < slots[0].openAt) return { phase: 'countdown', slot: null };
  for (const s of slots) {
    if (now < s.closeAt) return { phase: 'question', slot: s };
    if (now < s.revealUntil) return { phase: 'reveal', slot: s };
  }
  return { phase: 'done', slot: null };
}

export const endAt = (slots: QuestionSlot[]) =>
  slots.length ? slots[slots.length - 1].revealUntil : 0;

/** Điểm một câu: đúng được 100 + 10 điểm cho mỗi giây còn lại (làm tròn), sai 0. */
export function pointsFor(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  return 100 + Math.round(Math.max(0, (QUESTION_MS - elapsedMs) / 1000) * 10);
}

export type QuizResult = 'win' | 'loss' | 'draw' | 'none';

export interface QuizSettlement {
  winnerId: number | null;
  hostDelta: number;
  guestDelta: number;
  hostXp: number;
  guestXp: number;
  hostResult: QuizResult;
  guestResult: QuizResult;
}

const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));
const delta = (a: number, b: number, s: number) => {
  const d = Math.round(QUIZ_ELO_K * (s - expected(a, b)));
  return d === 0 ? 0 : d;
};

/**
 * Chốt trận. Thắng = tổng điểm cao hơn; bằng nhau là hoà. Đầu hàng: người kia thắng.
 * Không tính điểm (Elo/XP/thống kê) khi: đầu hàng trước khi câu đầu tiên kết thúc, hoặc cả hai không
 * đúng câu nào. Elo K=32, sàn 0; XP chỉ cho người có ít nhất một câu đúng (thắng thì luôn có).
 */
export function settleQuiz(i: {
  hostId: number;
  guestId: number;
  hostRating: number;
  guestRating: number;
  hostScore: number;
  guestScore: number;
  hostCorrect: number;
  guestCorrect: number;
  forfeiterId?: number | null;
  unscored?: boolean;
}): QuizSettlement {
  let winnerId: number | null;
  if (i.forfeiterId) winnerId = i.forfeiterId === i.hostId ? i.guestId : i.hostId;
  else if (i.hostScore === i.guestScore) winnerId = null;
  else winnerId = i.hostScore > i.guestScore ? i.hostId : i.guestId;

  const none = {
    winnerId,
    hostDelta: 0,
    guestDelta: 0,
    hostXp: 0,
    guestXp: 0,
    hostResult: 'none' as const,
    guestResult: 'none' as const,
  };
  if (i.unscored || (i.hostCorrect < 1 && i.guestCorrect < 1)) return none;

  const s = winnerId === null ? 0.5 : winnerId === i.hostId ? 1 : 0;
  let hd = delta(i.hostRating, i.guestRating, s);
  let gd = -hd || 0;
  hd = Math.max(-i.hostRating, hd); // sàn 0
  gd = Math.max(-i.guestRating, gd);
  const res = (me: number): QuizResult =>
    winnerId === null ? 'draw' : winnerId === me ? 'win' : 'loss';
  const xp = (r: QuizResult, correct: number) =>
    r === 'win' ? QUIZ_XP.win : correct < 1 ? 0 : r === 'draw' ? QUIZ_XP.draw : r === 'loss' ? QUIZ_XP.loss : 0;
  const hr = res(i.hostId), gr = res(i.guestId);
  return {
    winnerId,
    hostDelta: hd,
    guestDelta: gd,
    hostXp: xp(hr, i.hostCorrect),
    guestXp: xp(gr, i.guestCorrect),
    hostResult: hr,
    guestResult: gr,
  };
}
