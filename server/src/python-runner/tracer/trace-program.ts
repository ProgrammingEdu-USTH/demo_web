/**
 * Dựng chương trình gửi vào sandbox, và đọc tài liệu vết từ stdout của nó.
 *
 * Vì sao KHÔNG thêm route mới cho runner: lớp thật sự chạy mã là `runner/` trên
 * VM — một tiến trình riêng, deploy riêng, bundle riêng. Thêm `POST /trace` ở đó
 * nghĩa là tính năng này chỉ sống khi VM được deploy lại đúng lúc, và nghĩa là
 * một đường chạy mã THỨ HAI phải tự lo hàng đợi, trần RAM, trần thời gian, cờ
 * cách ly. Thay vào đó: backend dán tracer + mã người học thành MỘT file Python
 * và gửi qua ĐÚNG `POST /run` đang có. Cùng hàng đợi, cùng 8 cờ cách ly,
 * cùng `--network=none`, cùng trần RAM, cùng `timeout` — không thêm bề mặt nào.
 * Runner không cần biết tracer tồn tại.
 *
 * Cái giá của lựa chọn đó: tracer + mã người học phải cùng vừa trần 20 KB
 * (MAX_CODE_BYTES). Vì vậy mã người học được NÉN (zlib + base64) trước khi nhúng:
 * mã Python nén 3-4 lần nên gần như mọi chương trình trong trần của editor đều
 * vừa, còn trường hợp xấu nhất (dán một khối base64 không nén được) thì backend
 * từ chối kèm con số thật thay vì đoán trước một trần cứng.
 */
import { deflateSync } from 'node:zlib';
import { MAX_CODE_BYTES } from '../sandbox/docker-sandbox';
import type {
  TraceDocument,
  TraceRunInfo,
  TraceStopReason,
} from './trace-document';
import { TRACER_SOURCE } from './tracer-source';

/** Mốc bao quanh JSON trên stdout — phải giống PE_BEGIN/PE_END trong pe_tracer.py. */
export const TRACE_BEGIN = '__PE_TRACE_V1_BEGIN__';
export const TRACE_END = '__PE_TRACE_V1_END__';

/** Mã người học quá dài để nhét cùng tracer vào một file 20 KB. */
export class TraceCodeTooLargeError extends Error {
  constructor(
    readonly programBytes: number,
    readonly codeBytes: number,
  ) {
    super(
      `Chương trình quá dài để xem từng bước: cần gửi kèm bộ ghi vết nên tổng ` +
        `thành ${Math.ceil(programBytes / 1024)} KB, vượt trần ${MAX_CODE_BYTES / 1024} KB. ` +
        `Nút “Chạy” vẫn chạy được chương trình này.`,
    );
    this.name = 'TraceCodeTooLargeError';
  }
}

/**
 * Dựng file Python sẽ chạy trong sandbox: tracer + một lời gọi `_pe_run` mang
 * mã người học đã nén.
 *
 * Giữ ĐÚNG hình dạng này ở cả `pe_tracer_test.py` (hàm build_program) — hai nơi
 * dựng cùng một thứ nên test Python mới đo được đúng cái backend gửi đi.
 */
export function buildTraceProgram(code: string): string {
  // base64 của zlib: chỉ gồm [A-Za-z0-9+/=] nên nhét vào chuỗi nháy kép của
  // Python là an toàn tuyệt đối — không có cách nào mã người học thoát ra khỏi
  // chuỗi đó (khác hẳn việc dán mã nguồn thô vào một template).
  const payload = deflateSync(Buffer.from(code, 'utf8'), { level: 9 }).toString(
    'base64',
  );
  const program = `${TRACER_SOURCE}\n_pe_run("${payload}")\n`;
  const programBytes = Buffer.byteLength(program, 'utf8');
  if (programBytes > MAX_CODE_BYTES) {
    throw new TraceCodeTooLargeError(
      programBytes,
      Buffer.byteLength(code, 'utf8'),
    );
  }
  return program;
}

/**
 * Bóc tài liệu vết ra khỏi stdout.
 *
 * Vì sao phải bóc chứ không `JSON.parse(stdout)`: mã người học có thể ghi THẲNG
 * vào fd 1 (`os.write(1, b"rac")`) nên stdout có thể có rác trước/sau tài liệu.
 * Lấy mốc CUỐI CÙNG vì mã người học in được đúng chuỗi mốc ra để giả mạo một
 * tài liệu — mốc thật luôn là mốc do tracer ghi sau cùng.
 *
 * Trả null khi không có tài liệu nào đọc được (hết giờ cứng, tracer chết, JSON
 * bị cắt vì tràn 1 MB). Nơi gọi phải có đường đi cho null — xem fallbackTrace.
 */
