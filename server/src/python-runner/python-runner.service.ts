import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PYTHON_EXECUTOR, type PythonExecutor } from './python-executor';
import type { RunResult } from './sandbox/docker-sandbox';
import type { TraceResponse, TraceRunInfo } from './tracer/trace-document';
import {
  buildTraceProgram,
  fallbackTrace,
  parseTraceOutput,
  TraceCodeTooLargeError,
} from './tracer/trace-program';

/**
 * Cửa vào của controller. Không biết mã chạy ở đâu — việc đó thuộc về executor
 * được chọn theo PY_RUNNER_MODE (xem python-runner.module.ts).
 */
@Injectable()
export class PythonRunnerService {
  constructor(
    @Inject(PYTHON_EXECUTOR) private readonly executor: PythonExecutor,
  ) {}

  run(code: string, signal?: AbortSignal): Promise<RunResult> {
    return this.executor.run(code, signal);
  }

  /**
   * Chạy mã KÈM ghi vết để `/ide` bước được từng dòng.
   *
   * Đi qua ĐÚNG executor của nút Chạy: cùng hàng đợi, cùng container, cùng cờ
   * cách ly, cùng trần thời gian. Khác biệt duy nhất là nội dung file gửi xuống
   * (tracer + mã người học) — xem tracer/trace-program.ts. Nhờ vậy `runner/`
   * trên VM không cần biết tính năng này tồn tại, và không có đường chạy mã thứ
   * hai nào phải tự lo giới hạn.
   */
  async trace(code: string, signal?: AbortSignal): Promise<TraceResponse> {
    let program: string;
    try {
      program = buildTraceProgram(code);
    } catch (e) {
      // Quá dài là lỗi của YÊU CẦU (400) kèm con số thật, không phải lỗi máy chủ.
      if (e instanceof TraceCodeTooLargeError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const result = await this.executor.run(program, signal);
    const run: TraceRunInfo = {
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      outputTruncated: result.outputTruncated,
      durationMs: result.durationMs,
      queuedMs: result.queuedMs,
    };
    // Không bóc được vết (hết giờ cứng nên tiến trình bị SIGKILL trước khi in,
    // đầu ra tràn 1 MB nên JSON bị cắt, docker không chạy) thì vẫn trả về một
    // tài liệu hợp lệ mang đầu ra thô: người học bấm nút rồi nhận ô trống không
    // kèm lời giải thích là kết cục tệ nhất.
    const trace =
      parseTraceOutput(result.stdout) ??
      fallbackTrace(run, result.stdout, result.stderr);
    return { trace, run };
  }
}
