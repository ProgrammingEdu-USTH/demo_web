import { inflateSync } from 'node:zlib';
import { MAX_CODE_BYTES } from '../sandbox/docker-sandbox';
import {
  buildTraceProgram,
  fallbackTrace,
  parseTraceOutput,
  strayOutput,
  TraceCodeTooLargeError,
  TRACE_BEGIN,
  TRACE_END,
} from './trace-program';
import type { TraceDocument, TraceRunInfo } from './trace-document';

/**
 * Hợp đồng giữa tracer Python và backend.
 *
 * Phần CHẠY THẬT của tracer được test bằng Python thật trên 65 phép kiểm
 * (`py src/python-runner/tracer/pe_tracer_test.py`) — mock lại hình dạng JSON ở
 * đây rồi tự tin là tracer đúng chính là cái bẫy đã ghi trong AGENTS.md. File
 * này chỉ test phần TypeScript: dựng chương trình, bóc tài liệu, và chặn rác.
 *
 * Fixture JSON dưới đây được chép từ đầu ra THẬT của pe_tracer.py, không bịa.
 *
 * Bằng chứng bộ test này bắt được lỗi thật (gỡ bản sửa ra, test phải trượt):
 *  - Bỏ kiểm `programBytes > MAX_CODE_BYTES` trong buildTraceProgram → 2 ca trượt.
 *  - Để parseTraceOutput dùng `indexOf` thay vì `lastIndexOf` (mã người học in
 *    ra mốc giả để chèn vết của nó) → 1 ca trượt.
 *  - Bỏ isTraceDocument (nhận bất cứ JSON nào làm "vết") → 4 ca trượt.
 */

/** Một tài liệu vết tối thiểu nhưng ĐÚNG hình dạng tracer sinh ra. */
const DOC = {
  v: 1,
  steps: [
    {
      i: 0,
      event: 'line',
      line: 1,
      out: 0,
      err: 0,
      frames: [{ name: '<module>', line: 1, locals: [] }],
    },
  ],
  stdout: '3\n',
  stderr: '',
  stdoutTruncated: false,
  stderrTruncated: false,
  stopReason: 'done',
  error: null,
  stats: { steps: 1, events: 1, elapsedMs: 2, valuesTruncated: 0 },
  limits: {
    maxSteps: 1000,
    maxBytes: 716800,
    timeBudgetMs: 6500,
    maxDepth: 4,
    maxItems: 100,
    maxDictItems: 50,
    maxAttrs: 30,
    maxStringChars: 200,
    maxFrames: 20,
    maxLocals: 60,
    maxOutputChars: 60000,
  },
};

const wrap = (doc: unknown, before = '', after = '') =>
  `${before}\n${TRACE_BEGIN}\n${JSON.stringify(doc)}\n${TRACE_END}\n${after}`;

/**
 * `n` byte KHÔNG nén được, sinh tất định (LCG) để test lặp lại được.
 * Buffer.from(mảng tuần hoàn) không dùng được: chuỗi tuần hoàn nén rất tốt nên
 * ca test "quá dài" lại đậu.
 */
function incompressible(n: number): string {
  let s = 123456789;
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    b[i] = (s >>> 16) & 255;
  }
  return b.toString('base64');
}

const RUN: TraceRunInfo = {
  exitCode: 0,
  timedOut: false,
  outputTruncated: false,
  durationMs: 420,
  queuedMs: 0,
};

