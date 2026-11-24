import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException, throttlerMessage } from '@nestjs/throttler';
import { redactQuery } from 'src/common/logging/redact-url';
import {
  classifyDbError,
  DB_ERROR_MESSAGES,
  RETRY_AFTER_SECONDS,
} from 'src/common/db-errors';

@Catch()
export class AllExceptionsFilter<T> implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã có lỗi xảy ra, xin vui lòng thử lại sau';
    let detail: any = null;
    let fields: Record<string, string> | null = null;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      // Route nào khai @ThrottleMessage thì CustomThrottlerGuard đã đặt câu
      // riêng; chỉ thay bằng câu chung khi vẫn là mặc định tiếng Anh của thư
      // viện ('ThrottlerException: Too Many Requests'). Không phân biệt chỗ này
      // thì /python/run luôn nói "bạn bấm quá nhiều" kể cả khi thật ra hàng đợi
      // của máy chủ đầy — hai việc khác nhau, cách xử lý khác nhau.
      message =
        exception.message && exception.message !== throttlerMessage
          ? exception.message
          : 'Quá nhiều yêu cầu, vui lòng thử lại sau';
    } else if (classifyDbError(exception)) {
      // Cạn pool / mất kết nối DB là tình trạng TẠM THỜI của hạ tầng -> 503 + Retry-After, không
      // phải 500. Câu nói theo NGUYÊN NHÂN (xem db-errors.ts): "quá tải" cho socket bị Neon cắt
      // là nói sai và khiến người học chờ lâu hơn cần.
      const kind = classifyDbError(exception)!;
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = DB_ERROR_MESSAGES[kind];
      response.setHeader?.('Retry-After', String(RETRY_AFTER_SECONDS[kind]));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res != null) {
        const resObj = res as any;
        if (Array.isArray(resObj.message)) {
          // Nói RÕ sai ở đâu thay vì câu chung chung 'Dữ liệu không hợp lệ':
          // client hiển thị message này trực tiếp cho người dùng.
          message = resObj.message[0] ?? 'Dữ liệu không hợp lệ';
          detail = resObj.message;
          // Map field -> message (do validationExceptionFactory sinh ra) giúp
          // form tô đỏ đúng ô nhập.
          if (resObj.fields && typeof resObj.fields === 'object') {
            fields = resObj.fields;
          }
        } else {
          message = resObj.message || message;
        }
      }

      // Message tiếng Việt mặc định CHỈ áp khi exception không mang message
      // riêng (guard/passport ném ra 'Unauthorized'/'Forbidden' trống nghĩa).
      // Trước đây ép cứng nên mọi lỗi 401 đều thành 'Chưa đăng nhập' — kể cả
      // 'Email/số điện thoại hoặc mật khẩu không đúng' do AuthService ném ra,
      // khiến người dùng nhập sai mật khẩu không biết mình sai ở đâu.
      if (
        exception instanceof UnauthorizedException &&
        message === 'Unauthorized'
      ) {
        message = 'Chưa đăng nhập';
      } else if (
        exception instanceof ForbiddenException &&
        message === 'Forbidden'
      ) {
        message = 'Không có quyền truy cập';
      }
    }

    const requestId = request.requestId || null;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      const req = request as Request;
      this.logger.error(
        `${req.method} ${redactQuery(req.originalUrl ?? req.url)} -> ${status} ${message}`,
        stack,
      );
    }

    response.status(status).json({
      error: {
        status,
        message,
        detail,
        ...(fields ? { fields } : {}),
      },
      request_id: requestId,
    });
  }
}
