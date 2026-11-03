/**
 * arena-mock.ts — dữ liệu giả bám đúng schema openapi.yaml, chỉ dùng khi
 * NEXT_PUBLIC_ARENA_MOCK=1. Trạng thái nằm trong bộ nhớ tab (mất khi tải lại).
 *
 * Kịch bản: tạo phòng/xếp hàng → `waiting`, sau ~6 s tự thành `active` (đối thủ
 * giả "Minh Anh"); mỗi lần nộp được chấm một phần (4, 8 rồi 10/10 test); đủ 10/10
 * thì trận `finished` (solved). Mã chứa "import os" bị `rejected`. Hết giờ → timeout.
 * KHÔNG phải bảo mật/chấm thật: chỉ để dựng UI.
 */
import { ArenaApiError } from '@/lib/arena-api';
import type {
  ArenaProfile,
  CurrentMatchResponse,
  HistoryResponse,
  LeaderboardResponse,
  Match,
  MatchEnvelope,
  Problem,
  ProblemMeta,
  QueueResponse,
  Submission,
  SubmitResponse,
} from '@/lib/arena-api';

const PROBLEMS: Problem[] = [
  {
    id: 'sum-of-evens', title: 'Tổng các số chẵn', difficulty: 'easy', durationSec: 600,
    statement: 'Cho danh sách số nguyên nums. Trả về tổng các phần tử chẵn (số âm cũng xét; danh sách rỗng → 0).\n\nRàng buộc: 0 ≤ len(nums) ≤ 10^5, |x| ≤ 10^6.',
    signature: 'def solve(nums: list[int]) -> int',
    starterCode: 'def solve(nums):\n    # viết lời giải của bạn\n    return 0\n',
    examples: [{ args: [[1, 2, 3, 4]], expected: 6 }, { args: [[]], expected: 0 }, { args: [[7, 9]], expected: 0 }],
    testCount: 10,
  },
  {
    id: 'fizzbuzz', title: 'FizzBuzz', difficulty: 'easy', durationSec: 600,
    statement: 'Trả về danh sách n chuỗi từ 1 tới n: bội của 15 → "FizzBuzz", bội của 3 → "Fizz", bội của 5 → "Buzz", còn lại là str(i).\n\nRàng buộc: 0 ≤ n ≤ 1000.',
    signature: 'def solve(n: int) -> list[str]',
    starterCode: 'def solve(n):\n    return []\n',
    examples: [{ args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] }, { args: [1], expected: ['1'] }, { args: [3], expected: ['1', '2', 'Fizz'] }],
    testCount: 10,
  },
  {
    id: 'max-subarray', title: 'Dãy con liên tiếp có tổng lớn nhất', difficulty: 'medium', durationSec: 900,
    statement: 'Tìm tổng lớn nhất của một dãy con liên tiếp KHÔNG rỗng của nums.\n\nRàng buộc: 1 ≤ len ≤ 10^4, |x| ≤ 10^4.',
    signature: 'def solve(nums: list[int]) -> int',
    starterCode: 'def solve(nums):\n    return 0\n',
    examples: [{ args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 }, { args: [[1]], expected: 1 }, { args: [[5, 4, -1, 7, 8]], expected: 23 }],
    testCount: 11,
  },
];

const META = (p: Problem): ProblemMeta => ({ id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec });

const ME = { id: 1, name: 'Bạn', rating: 1000 };
const BOT = { id: 2, name: 'Minh Anh', rating: 1040 };
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface MockMatch {
  id: number; code: string; isPublic: boolean; status: Match['status'];
  problem: Problem; createdAt: number; startedAt: number | null; deadlineAt: number | null; finishedAt: number | null;
  subs: Submission[]; oppBest: number; result: Match['result'];
}

let nextId = 100;
let nextSubId = 1;
let cur: MockMatch | null = null;
const finished: MockMatch[] = [];
const profile = { rating: 1000, wins: 0, losses: 0, draws: 0 };

const iso = (t: number) => new Date(t).toISOString();
const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const err = (status: number, _code: string, message: string, retryAfter?: number) => new ArenaApiError(status, message, undefined, retryAfter);

function code6() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function bestPassed(m: MockMatch) {
  return m.subs.reduce((a, s) => (s.status === 'graded' ? Math.max(a, s.passed) : a), 0);
}

