/**
 * arena-api.ts — client cho API Arena (xem arena-team/contracts/openapi.yaml).
 *
 * Mọi lời gọi đi qua `apiFetch` (token + refresh 401 do api.ts lo). Lỗi ném
 * `ArenaApiError`. Đặt NEXT_PUBLIC_ARENA_MOCK=1 để dùng dữ liệu giả (arena-mock.ts)
 * khi backend chưa xong; tắt thì gọi đúng /api/arena/... của hợp đồng.
 */
import { apiFetch } from '@/lib/api';
import { mockApi } from '@/lib/arena-mock';

// ───────────────────────── Kiểu dữ liệu (bám openapi.yaml) ─────────────────────────

export type Difficulty = 'easy' | 'medium';
export type MatchStatus = 'waiting' | 'active' | 'finished' | 'cancelled';
export type EndReason = 'solved' | 'timeout' | 'forfeit';

export interface ProblemMeta {
  id: string;
  title: string;
  difficulty: Difficulty;
  durationSec: number;
}

export interface ProblemExample {
  args: unknown[];
  expected: unknown;
}

export interface Problem extends ProblemMeta {
  statement: string;
  signature: string;
  starterCode: string;
  examples: ProblemExample[];
  testCount: number;
}

export interface Player {
  id: number;
  name: string;
  rating: number;
}

export interface Opponent extends Player {
  submissionCount: number;
  bestPassed: number;
}

export interface MatchResult {
  winnerId: number | null;
  isDraw: boolean;
  endReason: EndReason | null;
  myRatingDelta: number;
  opponentRatingDelta: number;
  myXp: number;
  myBestPassed: number;
  opponentBestPassed: number;
}

export interface Match {
  id: number;
  code: string;
  status: MatchStatus;
  isPublic: boolean;
  role: 'host' | 'guest';
  createdAt: string;
  startedAt: string | null;
  deadlineAt: string | null;
  finishedAt: string | null;
  me: Player;
  opponent: Opponent | null;
  mySubmissionCount: number;
  myBestPassed: number;
  problem: Problem | null;
  result: MatchResult | null;
}

export interface MatchEnvelope {
  ok: boolean;
  serverTime: string;
  match: Match;
}

export interface PublicResult {
  index: number;
  passed: boolean;
  got?: string;
  error?: string;
}

export interface Submission {
  id: number;
  matchId: number;
  status: 'graded' | 'rejected' | 'error';
  passed: number;
  total: number;
  publicResults: PublicResult[];
  hiddenPassed: number;
  hiddenTotal: number;
  message: string | null;
  createdAt: string;
}

export interface SubmitResponse {
  serverTime: string;
  submission: Submission;
  match: Match;
}

export interface ArenaProfile {
  ok: boolean;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number | null;
}

export interface CurrentMatchResponse {
  ok: boolean;
  serverTime: string;
  match: Match | null;
}

export interface QueueResponse {
  queueStatus: 'waiting' | 'matched';
  match: Match;
}

export interface HistoryItem {
  id: number;
  problemId: string;
  problemTitle: string;
  opponentName: string;
  outcome: 'win' | 'loss' | 'draw';
  ratingDelta: number;
  xp: number;
  endReason: EndReason | null;
  finishedAt: string;
}

export interface HistoryResponse {
  ok: boolean;
  nextBefore: number | null;
  items: HistoryItem[];
}

export interface RankEntry {
  id: number;
  name: string;
  avatar: string;
  value: number;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  is_me: boolean;
}

export interface LeaderboardResponse {
  ok: boolean;
  entries: RankEntry[];
  me: RankEntry | null;
}

// ───────────────────────── Lỗi ─────────────────────────

export class ArenaApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;

  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'ArenaApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Thông điệp tiếng Việt cho người dùng theo mã lỗi của hợp đồng. */
