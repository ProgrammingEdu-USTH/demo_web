// Đấu code 1v1 VỚI MÁY — chạy hoàn toàn trên trình duyệt, không cần backend (dùng được khi offline).
// Cùng luật với bản online (server/src/arena): nộp tối đa 10 lần, cách nhau ≥ 10 s; đúng hết test là thắng ngay;
// hết giờ thì ai đúng nhiều test hơn thắng, bằng nhau thì ai nộp bài đó sớm hơn; đầu hàng thì thua.
// Bài được chấm bằng Pyodide ngay trên máy (grader.js) với cả test ẩn (offline-problems.json, xuất từ server).
// Đối thủ là bot tiến bộ theo lịch sinh ngẫu nhiên dựa trên Elo (như bản PE-3d trước khi nối server).
// Trận với máy là luyện tập: không đổi Elo, không cộng XP, không lưu lên server.
import PROBLEMS from './offline-problems.json';
import { grade } from './grader.js';

export const SUBMIT_GAP_MS = 10_000;
export const MAX_SUBMISSIONS = 10;
const BOTS = [
  ['Minh Anh (máy)', 1180, '#e4a33a'], ['Quốc Bảo (máy)', 1140, '#7b8bb5'], ['Thu Hà (máy)', 1110, '#c0773e'], ['Gia Huy (máy)', 1075, '#4f8a7a'],
  ['Ngọc Linh (máy)', 1050, '#b25b7c'], ['Đức Mạnh (máy)', 1020, '#5b6fb0'], ['Khánh Vy (máy)', 990, '#a0607a'], ['Tuấn Kiệt (máy)', 960, '#5d8a4f'],
  ['Bảo Ngọc (máy)', 930, '#8a6bb0'], ['Hải Đăng (máy)', 900, '#3f7f9a'],
];
const total = (p) => p.publicTests.length + p.hiddenTests.length;
const rnd = (a, b) => a + Math.random() * (b - a);
const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));

export class OfflineError extends Error { constructor(message, code) { super(message); this.code = code; } }

let M = null; // trận hiện tại
let me = { id: 'me', name: 'Bạn', rating: 1000 };
let seq = 1, subSeq = 1;
const subs = new Set();
const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
export function subscribe(f) { subs.add(f); return () => subs.delete(f); }

export const active = () => !!M;
export const problems = () => PROBLEMS.map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec, testCount: total(p) }));

/** Lịch nộp bài của bot: mạnh hơn bạn thì nhiều khả năng giải xong và giải sớm hơn. */
function planBot(p, bot) {
  const T = total(p), D = p.durationSec * 1000;
  const e = expected(bot.rating, me.rating);
  const solves = Math.random() < 0.3 + 0.55 * e;
  const endAt = solves ? D * rnd(0.22, 0.55 + 0.45 * (1 - e)) : D * rnd(0.55, 0.95);
  const finalPassed = solves ? T : Math.max(1, T - 1 - Math.floor(Math.random() * Math.ceil(T / 2)));
  const n = Math.max(1, Math.min(4, Math.round(rnd(1, 3.6))));
  const plan = [];
  for (let k = 1; k <= n; k++) {
    const at = Math.min(D - 1500, Math.max(k * (SUBMIT_GAP_MS + 2000), endAt * (k / n) + (k < n ? rnd(-8000, 8000) : 0)));
    const passed = k === n ? finalPassed : Math.max(0, Math.min(finalPassed - 1, Math.round(finalPassed * (k / n) * rnd(0.6, 1))));
    plan.push({ at: Math.round(at), passed });
  }
  return plan.sort((a, b) => a.at - b.at);
}

/** Bài tốt nhất: đúng nhiều nhất, bằng nhau thì nộp sớm hơn. */
function best(list) {
  let b = null;
  for (const s of list) {
    if (s.status && s.status !== 'graded') continue;
    if (!b || s.passed > b.passed || (s.passed === b.passed && s.createdAt < b.createdAt)) b = { passed: s.passed, createdAt: s.createdAt };
  }
  return b;
}