function finish(m: MockMatch, endReason: 'solved' | 'timeout' | 'forfeit', iWon: boolean | null) {
  const mine = bestPassed(m);
  const delta = iWon === null ? 0 : iWon ? 16 : -16;
  m.status = 'finished';
  m.finishedAt = Date.now();
  m.result = {
    winnerId: iWon === null ? null : iWon ? ME.id : BOT.id,
    isDraw: iWon === null,
    endReason,
    myRatingDelta: delta,
    opponentRatingDelta: -delta,
    myXp: iWon ? 50 : mine > 0 ? 10 : 0,
    myBestPassed: mine,
    opponentBestPassed: m.oppBest,
  };
  profile.rating = Math.max(0, profile.rating + delta);
  if (iWon === null) profile.draws++; else if (iWon) profile.wins++; else profile.losses++;
  finished.unshift(m);
  cur = null;
}

/** Tiến trạng thái theo thời gian thật (giống "chốt lười" của server). */
function tick(m: MockMatch) {
  const now = Date.now();
  if (m.status === 'waiting' && now - m.createdAt > 6000) {
    m.status = 'active';
    m.startedAt = now;
    m.deadlineAt = now + m.problem.durationSec * 1000;
  }
  if (m.status === 'active') {
    // đối thủ giả tiến dần: +1 test mỗi 30 s, tối đa tổng - 3
    m.oppBest = Math.min(m.problem.testCount - 3, Math.floor((now - (m.startedAt ?? now)) / 30000));
    if (m.deadlineAt && now > m.deadlineAt) {
      const mine = bestPassed(m);
      finish(m, 'timeout', mine === m.oppBest ? null : mine > m.oppBest);
    }
  }
}

function toMatch(m: MockMatch): Match {
  tick(m);
  const showProblem = m.status === 'active' || m.status === 'finished';
  return {
    id: m.id, code: m.code, status: m.status, isPublic: m.isPublic, role: 'host',
    createdAt: iso(m.createdAt),
    startedAt: m.startedAt ? iso(m.startedAt) : null,
    deadlineAt: m.deadlineAt ? iso(m.deadlineAt) : null,
    finishedAt: m.finishedAt ? iso(m.finishedAt) : null,
    me: { ...ME, rating: profile.rating },
    opponent: m.status === 'waiting' || m.status === 'cancelled' ? null : { ...BOT, submissionCount: m.oppBest > 0 ? m.oppBest : 0, bestPassed: m.oppBest },
    mySubmissionCount: m.subs.length,
    myBestPassed: bestPassed(m),
    problem: showProblem ? m.problem : null,
    result: m.result,
  };
}

function envelope(m: MockMatch): MatchEnvelope {
  const match = toMatch(m);
  return { ok: true, serverTime: iso(Date.now()), match };
}

function pick(problemId?: string): Problem {
  if (problemId) {
    const p = PROBLEMS.find((x) => x.id === problemId);
    if (!p) throw err(400, 'BAD_REQUEST', 'Đề không tồn tại.');
    return p;
  }
  return PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
}

function create(isPublic: boolean, problemId?: string): MockMatch {
  if (cur) throw err(409, 'ALREADY_IN_MATCH', 'Đang có trận.');
  cur = {
    id: nextId++, code: code6(), isPublic, status: 'waiting', problem: pick(problemId),
    createdAt: Date.now(), startedAt: null, deadlineAt: null, finishedAt: null, subs: [], oppBest: 0, result: null,
  };
  return cur;
}

function find(id: number): MockMatch {
  if (cur && cur.id === id) return cur;
  const f = finished.find((x) => x.id === id);
  if (f) return f;
  throw err(404, 'MATCH_NOT_FOUND', 'Không tìm thấy trận.');
}

let lastSubmitAt = 0;

