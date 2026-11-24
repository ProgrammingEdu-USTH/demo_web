/**
 * Chạy một đoạn mã Python trong container Docker dùng một lần.
 *
 * File này là NGUỒN DUY NHẤT của logic chạy docker. Nó cố ý chỉ dùng module
 * dựng sẵn của Node (không Nest, không đường dẫn `src/...`) vì có hai nơi dùng:
 *   - backend Nest (`LocalExecutor`, chế độ PY_RUNNER_MODE=local);
 *   - `runner/` — app Node độc lập đặt trên VM, bundle file này vào.
 * Chép sang hai nơi rồi để lệch nhau là cách sandbox hở ở một bên mà không ai
 * biết, nên cấm chép: sửa ở đây thì cả hai cùng đổi.
 *
 * Cách ly nằm ở các cờ `docker run` (không mạng, FS chỉ đọc, 1 CPU, RAM cấu
 * hình được, 128 tiến trình, bỏ toàn bộ capability, cấm leo quyền, user không
 * phải root trong image) — ở đây chỉ dựng lệnh, đặt giờ chặn và dọn dẹp.
 *
 * Lệnh được dựng bằng `execFile` với MẢNG đối số, không qua shell: nội dung mã
 * của người dùng chỉ nằm trong một file được mount, không bao giờ nằm trên
 * dòng lệnh.
 */
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseMemory } from './host-capacity';

/** Trần kích thước mã nguồn: 20 KB (tính theo BYTE UTF-8). */
export const MAX_CODE_BYTES = 20 * 1024;

/** Trần dung lượng mỗi luồng (stdout, stderr) mà Node giữ lại: 1 MB. */
const MAX_BUFFER = 1024 * 1024;

/** Kết quả của một lần chạy container (chưa tính thời gian xếp hàng). */
export interface SandboxResult {
  stdout: string;
  stderr: string;
  /** null khi tiến trình bị giết (timeout / vượt maxBuffer) nên không có mã thoát. */
  exitCode: number | null;
  timedOut: boolean;
  outputTruncated: boolean;
  /** Thời gian CHẠY (không gồm thời gian chờ trong hàng đợi). */
  durationMs: number;
}

/** Thứ trả về cho client: kết quả chạy + thời gian chờ trong hàng đợi (0 nếu chạy ngay). */
export interface RunResult extends SandboxResult {
  queuedMs: number;
}

export type SandboxErrorKind =
  'CODE_TOO_LARGE' | 'DOCKER_MISSING' | 'BAD_TMPDIR' | 'ABORTED';

