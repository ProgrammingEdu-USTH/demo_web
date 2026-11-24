import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientClosedRequestException,
  type PythonExecutor,
} from './python-executor';
import type { RunResult } from './sandbox/docker-sandbox';

export const RUNNER_DOWN_MESSAGE = 'Bộ chạy Python đang tắt, thử lại sau';

/**
 * Thời gian chờ thêm: runner còn phải khởi động container, `docker kill`, dọn dẹp.
 * Tổng thời gian chờ runner = chờ trong HÀNG ĐỢI của runner + chạy + khoản này.
 */
const EXTRA_WAIT_MS = 10_000;

/**
 * Gọi runner HTTP (PY_RUNNER_MODE=remote): POST ${RUNNER_URL}/run.
 *
 * Giới hạn đồng thời KHÔNG kiểm ở đây — runner quyết định, và 429 của nó được
 * chuyển tiếp nguyên trạng cho client.
 *
 * Phân loại phản hồi:
 *   200            → RunResult nguyên vẹn
 *   429            → 429 (giữ thông điệp của runner)
 *   400 / 413      → 400 (mã không hợp lệ)
 *   còn lại, lỗi mạng, hết giờ, JSON sai hình → 503 RUNNER_DOWN_MESSAGE
 * 401 từ runner nghĩa là RUNNER_SECRET của backend lệch runner: đó là lỗi cấu
 * hình của CHỦ HỆ THỐNG, không phải của người dùng, nên ghi log lỗi rõ ràng và
 * chỉ trả 503 chung chung — không để lộ ra ngoài rằng có một khoá đang sai.
 */
@Injectable()
export class RemoteExecutor implements PythonExecutor {
  private readonly logger = new Logger(RemoteExecutor.name);
  private readonly endpoint: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    // Tiêm được để test không phải chạm mạng.
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    // Joi đã bắt buộc hai biến này khi mode=remote; getOrThrow để quên là nổ ngay lúc khởi động.
    const base = config.getOrThrow<string>('RUNNER_URL').replace(/\/+$/, '');
    this.endpoint = `${base}/run`;
    this.secret = config.getOrThrow<string>('RUNNER_SECRET');
    // Phải tính cả thời gian xếp hàng ở runner: bài vào cuối hàng có thể chờ tới
    // PY_RUN_QUEUE_TIMEOUT_MS rồi mới được chạy PY_RUN_TIMEOUT_MS. Hai biến này
    // phải cùng giá trị với runner, nếu không backend bỏ cuộc trước runner.
    this.timeoutMs =
      (config.get<number>('PY_RUN_QUEUE_TIMEOUT_MS') ?? 30_000) +
      (config.get<number>('PY_RUN_TIMEOUT_MS') ?? 10_000) +
      EXTRA_WAIT_MS;
  }

  async run(code: string, signal?: AbortSignal): Promise<RunResult> {
    let res: Response;
    try {
      const timeout = AbortSignal.timeout(this.timeoutMs);
      res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secret}`,
        },
        body: JSON.stringify({ code }),
        // Người dùng bỏ đi thì huỷ luôn request tới runner: runner thấy kết nối
        // đóng sẽ rút bài khỏi hàng đợi (hoặc giết container nếu đang chạy).
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
    } catch (e) {
      if (signal?.aborted) {
        throw new ClientClosedRequestException();
      }
      this.logger.warn(`Không gọi được runner: ${describe(e)}`);
      throw new ServiceUnavailableException(RUNNER_DOWN_MESSAGE);
    }

    const body: unknown = await res.json().catch(() => null);

    if (res.ok) {
      // Runner cũ chưa có hàng đợi không gửi queuedMs: coi như không chờ.
      if (isRunResult(body)) return { ...body, queuedMs: body.queuedMs ?? 0 };
      this.logger.error('Runner trả 200 nhưng nội dung không phải RunResult');
      throw new ServiceUnavailableException(RUNNER_DOWN_MESSAGE);
    }

    if (res.status === 429) {
      throw new HttpException(
        messageOf(body) ?? 'Runner đang bận, vui lòng thử lại sau vài giây.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (res.status === 400 || res.status === 413) {
      throw new BadRequestException(messageOf(body) ?? 'Mã nguồn không hợp lệ');
    }
    if (res.status === 401) {
      this.logger.error(
        'Runner từ chối khoá (401): RUNNER_SECRET của backend không khớp RUNNER_SECRET của runner.',
      );
    } else {
      this.logger.error(`Runner trả HTTP ${res.status}`);
    }
    throw new ServiceUnavailableException(RUNNER_DOWN_MESSAGE);
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: { code?: string } }).cause;
    return `${e.name}: ${e.message}${cause?.code ? ` (${cause.code})` : ''}`;
  }
  return String(e);
}

function messageOf(body: unknown): string | undefined {
  const m = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(m)) return m.join(', ');
  return typeof m === 'string' && m ? m : undefined;
}

function isRunResult(
  v: unknown,
): v is Omit<RunResult, 'queuedMs'> & { queuedMs?: number } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.stdout === 'string' &&
    typeof r.stderr === 'string' &&
    (r.exitCode === null || typeof r.exitCode === 'number') &&
    typeof r.timedOut === 'boolean' &&
    typeof r.outputTruncated === 'boolean' &&
    typeof r.durationMs === 'number' &&
    (r.queuedMs === undefined || typeof r.queuedMs === 'number')
  );
}
