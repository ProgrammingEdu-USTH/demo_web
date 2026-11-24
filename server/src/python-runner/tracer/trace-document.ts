/**
 * HỢP ĐỒNG JSON giữa tracer (Python, trong sandbox) — backend — giao diện.
 *
 * Một lượt "Xem từng bước" sinh ra ĐÚNG MỘT tài liệu này, rồi UI bước qua lại
 * cục bộ trên nó. Không có lượt gọi máy chủ nào cho từng bước: mỗi lượt chạy là
 * một container dùng một lần, không có tiến trình nào sống sót giữa hai request
 * (xem sandbox/docker-sandbox.ts), nên "bước tiếp" bằng cách gọi lại máy chủ là
 * không thể làm được dù có muốn.
 *
 * Nguồn sinh ra nó: src/python-runner/tracer/pe_tracer.py. Mọi trường ở đây đều
 * do file đó ghi ra; sửa một bên thì phải sửa bên kia và chạy lại
 * `py src/python-runner/tracer/pe_tracer_test.py`.
 *
 * Ví dụ đầy đủ cho chương trình:
 *
 *   tong = 0
 *   for i in range(2):
 *       tong = tong + i
 *   print(tong)
 *
 * (rút gọn còn 3 bước đầu để đọc được; bản thật có 10 bước)
 *
 * {
 *   "v": 1,
 *   "stopReason": "done",
 *   "error": null,
 *   "stdout": "1\n",
 *   "stderr": "",
 *   "stdoutTruncated": false,
 *   "stderrTruncated": false,
 *   "steps": [
 *     { "i": 0, "event": "call", "line": 1, "out": 0, "err": 0,
 *       "frames": [{ "name": "<module>", "line": 1, "locals": [] }] },
 *     { "i": 1, "event": "line", "line": 1, "out": 0, "err": 0,
 *       "frames": [{ "name": "<module>", "line": 1, "locals": [] }] },
 *     { "i": 2, "event": "line", "line": 2, "out": 0, "err": 0,
 *       "frames": [{ "name": "<module>", "line": 2,
 *                    "locals": [["tong", { "t": "prim", "r": "0" }]] }] }
 *   ],
 *   "stats": { "steps": 10, "events": 10, "elapsedMs": 3, "valuesTruncated": 0 },
 *   "limits": { "maxSteps": 1000, "maxBytes": 716800, "timeBudgetMs": 6500,
 *               "maxDepth": 4, "maxItems": 100, "maxDictItems": 50,
 *               "maxAttrs": 30, "maxStringChars": 200, "maxFrames": 20,
 *               "maxLocals": 60, "maxOutputChars": 60000 }
 * }
 */

/**
 * Một giá trị Python đã được hạ xuống dạng an toàn để truyền và vẽ.
 *
 * Vì sao không phải `repr()` suông: `repr` của một list một triệu phần tử là một
 * chuỗi một triệu ký tự, `repr` của dữ liệu tự tham chiếu thì CPython in `[...]`
 * nhưng `repr` do người học tự viết có thể đệ quy vô hạn hoặc ném lỗi. Cây này
 * có trần ở mọi chiều và mọi nhánh đều có đường thoát.
 */
export type TraceValue =
  /** int, float, bool, None, complex — `r` là repr (đã cắt nếu khổng lồ, ví dụ 10**5000). */
  | { t: 'prim'; r: string }
  /** `r` là nội dung chuỗi (KHÔNG có dấu nháy); `n` là độ dài thật khi bị cắt. */
  | { t: 'str'; r: string; trunc?: true; n?: number }
  | { t: 'bytes'; r: string; n: number }
  /** list/tuple/set/frozenset. `n` là số phần tử THẬT, `items` chỉ là phần đầu. */
  | {
      t: 'list' | 'tuple' | 'set' | 'frozenset';
      items: TraceValue[];
      n: number;
      more?: true;
    }
  /** dict: mỗi phần tử là cặp [khoá, giá trị]; khoá cũng là TraceValue (khoá có thể là tuple…). */
  | { t: 'dict'; items: [TraceValue, TraceValue][]; n: number; more?: true }
  /** Đối tượng thường: đọc từ `__dict__` nên property KHÔNG bị gọi (không chạy mã người học). */
  | {
      t: 'obj';
      cls: string;
      attrs: [string, TraceValue][];
      n: number;
      more?: true;
    }
  | { t: 'fn'; name: string; cls: string }
  | { t: 'cls'; name: string }
  /** Đã gặp chính nó trên đường đi xuống: `a = []; a.append(a)`. */
  | { t: 'cycle' }
  /** Lồng sâu hơn `limits.maxDepth`. */
  | { t: 'depth' }
  /** Kiểu không mở ra được (module, ndarray…) hoặc repr ném lỗi. */
  | { t: 'opaque'; cls: string; r: string };