/** Lỗi của HẠ TẦNG chạy mã (khác với lỗi trong chương trình của người dùng, vốn nằm trong RunResult). */
export class SandboxError extends Error {
  constructor(
    readonly kind: SandboxErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export interface SandboxOptions {
  /** Tên image sandbox, ví dụ `py-sandbox`. */
  image: string;
  /** Hết giờ thì giết container (ms). */
  timeoutMs: number;
  /** RAM mỗi bài (PY_RUN_MEMORY), ví dụ `1g`, `1.5g`, `1536m`. Mặc định `1g`. */
  memory?: string;
  /**
   * Người gọi bỏ đi (ngắt kết nối): giết container ngay để nhả chỗ chạy, thay vì
   * để nó chạy nốt tới hết giờ cho một người không còn ở đó.
   */
  signal?: AbortSignal;
  /** Nơi ghi cảnh báo không đủ nặng để ném lỗi (docker kill thất bại, không xoá được thư mục tạm). */
  onWarn?: (message: string) => void;
}

type ExecOutcome = Omit<SandboxResult, 'durationMs'>;

/**
 * Phép kiểm byte chính xác; lớp HTTP chỉ chặn sớm theo số ký tự. Tách ra để
 * nơi gọi kiểm TRƯỚC khi xin chỗ chạy đồng thời (mã quá lớn là 400, không phải 429).
 */
export function assertCodeSize(code: string): void {
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    throw new SandboxError('CODE_TOO_LARGE', 'Mã nguồn tối đa 20 KB');
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new SandboxError('ABORTED', 'Yêu cầu đã bị huỷ');
  }
}

export async function runInSandbox(
  code: string,
  options: SandboxOptions,
): Promise<SandboxResult> {
  assertCodeSize(code);
  throwIfAborted(options.signal);

  const started = Date.now();
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(tmpdir(), 'pyrun-'));
    // `--mount` tách tham số bằng dấu phẩy: đường dẫn có dấu phẩy sẽ bị hiểu
    // thành tham số mới. Thư mục do mkdtemp sinh ra nên không xảy ra, trừ khi
    // TMP/TEMP của máy bị đặt lạ — thà từ chối còn hơn mount sai chỗ.
    if (dir.includes(',')) {
      throw new SandboxError(
        'BAD_TMPDIR',
        'Thư mục tạm có dấu phẩy, không thể mount vào sandbox',
      );
    }
    // mkdtemp tạo thư mục 0700 thuộc user của Node; user không phải root
    // trong container (Linux) sẽ không đọc được nếu không mở quyền.
    await chmod(dir, 0o755);
    await writeFile(join(dir, 'main.py'), code, { mode: 0o644 });
    // Có thể đã bị huỷ trong lúc ghi file: đừng tạo container cho người đã đi.
    throwIfAborted(options.signal);

    const name = `pyrun-${randomUUID()}`;
    const outcome = await runContainer(name, dir, options);
    return { ...outcome, durationMs: Date.now() - started };
  } finally {
    if (dir) {
      // Dọn thư mục tạm kể cả khi chạy lỗi; lỗi dọn không được che lỗi gốc.
      await rm(dir, { recursive: true, force: true }).catch((e: unknown) =>
        options.onWarn?.(`Không xoá được ${dir}: ${String(e)}`),
      );
    }
  }
}

/** Docker CLI có nói chuyện được với daemon không (dùng cho GET /health của runner). */
export function isDockerAvailable(timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['info', '--format', '{{.ServerVersion}}'],
      { timeout: timeoutMs, windowsHide: true },
      (error) => resolve(!error),
    );
  });
}

/** Máy thật đang chạy container (kể cả khi là Docker Desktop/WSL2), theo `docker info`. */
export interface DockerHostInfo {
  ncpu: number;
  memTotalBytes: number;
}

/** null nếu docker không trả lời hoặc đầu ra không có NCPU/MemTotal hợp lệ. */
export function readDockerInfo(
  timeoutMs = 5000,
): Promise<DockerHostInfo | null> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['info', '--format', '{{json .}}'],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          const info = JSON.parse(stdout) as {
            NCPU?: unknown;
            MemTotal?: unknown;
          };
          const ncpu = Number(info.NCPU);
          const memTotalBytes = Number(info.MemTotal);
          resolve(
            ncpu > 0 && memTotalBytes > 0 ? { ncpu, memTotalBytes } : null,
          );
        } catch {
          resolve(null);
        }
      },
    );
  });
}

