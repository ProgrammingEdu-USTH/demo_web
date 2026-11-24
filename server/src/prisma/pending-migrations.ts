import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Migration có trong repo mà DB chưa áp. Code đi trước DB (kéo code mới nhưng chưa chạy
 * `prisma migrate deploy`) làm câu SQL đọc cột chưa có lỗi 500, và giao diện chỉ hiện câu chung
 * "Chưa kết nối được Backend" (đã gặp 21/11: cột enrollments.reset_at).
 */
export function findPendingMigrations(inRepo: string[], applied: string[]): string[] {
  const done = new Set(applied);
  return inRepo.filter((n) => !done.has(n)).sort();
}

/** null khi không có thư mục prisma/migrations (bản build không chép nó): khi đó bỏ qua việc kiểm. */
export function readRepoMigrations(
  dir = join(process.cwd(), 'prisma', 'migrations'),
): string[] | null {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return null;
  }
}
