/**
 * Luật thắng/thua và điểm Elo của Arena — HÀM THUẦN, không đụng DB/đồng hồ.
 * Đây là NƠI DUY NHẤT quyết định kết quả trận (xem contracts/features.md §2-3).
 */

export const ELO_K = 32;
export const DEFAULT_RATING = 1000;
export const XP_WIN = 50;
export const XP_LOSS = 10;
export const XP_DRAW = 20;

export type EndReason = 'solved' | 'timeout' | 'forfeit';

/** Bài tốt nhất của một người chơi (null nếu chưa có lần nộp graded hợp lệ). */
export interface BestSubmission {
  passed: number;
  createdAt: Date;
  id: number;
}

export interface OutcomeInput {
  reason: EndReason;
  hostId: number;
  guestId: number;
  hostBest: BestSubmission | null;
  guestBest: BestSubmission | null;
  /** reason = 'solved': người vừa đạt 100%. */
  solverId?: number;
  /** reason = 'forfeit': người đầu hàng. */
  forfeiterId?: number;
  /** reason = 'forfeit': thời điểm bắt đầu trận và hiện tại (chống cày điểm). */
  startedAt?: Date | null;
  now?: Date;
}

export interface Outcome {
  winnerId: number | null;
  isDraw: boolean;
  /** true: trận vẫn kết thúc có người thắng nhưng không tính Elo/thống kê/XP. */
  unscored?: boolean;
}

/** Đầu hàng chỉ được tính điểm khi trận đủ dài và người thắng đã có bài đạt ≥ 1 test. */
export const FORFEIT_MIN_MS = 60_000;

/** Hơn kém của bài tốt nhất: >0 nếu a tốt hơn b. */
function compareBest(a: BestSubmission | null, b: BestSubmission | null) {
  const pa = a?.passed ?? 0;
  const pb = b?.passed ?? 0;
  if (pa !== pb) return pa > pb ? 1 : -1;
  if (pa === 0 || !a || !b) return 0;
  const ta = a.createdAt.getTime();
  const tb = b.createdAt.getTime();
  if (ta !== tb) return ta < tb ? 1 : -1; // nộp sớm hơn thì tốt hơn
  return 0; // bằng nhau tuyệt đối -> hoà (không dùng id để phân định)
}

export function computeOutcome(input: OutcomeInput): Outcome {
  const { hostId, guestId } = input;
  if (input.reason === 'solved') {
    const w = input.solverId;
    if (w !== hostId && w !== guestId) throw new Error('solverId không hợp lệ');
    return { winnerId: w, isDraw: false };
  }
  if (input.reason === 'forfeit') {
    const f = input.forfeiterId;
    if (f !== hostId && f !== guestId) {
      throw new Error('forfeiterId không hợp lệ');
    }
    const winnerId = f === hostId ? guestId : hostId;
    const best = winnerId === hostId ? input.hostBest : input.guestBest;
    const elapsed =
      input.startedAt && input.now
        ? input.now.getTime() - input.startedAt.getTime()
        : 0;
    const scored = (best?.passed ?? 0) >= 1 && elapsed >= FORFEIT_MIN_MS;
    return { winnerId, isDraw: false, unscored: !scored };
  }
  const c = compareBest(input.hostBest, input.guestBest);
  if (c === 0) return { winnerId: null, isDraw: true };
  return { winnerId: c > 0 ? hostId : guestId, isDraw: false };
}

/** Điểm kỳ vọng của bên A khi đấu với B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** delta Elo của bên A; S = 1 thắng / 0.5 hoà / 0 thua. Bên B nhận -delta. */
export function eloDelta(ratingA: number, ratingB: number, s: number): number {
  const d = Math.round(ELO_K * (s - expectedScore(ratingA, ratingB)));
  return d === 0 ? 0 : d; // tránh -0
}

export type SideResult = 'win' | 'loss' | 'draw' | 'none';

export interface SettleInput extends Outcome {
  hostId: number;
  hostRating: number;
  guestRating: number;
  hostPassed: number;
  guestPassed: number;
}

export interface Settlement {
  hostDelta: number;
  guestDelta: number;
  hostNewRating: number;
  guestNewRating: number;
  hostXp: number;
  guestXp: number;
  hostResult: SideResult;
  guestResult: SideResult;
}

function xpFor(result: SideResult, passed: number): number {
  if (result === 'win') return XP_WIN;
  if (passed < 1) return 0;
  if (result === 'loss') return XP_LOSS;
  if (result === 'draw') return XP_DRAW;
  return 0;
}

/**
 * Từ kết quả (thắng/hoà) tính delta thực tế (đã chặn sàn 0 từng bên), XP và
 * loại thống kê. Hoà mà cả hai 0 test: không đổi rating/thống kê/XP.
 */
export function settleMatch(i: SettleInput): Settlement {
  if (i.unscored || (i.isDraw && i.hostPassed < 1 && i.guestPassed < 1)) {
    return {
      hostDelta: 0,
      guestDelta: 0,
      hostNewRating: i.hostRating,
      guestNewRating: i.guestRating,
      hostXp: 0,
      guestXp: 0,
      hostResult: 'none',
      guestResult: 'none',
    };
  }
  let hostResult: SideResult;
  let guestResult: SideResult;
  let s: number;
  if (i.isDraw) {
    hostResult = guestResult = 'draw';
    s = 0.5;
  } else if (i.winnerId === i.hostId) {
    hostResult = 'win';
    guestResult = 'loss';
    s = 1;
  } else {
    hostResult = 'loss';
    guestResult = 'win';
    s = 0;
  }
  const raw = eloDelta(i.hostRating, i.guestRating, s);
  const hostNewRating = Math.max(0, i.hostRating + raw);
  const guestNewRating = Math.max(0, i.guestRating - raw);
  return {
    hostDelta: hostNewRating - i.hostRating,
    guestDelta: guestNewRating - i.guestRating,
    hostNewRating,
    guestNewRating,
    hostXp: xpFor(hostResult, i.hostPassed),
    guestXp: xpFor(guestResult, i.guestPassed),
    hostResult,
    guestResult,
  };
}
