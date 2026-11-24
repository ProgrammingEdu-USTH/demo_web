// Trạng thái Arena phía trình duyệt, lấy từ backend (server/src/arena — module của demo_web).
// Server quyết định mọi luật: ghép trận, đồng hồ, chấm bài (test ẩn không rời server), Elo, XP.
// File này chỉ: gọi API, poll trận đang diễn ra (3 s, 5 s khi tab ẩn), đổi thời điểm ISO của
// server sang đồng hồ máy (bù lệch giờ bằng serverTime) và giữ một bản chụp cho ui.js vẽ.
import { arenaApi, describe, hasSession, syncName } from './api.js';

export const SUBMIT_GAP_MS = 10_000; // khớp server/src/arena/arena.service.ts
export const MAX_SUBMISSIONS = 10;
const POLL_MS = 3000, POLL_HIDDEN_MS = 5000, IDLE_MS = 30_000, RETRY_MS = 10_000;

export class ArenaError extends Error {
  constructor(message, code, retryAfter) { super(message); this.code = code; this.retryAfter = retryAfter; }
}
const wrap = (e) => new ArenaError(describe(e), e?.code, e?.retryAfter);

const COLORS = ['#e4a33a', '#7b8bb5', '#c0773e', '#4f8a7a', '#b25b7c', '#5b6fb0', '#a0607a', '#5d8a4f', '#8a6bb0', '#3f7f9a'];
export const colorFor = (id) => COLORS[Math.abs(Number(id) || 0) % COLORS.length];

const S = {
  conn: 'idle', // idle | connecting | ok | offline
  error: null,
  started: false,
  playerName: '',
  offset: 0, // serverTime − Date.now()
  me: { id: null, name: '', rating: 1000, wins: 0, losses: 0, draws: 0, rank: null },
  problems: [],
  history: [],
  board: [],
  raw: null, // trận theo dạng server trả
  subs: [], // bài nộp của tôi trong trận hiện tại (mới nhất trước)
  pending: false,
};
let nextNet = 0, inflight = false, starting = null;

const subs = new Set();
function emit() { subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }

const t = (iso) => { const v = Date.parse(iso ?? ''); return Number.isFinite(v) ? v - S.offset : null; };
function clockFrom(serverTime) { const v = Date.parse(serverTime ?? ''); if (Number.isFinite(v)) S.offset = v - Date.now(); }

/* ---------- nhận dữ liệu ---------- */
function applyMatch(m, serverTime) {
  clockFrom(serverTime);
  const prev = S.raw;
  if (!m || m.status === 'cancelled') { S.raw = null; S.subs = []; return; }
  if (prev?.id !== m.id) S.subs = [];
  S.raw = m;
  if (m.me) { S.me.id = m.me.id; S.me.name = m.me.name; if (m.status !== 'finished') S.me.rating = m.me.rating; }
  // vừa kết thúc → cập nhật Elo, lịch sử, bảng xếp hạng, danh sách bài đã chấm
  if (m.status === 'finished' && prev?.status !== 'finished') void afterFinish(m.id);
}
async function afterFinish(id) {
  await Promise.allSettled([loadMe(), loadLists(), loadSubs(id)]);
  emit();
}
function applyMe(r) { Object.assign(S.me, { rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws, rank: r.rank }); }
const loadMe = () => arenaApi.me().then(applyMe);
async function loadSubs(id) {
  const list = await arenaApi.submissions(id);
  if (S.raw?.id === id) S.subs = list;
}
async function loadLists() {
  const [h, lb] = await Promise.all([arenaApi.history(20), arenaApi.leaderboard()]);
  S.history = h.items;
  const rows = lb.entries.slice();
  if (lb.me && !rows.some((e) => e.is_me)) rows.push(lb.me);
  S.board = rows;
}
async function loadProblems() {
  const list = await arenaApi.problems();
  // danh sách không có số test → hỏi chi tiết từng đề (chỉ vài đề, gọi một lần)
  const detail = await Promise.all(list.map((p) => arenaApi.problem(p.id).catch(() => null)));
  S.problems = list.map((p, i) => ({ ...p, testCount: detail[i]?.testCount ?? null }));
}

