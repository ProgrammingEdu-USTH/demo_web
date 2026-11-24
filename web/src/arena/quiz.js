// Arena · Đoán output — chuyển từ app "Arena" trong máy tính Góc học của pe-usth (nhánh test,
// frontend/public/goc-hoc/may-tinh/mac.js): 1 chọi 1, 5 câu, 15 giây mỗi câu, đoán đoạn code in ra gì;
// đúng được 100 điểm + 10 điểm cho mỗi giây còn lại; hạng Đồng → Kim cương theo điểm Elo.
//
// Hai cách đấu, cùng một giao diện:
//  · Online: đối thủ là người thật, server (server/src/arena-quiz) giữ đáp án, đồng hồ và Elo.
//  · Với máy: như bản pe-usth — bot trả lời sau 3–11 giây, đúng khoảng 65%; chạy trên máy, không tính Elo.
// Câu hỏi: server/src/arena-quiz/quiz-bank.json (ví dụ có output cố định trong "Sổ Học" của pe-usth).
import BANK from '../../../server/src/arena-quiz/quiz-bank.json';
import { quizApi, describe } from './api.js';

const Q_MS = 15_000, REVEAL_MS = 3_000, COUNTDOWN_MS = 3_000, N = 5; // khớp server/src/arena-quiz/quiz-logic.ts
const TIERS = [[0, 'Đồng', '#c98b5a'], [1100, 'Bạc', '#cfd3e0'], [1300, 'Vàng', '#ffc97a'], [1500, 'Bạch kim', '#9ad8ff'], [1700, 'Kim cương', '#c9b3ff']];
const BOTS = [['mocha_dev', 1205], ['bug_san_bat', 1342], ['latte_lambda', 1288], ['tra_dao_tuple', 1150], ['pha_che_numpy', 1410], ['meo_ngu_trua', 1096], ['bac_xiu_bit', 980]];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function tierOf(e) {
  let i = 0; TIERS.forEach((t, k) => { if (e >= t[0]) i = k; });
  const t = TIERS[i], nx = TIERS[i + 1];
  const sub = nx ? ['III', 'II', 'I'][Math.min(2, Math.floor((e - t[0]) / ((nx[0] - t[0]) / 3)))] : '';
  return { name: t[1], col: t[2], sub, label: `${t[1]}${sub ? ' ' + sub : ''}`, next: nx ? { at: nx[0], name: nx[1] } : null, base: t[0] };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KW = /\b(def|return|if|elif|else|for|in|while|break|continue|try|except|finally|as|import|from|class|with|lambda|and|or|not|is|None|True|False|print|len|range|self)\b/;
/** Tô màu Python đơn giản cho khung code (comment, chuỗi, từ khoá, số). */
function hlPy(src) {
  const re = new RegExp(`(#[^\\n]*)|(f?"[^"\\n]*"|f?'[^'\\n]*')|${KW.source}|(\\b\\d+(?:\\.\\d+)?\\b)`, 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}
const initials = (n) => String(n || '?').split(/[\s_]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${s}`; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ---------- lịch câu hỏi (giống server: câu đóng khi hết 15 s hoặc khi cả hai đã trả lời) ---------- */
function timeline(start, answers, players) {
  const slots = []; let openAt = start;
  for (let i = 0; i < N; i++) {
    const deadline = openAt + Q_MS;
    const mine = answers.filter((a) => a.q === i && a.at < deadline);
    const all = players.every((p) => mine.some((a) => a.who === p));
    const closeAt = all ? Math.max(...mine.map((a) => a.at)) : deadline;
    slots.push({ index: i, openAt, closeAt, revealUntil: closeAt + REVEAL_MS });
    openAt = closeAt + REVEAL_MS;
  }
  return slots;
}
const points = (ok, ms) => (ok ? 100 + Math.round(Math.max(0, (Q_MS - ms) / 1000) * 10) : 0);

/* ---------- trạng thái ---------- */
let root = null, ctx = {}, tick = null, pollT = null, inflight = false;
let S = freshState();
function freshState() {
  return { view: 'lobby', kind: null, me: { rating: 1000, wins: 0, losses: 0, draws: 0, rank: null }, board: [], loaded: false,
    online: null, offset: 0, bot: null, picked: {}, lastKey: '', note: '', sureUntil: 0 };
}
const toast = (t) => (ctx.toast ? ctx.toast(t) : console.info(t));
const $ = (s) => root?.querySelector(s);
const now = () => Date.now();

/** Trận đang chơi (online hoặc với máy) ở dạng chung cho giao diện. */
function match() {
  if (S.kind === 'online' && S.online) return S.online;
  if (S.kind === 'bot' && S.bot) return botView();
  return null;
}
export function hasLive() { const m = match(); return !!m && (m.status === 'waiting' || m.status === 'active'); }
export function status() {
  const m = match(); if (!m) return null;
  if (m.status === 'waiting') return { text: 'Đoán output · đang tìm đối thủ…', live: true };
  if (m.status === 'active') return { text: `Đoán output · ${m.current == null ? 'sắp bắt đầu' : `câu ${m.current + 1}/${N}`} · ${m.myScore}:${m.oppScore}`, live: true };
  return null;
}

/* ---------- online: nhận trận từ server, đổi giờ ISO sang đồng hồ máy ---------- */
function applyOnline(env) {
  const v = Date.parse(env.serverTime ?? ''); if (Number.isFinite(v)) S.offset = v - Date.now();
  const m = env.match;
  if (!m) { S.online = null; return; }
  const t = (iso) => { const x = Date.parse(iso ?? ''); return Number.isFinite(x) ? x - S.offset : null; };
  S.online = {
    kind: 'online', id: m.id, status: m.status, phase: m.phase, current: m.current, total: m.total || N,
    createdAt: t(m.createdAt), startedAt: t(m.startedAt), endsAt: t(m.endsAt),
    me: m.me, opponent: m.opponent, myScore: m.myScore, oppScore: m.oppScore, result: m.result,
    questions: m.questions.map((q) => ({ ...q, openAt: t(q.openAt), closeAt: t(q.closeAt), revealUntil: t(q.revealUntil) })),
  };
}
async function pollOnline() {
  if (inflight || S.kind !== 'online' || !S.online) return;
  const m = S.online;
  if (m.status !== 'waiting' && m.status !== 'active') return;
  inflight = true;
  try { applyOnline(await quizApi.match(m.id)); } catch (e) { if (e?.status === 404) S.online = null; }
  finally { inflight = false; }
  if (S.online?.status === 'finished') void loadProfile();
  if (S.online?.status === 'cancelled') { S.online = null; S.kind = null; S.note = 'Chưa có ai vào trận trong 60 giây. Thử lại, hoặc đấu với máy.'; }
  render();
}
async function loadProfile() {
  try {
    const [me, lb] = await Promise.all([quizApi.me(), quizApi.leaderboard()]);
    S.me = me; const rows = lb.entries.slice(); if (lb.me && !rows.some((e) => e.is_me)) rows.push(lb.me); S.board = rows; S.loaded = true;
  } catch (e) { S.loaded = 'err'; S.err = describe(e); }
  render();
}
async function resumeOnline() {
  try { const env = await quizApi.current(); if (env.match) { S.kind = 'online'; applyOnline(env); } } catch { /* chưa kết nối: sảnh tự báo */ }
  render();
}

/* ---------- với máy: chạy cục bộ theo đúng lịch của bản online ---------- */
function startBot() {
  const items = shuffle(BANK).slice(0, N);
  const qs = items.map((q) => {
    const wrong = shuffle([...new Set(BANK.map((x) => x.output).filter((o) => o !== q.output))]).slice(0, 3);
    const opts = shuffle([q.output, ...wrong]);
    return { code: q.code, lesson: q.lesson, opts, answer: opts.indexOf(q.output) };
  });
  const r = S.me.rating || 1000;
  const op = BOTS.slice().sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[Math.floor(Math.random() * 2)];
  // bot: trả lời sau 3–11 giây kể từ lúc câu mở, đúng khoảng 65% (như pe-usth); thời điểm tính lại khi câu mở
  const plan = qs.map((q) => {
    const right = Math.random() < 0.65;
    return { delay: 3000 + Math.random() * 8000, choice: right ? q.answer : (q.answer + 1 + Math.floor(Math.random() * 3)) % 4 };
  });
  S.kind = 'bot'; S.picked = {};
  S.bot = { op: { id: -1, name: op[0], rating: op[1] }, qs, plan, start: now() + COUNTDOWN_MS, mine: [], status: 'active', finishedAt: null };
  render();
}
function botAnswers(b, t) {
  // dựng dần: câu i mở khi câu i-1 xong, nên phải tính lịch từng câu theo thứ tự
  const ans = b.mine.slice();
  for (let i = 0; i < N; i++) {
    const slots = timeline(b.start, ans, ['me', 'bot']);
    const s = slots[i];
    const at = s.openAt + b.plan[i].delay;
    if (at < s.openAt + Q_MS && at <= t) ans.push({ q: i, who: 'bot', at, choice: b.plan[i].choice });
    if (s.openAt > t) break;
  }
  return ans;
}
function botView() {
  const b = S.bot, t = now();
  const ans = botAnswers(b, t);
  const slots = timeline(b.start, ans, ['me', 'bot']);
  const end = slots[N - 1].revealUntil;
  const done = b.status === 'finished' || t >= end;
  let phase = 'countdown', current = null;
  if (done) phase = 'done';
  else if (t >= b.start) for (const s of slots) { if (t < s.closeAt) { phase = 'question'; current = s.index; break; } if (t < s.revealUntil) { phase = 'reveal'; current = s.index; break; } }
  const questions = slots.filter((s) => done || s.openAt <= t).map((s) => {
    const q = b.qs[s.index], closed = done || t >= s.closeAt;
    const me = ans.find((a) => a.q === s.index && a.who === 'me'), bo = ans.find((a) => a.q === s.index && a.who === 'bot');
    return { index: s.index, code: q.code, lesson: q.lesson, opts: q.opts, openAt: s.openAt, closeAt: s.closeAt, revealUntil: s.revealUntil, closed,
      answer: closed ? q.answer : null, myChoice: me?.choice ?? null, myPoints: closed ? points(me?.choice === q.answer, (me?.at ?? 0) - s.openAt) : null,
      oppAnswered: !!bo, oppChoice: closed ? (bo?.choice ?? null) : null, oppPoints: closed ? (bo ? points(bo.choice === q.answer, bo.at - s.openAt) : 0) : null };
  });
  const sum = (k) => questions.filter((q) => q.closed).reduce((x, q) => x + (q[k] || 0), 0);
  const myScore = sum('myPoints'), oppScore = sum('oppPoints');
  const forfeit = b.status === 'finished' && b.forfeit;
  const win = forfeit ? false : myScore > oppScore, draw = !forfeit && myScore === oppScore;
  return { kind: 'bot', status: done ? 'finished' : 'active', phase, current, total: N, startedAt: b.start, me: { name: 'Bạn', rating: S.me.rating }, opponent: b.op,
    myScore, oppScore, questions,
    result: done ? { winnerId: win ? 'me' : draw ? null : -1, isDraw: draw, endReason: forfeit ? 'forfeit' : 'completed', unscored: true, myRatingDelta: 0, myXp: 0, practice: true } : null };
}

/* ---------- hành động ---------- */
let busy = false;
async function act(fn) {
  if (busy) return; busy = true; render();
  try { await fn(); } catch (e) { toast(describe(e)); }
  busy = false; render();
}
const queueOnline = () => act(async () => { S.note = ''; S.picked = {}; const r = await quizApi.queue(); S.kind = 'online'; applyOnline(r); });
const cancelOnline = () => act(async () => { if (!S.online) return; applyOnline(await quizApi.cancel(S.online.id)); S.online = null; S.kind = null; toast('Đã huỷ tìm trận'); });
function pick(i) {
  const m = match(); if (!m || m.phase !== 'question') return;
  const q = m.questions[m.current]; if (!q || q.myChoice != null || S.picked[m.current] != null) return;
  S.picked[m.current] = i; render();
  if (S.kind === 'bot') { S.bot.mine.push({ q: m.current, who: 'me', at: now(), choice: i }); render(); return; }
  const idx = m.current;
  quizApi.answer(m.id, idx, i).then((env) => { applyOnline(env); render(); }).catch((e) => { delete S.picked[idx]; toast(describe(e)); render(); });
}
function forfeit() {
  // xác nhận nằm trong state (không nằm trên nút): khối câu hỏi có thể vẽ lại giữa hai lần bấm
  if (now() >= S.sureUntil) { S.sureUntil = now() + 3000; S.lastKey = ''; render(); setTimeout(() => { S.lastKey = ''; render(); }, 3050); return; }
  S.sureUntil = 0;
  if (S.kind === 'bot') { S.bot.status = 'finished'; S.bot.forfeit = true; render(); return; }
  act(async () => { applyOnline(await quizApi.forfeit(S.online.id)); void loadProfile(); });
}
function leave() { S.online = null; S.bot = null; S.kind = null; S.picked = {}; render(); }

/* ---------- vẽ ---------- */
function lobbyHTML() {
  const t = tierOf(S.me.rating || 1000);
  const prog = t.next ? Math.min(1, ((S.me.rating || 1000) - t.base) / (t.next.at - t.base)) : 1;
  const board = S.loaded === true ? (S.board.length ? `<ul class="ar-list ar-lb">${S.board.map((e) => `<li class="${e.is_me ? 'ar-me' : ''}"><span class="rk">${e.rank}</span>
      <span class="av" style="background:${tierOf(e.value).col}">${esc(initials(e.name))}</span>
      <span><b>${esc(e.name)}${e.is_me ? ' (bạn)' : ''}</b><small>${tierOf(e.value).label} · ${e.wins}T · ${e.losses}B · ${e.draws}H</small></span><span class="el">${e.value}</span></li>`).join('')}</ul>`
      : '<p class="ar-empty">Chưa ai đấu online. Thắng một trận để lên bảng.</p>')
    : S.loaded === 'err' ? `<p class="ar-empty">${esc(S.err || 'Chưa tải được bảng xếp hạng.')}</p>` : '<p class="ar-empty">Đang tải…</p>';
  return `<div class="ar-lobby">
    <section class="ar-hero qz-hero">
      <div class="ar-rays" aria-hidden="true"></div>
      <div class="eyebrow">Arena · Đấu nhanh</div>
      <h2>Đoán output</h2>
      <p>1 chọi 1 · 5 câu · 15 giây mỗi câu. Đọc đoạn code, chọn đúng thứ nó in ra. Trả lời đúng được 100 điểm, nhanh hơn được cộng thêm.</p>
      <div class="ar-cta">
        <button class="btn ar-go" id="qzOnline" ${busy ? 'disabled' : ''}>Đấu online</button>
        <button class="btn ghost" id="qzBot" ${busy ? 'disabled' : ''}>Đấu với máy</button>
      </div>
      ${S.note ? `<p class="qz-note">${esc(S.note)}</p>` : ''}
      <ul class="ar-rules">
        <li><b>Online</b>: gặp người thật đang chờ, tính Elo và XP. Câu hỏi và đáp án do máy chủ giữ.</li>
        <li><b>Với máy</b>: luyện với bot cùng hạng, không tính Elo.</li>
        <li>Câu hỏi lấy từ các ví dụ trong Sổ Học (Python M1–M6).</li>
      </ul>
    </section>
    <section class="ar-panel glass">
      <div class="qz-me"><span class="av" style="background:${t.col}">${esc(t.name[0])}</span>
        <div><b>${t.label}</b><small>${S.me.rating} điểm · ${S.me.wins}T · ${S.me.losses}B · ${S.me.draws}H${S.me.rank ? ` · hạng ${S.me.rank}` : ''}</small>
        ${t.next ? `<div class="prog qz-prog"><i style="width:${Math.round(prog * 100)}%"></i></div><small>còn ${t.next.at - S.me.rating} điểm lên ${t.next.name}</small>` : ''}</div></div>
      <h3 class="qz-h">Bảng xếp hạng · Đoán output</h3>
      <div class="ar-tab">${board}</div>
    </section>
  </div>`;
}
function waitingHTML(m) {
  return `<div class="ar-wait">
    <div class="ar-radar" aria-hidden="true"><i></i><i></i><i></i><span>?</span></div>
    <h2>Đang tìm đối thủ…</h2>
    <p>Đoán output online · ${tierOf(S.me.rating).label} · ${S.me.rating} điểm</p>
    <p class="ar-mono" id="qzWait">0:00</p>
    <div class="ar-cta"><button class="btn ghost" id="qzCancel">Huỷ tìm</button><button class="btn ghost" id="qzToBot" hidden>Đấu với máy thay</button></div>
  </div>`;
}
function vsHTML(m) {
  const t = tierOf(m.me.rating), o = m.opponent, to = tierOf(o?.rating ?? 1000);
  return `<div class="qz-vs">
    <div class="p"><span class="av" style="background:${t.col}">${esc(initials(m.me.name === 'Bạn' ? (ctx.playerName || 'Bạn') : m.me.name))}</span><div><b>Bạn</b><small>${t.label}</small></div></div>
    <div class="mid"><div class="sc" id="qzSc">${m.myScore} : ${m.oppScore}</div><small id="qzQn">${m.current == null ? 'Sắp bắt đầu' : `Câu ${m.current + 1}/${m.total}`}</small></div>
    <div class="p r"><div><b>${esc(o?.name ?? '?')}</b><small>${to.label}${m.kind === 'bot' ? ' · máy' : ''}</small></div><span class="av" style="background:${to.col}">${esc(initials(o?.name))}</span></div>
  </div>`;
}
function playHTML(m) {
  const q = m.current != null ? m.questions[m.current] : null;
  if (!q) return `${vsHTML(m)}<div class="qz-count"><b id="qzCount">${clock((m.startedAt ?? now()) - now())}</b><small>Chuẩn bị…</small></div>`;
  const picked = q.myChoice ?? S.picked[m.current] ?? null;
  const reveal = q.closed;
  const stat = reveal
    ? `${q.myChoice === q.answer ? `<b class="ok">Đúng! +${q.myPoints}</b>` : q.myChoice == null ? '<b class="bad">Hết giờ.</b>' : '<b class="bad">Chưa đúng.</b>'} ${esc(m.opponent?.name ?? 'Đối thủ')} ${q.oppChoice == null ? 'không kịp trả lời' : q.oppChoice === q.answer ? `cũng đúng (+${q.oppPoints})` : 'trả lời sai'}.${q.lesson ? ` Câu này lấy từ bài ${esc(q.lesson)}.` : ''}`
    : picked != null ? (q.oppAnswered ? 'Cả hai đã chốt…' : `Đã chốt. Đang chờ ${esc(m.opponent?.name ?? 'đối thủ')}…`)
      : q.oppAnswered ? `<b>${esc(m.opponent?.name ?? 'Đối thủ')} đã trả lời!</b>` : 'Chọn một đáp án. Trả lời nhanh được cộng thêm điểm.';
  return `${vsHTML(m)}
    <div class="qz-timer"><div class="tr"><i id="qzBar"></i></div><span id="qzLeft"></span></div>
    <div class="qz-card"><h3>Đoạn code này in ra gì?</h3><pre class="qz-code">${hlPy(q.code)}</pre></div>
    <div class="qz-opts">${q.opts.map((o, i) => {
      const cls = reveal ? (i === q.answer ? 'right' : i === picked ? 'wrong' : '') : i === picked ? 'pick' : '';
      const them = reveal && q.oppChoice === i ? `<em>${esc(initials(m.opponent?.name))}</em>` : '';
      return `<button class="qz-opt ${cls}" data-o="${i}" ${reveal || picked != null ? 'disabled' : ''}><pre>${esc(o)}</pre>${them}</button>`; }).join('')}</div>
    <div class="qz-stat">${stat}</div>
    <div class="qz-foot"><button class="ar-link" id="qzForfeit">${now() < S.sureUntil ? 'Bấm lần nữa để đầu hàng' : 'Đầu hàng'}</button></div>`;
}
function resultHTML(m) {
  const r = m.result;
  const kind = r.isDraw ? 'draw' : (m.kind === 'bot' ? r.winnerId === 'me' : r.winnerId === m.me.id) ? 'win' : 'loss';
  const close = Math.abs(m.myScore - m.oppScore) < 100;
  const title = { win: r.endReason === 'forfeit' ? 'Thắng (đối thủ đầu hàng)' : 'Thắng!', loss: r.endReason === 'forfeit' ? 'Thua (đầu hàng)' : close ? 'Thua sát nút' : 'Thua', draw: 'Hoà' }[kind];
  const gain = r.practice ? '<span class="pill glass">Trận luyện với máy · không tính Elo</span>'
    : r.unscored ? '<span class="pill glass">Trận không tính điểm</span>'
      : `<span class="pill glass ${r.myRatingDelta >= 0 ? 'up' : 'down'}"><b>${r.myRatingDelta > 0 ? '+' : ''}${r.myRatingDelta}</b>&nbsp;điểm → ${S.me.rating} (${tierOf(S.me.rating).label})</span>${r.myXp ? `<span class="pill glass"><b>+${r.myXp}</b>&nbsp;XP</span>` : ''}`;
  return `<div class="ar-result ${kind}">
    <div class="ar-rays" aria-hidden="true"></div>
    <div class="eyebrow">Đoán output · ${m.kind === 'bot' ? 'với máy' : 'online'}</div>
    <h2>${title}</h2>
    <div class="ar-vs"><div><b>${m.myScore}</b><small>Bạn</small></div><span class="x">vs</span><div><b>${m.oppScore}</b><small>${esc(m.opponent?.name ?? '')}</small></div></div>
    <ol class="qz-recap">${m.questions.map((q) => `<li class="${q.myChoice === q.answer ? 'ok' : 'no'}"><span>Câu ${q.index + 1}</span><b>${q.myChoice === q.answer ? `+${q.myPoints}` : '0'}</b><small>${esc(m.opponent?.name ?? '')}: ${q.oppChoice === q.answer ? `+${q.oppPoints}` : '0'}</small></li>`).join('')}</ol>
    <div class="ar-gain">${gain}</div>
    <div class="ar-cta"><button class="btn ar-go" id="qzAgain">Đấu tiếp</button><button class="btn ghost" id="qzLobby">Về sảnh</button></div>
  </div>`;
}

function keyOf(m) {
  if (!m) return `lobby|${busy}|${S.loaded}|${S.me.rating}|${S.board.length}|${S.note}`;
  if (m.status === 'waiting') return `wait|${m.id}`;
  if (m.status === 'finished') return `res|${m.kind}|${m.id ?? ''}|${S.me.rating}`;
  const q = m.current != null ? m.questions[m.current] : null;
  return `play|${m.kind}|${m.phase}|${m.current}|${m.myScore}|${m.oppScore}|${q ? `${q.myChoice}|${S.picked[m.current]}|${q.oppAnswered}|${q.closed}` : ''}`;
}
function render() {
  if (!root) return;
  const m = match();
  const k = keyOf(m);
  if (k !== S.lastKey) {
    const was = S.lastKey.split('|')[0];
    S.lastKey = k;
    root.innerHTML = !m ? lobbyHTML() : m.status === 'waiting' ? waitingHTML(m) : m.status === 'finished' ? resultHTML(m) : playHTML(m);
    wire(m);
    const now0 = k.split('|')[0];
    if (!RM && now0 !== was) root.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
    if (!RM && m?.phase === 'reveal') root.querySelector('.qz-opt.right')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 420 });
  }
  frame(m);
}
/** Mỗi 0,2 s: thanh thời gian, số giây, đếm ngược — không vẽ lại cả khối. */
function frame(m = match()) {
  if (!m) return;
  if (m.status === 'waiting') { const el = $('#qzWait'); if (el) { const s = Math.floor((now() - (m.createdAt ?? now())) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; const b = $('#qzToBot'); if (b) b.hidden = s < 15; } return; }
  if (m.status !== 'active') return;
  const c = $('#qzCount'); if (c) c.textContent = clock((m.startedAt ?? now()) - now()) || '0';
  const q = m.current != null ? m.questions[m.current] : null;
  const bar = $('#qzBar'), left = $('#qzLeft');
  if (q && bar) {
    const rem = q.closed ? 0 : Math.max(0, q.openAt + Q_MS - now());
    bar.style.transform = `scaleX(${rem / Q_MS})`; bar.classList.toggle('low', rem < 5000);
    if (left) left.textContent = q.closed ? '' : `${Math.ceil(rem / 1000)} giây`;
  }
}
function wire(m) {
  if (!m) {
    $('#qzOnline')?.addEventListener('click', queueOnline);
    $('#qzBot')?.addEventListener('click', () => { S.note = ''; startBot(); });
  } else if (m.status === 'waiting') {
    $('#qzCancel')?.addEventListener('click', cancelOnline);
    $('#qzToBot')?.addEventListener('click', () => act(async () => { await quizApi.cancel(m.id).catch(() => {}); S.online = null; startBot(); }));
  } else if (m.status === 'finished') {
    S.picked = {};
    $('#qzAgain')?.addEventListener('click', () => { const k = m.kind; leave(); if (k === 'bot') startBot(); else queueOnline(); });
    $('#qzLobby')?.addEventListener('click', leave);
  } else {
    root.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.o)));
    $('#qzForfeit')?.addEventListener('click', forfeit);
  }
}
function onKey(e) {
  const m = match(); if (!m || m.phase !== 'question' || !root?.isConnected) return;
  if (['1', '2', '3', '4'].includes(e.key) && !e.target.closest?.('input,textarea')) pick(+e.key - 1);
}

/* ---------- vào / ra ---------- */
export function mount(el, options = {}) {
  unmount();
  root = el; ctx = options; S.lastKey = '';
  void loadProfile(); if (!S.online) void resumeOnline();
  render();
  tick = setInterval(() => { if (!root?.isConnected) return unmount(); if (S.kind === 'bot') render(); else frame(); }, 200);
  pollT = setInterval(() => { if (root?.isConnected) void pollOnline(); }, document.hidden ? 2000 : 1000);
  addEventListener('keydown', onKey);
}
export function unmount() {
  clearInterval(tick); clearInterval(pollT); tick = pollT = null;
  removeEventListener('keydown', onKey);
  root = null;
}