function finish(reason, { solver, forfeiter } = {}, at = Date.now()) {
  const p = M.problem, mb = best(M.subs), ob = best(M.botSubs);
  let winnerId = null;
  if (reason === 'solved') winnerId = solver;
  else if (reason === 'forfeit') winnerId = forfeiter === 'me' ? M.bot.id : 'me';
  else {
    const a = mb?.passed ?? 0, b = ob?.passed ?? 0;
    if (a !== b) winnerId = a > b ? 'me' : M.bot.id;
    else if (a > 0 && mb.createdAt !== ob.createdAt) winnerId = mb.createdAt < ob.createdAt ? 'me' : M.bot.id;
  }
  M.status = 'finished'; M.finishedAt = at;
  M.result = {
    winnerId, isDraw: winnerId === null, endReason: reason, practice: true, unscored: true,
    myRatingDelta: 0, opponentRatingDelta: 0, myXp: 0,
    myBestPassed: mb?.passed ?? 0, opponentBestPassed: ob?.passed ?? 0, total: total(p),
  };
}

/** Tiến trận theo thời gian: hết chờ → bắt đầu; bot nộp theo lịch; hết giờ → chốt. */
function tick(now = Date.now(), { timeout = true } = {}) {
  if (!M) return false;
  let changed = false;
  if (M.status === 'waiting' && now >= M.matchAt) {
    M.status = 'active'; M.startedAt = M.matchAt; M.deadlineAt = M.startedAt + M.problem.durationSec * 1000;
    M.plan = planBot(M.problem, M.bot); changed = true;
  }
  if (M.status === 'active') {
    const T = total(M.problem);
    while (M.plan.length && M.startedAt + M.plan[0].at <= Math.min(now, M.deadlineAt)) {
      const ev = M.plan.shift(), at = M.startedAt + ev.at;
      M.botSubs.push({ passed: ev.passed, createdAt: at }); changed = true;
      if (ev.passed === T) { finish('solved', { solver: M.bot.id }, at); return true; }
    }
    if (timeout && now >= M.deadlineAt && !M.subs.some((s) => s.status === 'pending')) { finish('timeout', {}, M.deadlineAt); changed = true; }
  }
  return changed;
}

export function poll() { if (tick()) emit(); return snapshot(); }

export function snapshot() {
  if (!M) return { conn: 'ok', me: { ...me }, match: null, offline: true };
  const p = M.problem, ob = best(M.botSubs), show = M.status !== 'waiting';
  return {
    conn: 'ok', offline: true, me: { ...me },
    match: {
      id: M.id, code: '', status: M.status, isPublic: true, offline: true,
      createdAt: M.createdAt, startedAt: M.startedAt, deadlineAt: M.deadlineAt, finishedAt: M.finishedAt,
      opponent: show ? { ...M.bot, submissionCount: M.botSubs.length, bestPassed: ob?.passed ?? 0 } : null,
      mySubmissionCount: M.subs.length, myBestPassed: best(M.subs)?.passed ?? 0,
      lastSubmitAt: M.subs.find((s) => s.status !== 'pending')?.createdAt ?? null,
      pending: M.subs.some((s) => s.status === 'pending'),
      submissions: M.subs.slice(),
      problem: show ? { id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec, statement: p.statement,
        signature: p.signature, starterCode: p.starterCode, examples: p.publicTests, testCount: total(p) } : null,
      problemMeta: { id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec },
      result: M.result,
    },
  };
}