/** Kết nối lần đầu (hoặc thử lại): tạo/khôi phục phiên khách, nạp hồ sơ, đề, trận đang dở. */
export function start({ quiet = false } = {}) {
  if (starting) return starting;
  if (!quiet) { S.conn = S.conn === 'ok' ? 'ok' : 'connecting'; S.error = null; emit(); } // tự thử lại thì giữ nguyên banner
  starting = (async () => {
    try {
      const cur = await arenaApi.current(); // lệnh đầu tiên: tạo/khôi phục phiên khách
      // tên hiển thị = tên người chơi trong Góc học; lỗi thì vẫn chơi được (thử lại lần kết nối sau)
      if (S.playerName) await syncName(S.playerName).catch((e) => console.warn('[arena] đặt tên', e));
      await Promise.all([loadMe(), loadProblems(), loadLists()]);
      if (!(S.raw?.status === 'finished' && !cur.match)) applyMatch(cur.match, cur.serverTime); // giữ màn kết quả đang xem
      if (S.raw && S.raw.status !== 'waiting') await loadSubs(S.raw.id).catch(() => {});
      S.conn = 'ok'; S.started = true;
    } catch (e) {
      S.conn = 'offline'; S.error = describe(e);
    } finally {
      starting = null; nextNet = Date.now() + (S.conn === 'offline' ? RETRY_MS : POLL_MS); emit();
    }
  })();
  return starting;
}

/** Nhịp mạng: trận đang chờ/đang đấu thì hỏi lại trận; rảnh thì thỉnh thoảng hỏi hồ sơ + trận hiện tại. */
async function net() {
  inflight = true;
  const m = S.raw;
  try {
    if (m && (m.status === 'waiting' || m.status === 'active')) {
      const env = await arenaApi.match(m.id);
      applyMatch(env.match, env.serverTime);
    } else if (!m) {
      const [cur] = await Promise.all([arenaApi.current(), loadMe()]);
      if (!S.raw) applyMatch(cur.match, cur.serverTime);
    }
    if (S.conn !== 'ok') { S.conn = 'ok'; S.error = null; }
  } catch (e) {
    if (e?.status === 404 && m) { S.raw = null; S.subs = []; } else if (e?.status === 0) { S.conn = 'offline'; S.error = describe(e); }
  } finally {
    inflight = false;
    const live = S.raw && (S.raw.status === 'waiting' || S.raw.status === 'active');
    nextNet = Date.now() + (live ? (document.hidden ? POLL_HIDDEN_MS : POLL_MS) : IDLE_MS);
    emit();
  }
}

/** Gọi định kỳ (UI mỗi 0,5 s, menu phòng mỗi 1 s). Không chặn: mạng chạy nền, trả bản chụp hiện có. */
export function poll() {
  if (!S.started) {
    // menu ngoài phòng: đã có phiên thì nạp nhẹ để hiện Elo; chưa từng vào Arena thì không tạo khách
    if (!starting && hasSession() && S.conn === 'idle') void start();
    else if (!starting && S.conn === 'offline' && Date.now() >= nextNet) void start({ quiet: true }); // máy chủ tắt: tự thử lại
  } else if (!inflight && !starting && Date.now() >= nextNet) void net();
  return snapshot();
}

