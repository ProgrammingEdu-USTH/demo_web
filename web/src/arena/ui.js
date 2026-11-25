// Giao diện Arena trong PE-3d: sảnh → tìm đối thủ / phòng riêng → phòng thi → kết quả, kèm lịch sử và bảng xếp hạng.
// Chuyển từ demo_web/frontend/src/components/arena/{LobbyView,MatchView,ListViews}.tsx sang JS thuần
// (PE-3d không dùng React). Trạng thái lấy từ backend qua engine.js; UI chỉ hiển thị và gọi lệnh.
// "Chạy thử" chạy các ví dụ công khai ngay trên trình duyệt (grader.js, Pyodide); "Nộp bài" do server chấm.
// Chế độ thứ hai "Đoán output" (từ máy tính Góc học của pe-usth) nằm ở quiz.js; ui.js chỉ đổi qua lại hai chế độ.
import * as E from './engine.js';
import * as Q from './quiz.js';
import * as O from './offline.js';
import { grade, warmUp, isLoaded, onLoadState } from './grader.js';

const DIFF = { easy: 'Dễ', medium: 'Trung bình' };
const REASON = { solved: 'Giải xong tất cả test', timeout: 'Hết giờ', forfeit: 'Đầu hàng' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (v) => { try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch { return String(v); } };
const clock = (sec) => { const s = Math.max(0, Math.floor(sec)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const delta = (n) => (n > 0 ? `+${n}` : String(n));
const minutes = (sec) => (sec % 60 === 0 ? `${sec / 60} phút` : `${Math.floor(sec / 60)} phút ${sec % 60} giây`);
const ago = (t) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.floor(s / 60); if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24); return d === 1 ? 'hôm qua' : d < 30 ? `${d} ngày trước` : new Date(t).toLocaleDateString('vi-VN');
};
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2);
const draftKey = (id) => `pe-arena-draft-${id}`;
const loadDraft = (id) => { try { return localStorage.getItem(draftKey(id)); } catch { return null; } };
const saveDraft = (id, c) => { try { localStorage.setItem(draftKey(id), c); } catch { /* bỏ qua */ } };
const clearDraft = (id) => { try { localStorage.removeItem(draftKey(id)); } catch { /* bỏ qua */ } };
const ico = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;

let root = null, ctx = {}, timer = null, unsub = null, unload = null;
let view = '', tab = 'problems', lastStatus = null, runOut = null, busy = false, vsShownFor = null;
const MODE_KEY = 'pe-arena-mode';
let mode = (() => { try { return localStorage.getItem(MODE_KEY) === 'quiz' ? 'quiz' : 'code'; } catch { return 'code'; } })();
function setMode(m) { mode = m; try { localStorage.setItem(MODE_KEY, m); } catch { /* bỏ qua */ } render(true); }
// Trận đấu code đang chạy đến từ đâu: engine offline (đấu với máy) khi có trận với máy, còn lại là server.
const src = () => (O.active() ? O : E);
const snap = () => src().snapshot();
/** Đấu code với máy: chạy trên trình duyệt, không cần máy chủ (offline.js). */
const startBot = (problemId) => doAct(async () => { O.start(problemId, { rating: E.snapshot().me.rating, name: ctx.playerName }); });