export interface TraceFrame {
  /** `<module>` cho thân chương trình, còn lại là tên hàm. */
  name: string;
  line: number;
  /** Giữ THỨ TỰ xuất hiện trong frame (không sắp lại) — người học đọc theo thứ tự mình viết. */
  locals: [string, TraceValue][];
}

export interface TraceStep {
  /** Chỉ số bước, 0-based, trùng vị trí trong mảng `steps`. */
  i: number;
  /**
   * `line`: dòng SẮP chạy (với event `line`), dòng `def` (với `call`), dòng
   * `return`/dòng ném lỗi (với `return`/`exception`). 1-based theo mã người học.
   */
  line: number;
  event: 'line' | 'call' | 'return' | 'exception';
  /** Call stack: [0] ngoài cùng (`<module>`), phần tử cuối là frame đang chạy. */
  frames: TraceFrame[];
  /** Số frame bị bỏ ở GIỮA frames[0] và frames[1] (đệ quy sâu hơn `limits.maxFrames`). */
  framesElided?: number;
  /** Số ký tự stdout đã in TỚI bước này → UI cắt `stdout.slice(0, out)`. */
  out: number;
  /** Như `out`, cho stderr. */
  err: number;
  /** Chỉ có ở event `return`. */
  ret?: TraceValue;
  /** Chỉ có ở event `exception`. */
  exc?: { type: string; message: string };
}

/**
 * Vì sao vết dừng. UI phải nói thật câu này ra, đừng im lặng:
 *   done        chương trình chạy hết
 *   error       ngoại lệ chưa bắt (hoặc SyntaxError) — `error` có chi tiết
 *   step-limit  chạm trần số bước; vết dừng nhưng CHƯƠNG TRÌNH VẪN CHẠY NỐT nên
 *               `stdout` là đầu ra đầy đủ
 *   byte-limit  vết đã quá lớn để gửi về (dữ liệu trong biến quá nặng)
 *   time-limit  hết thời gian dành cho một lượt ghi vết (ghi vết chậm hơn chạy)
 *   tracer-error  lỗi của chính tracer — không bao giờ nên thấy, nếu thấy thì là lỗi của chúng ta
 */
export type TraceStopReason =
  | 'done'
  | 'error'
  | 'step-limit'
  | 'byte-limit'
  | 'time-limit'
  | 'tracer-error';

export interface TraceLimits {
  maxSteps: number;
  maxBytes: number;
  timeBudgetMs: number;
  maxDepth: number;
  maxItems: number;
  maxDictItems: number;
  maxAttrs: number;
  maxStringChars: number;
  maxFrames: number;
  maxLocals: number;
  maxOutputChars: number;
}

export interface TraceDocument {
  /** Phiên bản hợp đồng. Đổi hình dạng thì tăng số này, đừng sửa im lặng. */
  v: 1;
  steps: TraceStep[];
  /** TOÀN BỘ đầu ra của chương trình (kể cả phần in ra sau bước cuối cùng). */
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  stopReason: TraceStopReason;
  error: {
    type: string;
    message: string;
    /** Dòng trong mã người học, null nếu không xác định được. */
    line: number | null;
    /** Traceback đã lọc sạch khung của tracer, in đúng dòng mã người học. */
    traceback: string;
  } | null;
  stats: {
    /** Số bước ĐƯỢC GHI (= steps.length). */
    steps: number;
    /** Số sự kiện đã THẤY. Lớn hơn `steps` nghĩa là đã bỏ bớt vì chạm trần. */
    events: number;
    elapsedMs: number;
    valuesTruncated: number;
  };
  limits: TraceLimits;
}

/** Phần "chạy thật" của lượt đó, lấy từ RunResult — để nói thật về giá phải trả. */
export interface TraceRunInfo {
  exitCode: number | null;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
  queuedMs: number;
}

/** Thân phản hồi của POST /api/python/trace. */
export interface TraceResponse {
  trace: TraceDocument;
  run: TraceRunInfo;
}
