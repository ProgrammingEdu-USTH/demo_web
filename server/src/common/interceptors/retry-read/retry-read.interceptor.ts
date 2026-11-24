import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, retry, throwError, timer } from 'rxjs';
import { classifyDbError } from 'src/common/db-errors';

/**
 * Route GET gặp "Connection terminated" thì chạy lại handler MỘT lần.
 *
 * Neon cắt socket idle/autosuspend ở phía server; pool chỉ biết connection chết khi dùng nó,
 * nên lần đầu sau khoảng lặng thất bại dù lần sau (connection mới) sẽ qua. Chỉ GET vì handler
 * ghi (POST/PUT) có thể đã commit một phần trước khi socket đứt — chạy lại là nhân đôi việc.
 * Chỉ 'connection-dropped': pool-timeout thử lại thì chỉ xếp hàng thêm 10 s.
 */
@Injectable()
export class RetryReadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RetryReadInterceptor.name);

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    if (req.method !== 'GET') return next.handle();

    return next.handle().pipe(
      retry({
        count: 1,
        delay: (err) => {
          if (classifyDbError(err) !== 'connection-dropped') {
            return throwError(() => err as Error);
          }
          this.logger.warn(
            `GET ${req.url.split('?')[0]}: connection DB bị ngắt, thử lại 1 lần`,
          );
          return timer(200);
        },
      }),
    );
  }
}
