/**
 * Luật thời hạn giữ của `learning_events` — phần thuần, để test được. Phần chạm DB nằm ở
 * scripts/learning-events/rollup-heartbeats.ts.
 */

export const HEARTBEAT_KIND = 'X-Lesson.Heartbeat';

/** Heartbeat thô chỉ giữ ngần này ngày rồi gộp thành phút (learning_time_daily). */
export const DEFAULT_HEARTBEAT_DAYS = 7;

/**
 * Mọi loại khác, và bảng tóm tắt, giữ ngần này ngày. BẰNG `HAN_LUU_NGAY`
 * (frontend/src/lib/learning-event-kinds.ts): đó là điều đã hứa với người học, nên job này
 * không được giữ lâu hơn nó. Đổi một nơi thì đổi cả hai.
 */
export const DEFAULT_KEEP_DAYS = 90;

/**
 * 00:00 UTC của ngày cách `now` đúng `daysBack` ngày. Cắt theo NGÀY chứ không theo giây vì
 * job cộng dồn phút vào dòng (user, ngày, bài): nếu mốc cắt rơi giữa một ngày thì lần chạy
 * sau lại gộp nốt nửa kia vào cùng dòng, và một phút nằm đúng ranh giới bị đếm hai lần.
 * Mốc theo ngày nghĩa là mỗi (user, ngày) được gộp trọn MỘT lần.
 */
export function dayAlignedCutoff(now: Date, daysBack: number): Date {
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(startOfToday - daysBack * 86_400_000);
}

/** `--keep-days=30` → 30. Thiếu cờ thì lấy mặc định; không phải số nguyên ≥ 1 thì ném lỗi. */
export function parseDaysFlag(
  argv: readonly string[],
  flag: string,
  fallback: number,
): number {
  const raw = argv
    .find((a) => a.startsWith(`${flag}=`))
    ?.slice(flag.length + 1);
  if (raw === undefined) return fallback;
  // 0 ngày nghĩa là gộp/xoá cả dữ liệu của hôm nay — gần như chắc chắn là gõ nhầm.
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error(`${flag} phải là số nguyên >= 1 (ngày), nhận "${raw}"`);
  }
  return Number(raw);
}
