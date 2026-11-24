import { BadRequestException } from '@nestjs/common';
import { PYTHON_EXECUTOR, type PythonExecutor } from './python-executor';
import { PythonRunnerService } from './python-runner.service';
import type { RunResult } from './sandbox/docker-sandbox';
import { Test } from '@nestjs/testing';
import { TRACE_BEGIN, TRACE_END } from './tracer/trace-program';

/**
 * `trace()` phải đi qua ĐÚNG executor của nút Chạy.
 *
 * Vì sao test điều đó: nếu "xem từng bước" tự mở một đường chạy mã riêng thì nó
 * nằm ngoài hàng đợi, ngoài trần RAM và ngoài các cờ cách ly của
 * docker-sandbox.ts — tức là một endpoint chạy mã tuỳ ý không ai canh. Ca đầu
 * tiên ở đây chốt chặn chuyện đó bằng cách bắt executor giả kể lại nó được gọi
 * gì, và chốt rằng mã người học KHÔNG đi nguyên văn xuống sandbox (nó được nén
 * và nhúng, nên không thể trộn vào mã của tracer).
 *
 * Bằng chứng test bắt được lỗi thật (gỡ bản sửa ra, test phải trượt):
 *  - Cho trace() gọi runInSandbox trực tiếp thay vì executor → 2 ca trượt.
 *  - Bỏ nhánh fallbackTrace (trả về trace null khi không bóc được) → 2 ca trượt.
 *  - Bỏ chuyển TraceCodeTooLargeError thành 400 → 1 ca trượt (thành 500).
 */

const OK: RunResult = {
  stdout: '',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  outputTruncated: false,
  durationMs: 321,
  queuedMs: 12,
};

/** Tài liệu vết tối thiểu, hình dạng chép từ đầu ra thật của pe_tracer.py. */
const DOC = {
  v: 1,
  steps: [
    {
      i: 0,
      event: 'line',
      line: 1,
      out: 0,
      err: 0,
      frames: [
        { name: '<module>', line: 1, locals: [['x', { t: 'prim', r: '1' }]] },
      ],
    },
  ],
  stdout: '1\n',
  stderr: '',
  stdoutTruncated: false,
  stderrTruncated: false,
  stopReason: 'done',
  error: null,
  stats: { steps: 1, events: 1, elapsedMs: 1, valuesTruncated: 0 },
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

async function makeService(executor: PythonExecutor) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PythonRunnerService,
      { provide: PYTHON_EXECUTOR, useValue: executor },
    ],
  }).compile();
  return moduleRef.get(PythonRunnerService);
}

describe('PythonRunnerService.trace', () => {
  it('đi qua executor dùng chung (cùng hàng đợi/cách ly), không mở đường riêng', async () => {
    const run = jest.fn().mockResolvedValue({
      ...OK,
      stdout: `${TRACE_BEGIN}\n${JSON.stringify(DOC)}\n${TRACE_END}\n`,
    });
    const service = await makeService({ run });
    const res = await service.trace('x = 1\n');

    expect(run).toHaveBeenCalledTimes(1);
    const program = (run.mock.calls[0] as [string])[0];
    // Thứ gửi xuống sandbox là tracer + mã NÉN, không phải mã người học thô.
    expect(program).toContain('def _pe_run(');
    expect(program).not.toContain('x = 1');
    expect(res.trace.stopReason).toBe('done');
    // Thời gian chạy/chờ của lượt thật được trả về để UI nói thật về giá.
    expect(res.run).toEqual({
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
      durationMs: 321,
      queuedMs: 12,
    });
  });

  it('chuyển tiếp AbortSignal để client ngắt kết nối thì container bị giết', async () => {
    const run = jest.fn().mockResolvedValue(OK);
    const service = await makeService({ run });
    const ac = new AbortController();
    await service.trace('x = 1\n', ac.signal);
    expect((run.mock.calls[0] as [string, AbortSignal])[1]).toBe(ac.signal);
  });

  it('hết giờ cứng, không có vết nào trong stdout → tài liệu thay thế nói rõ', async () => {
    const run = jest.fn().mockResolvedValue({
      ...OK,
      stdout: 'in duoc mot it',
      exitCode: null,
      timedOut: true,
    });
    const service = await makeService({ run });
    const res = await service.trace('while True: pass\n');
    expect(res.trace.stopReason).toBe('time-limit');
    expect(res.trace.steps).toEqual([]);
    expect(res.trace.stdout).toBe('in duoc mot it');
    expect(res.run.timedOut).toBe(true);
  });

  it('docker chết → giữ stderr nguyên văn để frontend nhận ra lỗi hạ tầng', async () => {
    const stderr =
      'docker: Cannot connect to the Docker daemon at unix:///var/run/docker.sock';
    const run = jest.fn().mockResolvedValue({ ...OK, exitCode: 125, stderr });
    const service = await makeService({ run });
    const res = await service.trace('print(1)\n');
    expect(res.trace.stderr).toBe(stderr);
    expect(res.run.exitCode).toBe(125);
  });

  it('mã không nén được mà quá dài → 400 kèm lời khuyên, không 500', async () => {
    const run = jest.fn();
    const service = await makeService({ run });
    // Khối base64 không nén được (LCG, tất định) nên tổng vượt 20 KB.
    let seed = 123456789;
    const bytes = Buffer.alloc(8000);
    for (let i = 0; i < bytes.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      bytes[i] = (seed >>> 16) & 255;
    }
    const noise = bytes.toString('base64');
    await expect(service.trace(`s = "${noise}"\n`)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Không được tốn một lượt chạy container cho yêu cầu đã biết là quá lớn.
    expect(run).not.toHaveBeenCalled();
  });
});