/* ================= mount ================= */
export function mount(el, options = {}) {
  unmount();
  root = el; ctx = options;
  if (options.playerName) E.setPlayerName(options.playerName);
  root.classList.add('arena');
  void E.start(); // tạo/khôi phục phiên khách, nạp hồ sơ + trận đang dở
  warmUp(); // nạp Pyodide sẵn trong nền
  unload = onLoadState(() => updatePy());
  const u1 = E.subscribe(() => render()), u2 = O.subscribe(() => render());
  unsub = () => { u1(); u2(); };
  view = ''; lastStatus = null; runOut = null;
  render(true);
  timer = setInterval(() => {
    if (!root || !root.isConnected) return unmount();
    E.poll(); O.poll();
    tickUI();
  }, 500);
}
export function unmount() {
  clearInterval(timer); timer = null;
  unsub?.(); unsub = null; unload?.(); unload = null;
  Q.unmount();
  root = null;
}
/** Tóm tắt cho menu bên ngoài phòng. */
export function status() {
  const s = O.active() ? O.poll() : E.poll();
  const m = s.match;
  if (m?.offline && m.status === 'active') return { text: `Đấu với máy · còn ${clock((m.deadlineAt - Date.now()) / 1000)}`, live: true, me: s.me };
  if (m?.status === 'active') return { text: `Đang đấu · còn ${clock((m.deadlineAt - Date.now()) / 1000)}`, live: true, me: s.me };
  if (m?.status === 'waiting') return { text: m.isPublic ? 'Đang tìm đối thủ…' : `Phòng ${m.code} · chờ bạn vào`, live: true, me: s.me };
  const qs = Q.status(); if (qs) return { ...qs, me: s.me };
  if (s.conn === 'offline') return { text: 'Đấu code 1v1 · máy chủ chưa chạy', live: false, me: s.me };
  if (s.conn !== 'ok') return { text: 'Đấu code 1v1 · trực tuyến', live: false, me: s.me };
  return { text: `Đấu code 1v1 · Elo ${s.me.rating}`, live: false, me: s.me };
}

const toast = (t) => (ctx.toast ? ctx.toast(t) : console.info(t));
const $ = (s) => root?.querySelector(s);

/* ================= render ================= */
function render(force) {
  if (!root) return;
  const s = snap();
  const m = s.match;
  const codeLive = m && (m.status === 'waiting' || m.status === 'active');
  if (Q.hasLive() && !codeLive) mode = 'quiz';
  const next = !m ? (mode === 'quiz' ? 'quiz' : 'lobby') : m.status === 'waiting' ? 'waiting' : m.status === 'active' ? 'match' : 'result';
  if (view === 'quiz' && next !== 'quiz') Q.unmount();
  // đổi trạng thái waiting → active: chiếu màn "VS"
  if (lastStatus === 'waiting' && next === 'match' && vsShownFor !== m.id) { vsShownFor = m.id; showVS(s); }
  lastStatus = next;
  if (next !== view || force) {
    view = next;
    root.innerHTML = { lobby: lobbyHTML, quiz: quizHTML, waiting: waitingHTML, match: matchHTML, result: resultHTML }[next](s);
    wire(next, s);
  } else if (next === 'quiz') {
    const c = $('#arConn'); const ch = connHTML(s); if (c && c.dataset.k !== ch) { c.dataset.k = ch; c.innerHTML = ch; wireConn(); }
  } else if (next === 'lobby') {
    $('#arHead').innerHTML = headStats(s.me);
    const c = $('#arConn'); const ch = connHTML(s); if (c && c.dataset.k !== ch) { c.dataset.k = ch; c.innerHTML = ch; wireConn(); }
    fillTab(); lockOnline(s);
  } else if (next === 'match') {
    updateMatch(s);
  } else if (next === 'result') {
    const g = $('#arGain'); if (g) g.innerHTML = gainHTML(s);
  }
  tickUI();
}

function headStats(me) {
  return `<span class="pill glass"><b>${me.rating}</b>&nbsp;Elo</span>
    <span class="pill glass" title="Thắng / Thua / Hoà">${me.wins}T · ${me.losses}B · ${me.draws}H</span>
    <span class="pill glass" title="Hạng trên bảng Arena">Hạng ${me.rank || '–'}</span>`;
}
function pyChip() {
  return `<span class="ar-py ${isLoaded() ? 'ok' : ''}" id="arPy">${isLoaded() ? 'Python sẵn sàng' : 'Đang nạp Python…'}</span>`;
}
function updatePy() { const c = $('#arPy'); if (c) { c.classList.toggle('ok', isLoaded()); c.textContent = isLoaded() ? 'Python sẵn sàng' : 'Đang nạp Python…'; } }