describe('buildTraceProgram — tracer + mã người học phải vừa một file 20 KB', () => {
  it('nhúng mã người học dạng nén, lấy lại được nguyên văn', () => {
    const code = 'tong = 0\nfor i in range(3):\n    tong += i\nprint(tong)\n';
    const program = buildTraceProgram(code);
    const payload = /_pe_run\("([A-Za-z0-9+/=]+)"\)/.exec(program);
    expect(payload).not.toBeNull();
    const back = inflateSync(Buffer.from(payload![1], 'base64')).toString(
      'utf8',
    );
    expect(back).toBe(code);
  });

  it('mã nhúng chỉ gồm ký tự base64 nên không thoát được khỏi chuỗi Python', () => {
    // Mã cố tình mang dấu nháy, chéo ngược và xuống dòng — đúng thứ sẽ phá một
    // bản "dán mã nguồn thô vào template".
    const nasty = 'x = "\\" + \'\\n\'\nprint(x)\n#"""';
    const program = buildTraceProgram(nasty);
    const payload = /_pe_run\("([A-Za-z0-9+/=]+)"\)$/m.exec(program);
    expect(payload).not.toBeNull();
    expect(
      inflateSync(Buffer.from(payload![1], 'base64')).toString('utf8'),
    ).toBe(nasty);
  });

  it('chương trình điển hình vẫn còn chỗ: file dựng ra nhỏ hơn trần', () => {
    const program = buildTraceProgram(
      'def fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(10))\n',
    );
    expect(Buffer.byteLength(program, 'utf8')).toBeLessThan(MAX_CODE_BYTES);
  });

  it('mã KHÔNG nén được mà quá dài → TraceCodeTooLargeError kèm con số thật', () => {
    // Một khối base64 dán vào code: zlib không ép nhỏ được (đã đo: deflate ra
    // to hơn đầu vào), nên tổng vượt trần. Trường hợp thật, không phải ca bịa.
    const code = `s = "${incompressible(8000)}"\n`;
    expect(() => buildTraceProgram(code)).toThrow(TraceCodeTooLargeError);
    try {
      buildTraceProgram(code);
    } catch (e) {
      const err = e as TraceCodeTooLargeError;
      expect(err.programBytes).toBeGreaterThan(MAX_CODE_BYTES);
      // Câu nói với người học phải chỉ ra đường đi khác, không chỉ báo lỗi.
      expect(err.message).toContain('Chạy');
    }
  });

  it('mã dài nhưng nén được (lặp lại) vẫn dựng được — không từ chối oan', () => {
    const repeated = 'print("xin chao cac ban")\n'.repeat(600); // ~15 KB
    expect(Buffer.byteLength(repeated, 'utf8')).toBeGreaterThan(14_000);
    expect(() => buildTraceProgram(repeated)).not.toThrow();
  });
});

describe('parseTraceOutput — bóc vết khỏi stdout', () => {
  it('đọc được tài liệu nằm giữa hai mốc', () => {
    const doc = parseTraceOutput(wrap(DOC));
    expect(doc?.stopReason).toBe('done');
    expect(doc?.steps).toHaveLength(1);
  });

  it('bỏ qua rác mã người học ghi thẳng vào fd 1 trước tài liệu', () => {
    const doc = parseTraceOutput(wrap(DOC, 'rac do os.write(1, ...) in ra'));
    expect(doc?.stdout).toBe('3\n');
    expect(strayOutput(wrap(DOC, 'rac'))).toBe('rac');
  });

  it('mã người học in ra MỐC GIẢ để chèn vết của nó → vẫn lấy mốc cuối (của tracer)', () => {
    const fake = {
      ...DOC,
      stdout: 'VET GIA',
      stats: { ...DOC.stats, steps: 9 },
    };
    const stdout =
      `${TRACE_BEGIN}\n${JSON.stringify(fake)}\n${TRACE_END}\n` + wrap(DOC);
    expect(parseTraceOutput(stdout)?.stdout).toBe('3\n');
  });

  it('không có mốc (hết giờ cứng, tiến trình bị giết trước khi in) → null', () => {
    expect(parseTraceOutput('')).toBeNull();
    expect(parseTraceOutput('mot nua dau ra roi bi cat')).toBeNull();
  });

  it('JSON bị cắt giữa dòng (tràn 1 MB) → null, không ném', () => {
    const cut = `${TRACE_BEGIN}\n{"v":1,"steps":[{"i":0`;
    expect(parseTraceOutput(cut + TRACE_END)).toBeNull();
  });

  it('JSON hợp lệ nhưng SAI hình dạng → null (không gắn nhãn "vết" cho rác)', () => {
    expect(parseTraceOutput(wrap({ v: 1 }))).toBeNull();
    expect(parseTraceOutput(wrap({ ...DOC, v: 2 }))).toBeNull();
    expect(parseTraceOutput(wrap({ ...DOC, steps: 'nhieu' }))).toBeNull();
    expect(parseTraceOutput(wrap({ ...DOC, steps: [{ i: 0 }] }))).toBeNull();
  });
});

describe('fallbackTrace — bấm nút rồi nhận ô trống là kết cục tệ nhất', () => {
  it('hết giờ cứng → nói là hết giờ, giữ đầu ra thô', () => {
    const doc: TraceDocument = fallbackTrace(
      { ...RUN, timedOut: true, exitCode: null },
      'da in mot it roi bi giet',
      '',
    );
    expect(doc.stopReason).toBe('time-limit');
    expect(doc.stdout).toBe('da in mot it roi bi giet');
    expect(doc.error?.message).toContain('hết giờ');
    expect(doc.steps).toEqual([]);
  });

  it('docker không chạy → giữ nguyên stderr để frontend nhận ra lỗi hạ tầng', () => {
    const docker = 'docker: Cannot connect to the Docker daemon';
    const doc = fallbackTrace({ ...RUN, exitCode: 125 }, '', docker);
    expect(doc.stopReason).toBe('tracer-error');
    expect(doc.stderr).toBe(docker);
  });
});