async function runContainer(
  name: string,
  dir: string,
  { image, timeoutMs, memory = '1g', signal, onWarn }: SandboxOptions,
): Promise<ExecOutcome> {
  // Cùng một giá trị cho --memory và --memory-swap: swap = RAM nghĩa là không
  // có swap, container vượt là bị OOM-kill (exit 137) chứ không lê lết trên đĩa.
  const ram = parseMemory(memory).flag;
  const args = [
    'run',
    '--rm',
    '--name',
    name,
    '--cpus=1',
    `--memory=${ram}`,
    `--memory-swap=${ram}`,
    '--pids-limit=128',
    '--network=none',
    '--read-only',
    // Bỏ MỌI capability (kể cả những cái root trong container mặc định có như
    // NET_RAW, MKNOD, SETUID…) và cấm tiến trình tự nâng quyền qua setuid. Mã
    // Python thường không cần cái nào; giữ lại chỉ mở rộng bề mặt tấn công nếu
    // sau này có lỗ thoát container.
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/tmp:size=64m',
    '--mount',
    `type=bind,source=${dir},target=/code,readonly`,
    image,
    'python',
    '/code/main.py',
  ];

  let finished = false;
  // Huỷ giữa chừng: `docker kill` ngay. Container có thể CHƯA được daemon tạo
  // xong (docker CLI vừa spawn) nên lần kill đầu có thể báo 'No such container'
  // — thử lại ngắn cho tới khi container chết hoặc `docker run` kết thúc.
  const onAbort = () => {
    void killWhileRunning(name, () => finished, onWarn);
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const outcome = await new Promise<ExecOutcome>((resolve, reject) => {
    execFile(
      'docker',
      args,
      {
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        // SIGKILL chứ không phải SIGTERM mặc định: docker CLI bắt SIGTERM để
        // chuyển tiếp cho container, có thể không chịu chết đúng giờ.
        killSignal: 'SIGKILL',
        windowsHide: true,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (!error) {
          return resolve({
            stdout,
            stderr,
            exitCode: 0,
            timedOut: false,
            outputTruncated: false,
          });
        }
        const e = error as NodeJS.ErrnoException & {
          killed?: boolean;
          code?: number | string;
        };
        // Không có docker CLI trên máy: lỗi hạ tầng, không phải lỗi của mã.
        if (e.code === 'ENOENT') {
          return reject(
            new SandboxError('DOCKER_MISSING', 'Máy chủ chưa cài Docker'),
          );
        }
        const outputTruncated = e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        // Node đã giết tiến trình docker CLI: do hết giờ hoặc do tràn buffer.
        const killed = e.killed === true;
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: typeof e.code === 'number' ? e.code : null,
          timedOut: killed && !outputTruncated,
          outputTruncated,
        });
      },
    );
  }).finally(() => {
    finished = true;
    signal?.removeEventListener('abort', onAbort);
  });

  // Node chỉ giết tiến trình docker CLI; CONTAINER vẫn chạy tiếp (còn ăn CPU
  // tới khi tự thoát) nên phải bảo daemon giết nó. `--rm` sẽ xoá nó sau đó.
  if (outcome.timedOut || outcome.outputTruncated) {
    const killed = await killContainer(name);
    if (!killed.ok) {
      // Container đã tự thoát/chưa kịp tạo thì báo "No such container" —
      // chấp nhận được, chỉ ghi log.
      onWarn?.(`docker kill ${name} lỗi: ${killed.message}`);
    }
  }
  return outcome;
}

/** `docker kill` một container. Không ném lỗi: nơi gọi tự quyết có đáng báo hay không. */
function killContainer(
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['kill', name],
      { timeout: 5000, windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            message: String(stderr || error.message).trim(),
          });
        } else {
          resolve({ ok: true });
        }
      },
    );
  });
}

const KILL_RETRY_MS = 150;
const KILL_MAX_ATTEMPTS = 20;

/** Giết container cho tới khi được, hoặc tới khi `docker run` đã kết thúc (container đã hết). */
async function killWhileRunning(
  name: string,
  isFinished: () => boolean,
  onWarn?: (message: string) => void,
): Promise<void> {
  let last = '';
  for (let attempt = 0; attempt < KILL_MAX_ATTEMPTS; attempt++) {
    if (isFinished()) return;
    const killed = await killContainer(name);
    if (killed.ok) return;
    last = killed.message;
    await new Promise((r) => setTimeout(r, KILL_RETRY_MS));
  }
  if (!isFinished()) {
    onWarn?.(
      `docker kill ${name} (huỷ do client ngắt) không thành công: ${last}`,
    );
  }
}