/* ---------- sảnh ---------- */
function connHTML(s) {
  if (s.conn === 'offline') return `<div class="ar-conn bad"><b>Offline · chưa kết nối được máy chủ Arena.</b><span>Đấu online tạm khoá, nhưng bạn vẫn <b>đấu với máy</b> được ngay (chấm bài trên trình duyệt). Muốn đấu online: chạy backend (<code>npm --prefix server run start:prod</code>) rồi bấm Thử lại.</span><button class="btn ghost" id="arRetry">Thử lại</button></div>`;
  if (s.conn !== 'ok') return `<div class="ar-conn"><span class="ar-spin"></span><span>Đang kết nối máy chủ Arena…</span></div>`;
  return '';
}
function wireConn() { $('#arRetry')?.addEventListener('click', () => { void E.start(); }); }
function modeHTML() {
  return `<div class="ar-mode" id="arMode" role="tablist" aria-label="Chế độ đấu">
    <button role="tab" data-mode="code" aria-selected="${mode === 'code'}">Đấu code 1v1</button>
    <button role="tab" data-mode="quiz" aria-selected="${mode === 'quiz'}">Đoán output nhanh</button></div>`;
}
function wireMode() { root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== mode && !Q.hasLive()) setMode(b.dataset.mode); })); }
/** Chế độ Đoán output: khung chung (tiêu đề, chọn chế độ, kết nối) + phần riêng do quiz.js vẽ. */
function quizHTML(s) {
  const ch = connHTML(s);
  return `<div class="pghead"><div><h1>Đấu trường</h1><p>Đoán output nhanh · 1 chọi 1 · 5 câu, 15 giây mỗi câu</p></div></div>
  ${modeHTML()}
  <div id="arConn" data-k="${esc(ch)}">${ch}</div>
  <div id="qzRoot" class="qz"></div>`;
}
function lobbyHTML(s) {
  const ch = connHTML(s);
  return `<div class="pghead"><div><h1>Đấu trường</h1><p>Đấu code 1v1 · cùng một đề Python · người thắng được cộng Elo và XP</p></div>
    <div class="ar-head" id="arHead">${headStats(s.me)}</div></div>
  ${modeHTML()}
  <div id="arConn" data-k="${esc(ch)}">${ch}</div>
  <div class="ar-lobby">
    <section class="ar-hero">
      <div class="ar-rays" aria-hidden="true"></div>
      <div class="eyebrow">Arena · Python</div>
      <h2>Tìm đối thủ</h2>
      <p>Cùng một đề Python, đua giải trước khi hết giờ. Đấu online với người thật, hoặc đấu với máy ngay cả khi offline.</p>
      <div class="ar-cta"><button class="btn ar-go" id="arQueue" data-online>${ico('play')}Đấu online</button><button class="btn ar-bot" id="arBot">Đấu với máy · offline</button>${pyChip()}</div>
      <div class="ar-room-row">
        <button class="btn ghost" id="arCreate" data-online>Tạo phòng riêng</button>
        <form id="arJoin" class="ar-join"><input id="arJoinCode" maxlength="8" placeholder="Mã phòng" autocomplete="off" spellcheck="false" aria-label="Mã phòng 4–8 ký tự" data-online><button class="btn ghost" type="submit" data-online>Vào phòng</button></form>
      </div>
      <ul class="ar-rules">
        <li><b>Thắng ngay</b> khi bài nộp đúng hết bộ test (có test ẩn, chấm trên máy chủ).</li>
        <li><b>Hết giờ</b>: ai đúng nhiều test hơn thắng; bằng nhau thì ai nộp bài đó sớm hơn.</li>
        <li><b>Nộp bài</b> tối đa 10 lần, cách nhau ít nhất 10 giây. <b>Chạy thử</b> thì không giới hạn.</li>
        <li><b>Đầu hàng</b> trước 60 giây, hoặc khi đối thủ chưa đúng test nào: không tính điểm.</li>
        <li><b>Với máy</b>: bot cùng tầm Elo, chấm bài ngay trên trình duyệt; trận luyện, không tính Elo.</li>
      </ul>
    </section>
    <section class="ar-panel glass">
      <div class="seg" role="tablist">
        <button role="tab" data-at="problems" aria-selected="${tab === 'problems'}">Kho đề</button>
        <button role="tab" data-at="history" aria-selected="${tab === 'history'}">Lịch sử</button>
        <button role="tab" data-at="rank" aria-selected="${tab === 'rank'}">Xếp hạng</button>
      </div>
      <div id="arTab" class="ar-tab"></div>
    </section>
  </div>`;
}
let tabKey = '';
function fillTab() {
  const el = $('#arTab'); if (!el) return;
  let html;
  if (tab === 'problems') {
    const online = E.snapshot().conn === 'ok';
    const list = E.problems().length ? E.problems() : O.problems(); // offline: kho đề đóng gói sẵn
    html = `<ul class="ar-list ar-probs">${list.map((p) => `<li><span class="ar-dot ${p.difficulty}"></span>
      <span><b>${esc(p.title)}</b><small>${DIFF[p.difficulty] || p.difficulty} · ${minutes(p.durationSec)}${p.testCount ? ` · ${p.testCount} test` : ''}</small></span>
      <span class="ar-pbtn"><button class="btn ghost" data-bot="${esc(p.id)}" title="Đấu đề này với máy (offline)">Với máy</button><button class="btn ghost" data-challenge="${esc(p.id)}" data-online ${online ? '' : 'disabled'} title="Tạo phòng riêng với đề này rồi gửi mã cho bạn">Tạo phòng</button></span></li>`).join('')}</ul>`;
  } else if (tab === 'history') {
    const h = E.history();
    html = h.length ? `<ul class="ar-list">${h.map((x) => `<li><span class="ar-res ${x.outcome}">${x.outcome === 'win' ? 'Thắng' : x.outcome === 'loss' ? 'Thua' : 'Hoà'}</span>
      <span><b>${esc(x.problemTitle)}</b><small>gặp ${esc(x.opponentName)} · ${REASON[x.endReason] || ''} · ${ago(x.finishedAt)}</small></span>
      <span class="ar-d ${x.ratingDelta > 0 ? 'up' : x.ratingDelta < 0 ? 'down' : ''}">${x.unscored ? 'không tính' : delta(x.ratingDelta)}${x.xp ? `<small>+${x.xp} XP</small>` : ''}</span></li>`).join('')}</ul>`
      : `<p class="ar-empty">Chưa có trận nào. Bấm “Tìm trận ngay” để bắt đầu.</p>`;
  } else {
    const lb = E.leaderboard();
    html = lb.length ? `<ul class="ar-list ar-lb">${lb.map((e) => `<li class="${e.isMe ? 'ar-me' : ''}"><span class="rk">${e.rank}</span>
      <span class="av" style="background:${e.color}">${esc(initials(e.name))}</span>
      <span><b>${esc(e.name)}${e.isMe ? ' (bạn)' : ''}</b><small>${e.wins}T · ${e.losses}B · ${e.draws}H</small></span><span class="el">${e.rating}</span></li>`).join('')}</ul>`
      : `<p class="ar-empty">Chưa ai đấu trận nào. Người đầu tiên lên bảng có thể là bạn.</p>`;
  }
  if (html === tabKey && el.innerHTML) return; // không vẽ lại khi không đổi (giữ focus/hover)
  tabKey = html; el.innerHTML = html;
  el.querySelectorAll('[data-challenge]').forEach((b) => b.addEventListener('click', () => doAct(() => E.createRoom(b.dataset.challenge))));
  el.querySelectorAll('[data-bot]').forEach((b) => b.addEventListener('click', () => startBot(b.dataset.bot)));
}