export const mockApi = {
  problems: () => delay(PROBLEMS.map(META)),
  me: (): Promise<ArenaProfile> =>
    delay({ ok: true, ...profile, rank: profile.wins + profile.losses + profile.draws > 0 ? 7 : null }),
  createRoom: (problemId?: string) => delay(envelope(create(false, problemId))),
  joinRoom: (code: string): Promise<MatchEnvelope> => {
    if (!/^[A-Za-z0-9]{4,8}$/.test(code)) return Promise.reject(err(400, 'BAD_REQUEST', 'Mã sai định dạng.'));
    if (cur) return Promise.reject(err(409, 'ALREADY_IN_MATCH', 'Đang có trận.'));
    if (code.toUpperCase() !== 'ABC234') return Promise.reject(err(404, 'ROOM_NOT_FOUND', 'Không tìm thấy phòng.'));
    const m = create(false);
    m.status = 'active'; m.startedAt = Date.now(); m.deadlineAt = m.startedAt + m.problem.durationSec * 1000;
    return delay(envelope(m));
  },
  queue: (): Promise<QueueResponse> => {
    const m = cur && cur.status === 'waiting' && cur.isPublic ? cur : create(true);
    return delay({ queueStatus: 'waiting' as const, match: toMatch(m) });
  },
  current: (): Promise<CurrentMatchResponse> =>
    delay({ ok: true, serverTime: iso(Date.now()), match: cur ? toMatch(cur) : null }, 100),
  match: (id: number) => delay(envelope(find(id)), 100),
  cancel: (id: number) => {
    const m = find(id);
    if (m.status === 'cancelled') return delay(envelope(m));
    if (m.status !== 'waiting') return Promise.reject(err(409, 'MATCH_NOT_WAITING', 'Trận đã bắt đầu.'));
    m.status = 'cancelled'; m.finishedAt = Date.now(); cur = null;
    return delay(envelope(m));
  },
  forfeit: (id: number) => {
    const m = find(id);
    if (m.status === 'finished') return delay(envelope(m));
    if (m.status !== 'active') return Promise.reject(err(409, 'MATCH_NOT_ACTIVE', 'Trận không diễn ra.'));
    finish(m, 'forfeit', false);
    return delay(envelope(m));
  },
  submit: async (id: number, code: string): Promise<SubmitResponse> => {
    const m = find(id);
    tick(m);
    if (m.status !== 'active') throw err(409, 'MATCH_NOT_ACTIVE', 'Trận không diễn ra.');
    const wait = Math.ceil((lastSubmitAt + 10000 - Date.now()) / 1000);
    if (wait > 0) throw err(429, 'SUBMIT_TOO_FAST', 'Nộp quá nhanh.', wait);
    if (m.subs.length >= 10) throw err(429, 'SUBMIT_LIMIT', 'Quá số lần nộp.');
    lastSubmitAt = Date.now();
    await delay(null, 1800);
    const total = m.problem.testCount;
    const pubCount = m.problem.examples.length;
    const rejected = /import\s+os/.test(code);
    const passed = rejected ? 0 : Math.min(total, 4 * (m.subs.length + 1) - (m.subs.length > 1 ? 2 : 0));
    const sub: Submission = {
      id: nextSubId++, matchId: id, status: rejected ? 'rejected' : 'graded', passed, total,
      publicResults: rejected ? [] : m.problem.examples.map((ex, i) => (
        i < passed
          ? { index: i, passed: true }
          : { index: i, passed: false, got: String(JSON.stringify(ex.expected) === '0' ? 1 : 0), ...(i === 2 ? { error: 'ValueError: demo' } : {}) }
      )),
      hiddenPassed: Math.max(0, passed - pubCount), hiddenTotal: total - pubCount,
      message: rejected ? 'Mã vi phạm kiểm tra tĩnh: không được import os.' : null,
      createdAt: iso(Date.now()),
    };
    m.subs.unshift(sub);
    if (!rejected && passed === total) finish(m, 'solved', true);
    return { serverTime: iso(Date.now()), submission: sub, match: toMatch(m) };
  },
  submissions: (id: number) => delay(find(id).subs.slice(), 100),
  history: (limit: number, before?: number): Promise<HistoryResponse> => {
    const rows = finished.filter((m) => !before || m.id < before).slice(0, limit);
    return delay({
      ok: true, nextBefore: null,
      items: rows.map((m) => ({
        id: m.id, problemId: m.problem.id, problemTitle: m.problem.title, opponentName: BOT.name,
        outcome: m.result?.isDraw ? 'draw' as const : m.result?.winnerId === ME.id ? 'win' as const : 'loss' as const,
        ratingDelta: m.result?.myRatingDelta ?? 0, xp: m.result?.myXp ?? 0, endReason: m.result?.endReason ?? null,
        finishedAt: iso(m.finishedAt ?? Date.now()),
      })),
    });
  },
  leaderboard: (): Promise<LeaderboardResponse> => {
    const names = ['Hà Linh', 'Quốc Bảo', 'Minh Anh', 'Thu Trang', 'Đức Huy'];
    const entries = names.map((name, i) => ({
      id: 10 + i, name, avatar: name.charAt(0), value: 1200 - i * 45, rank: i + 1,
      wins: 12 - i, losses: i + 2, draws: i % 2, is_me: false,
    }));
    return delay({ ok: true, entries, me: null });
  },
};
