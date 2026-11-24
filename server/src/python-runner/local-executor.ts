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
import {
  assertCodeSize,
  runInSandbox,
  SandboxError,
  type RunResult,
} from './sandbox/docker-sandbox';
import {
  QUEUE_BUSY_MESSAGE,
  QueueAbortedError,
  QueueRejectedError,
  RunQueue,
} from './sandbox/run-queue';

/**
 * Chạy docker ngay trên máy backend (PY_RUNNER_MODE=local).
 *
 * Hàng đợi (PY_RUN_MAX_CONCURRENT / PY_RUN_QUEUE_MAX / PY_RUN_QUEUE_TIMEOUT_MS)
 * dùng đúng RunQueue của runner nên hai chế độ hành xử giống nhau: hết chỗ thì
 * xếp hàng, hàng đầy hoặc chờ quá hạn mới 429. Ở chế độ remote runner mới là nơi
 * giữ hàng đợi, backend không giữ.
 */
@Injectable()
export class LocalExecutor implements PythonExecutor {
  private readonly logger = new Logger(LocalExecutor.name);
  private readonly queue: RunQueue;

  constructor(private readonly config: ConfigService) {
    this.queue = new RunQueue({
      slots: config.get<number>('PY_RUN_MAX_CONCURRENT') ?? 2,
      queueMax: config.get<number>('PY_RUN_QUEUE_MAX') ?? 100,
      queueTimeoutMs: config.get<number>('PY_RUN_QUEUE_TIMEOUT_MS') ?? 30_000,
    });
  }

  async run(code: string, signal?: AbortSignal): Promise<RunResult> {
    try {
      // Kiểm kích thước TRƯỚC khi xếp hàng: mã quá lớn là 400, không phải 429.
      assertCodeSize(code);
      const { value, queuedMs } = await this.queue.run(
        (taskSignal) =>
          runInSandbox(code, {
            image: this.config.get<string>('PY_SANDBOX_IMAGE') ?? 'py-sandbox',
            timeoutMs: this.config.get<number>('PY_RUN_TIMEOUT_MS') ?? 10_000,
            memory: this.config.get<string>('PY_RUN_MEMORY') ?? '1g',
            signal: taskSignal,
            onWarn: (m) => this.logger.warn(m),
          }),
        signal,
      );
      return { ...value, queuedMs };
    } catch (e) {
      throw toHttpException(e);
    }
  }
}

function toHttpException(e: unknown): unknown {
  if (e instanceof QueueRejectedError) {
    return new HttpException(QUEUE_BUSY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
  // Người gọi đã bỏ đi: không ai đọc câu trả lời này, chỉ cần dừng êm.
  if (
    e instanceof QueueAbortedError ||
    (e instanceof SandboxError && e.kind === 'ABORTED')
  ) {
    return new ClientClosedRequestException();
  }
  if (e instanceof SandboxError) {
    return e.kind === 'CODE_TOO_LARGE'
      ? new BadRequestException(e.message)
      : new ServiceUnavailableException(e.message);
  }
  return e;
}
