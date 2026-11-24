import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Response, Request } from 'express';
import cors from 'cors';

const CORS_SCOPED_PATHS = ['/api', '/auth'];

function isScopedPath(path: string): boolean {
  // startsWith(prefix + '/') thay vì startsWith(prefix): '/apiary' không được
  // tính là thuộc scope '/api'.
  return CORS_SCOPED_PATHS.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/'),
  );
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly corsHandler: ReturnType<typeof cors>;

  constructor(private readonly configService: ConfigService) {
    this.corsHandler = cors({
      origin: this.configService.get<string[]>('app.allowedOrigins'),
      credentials: true,
      exposedHeaders: ['ETag'],
      // Đo trên production ngày 13/10/2026: frontend (www.programmingedu.io.vn)
      // và API (api.programmingedu.io.vn) là hai ORIGIN khác nhau, mà mọi lời
      // gọi của `apiFetch` đều đính header `Authorization`. Header đó KHÔNG nằm
      // trong danh sách an toàn của CORS, nên trình duyệt buộc phải gửi một
      // OPTIONS preflight trước MỖI URL mới.
      //
      // Trước khi có dòng này, response preflight không mang
      // `Access-Control-Max-Age` (đã kiểm bằng curl trên production: header
      // không xuất hiện), nên trình duyệt dùng mặc định 5 giây — tức mỗi lần mở
      // một bài lại phải preflight lại /api/user, /api/enrolled và URL content
      // của bài đó.
      //
      // Một vòng từ Việt Nam tới instance Render ở Oregon đo được 230–250 ms
      // khi dùng lại kết nối, nên 3 preflight ≈ 0,7 s chờ vô ích mỗi lần mở
      // bài; một buổi học 20 bài là ~14 s mỗi học viên.
      //
      // 86400 (24 giờ) là mức Firefox chấp nhận tối đa; Chrome tự hạ xuống trần
      // 7200 s của nó chứ không coi là lỗi — nên đặt 86400 là an toàn và còn
      // giữ được preflight qua cả buổi học.
      maxAge: 86400,
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // const pathname = req.originalUrl.split('?')[0];
    // console.log('[CORS]', req.method, pathname, isScopedPath(req.path));
    if (isScopedPath(req.path)) {
      this.corsHandler(req, res, next);
    } else {
      next();
    }
  }
}
