import type { Prisma } from 'src/generated/prisma';

/**
 * Cộng XP vào nhật ký theo ngày (`user_daily_xp_logs`) bằng MỘT câu lệnh.
 *
 * VÌ SAO (BE3, 11/11/2026). Hai đường cộng XP — `completeLesson` và
 * `completeMission` — từng làm "findFirst rồi update/create": thêm một vòng tới
 * Neon trong transaction, và hai request song song của cùng người trong cùng
 * ngày đều đọc ra "chưa có" rồi CÙNG create, sinh hai hàng cho một ngày. Nay
 * bảng có unique `uq_daily_xp_user_date (user_id, log_date)` (migration
 * `20261111000000_daily_xp_log_unique`), nên upsert dịch thành một câu
 * `INSERT … ON CONFLICT DO UPDATE`: nguyên tử, không trùng, bớt một vòng.
 *
 * MỌI chỗ ghi bảng này PHẢI đi qua đây. Còn sót một chỗ "findFirst rồi create"
 * thì với unique mới nó không còn sinh hàng trùng nữa mà NÉM P2002 và
 * rollback cả transaction của người dùng — tệ hơn lỗi cũ.
 *
 * `logDate` phải đã qua `toStudyDate()` (UTC midnight của cột `@db.Date`).
 */
export async function addDailyXp(
  tx: Pick<Prisma.TransactionClient, 'userDailyXpLog'>,
  userId: number,
  logDate: Date,
  xp: number,
): Promise<void> {
  await tx.userDailyXpLog.upsert({
    where: { userId_logDate: { userId, logDate } },
    update: { xpEarned: { increment: xp } },
    create: { userId, logDate, xpEarned: xp },
  });
}