export function describeArenaError(e: unknown): string {
  if (!(e instanceof ArenaApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  switch (e.code) {
    case 'ALREADY_IN_MATCH': return 'Bạn đang ở trong một trận khác.';
    case 'CANNOT_JOIN_OWN_ROOM': return 'Không thể vào phòng do chính bạn tạo.';
    case 'ROOM_NOT_FOUND': return 'Không tìm thấy phòng (sai mã, đã hết hạn hoặc đã đủ người).';
    case 'MATCH_NOT_FOUND': return 'Không tìm thấy trận này.';
    case 'MATCH_NOT_ACTIVE': return 'Trận không còn diễn ra (đã hết giờ hoặc kết thúc).';
    case 'MATCH_NOT_WAITING': return 'Trận đã bắt đầu hoặc kết thúc, không thể huỷ.';
    case 'SUBMIT_LIMIT': return 'Bạn đã dùng hết số lần nộp của trận này.';
    case 'SUBMIT_TOO_FAST':
      return e.retryAfter ? `Nộp quá nhanh, thử lại sau ${e.retryAfter} giây.` : 'Nộp quá nhanh, vui lòng đợi chút.';
    case 'GRADER_BUSY': case 'GRADER_DISABLED': return 'Hệ thống chấm đang bận, thử lại sau.';
    default: break;
  }
  if (e.status === 429) {
    return e.retryAfter ? `Thao tác quá nhanh, thử lại sau ${e.retryAfter} giây.` : 'Thao tác quá nhanh, vui lòng thử lại sau.';
  }
  if (e.status === 503) return 'Hệ thống chấm đang bận, thử lại sau.';
  if (e.status === 0) return e.message;
  return e.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

// ───────────────────────── Lõi gọi API ─────────────────────────

export const ARENA_MOCK = process.env.NEXT_PUBLIC_ARENA_MOCK === '1';

type Init = { method?: string; body?: unknown; timeoutMs?: number; signal?: AbortSignal };

async function request<T>(path: string, init: Init = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  const onAbort = () => ctrl.abort();
  init.signal?.addEventListener('abort', onAbort);
  try {
    const res = await apiFetch(path, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      // Phong bì thật: { error: { status, message, detail, code? }, request_id }; dự phòng message/code ở gốc.
      type Env = { message?: unknown; code?: unknown };
      const d = (data && typeof data === 'object' ? data : {}) as Env & { error?: Env };
      const err: Env = d.error && typeof d.error === 'object' ? d.error : {};
      const rawMsg = err.message ?? d.message;
      const msg = Array.isArray(rawMsg) ? rawMsg.join('; ') : typeof rawMsg === 'string' ? rawMsg : '';
      const rawCode = err.code ?? d.code;
      const ra = Number(res.headers.get('Retry-After'));
      throw new ArenaApiError(
        res.status,
        msg || `Lỗi ${res.status}`,
        typeof rawCode === 'string' ? rawCode : undefined,
        Number.isFinite(ra) && ra > 0 ? ra : undefined,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ArenaApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ArenaApiError(0, init.signal?.aborted ? 'Đã huỷ yêu cầu.' : 'Quá thời gian chờ máy chủ.', 'TIMEOUT');
    }
    throw new ArenaApiError(0, 'Không kết nối được máy chủ.', 'NETWORK');
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

/** 401 sau khi apiFetch đã thử refresh → về trang đăng nhập, quay lại đúng chỗ. */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = window.location.pathname + window.location.search;
  window.location.href = '/login?next=' + encodeURIComponent(next);
}

// ───────────────────────── Các hàm API ─────────────────────────

export const arenaApi = {
  async problems(): Promise<ProblemMeta[]> {
    if (ARENA_MOCK) return mockApi.problems();
    const r = await request<{ problems: ProblemMeta[] }>('/api/arena/problems');
    return r.problems;
  },
  async me(): Promise<ArenaProfile> {
    if (ARENA_MOCK) return mockApi.me();
    return request<ArenaProfile>('/api/arena/me');
  },
  async createRoom(problemId?: string): Promise<MatchEnvelope> {
    if (ARENA_MOCK) return mockApi.createRoom(problemId);
    return request<MatchEnvelope>('/api/arena/rooms', { method: 'POST', body: problemId ? { problemId } : {} });
  },
  async joinRoom(code: string): Promise<MatchEnvelope> {
    if (ARENA_MOCK) return mockApi.joinRoom(code);
    return request<MatchEnvelope>('/api/arena/rooms/join', { method: 'POST', body: { code } });
  },
  async queue(): Promise<QueueResponse> {
    if (ARENA_MOCK) return mockApi.queue();
    return request<QueueResponse>('/api/arena/queue', { method: 'POST', body: {} });
  },
  async current(): Promise<CurrentMatchResponse> {
    if (ARENA_MOCK) return mockApi.current();
    return request<CurrentMatchResponse>('/api/arena/matches/current');
  },
  async match(id: number): Promise<MatchEnvelope> {
    if (ARENA_MOCK) return mockApi.match(id);
    return request<MatchEnvelope>(`/api/arena/matches/${id}`);
  },
  async cancel(id: number): Promise<MatchEnvelope> {
    if (ARENA_MOCK) return mockApi.cancel(id);
    return request<MatchEnvelope>(`/api/arena/matches/${id}/cancel`, { method: 'POST', body: {} });
  },
  async forfeit(id: number): Promise<MatchEnvelope> {
    if (ARENA_MOCK) return mockApi.forfeit(id);
    return request<MatchEnvelope>(`/api/arena/matches/${id}/forfeit`, { method: 'POST', body: {} });
  },
  /** Đồng bộ: server trả khi chấm xong (tối đa ~30 s) → timeout 40 s. */
  async submit(id: number, code: string, signal?: AbortSignal): Promise<SubmitResponse> {
    if (ARENA_MOCK) return mockApi.submit(id, code);
    return request<SubmitResponse>(`/api/arena/matches/${id}/submissions`, {
      method: 'POST',
      body: { code },
      timeoutMs: 40000,
      signal,
    });
  },
  async submissions(id: number): Promise<Submission[]> {
    if (ARENA_MOCK) return mockApi.submissions(id);
    const r = await request<{ submissions: Submission[] }>(`/api/arena/matches/${id}/submissions`);
    return r.submissions;
  },
  async history(limit = 20, before?: number): Promise<HistoryResponse> {
    if (ARENA_MOCK) return mockApi.history(limit, before);
    const q = new URLSearchParams({ limit: String(limit) });
    if (before) q.set('before', String(before));
    return request<HistoryResponse>(`/api/arena/history?${q.toString()}`);
  },
  async leaderboard(): Promise<LeaderboardResponse> {
    if (ARENA_MOCK) return mockApi.leaderboard();
    return request<LeaderboardResponse>('/api/arena/leaderboard');
  },
};