export function parseTraceOutput(stdout: string): TraceDocument | null {
  const end = stdout.lastIndexOf(TRACE_END);
  if (end < 0) return null;
  const begin = stdout.lastIndexOf(TRACE_BEGIN, end);
  if (begin < 0) return null;
  const body = stdout.slice(begin + TRACE_BEGIN.length, end);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  return isTraceDocument(parsed) ? parsed : null;
}

/** Phần stdout KHÔNG thuộc tài liệu vết (rác do mã người học ghi thẳng vào fd 1). */
export function strayOutput(stdout: string): string {
  const begin = stdout.lastIndexOf(TRACE_BEGIN);
  const raw = begin < 0 ? stdout : stdout.slice(0, begin);
  return raw.trim();
}

/**
 * Tài liệu thay thế khi không bóc được vết, để UI vẫn có cái mà hiện.
 *
 * Người học bấm "Xem từng bước" rồi nhận một ô trống là tệ nhất; thà nói "không
 * dựng được vết" và đưa luôn đầu ra thô của lần chạy.
 */
export function fallbackTrace(
  run: TraceRunInfo,
  stdout: string,
  stderr: string,
): TraceDocument {
  const timedOut = run.timedOut;
  const reason: TraceStopReason = timedOut ? 'time-limit' : 'tracer-error';
  return {
    v: 1,
    steps: [],
    stdout: strayOutput(stdout),
    stderr,
    stdoutTruncated: run.outputTruncated,
    stderrTruncated: false,
    stopReason: reason,
    error: {
      type: timedOut ? 'Timeout' : 'TracerError',
      message: timedOut
        ? 'Chương trình bị dừng vì hết giờ trước khi ghi xong vết.'
        : 'Không dựng được vết cho lần chạy này.',
      line: null,
      traceback: '',
    },
    stats: {
      steps: 0,
      events: 0,
      elapsedMs: run.durationMs,
      valuesTruncated: 0,
    },
    limits: FALLBACK_LIMITS,
  };
}

/**
 * Trần dùng cho tài liệu thay thế. Giá trị thật luôn do tracer gửi về trong
 * `limits`; đây chỉ là chỗ điền khi tracer không nói được gì, nên UI không phải
 * kiểm `limits` có tồn tại hay không ở mọi nơi.
 */
const FALLBACK_LIMITS = {
  maxSteps: 1000,
  maxBytes: 700 * 1024,
  timeBudgetMs: 6500,
  maxDepth: 4,
  maxItems: 100,
  maxDictItems: 50,
  maxAttrs: 30,
  maxStringChars: 200,
  maxFrames: 20,
  maxLocals: 60,
  maxOutputChars: 60000,
};

/**
 * Kiểm hình dạng trước khi chuyển ra client.
 *
 * Dữ liệu này đi ra từ một tiến trình chạy MÃ TUỲ Ý của người lạ: nếu mã đó in
 * được đúng chuỗi mốc rồi nhồi JSON của nó vào, thì thứ tới đây không phải do
 * tracer sinh ra. Kiểm hình dạng để UI không phải phòng thủ từng trường, và để
 * rác không bao giờ được gắn nhãn "vết".
 */
function isTraceDocument(v: unknown): v is TraceDocument {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  if (d.v !== 1) return false;
  if (!Array.isArray(d.steps)) return false;
  if (typeof d.stdout !== 'string' || typeof d.stderr !== 'string')
    return false;
  if (
    typeof d.stdoutTruncated !== 'boolean' ||
    typeof d.stderrTruncated !== 'boolean'
  ) {
    return false;
  }
  if (typeof d.stopReason !== 'string') return false;
  if (!d.stats || typeof d.stats !== 'object') return false;
  if (!d.limits || typeof d.limits !== 'object') return false;
  if (d.error !== null && (!d.error || typeof d.error !== 'object'))
    return false;
  return d.steps.every(isTraceStep);
}

function isTraceStep(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.i === 'number' &&
    typeof s.line === 'number' &&
    typeof s.event === 'string' &&
    typeof s.out === 'number' &&
    typeof s.err === 'number' &&
    Array.isArray(s.frames)
  );
}
