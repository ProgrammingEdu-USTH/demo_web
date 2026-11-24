import { ForbiddenException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';

/** Reset và hoàn thành bài phải lấy cùng khoá TRƯỚC khi đọc tiến độ/lịch sử.
 * Khoá hàng ghi danh tồn tại tới cuối transaction, ngăn mất bằng chứng thưởng
 * khi người học reset ở tab khác ngay lúc nộp bài.
 */
export async function lockCourseEnrollment(
  tx: Prisma.TransactionClient,
  userId: number,
  courseId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ user_id: number }[]>(Prisma.sql`
    SELECT user_id FROM enrollments
    WHERE user_id = ${userId} AND course_id = ${courseId} FOR UPDATE
  `);
  if (!rows.length)
    throw new ForbiddenException('Bạn cần đăng ký khoá học trước.');
}
