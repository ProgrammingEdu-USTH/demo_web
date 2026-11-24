// Bộ chấm Arena trên trình duyệt — chuyển từ demo_web/src/arena/arena-grader.service.ts.
// Cùng thuật toán: chạy từng test trong worker Pyodide, trang chủ đếm giờ (nạp / khai báo / mỗi test / tổng),
// test quá giờ thì giết worker, dựng worker mới chạy tiếp từ test sau (tối đa MAX_REBUILDS lần),
// so kết quả bằng jsonEqual nghiêm ngặt. Khác bản gốc: giữ sẵn một worker "ấm" để khỏi chờ nạp Pyodide,
// và thời gian nạp lần đầu (tải Pyodide từ CDN) không tính vào giới hạn tổng.
import { HARNESS_PY } from './harness.js';

export const PYODIDE_URL = import.meta.env?.VITE_PYODIDE_URL || 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
export const LOAD_TIMEOUT_MS = 60_000;
export const DEFINE_TIMEOUT_MS = 2_000;
export const TOTAL_TIMEOUT_MS = 30_000;
export const MAX_REBUILDS = 3;
export const MAX_TEXT = 200;

/** So sánh sâu nghiêm ngặt giữa hai giá trị JSON (kiểu phải khớp: true ≠ 1). */
export function jsonEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
  }
  return a === b;
}
const cut = (s) => (s === undefined ? undefined : String(s).slice(0, MAX_TEXT));

/* ---------- worker ấm ---------- */
let spare = null;
let loadListeners = new Set();
let loaded = false; // đã từng nạp xong Pyodide ít nhất một lần (lần sau nhanh nhờ cache)

function spawn() {
  const worker = new Worker(new URL('./grader.worker.js', import.meta.url));
  const ready = new Promise((resolve) => {
    const onMsg = ({ data }) => {
      if (data?.type === 'ready') { cleanup(); loaded = true; resolve(true); }
      else if (data?.type === 'fatal') { cleanup(); resolve(false); }
    };
    const onErr = () => { cleanup(); resolve(false); };
    const cleanup = () => { worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
  });
  worker.postMessage({ type: 'init', indexURL: PYODIDE_URL, harness: HARNESS_PY });
  const s = { worker, ready };
  ready.then((ok) => loadListeners.forEach((f) => f(ok)));
  return s;
}

/** Nạp sẵn Pyodide (gọi khi mở Arena). Trả Promise<boolean>. */
export function warmUp() {
  if (!spare) spare = spawn();
  return spare.ready;
}
export const isLoaded = () => loaded;
export function onLoadState(f) { loadListeners.add(f); return () => loadListeners.delete(f); }

function take() {
  const s = spare || spawn();
  spare = null;
  return s;
}

/* ---------- một lượt worker ---------- */
function runWorker({ code, calls, perTestMs, totalDeadline, onReady, onResult }) {
  return new Promise((resolve) => {
    const { worker, ready } = take();
    let settled = false, timer, phase = 'load';
    const finish = (end) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(end);
    };
    const arm = (ms) => {
      clearTimeout(timer);
      const dl = totalDeadline();
      const remaining = dl == null ? ms : dl - Date.now();
      timer = setTimeout(() => {
        const d = totalDeadline();
        if (d != null && Date.now() >= d) finish({ kind: 'totalTimeout' });
        else if (phase === 'load') finish({ kind: 'loadFailed' });
        else if (phase === 'define') finish({ kind: 'defineTimeout' });
        else finish({ kind: 'callTimeout' });
      }, Math.max(1, Math.min(ms, remaining)));
    };
    worker.addEventListener('message', ({ data: m }) => {
      if (settled || !m || typeof m !== 'object') return;
      switch (m.type) {
        case 'rejected': finish({ kind: 'rejected', message: String(m.message).slice(0, 300) }); break;
        case 'defined':
          if (typeof m.error === 'string') finish({ kind: 'defineError', message: m.error.slice(0, 300) });
          else { phase = 'call'; arm(perTestMs); }
          break;
        case 'result':
          if (typeof m.index !== 'number') break;
          onResult(m.index, { ok: m.ok === true, json: m.json, repr: m.repr, error: m.error });
          arm(perTestMs);
          break;
        case 'done': finish({ kind: 'done' }); break;
        case 'fatal': if (phase !== 'load') finish(phase === 'call' ? { kind: 'crash' } : { kind: 'loadFailed' }); break;
        default: break;
      }
    });
    worker.addEventListener('error', () => finish(phase === 'call' ? { kind: 'crash' } : { kind: 'loadFailed' }));
    arm(LOAD_TIMEOUT_MS);
    ready.then((ok) => {
      if (settled) return;
      if (!ok) return finish({ kind: 'loadFailed' });
      phase = 'define';
      onReady();
      arm(DEFINE_TIMEOUT_MS);
      worker.postMessage({ type: 'grade', code, calls });
    });
  });
}

