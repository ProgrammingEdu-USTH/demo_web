import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

/**
 * Cổng vào của POST /python/run: công khai hay đòi JWT tuỳ PY_RUNNER_PUBLIC.
 *
 * Vì sao không viết `@Public()` có điều kiện theo `process.env`: decorator chạy
 * lúc NẠP class, mà ConfigModule chỉ đọc file .env sau đó (khi app.module.ts
 * được đánh giá) — giá trị trong .env sẽ không bao giờ thấy được ở đó, route
 * lặng lẽ không công khai dù .env đã bật. Controller vì thế luôn gắn @Public()
 * (để JwtAuthGuard toàn cục tránh đường), còn guard này đọc cấu hình ở mỗi
 * request: bật thì cho qua, tắt thì chạy AuthGuard('jwt') như mọi route khác.
 * Mặc định tắt → lỗi cấu hình luôn rơi về phía KHÔNG công khai.
 */
@Injectable()
export class PythonRunnerAccessGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (isRunnerPublic(this.config)) return true;
    return super.canActivate(context);
  }
}

/** Joi chuyển 'true' thành boolean; chấp nhận cả chuỗi phòng khi validation bị bỏ qua. */
export function isRunnerPublic(config: ConfigService): boolean {
  const raw: unknown = config.get('PY_RUNNER_PUBLIC');
  return raw === true || raw === 'true';
}