/* ---------- chờ ghép trận / chờ bạn vào phòng ---------- */
function waitingHTML(s) {
  const m = s.match;
  const room = !m.isPublic;
  return `<div class="ar-wait">
    <div class="ar-radar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(initials(s.me.name || 'Bạn'))}</span></div>
    <h2>${m.offline ? 'Máy đang vào trận…' : room ? 'Phòng riêng đã mở' : 'Đang tìm đối thủ…'}</h2>
    ${room ? `<p>Gửi mã này cho bạn cùng đấu, họ bấm “Vào phòng” và nhập mã:</p>
    <div class="ar-code"><b aria-label="Mã phòng ${esc(m.code.split('').join(' '))}">${esc(m.code)}</b><button class="btn ghost" id="arCopy">Chép mã</button></div>` : ''}
    <p>${m.offline ? 'Đấu với máy · offline · không tính Elo' : `Đề hiện ra khi trận bắt đầu · Elo của bạn ${s.me.rating}`}</p>
    <p class="ar-mono" id="arWaitT">0:00</p>
    <div class="ar-cta">${pyChip()}<button class="btn ghost" id="arCancel">${room ? 'Đóng phòng' : 'Huỷ tìm'}</button></div>
  </div>`;
}

/* ---------- phòng thi ---------- */
function matchHTML(s) {
  const m = s.match, p = m.problem;
  const code = loadDraft(m.id) ?? p.starterCode;
  return `<div class="ar-score" id="arScore">${scoreHTML(s)}</div>
  <div class="lesson ar-room">
    <div class="lx ar-prob">
      <div class="eyebrow">${DIFF[p.difficulty]} · ${minutes(p.durationSec)} · ${p.testCount} test (${p.examples.length} công khai)</div>
      <h2>${esc(p.title)}</h2>
      <pre class="ar-stmt">${esc(p.statement)}</pre>
      <div class="ar-sig"><small>Viết hàm</small><code>${esc(p.signature)}</code></div>
      <table class="ar-ex"><thead><tr><th>#</th><th>Đầu vào</th><th>Kết quả mong đợi</th></tr></thead><tbody>
        ${p.examples.map((e, i) => `<tr><td>${i + 1}</td><td><code>${esc(e.args.map(json).join(', '))}</code></td><td><code>${esc(json(e.expected))}</code></td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="edx">
      <div class="bar"><b>solution.py</b><span class="ar-clock" id="arClock">${clock((m.deadlineAt - Date.now()) / 1000)}</span>
        <button class="btn ar-run" id="arRun">${ico('play')}Chạy thử</button>
        <button class="btn run" id="arSubmit">${ico('send')}Nộp bài</button></div>
      <div class="ar-ed"><pre class="gut" id="arGut" aria-hidden="true"></pre><textarea id="arCode" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Mã Python của bạn">${esc(code)}</textarea></div>
      <div class="out ar-out" id="arOut">${outHTML(s)}</div>
    </div>
  </div>`;
}
function scoreHTML(s) {
  const m = s.match, o = m.opponent, T = m.problem.testCount;
  const left = m.deadlineAt ? (m.deadlineAt - Date.now()) / 1000 : 0;
  const bar = (n) => `<div class="prog"><i style="width:${Math.round((n / T) * 100)}%"></i></div>`;
  return `<div class="ar-side ar-me"><span class="av" style="background:var(--amber)">${esc(initials(s.me.name || 'Bạn'))}</span>
      <div><b>Bạn <small>${s.me.rating}</small></b>${bar(m.myBestPassed)}<small>${m.myBestPassed}/${T} test · nộp ${m.mySubmissionCount}/${E.MAX_SUBMISSIONS}</small></div></div>
    <div class="ar-mid"><span class="ar-big${left <= 60 ? ' low' : ''}" id="arBigClock">${clock(left)}</span><button class="ar-link" id="arForfeit">Đầu hàng</button></div>
    <div class="ar-side op"><span class="av" style="background:${o.color}">${esc(initials(o.name))}</span>
      <div><b>${esc(o.name)} <small>${o.rating}</small></b>${bar(o.bestPassed)}<small>${o.bestPassed}/${T} test · nộp ${o.submissionCount} lần</small></div></div>`;
}
function outHTML(s) {
  const m = s.match;
  const parts = [];
  if (runOut) parts.push(runOut);
  const subs = m.submissions;
  if (subs.length) {
    parts.push(`<small>Bài đã nộp</small><ul class="ar-subs">${subs.map((x, i) => `<li class="${x.status}">
      <span class="n">#${subs.length - i}</span>
      ${x.status === 'pending' ? '<span class="ar-spin"></span><span>Đang chấm…</span>'
        : x.status === 'graded' ? `<span class="sc ${x.passed === x.total ? 'full' : ''}">${x.passed}/${x.total}</span><span>${x.publicResults.filter((r) => r.passed).length}/${x.publicResults.length} công khai · ${x.hiddenPassed}/${x.hiddenTotal} ẩn</span>`
        : `<span class="sc bad">${x.status === 'rejected' ? 'Bị từ chối' : 'Lỗi'}</span><span>${esc(x.message || '')}</span>`}
      <span class="t">${new Date(x.createdAt).toLocaleTimeString('vi-VN', { hour12: false })}</span></li>`).join('')}</ul>`);
  }
  if (!parts.length) parts.push(`<small>Kết quả</small><pre class="ar-hint">Chạy thử: chạy 3 ví dụ công khai, không tính lượt.\nNộp bài: chấm cả test ẩn. Ctrl+Enter để chạy thử.</pre>`);
  return parts.join('');
}
function updateMatch(s) {
  const sc = $('#arScore'); if (sc) { sc.innerHTML = scoreHTML(s); $('#arForfeit')?.addEventListener('click', onForfeit); }
  const out = $('#arOut'); if (out) out.innerHTML = outHTML(s);
}

/* ---------- kết quả ---------- */
function resultHTML(s) {
  const m = s.match, r = m.result, o = m.opponent;
  const kind = r.isDraw ? 'draw' : r.winnerId === s.me.id ? 'win' : 'loss';
  const title = { win: 'Bạn thắng!', loss: 'Bạn thua', draw: 'Hoà' }[kind];
  return `<div class="ar-result ${kind}">
    <div class="ar-rays" aria-hidden="true"></div>
    <div class="eyebrow">${esc(m.problemMeta.title)} · ${REASON[r.endReason]}</div>
    <h2>${title}</h2>
    <div class="ar-vs"><div><span class="av" style="background:var(--amber)">${esc(initials(s.me.name || 'Bạn'))}</span><b>${r.myBestPassed}/${r.total}</b><small>Bạn</small></div>
      <span class="x">vs</span>
      <div><span class="av" style="background:${o.color}">${esc(initials(o.name))}</span><b>${r.opponentBestPassed}/${r.total}</b><small>${esc(o.name)}</small></div></div>
    <div class="ar-gain" id="arGain">${gainHTML(s)}</div>
    ${r.unscored && !r.practice ? '<p>Đầu hàng quá sớm hoặc người thắng chưa đúng test nào nên không cộng trừ điểm.</p>' : ''}
    <div class="ar-cta"><button class="btn ar-go" id="arAgain">${ico('play')}Đấu trận mới</button><button class="btn ghost" id="arLobby">Về sảnh</button></div>
  </div>`;
}

function gainHTML(s) {
  const r = s.match.result;
  if (r.practice) return '<span class="pill glass">Trận luyện với máy · offline · không tính Elo</span>';
  return r.unscored ? '<span class="pill glass">Trận không tính điểm</span>'
    : `<span class="pill glass ${r.myRatingDelta >= 0 ? 'up' : 'down'}"><b>${delta(r.myRatingDelta)}</b>&nbsp;Elo → ${s.me.rating}</span><span class="pill glass"><b>+${r.myXp}</b>&nbsp;XP</span>`;
}

/* ================= sự kiện ================= */
function wire(v, s) {
  if (v === 'quiz') {
    wireConn(); wireMode();
    Q.mount($('#qzRoot'), { toast, playerName: ctx.playerName });
  } else if (v === 'lobby') {
    wireConn(); wireMode();
    $('#arQueue').addEventListener('click', () => doAct(() => E.queue()));
    $('#arBot').addEventListener('click', () => startBot());
    lockOnline(s);
    $('#arCreate').addEventListener('click', () => doAct(() => E.createRoom()));
    $('#arJoin').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const c = $('#arJoinCode').value.trim();
      if (c.length < 4) { toast('Mã phòng gồm 4–8 ký tự'); return; }
      doAct(() => E.joinRoom(c));
    });
    root.querySelectorAll('[data-at]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.at;
      root.querySelectorAll('[data-at]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      tabKey = ''; fillTab();
    }));
    tabKey = ''; fillTab();
  } else if (v === 'waiting') {
    $('#arCancel').addEventListener('click', () => doAct(() => src().cancel(), s.match.offline ? '' : s.match.isPublic ? 'Đã huỷ tìm trận' : 'Đã đóng phòng'));
    $('#arCopy')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(s.match.code); toast(`Đã chép mã phòng ${s.match.code}`); } catch { toast(`Mã phòng: ${s.match.code}`); }
    });
  } else if (v === 'match') {
    runOut = null;
    const ta = $('#arCode');
    const sync = () => { $('#arGut').textContent = Array.from({ length: ta.value.split('\n').length }, (_, i) => i + 1).join('\n'); };
    sync();
    ta.addEventListener('input', () => { sync(); saveDraft(s.match.id, ta.value); });
    ta.addEventListener('scroll', () => { $('#arGut').scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', onKey);
    $('#arRun').addEventListener('click', onRun);
    $('#arSubmit').addEventListener('click', onSubmit);
    $('#arForfeit').addEventListener('click', onForfeit);
  } else if (v === 'result') {
    clearDraft(s.match.id);
    const off = !!s.match.offline;
    $('#arAgain').addEventListener('click', () => { src().dismiss(); if (off) startBot(); else doAct(() => E.queue()); });
    $('#arLobby').addEventListener('click', () => { src().dismiss(); });
    const card = root.querySelector('.ar-result');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) card.animate([{ opacity: 0, transform: 'scale(.92) translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
}

/** Chạy một lệnh gọi server; khoá nút trong lúc chờ, lỗi thì báo bằng toast. */
async function doAct(fn, okMsg) {
  if (busy) return;
  busy = true;
  root?.querySelectorAll('.ar-lobby .btn, .ar-wait .btn').forEach((b) => { b.disabled = true; });
  try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message); }
  busy = false;
  root?.querySelectorAll('.ar-lobby .btn, .ar-wait .btn').forEach((b) => { b.disabled = false; });
  lockOnline(E.snapshot());
}
/** Không có máy chủ: khoá các nút cần server, giữ nút đấu với máy. */
function lockOnline(s) {
  const off = s.conn !== 'ok';
  root?.querySelectorAll('[data-online]').forEach((b) => { b.disabled = off || busy; b.title = off ? 'Cần máy chủ Arena — đang offline' : ''; });
}

function onKey(e) {
  const ta = e.target;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return e.shiftKey ? onSubmit() : onRun(); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value: v } = ta;
    if (e.shiftKey) {
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      const rm = v.slice(ls, ls + 4).match(/^ {1,4}/)?.[0].length || 0;
      if (rm) { ta.setRangeText('', ls, ls + rm, 'preserve'); ta.selectionStart = ta.selectionEnd = Math.max(ls, a - rm); }
    } else ta.setRangeText('    ', a, b, 'end');
    ta.dispatchEvent(new Event('input'));
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value: v } = ta;
    const line = v.slice(v.lastIndexOf('\n', a - 1) + 1, a);
    let ind = line.match(/^\s*/)[0];
    if (/:\s*$/.test(line)) ind += '    ';
    ta.setRangeText('\n' + ind, a, b, 'end');
    ta.dispatchEvent(new Event('input'));
  }
}

async function onRun() {
  const s = snap(); const m = s.match;
  if (!m || m.status !== 'active' || busy) return;
  const p = m.problem;
  busy = true; setBtns();
  runOut = `<small>Chạy thử</small><pre class="ar-hint">${isLoaded() ? 'Đang chạy…' : 'Đang nạp Python (lần đầu mất vài giây)…'}</pre>`;
  updateMatch(snap());
  try {
    const r = await grade($('#arCode')?.value ?? '', p.examples, { perTestMs: 2000 });
    if (r.status !== 'graded') runOut = `<small>Chạy thử</small><pre class="ar-err">${r.status === 'rejected' ? 'Mã bị từ chối: ' : ''}${esc(r.message)}</pre>`;
    else runOut = `<small>Chạy thử · ${r.passed}/${r.total} ví dụ đúng (chưa tính lượt nộp)</small><ul class="ar-runs">${r.details.map((d) => `<li class="${d.passed ? 'ok' : 'no'}">
      <span class="k">${d.passed ? ico('check') : '✗'}</span><span><code>solve(${esc(d.args.map(json).join(', '))})</code>
      <small>${d.error ? `<em>${esc(d.error)}</em>` : `trả về <code>${esc(d.got ?? '')}</code>`}${d.passed ? '' : ` · mong đợi <code>${esc(json(d.expected))}</code>`}</small></span></li>`).join('')}</ul>`;
  } catch (e) {
    runOut = `<small>Chạy thử</small><pre class="ar-err">${esc(e.message)}</pre>`;
  }
  busy = false;
  if (view === 'match') { updateMatch(snap()); setBtns(); }
}

async function onSubmit() {
  const m = snap().match;
  if (!m || m.status !== 'active' || busy) return;
  const code = $('#arCode')?.value ?? '';
  busy = true; setBtns();
  try {
    const r = await src().submit(code);
    const x = r.submission;
    if (x.status === 'graded') toast(x.passed === x.total ? 'Đúng hết bộ test!' : `Đúng ${x.passed}/${x.total} test`);
    else toast(x.status === 'rejected' ? 'Mã bị từ chối khi kiểm tra' : (x.message || 'Có lỗi khi chấm'));
  } catch (e) {
    toast(e.message);
  }
  busy = false;
  if (view === 'match') setBtns();
}

function onForfeit() {
  const m = snap().match; if (!m || m.status !== 'active') return;
  const b = $('#arForfeit');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Bấm lần nữa để đầu hàng'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = 'Đầu hàng'; } }, 3000); return; }
  src().forfeit().catch((e) => toast(e.message));
}

function setBtns() {
  const m = snap().match; if (!m || view !== 'match') return;
  const run = $('#arRun'), sub = $('#arSubmit'); if (!run || !sub) return;
  run.disabled = busy;
  const wait = m.lastSubmitAt ? Math.ceil((E.SUBMIT_GAP_MS - (Date.now() - m.lastSubmitAt)) / 1000) : 0;
  const left = E.MAX_SUBMISSIONS - m.mySubmissionCount;
  sub.disabled = busy || m.pending || wait > 0 || left <= 0;
  sub.innerHTML = m.pending ? '<span class="ar-spin"></span>Đang chấm' : left <= 0 ? 'Hết lượt nộp' : wait > 0 ? `Nộp lại sau ${wait}s` : `${ico('send')}Nộp bài`;
}

/* nhịp 0,5 s: đồng hồ, nút */
function tickUI() {
  if (!root) return;
  const md = $('#arMode'); if (md) md.hidden = Q.hasLive(); // đang trong trận đoán output: không đổi chế độ
  const m = snap().match;
  if (view === 'waiting' && m) { const el = $('#arWaitT'); if (el) { const t = Math.floor((Date.now() - m.createdAt) / 1000); el.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; } }
  if (view === 'match' && m?.deadlineAt) {
    const left = (m.deadlineAt - Date.now()) / 1000;
    const txt = clock(left);
    const a = $('#arClock'), b = $('#arBigClock');
    if (a) a.textContent = txt;
    if (b) { b.textContent = txt; b.classList.toggle('low', left <= 60); }
    setBtns();
  }
}

/* màn "VS" khi ghép xong */
function showVS(s) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const o = s.match.opponent;
  const d = document.createElement('div'); d.className = 'ar-vsfx';
  d.innerHTML = `<div class="l"><span class="av" style="background:var(--amber)">${esc(initials(s.me.name || 'Bạn'))}</span><b>Bạn</b><small>${s.me.rating}</small></div>
    <div class="bolt">VS</div>
    <div class="r"><span class="av" style="background:${o.color}">${esc(initials(o.name))}</span><b>${esc(o.name)}</b><small>${o.rating}</small></div>`;
  document.body.appendChild(d);
  d.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1900, easing: 'ease-out' }).finished.then(() => d.remove());
  d.querySelector('.l').animate([{ transform: 'translateX(-60vw)' }, { transform: 'none', offset: 0.3 }, { transform: 'translateX(-10px)' }], { duration: 1900, easing: 'cubic-bezier(.22,1,.36,1)' });
  d.querySelector('.r').animate([{ transform: 'translateX(60vw)' }, { transform: 'none', offset: 0.3 }, { transform: 'translateX(10px)' }], { duration: 1900, easing: 'cubic-bezier(.22,1,.36,1)' });
  d.querySelector('.bolt').animate([{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.35 }, { transform: 'scale(1.1)' }], { duration: 1900, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
