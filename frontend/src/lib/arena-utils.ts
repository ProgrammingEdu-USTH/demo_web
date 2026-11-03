/** Hàm thuần dùng chung cho giao diện Arena (đồng hồ, định dạng, nháp mã). */

/** offset = serverTime − Date.now(), tính mỗi lần nhận phản hồi có serverTime. */
export function clockOffset(serverTimeIso: string, clientNow: number = Date.now()): number {
  const t = Date.parse(serverTimeIso);
  return Number.isFinite(t) ? t - clientNow : 0;
}

/** Số giây còn lại tới deadline theo giờ server (không âm, làm tròn lên). */
export function secondsLeft(deadlineIso: string | null, offsetMs: number, clientNow: number = Date.now()): number {
  if (!deadlineIso) return 0;
  const d = Date.parse(deadlineIso);
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.ceil((d - (clientNow + offsetMs)) / 1000));
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60} phút` : `${Math.floor(sec / 60)} phút ${sec % 60} giây`;
}

export function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const DIFFICULTY_LABEL: Record<string, string> = { easy: 'Dễ', medium: 'Trung bình' };
export const END_REASON_LABEL: Record<string, string> = {
  solved: 'Giải xong tất cả test',
  timeout: 'Hết giờ',
  forfeit: 'Đầu hàng',
};

/** Khoảng poll: 3 s, 5 s khi tab ẩn (features.md §8). */
export function pollDelayMs(hidden: boolean): number {
  return hidden ? 5000 : 3000;
}

// ── Nháp mã trong localStorage (khoá arena-draft-<matchId>), luôn bọc try/catch ──
const draftKey = (matchId: number) => `arena-draft-${matchId}`;

export function loadDraft(matchId: number): string | null {
  try {
    return localStorage.getItem(draftKey(matchId));
  } catch {
    return null;
  }
}

export function saveDraft(matchId: number, code: string): void {
  try {
    localStorage.setItem(draftKey(matchId), code);
  } catch {
    /* bỏ qua: chế độ riêng tư / hết dung lượng */
  }
}

export function clearDraft(matchId: number): void {
  try {
    localStorage.removeItem(draftKey(matchId));
  } catch {
    /* bỏ qua */
  }
}

/** Hiển thị giá trị JSON của ví dụ công khai thành chuỗi ngắn. */
export function showJson(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch {
    return String(v);
  }
}

/** "3 phút trước", "2 giờ trước", "hôm qua"… — gọn cho thẻ lịch sử trên mobile. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return 'vừa xong';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day === 1) return 'hôm qua';
  if (day < 30) return `${day} ngày trước`;
  return new Date(t).toLocaleDateString('vi-VN');
}

/** Giây → "0:14" cho đồng hồ chờ ghép trận. */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
