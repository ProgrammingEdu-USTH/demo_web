// Client gọi backend (server/, NestJS — từ pe-usth + module arena của demo_web).
// Cùng hợp đồng với demo_web/frontend/src/lib/arena-api.ts, viết lại bằng JS thuần cho PE-3d.
//
// Đường dẫn: /api/arena/* và /auth/* ở gốc. Khi chạy `vite` / `vite preview`, Vite proxy hai
// nhánh này sang http://localhost:5100 (vite.config.js) nên trình duyệt gọi cùng origin.
// Triển khai tách rời thì đặt VITE_API_URL (vd https://api.example.com) lúc build.
//
// Đăng nhập: PE-3d không có màn đăng nhập → tự tạo tài khoản khách (POST /auth/guest).
// Access token (JWT ngắn hạn) giữ trong localStorage; refresh token nằm trong cookie httpOnly
// `pe_refresh` (path=/auth) do backend đặt, JS không đọc được.

export const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'pe-arena-access';
const NAME_KEY = 'pe-arena-name';

export class ArenaApiError extends Error {
  constructor(status, message, code, retryAfter) {
    super(message);
    this.name = 'ArenaApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Thông điệp tiếng Việt theo mã lỗi của hợp đồng (giống describeArenaError bản demo_web). */
export function describe(e) {
  if (!(e instanceof ArenaApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.';
  switch (e.code) {
    case 'ALREADY_IN_MATCH': return 'Bạn đang ở trong một trận khác.';
    case 'CANNOT_JOIN_OWN_ROOM': return 'Không thể vào phòng do chính bạn tạo.';
    case 'ROOM_NOT_FOUND': return 'Không tìm thấy phòng (sai mã, đã hết hạn hoặc đã đủ người).';
    case 'MATCH_NOT_FOUND': return 'Không tìm thấy trận này.';
    case 'MATCH_NOT_ACTIVE': return 'Trận không còn diễn ra (đã hết giờ hoặc kết thúc).';
    case 'MATCH_NOT_WAITING': return 'Trận đã bắt đầu hoặc kết thúc, không thể huỷ.';
    case 'SUBMIT_LIMIT': return 'Bạn đã dùng hết số lần nộp của trận này.';
    case 'SUBMIT_TOO_FAST': return e.retryAfter ? `Nộp quá nhanh, thử lại sau ${e.retryAfter} giây.` : 'Nộp quá nhanh, vui lòng đợi chút.';
    case 'GRADER_BUSY': case 'GRADER_DISABLED': return 'Hệ thống chấm đang bận, thử lại sau.';
    case 'QUESTION_CLOSED': return 'Câu này đã hết giờ trả lời.';
    case 'ALREADY_ANSWERED': return 'Bạn đã trả lời câu này rồi.';
    default: break;
  }
  if (e.status === 429) return e.retryAfter ? `Thao tác quá nhanh, thử lại sau ${e.retryAfter} giây.` : 'Thao tác quá nhanh, vui lòng thử lại sau.';
  if (e.status === 503) return 'Máy chủ đang bận, thử lại sau.';
  return e.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* riêng tư */ } },
};
let token = store.get(TOKEN_KEY);
export const hasSession = () => !!token;

/** Một lượt fetch có hạn giờ; lỗi mạng/hết giờ → ArenaApiError(status 0). */
async function raw(path, { method = 'GET', body, timeoutMs = 15000, auth = true } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(API_BASE + path, {
      method, headers, credentials: 'include', signal: ctrl.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new ArenaApiError(0, 'Quá thời gian chờ máy chủ.', 'TIMEOUT');
    throw new ArenaApiError(0, 'Không kết nối được máy chủ Arena.', 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Như raw(), nhưng thử lại MỘT lần khi máy chủ 503 hoặc rớt mạng (Neon "ngủ" làm kết nối đầu tiên
 *  quá hạn). Chỉ dùng cho lệnh đọc và đăng nhập — lệnh ghi (ghép trận, nộp bài) không tự lặp lại. */
async function retrying(path, opts = {}) {
  const safe = (opts.method ?? 'GET') === 'GET' || opts.retry;
  try {
    const res = await raw(path, opts);
    if (res.status !== 503 || !safe) return res;
    await wait(Math.min(5, Number(res.headers.get('Retry-After')) || 1.5) * 1000);
  } catch (e) {
    if (!safe || e?.status !== 0) throw e;
    await wait(1500);
  }
  return raw(path, opts);
}

async function parse(res) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.ok) return data;
  // 5xx không có thân JSON: proxy của Vite (hoặc reverse proxy) không tới được backend
  if (res.status >= 500 && !data) throw new ArenaApiError(0, 'Không kết nối được máy chủ Arena.', 'NETWORK');
  // Phong bì lỗi của backend: { error: { status, message, detail, code? }, request_id }; dự phòng message/code ở gốc.
  const d = data && typeof data === 'object' ? data : {};
  const err = d.error && typeof d.error === 'object' ? d.error : {};
  const m = err.message ?? d.message;
  const msg = Array.isArray(m) ? m.join('; ') : typeof m === 'string' ? m : '';
  const code = err.code ?? d.code;
  const ra = Number(res.headers.get('Retry-After'));
  throw new ArenaApiError(res.status, msg || `Lỗi ${res.status}`, typeof code === 'string' ? code : undefined, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

let authing = null;
/** Lấy access token mới: thử refresh (cookie) trước, không được thì tạo khách mới. */
function reauth() {
  if (!authing) {
    authing = (async () => {
      let r = await retrying('/auth/refresh', { method: 'POST', body: {}, auth: false, retry: true });
      if (!r.ok) {
        r = await retrying('/auth/guest', { method: 'POST', body: {}, auth: false, retry: true });
        store.set(NAME_KEY, null); // tài khoản mới: đặt lại tên lần tới
      }
      const d = await parse(r);
      if (!d?.access) throw new ArenaApiError(500, 'Máy chủ không cấp phiên đăng nhập.');
      token = d.access;
      store.set(TOKEN_KEY, token);
    })().finally(() => { authing = null; });
  }
  return authing;
}

/** Gọi API có JWT; 401 thì xin phiên mới một lần rồi gọi lại. */
export async function request(path, opts = {}) {
  if (!token) await reauth();
  let res = await retrying(path, opts);
  if (res.status === 401) {
    token = null; store.set(TOKEN_KEY, null);
    await reauth();
    res = await retrying(path, opts);
  }
  return parse(res);
}

/** Đặt tên hiển thị (tên người chơi trong Góc học) cho tài khoản khách — một lần cho mỗi tên. */
export async function syncName(name) {
  const n = String(name || '').trim().slice(0, 60);
  if (!n || store.get(NAME_KEY) === n) return;
  await request('/api/user', { method: 'PUT', body: { name: n } });
  store.set(NAME_KEY, n);
}

export const arenaApi = {
  problems: () => request('/api/arena/problems').then((r) => r.problems),
  problem: (id) => request(`/api/arena/problems/${encodeURIComponent(id)}`).then((r) => r.problem),
  me: () => request('/api/arena/me'),
  createRoom: (problemId) => request('/api/arena/rooms', { method: 'POST', body: problemId ? { problemId } : {} }),
  joinRoom: (code) => request('/api/arena/rooms/join', { method: 'POST', body: { code } }),
  queue: () => request('/api/arena/queue', { method: 'POST', body: {} }),
  current: () => request('/api/arena/matches/current'),
  match: (id) => request(`/api/arena/matches/${id}`),
  cancel: (id) => request(`/api/arena/matches/${id}/cancel`, { method: 'POST', body: {} }),
  forfeit: (id) => request(`/api/arena/matches/${id}/forfeit`, { method: 'POST', body: {} }),
  /** Đồng bộ: server trả khi chấm xong (tối đa ~30 s) → hạn 40 s. */
  submit: (id, code) => request(`/api/arena/matches/${id}/submissions`, { method: 'POST', body: { code }, timeoutMs: 40000 }),
  submissions: (id) => request(`/api/arena/matches/${id}/submissions`).then((r) => r.submissions),
  history: (limit = 20) => request(`/api/arena/history?limit=${limit}`),
  leaderboard: () => request('/api/arena/leaderboard'),
};

/** Arena · Đoán output (server/src/arena-quiz): đấu online 1v1, đồng hồ và đáp án do server giữ. */
export const quizApi = {
  me: () => request('/api/arena/quiz/me'),
  leaderboard: () => request('/api/arena/quiz/leaderboard'),
  queue: () => request('/api/arena/quiz/queue', { method: 'POST', body: {} }),
  current: () => request('/api/arena/quiz/matches/current'),
  match: (id) => request(`/api/arena/quiz/matches/${id}`),
  answer: (id, index, choice) => request(`/api/arena/quiz/matches/${id}/answer`, { method: 'POST', body: { index, choice } }),
  cancel: (id) => request(`/api/arena/quiz/matches/${id}/cancel`, { method: 'POST', body: {} }),
  forfeit: (id) => request(`/api/arena/quiz/matches/${id}/forfeit`, { method: 'POST', body: {} }),
};