/* ---------- đọc ---------- */
export function snapshot() {
  return { conn: S.conn, error: S.error, me: { ...S.me }, match: view() };
}
function view() {
  const m = S.raw; if (!m) return null;
  const p = m.problem;
  const T = p?.testCount ?? null;
  const r = m.result;
  const list = S.subs.map((x) => ({ ...x, createdAt: t(x.createdAt) }));
  if (S.pending) list.unshift({ id: 'pending', status: 'pending', createdAt: Date.now(), publicResults: [] });
  return {
    id: m.id, code: m.code, status: m.status, isPublic: m.isPublic, role: m.role,
    createdAt: t(m.createdAt), startedAt: t(m.startedAt), deadlineAt: t(m.deadlineAt), finishedAt: t(m.finishedAt),
    opponent: m.opponent ? { ...m.opponent, color: colorFor(m.opponent.id) } : null,
    mySubmissionCount: m.mySubmissionCount, myBestPassed: m.myBestPassed,
    lastSubmitAt: list.find((x) => x.status !== 'pending')?.createdAt ?? null,
    pending: S.pending,
    submissions: list,
    problem: p,
    problemMeta: p ? { id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec } : null,
    result: r ? { ...r, total: T, unscored: !r.isDraw && r.myRatingDelta === 0 && r.opponentRatingDelta === 0 && r.myXp === 0 } : null,
  };
}
export const problems = () => S.problems.slice();
export const history = () => S.history.map((x) => ({ ...x, finishedAt: Date.parse(x.finishedAt), unscored: x.outcome !== 'draw' && x.ratingDelta === 0 && x.xp === 0 }));
export const leaderboard = () => S.board.map((e) => ({ id: e.id, name: e.name, rating: e.value, rank: e.rank, wins: e.wins, losses: e.losses, draws: e.draws, isMe: e.is_me, color: colorFor(e.id) }));

/* ---------- ghi (đều async, lỗi ném ArenaError có thông điệp tiếng Việt) ---------- */
async function act(fn) {
  try {
    const env = await fn();
    applyMatch(env.match, env.serverTime);
    nextNet = Date.now() + POLL_MS;
    return snapshot();
  } catch (e) {
    if (e?.code === 'ALREADY_IN_MATCH' || e?.code === 'MATCH_NOT_ACTIVE' || e?.code === 'MATCH_NOT_WAITING') nextNet = 0; // đồng bộ lại ngay
    throw wrap(e);
  } finally { emit(); }
}
/** Ghép ngẫu nhiên: vào phòng công khai đang chờ hoặc tạo phòng công khai mới. */
export const queue = () => act(() => arenaApi.queue());
/** Phòng riêng (có mã mời); problemId tuỳ chọn để chọn đề. */
export const createRoom = (problemId) => act(() => arenaApi.createRoom(problemId));
export const joinRoom = (code) => act(() => arenaApi.joinRoom(String(code || '').trim().toUpperCase()));
export function cancel() { const m = S.raw; if (!m) return Promise.resolve(snapshot()); return act(() => arenaApi.cancel(m.id)); }
export function forfeit() {
  const m = S.raw; if (!m || m.status !== 'active') return Promise.reject(new ArenaError('Trận không còn diễn ra.', 'MATCH_NOT_ACTIVE'));
  return act(() => arenaApi.forfeit(m.id));
}
/** Rời màn kết quả, về sảnh. */
export function dismiss() { if (S.raw && S.raw.status !== 'waiting' && S.raw.status !== 'active') { S.raw = null; S.subs = []; nextNet = 0; emit(); } }

/** Nộp bài: server chấm cả test công khai lẫn test ẩn rồi mới trả lời (tối đa ~30 s). */
export async function submit(code) {
  const m = S.raw;
  if (!m || m.status !== 'active') throw new ArenaError('Trận không còn diễn ra (đã hết giờ hoặc kết thúc).', 'MATCH_NOT_ACTIVE');
  if (typeof code !== 'string' || !code.trim()) throw new ArenaError('Chưa có mã để nộp.', 'INVALID_CODE');
  if (S.pending) throw new ArenaError('Bài trước đang được chấm.', 'SUBMIT_PENDING');
  S.pending = true; emit();
  try {
    const r = await arenaApi.submit(m.id, code);
    if (S.raw?.id === m.id) S.subs = [r.submission, ...S.subs.filter((x) => x.id !== r.submission.id)];
    applyMatch(r.match, r.serverTime);
    return { submission: r.submission, ...snapshot() };
  } catch (e) {
    if (e?.code === 'MATCH_NOT_ACTIVE') nextNet = 0;
    throw wrap(e);
  } finally {
    S.pending = false; nextNet = Math.min(nextNet, Date.now() + POLL_MS); emit();
  }
}

export function setPlayerName(name) {
  const n = String(name || '').trim(); if (!n) return;
  S.playerName = n;
  if (S.started) void syncName(n).catch((e) => console.warn('[arena] đặt tên', e)); // menu đã kết nối trước khi mở Arena
}