/** Bắt đầu trận với máy (problemId tuỳ chọn). rating/name: hồ sơ hiện có để chọn bot cùng tầm. */
export function start(problemId, { rating, name } = {}) {
  if (M && (M.status === 'waiting' || M.status === 'active')) throw new OfflineError('Bạn đang ở trong một trận khác.', 'ALREADY_IN_MATCH');
  if (rating) me.rating = rating; if (name) me.name = name;
  const p = (problemId && PROBLEMS.find((x) => x.id === problemId)) || PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
  const near = BOTS.slice().sort((a, b) => Math.abs(a[1] - me.rating) - Math.abs(b[1] - me.rating)).slice(0, 3);
  const [bn, br, bc] = near[Math.floor(Math.random() * near.length)];
  const now = Date.now();
  M = { id: `off-${seq++}`, problem: p, bot: { id: 'bot', name: bn, rating: br, color: bc }, status: 'waiting',
    createdAt: now, matchAt: now + Math.round(rnd(1500, 3500)), startedAt: null, deadlineAt: null, finishedAt: null,
    subs: [], botSubs: [], plan: [], result: null };
  emit(); return snapshot();
}
export function cancel() { if (M?.status === 'waiting') { M = null; emit(); } return Promise.resolve(snapshot()); }
export function forfeit() {
  if (!M || M.status !== 'active') return Promise.reject(new OfflineError('Trận không còn diễn ra.', 'MATCH_NOT_ACTIVE'));
  M.subs.forEach((s) => { if (s.status === 'pending') { s.status = 'error'; s.message = 'Đã đầu hàng'; } });
  finish('forfeit', { forfeiter: 'me' }); emit(); return Promise.resolve(snapshot());
}
export function dismiss() { if (M && M.status !== 'waiting' && M.status !== 'active') { M = null; emit(); } }

/** Nộp bài: chấm đủ test công khai + test ẩn bằng Pyodide trên máy. */
export async function submit(code) {
  tick();
  if (!M || M.status !== 'active') throw new OfflineError('Trận không còn diễn ra (đã hết giờ hoặc kết thúc).', 'MATCH_NOT_ACTIVE');
  if (typeof code !== 'string' || !code.trim()) throw new OfflineError('Chưa có mã để nộp.', 'INVALID_CODE');
  if (M.subs.some((s) => s.status === 'pending')) throw new OfflineError('Bài trước đang được chấm.', 'SUBMIT_PENDING');
  if (M.subs.length >= MAX_SUBMISSIONS) throw new OfflineError(`Mỗi trận chỉ được nộp tối đa ${MAX_SUBMISSIONS} lần.`, 'SUBMIT_LIMIT');
  const now = Date.now(), last = M.subs[0]?.createdAt;
  if (last && now - last < SUBMIT_GAP_MS) throw new OfflineError(`Nộp quá nhanh, thử lại sau ${Math.ceil((SUBMIT_GAP_MS - (now - last)) / 1000)} giây.`, 'SUBMIT_TOO_FAST');
  const m = M, p = m.problem;
  const sub = { id: subSeq++, status: 'pending', passed: 0, total: total(p), publicResults: [], hiddenPassed: 0, hiddenTotal: p.hiddenTests.length, message: null, createdAt: now };
  m.subs.unshift(sub); emit();
  let r;
  try { r = await grade(code, [...p.publicTests, ...p.hiddenTests], { perTestMs: p.perTestMs, publicCount: p.publicTests.length }); }
  catch { r = { status: 'error', message: 'Bộ chấm trên máy gặp sự cố, hãy thử lại', passed: 0, publicResults: [], hiddenPassed: 0 }; }
  if (sub.status === 'pending') {
    Object.assign(sub, { status: r.status, message: r.message, passed: r.passed, publicResults: r.publicResults, hiddenPassed: r.hiddenPassed });
    if (M === m && m.status === 'active') {
      tick(Date.now(), { timeout: false }); // bot có thể đã giải xong trong lúc chấm
      if (m.status === 'active' && sub.status === 'graded' && sub.passed === sub.total) finish('solved', { solver: 'me' });
      else tick();
    }
  }
  emit();
  return { submission: { ...sub }, ...snapshot() };
}
