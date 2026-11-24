// Kiểu NestExpressApplication (không phải INestApplication chung) mới có
// useBodyParser — cần để đặt trần kích thước body.
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';

/**
 * Cấu hình tầng HTTP (Express) dùng chung cho main.ts và test.
 *
 * Vì sao tách khỏi main.ts: main.ts gọi bootstrap() ngay khi được import nên test
 * không dựng lại được đúng cấu hình production. Trước đây `x-powered-by: Express`
 * lọt ra mọi response trên production (đo 14/10/2026 ở /health và
 * /api/python/run) mà không test nào thấy, vì không test nào chạy qua main.ts.
 * Đặt ở đây thì http-app.setup.spec.ts dựng app thật và kiểm từng dòng.
 *
 * Phần prefix/CORS/rate-limit KHÔNG nằm ở đây — gateway giữ độc quyền
 * (src/api-gateway/api-gateway.setup.ts).
 */
export function setupHttpApp(app: NestExpressApplication): void {
  // Express mặc định gắn `X-Powered-By: Express` vào MỌI response, kể cả lỗi.
  // Không phải lỗ hổng tự thân, nhưng báo không công cho người dò quét biết
  // framework để chọn bộ khai thác. Tắt ở cấp ứng dụng Express (không phải
  // middleware xoá header) để cả response do Nest tự sinh như 404 cũng sạch.
  app.disable('x-powered-by');
  // BE13: chỉ gateway được cấp ETag cho response đã phân biệt quyền/người xem.
  app.set('etag', false);

  // Chặn body quá lớn ngay tại cổng vào: không có trần thì một request duy
  // nhất gửi JSON hàng chục MB (vd lộ trình cá nhân) đủ để ngốn RAM và làm
  // chậm cả tiến trình. 1mb thoải mái cho mọi payload hợp lệ của hệ thống.
  app.useBodyParser('json', { limit: process.env.BODY_LIMIT || '1mb' });
  app.useBodyParser('urlencoded', {
    limit: process.env.BODY_LIMIT || '1mb',
    extended: true,
  });

  // Nén gzip/brotli cho response JSON lớn (courses, skills, forum feed...) —
  // giảm băng thông đáng kể khi nhiều client cùng poll badge/feed.
  //
  // Phải từ 1.8.2 trở lên: 1.8.1 không huỷ luồng zlib khi client ngắt giữa
  // chừng (GHSA-vc2v-76pw-4v95), mỗi response nén bị bỏ dở rò bộ nhớ native.
  // Middleware này nằm trên đường của MỌI response và không cần đăng nhập, nên
  // lặp lại "mở rồi ngắt" là đủ làm cạn RAM instance.
  app.use(compression());
}