/* ---------- chấm (mỗi lúc một bài) ---------- */
let chain = Promise.resolve();

/**
 * Chấm `code` với danh sách test [{args, expected}]; publicCount test đầu là công khai.
 * → { status:'graded'|'rejected'|'error', message, passed, total, publicResults, hiddenPassed, hiddenTotal, details }
 *   details: kết quả từng test công khai kèm expected (chỉ để hiện "Chạy thử").
 */
export function grade(code, tests, { perTestMs = 2000, publicCount = tests.length } = {}) {
  const job = chain.then(() => run(code, tests, perTestMs, publicCount));
  chain = job.catch(() => {});
  return job;
}

async function run(code, tests, perTestMs, publicCount) {
  const total = tests.length;
  const base = (status, message) => ({ status, message, passed: 0, total, publicResults: [], hiddenPassed: 0, hiddenTotal: total - publicCount });
  const results = Array.from({ length: total });
  let deadline = null; // bắt đầu đếm tổng khi worker đầu tiên sẵn sàng
  let next = 0, rebuilds = 0, firstRun = true;

  try {
    while (next < total) {
      const calls = tests.slice(next).map((t, i) => ({ index: next + i, args: t.args })); // chỉ args
      const end = await runWorker({
        code, calls, perTestMs,
        totalDeadline: () => deadline,
        onReady: () => { if (deadline == null) deadline = Date.now() + TOTAL_TIMEOUT_MS; },
        onResult: (index, r) => { results[index] = r; next = Math.max(next, index + 1); },
      });

      if (end.kind === 'done') break;
      if (end.kind === 'rejected') return base('rejected', end.message);
      if (firstRun && next === 0) {
        if (end.kind === 'defineError') return base('error', end.message);
        if (end.kind === 'defineTimeout') return base('error', 'Quá thời gian khi chạy mã khai báo');
        if (end.kind === 'loadFailed') return base('error', 'Không nạp được Python (Pyodide). Kiểm tra mạng rồi thử lại.');
      }
      firstRun = false;
      if (end.kind === 'defineError' || end.kind === 'defineTimeout' || end.kind === 'totalTimeout') {
        for (let i = next; i < total; i++) results[i] = { ok: false, error: 'TIMEOUT' };
        break;
      }
      if (end.kind === 'loadFailed') {
        for (let i = next; i < total; i++) results[i] = { ok: false, error: 'CRASH' };
        break;
      }
      results[next] = { ok: false, error: end.kind === 'callTimeout' ? 'TIMEOUT' : 'CRASH' };
      next += 1;
      rebuilds += 1;
      if (rebuilds > MAX_REBUILDS) {
        for (let i = next; i < total; i++) results[i] = { ok: false, error: 'TIMEOUT' };
        break;
      }
    }
  } finally {
    setTimeout(warmUp, 50); // chuẩn bị worker cho lần sau
  }

  let passed = 0, hiddenPassed = 0;
  const publicResults = [], details = [];
  tests.forEach((t, i) => {
    const r = results[i] ?? { ok: false, error: 'TIMEOUT' };
    let good = false;
    if (r.ok && typeof r.json === 'string') {
      try { good = jsonEqual(JSON.parse(r.json), t.expected); } catch { good = false; }
    }
    if (good) passed++;
    if (i < publicCount) {
      const item = { index: i, passed: good };
      const got = cut(r.repr), error = cut(r.error === 'TIMEOUT' ? `Quá thời gian (${perTestMs / 1000} s)` : r.error === 'CRASH' ? 'Chương trình bị dừng bất thường' : r.error);
      if (got !== undefined) item.got = got;
      if (error !== undefined && !good) item.error = error;
      publicResults.push(item);
      details.push({ ...item, args: t.args, expected: t.expected });
    } else if (good) hiddenPassed++;
  });
  return { status: 'graded', message: null, passed, total, publicResults, hiddenPassed, hiddenTotal: total - publicCount, details };
}
