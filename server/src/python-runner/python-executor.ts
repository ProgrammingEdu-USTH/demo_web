import { HttpException } from '@nestjs/common';
import type { RunResult } from './sandbox/docker-sandbox';

/**
 * Client đã đóng kết nối trước khi có kết quả (đóng/tải lại tab). Không ai đọc câu
 * trả lời này; dùng 499 (quy ước của nginx) thay vì 5xx để bộ lọc lỗi không ghi nó
 * như một lỗi máy chủ — đây là sự kiện bình thường, không phải sự cố.
 */
export class ClientClosedRequestException extends HttpException {
  constructor() {
    super('Yêu cầu đã bị huỷ', 499);
  }
}

/**
 * Nơi THỰC SỰ chạy mã Python. Hai cài đặt, chọn bằng PY_RUNNER_MODE:
 *   - LocalExecutor:  chạy docker ngay trên máy backend;
 *   - RemoteExecutor: gọi runner HTTP đặt trên máy khác (backend trên Render
 *     không có Docker nên phải đi đường này).
 * Lỗi được ném ra dưới dạng HttpException của Nest để controller không phải
 * biết đang ở chế độ nào.
 *
 * `signal`: người gọi bỏ đi (ngắt kết nối). Đang xếp hàng thì rút khỏi hàng và
 * không chạy; đang chạy thì giết container để nhả chỗ ngay.
 */
export interface PythonExecutor {
  run(code: string, signal?: AbortSignal): Promise<RunResult>;
}

export const PYTHON_EXECUTOR = Symbol('PYTHON_EXECUTOR');
