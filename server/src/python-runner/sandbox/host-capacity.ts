/**
 * RAM mỗi bài và phép kiểm "máy này có chịu nổi cấu hình không". Chỉ dùng Node
 * thuần để cả backend (Joi), sandbox và runner cùng dùng.
 */

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

/** RAM chừa cho hệ điều hành + Docker daemon + runner; phần còn lại mới chia cho các bài. */
export const HOST_RESERVE_BYTES = 1.5 * GIB;
/** Python + numpy/pandas cần chừng này mới khởi động nổi; thấp hơn là cấu hình nhầm. */
export const MIN_MEMORY_MIB = 128;
/** Cho chạy nhiều hơn số nhân × hệ số này là các bài tranh nhau CPU → chỉ cảnh báo. */
export const CPU_OVERSUBSCRIBE_FACTOR = 1.5;

export interface ParsedMemory {
  mib: number;
  /** Giá trị đưa cho `--memory` / `--memory-swap` của docker. */
  flag: string;
}

/** `1536` MiB → "1536m", `1024` MiB → "1g" (giữ nguyên dạng cũ khi là bội của 1 GiB). */
export function formatMemoryFlag(mib: number): string {
  return mib % 1024 === 0 ? `${mib / 1024}g` : `${mib}m`;
}

/**
 * Nhận "1g", "1.5g", "1536m", "512mb"… (bắt buộc có đơn vị m/g: docker hiểu số
 * trần là BYTE, dễ cấu hình nhầm 1g thành 1 byte). Làm tròn về MiB nguyên.
 */
export function parseMemory(raw: string): ParsedMemory {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(m|mb|g|gb)\s*$/i.exec(raw);
  if (!match) {
    throw new Error(
      `PY_RUN_MEMORY="${raw}" không hợp lệ: cần số kèm đơn vị m hoặc g (ví dụ 1g, 1.5g, 1536m)`,
    );
  }
  const unit = match[2].toLowerCase()[0];
  const mib = Math.round(Number(match[1]) * (unit === 'g' ? 1024 : 1));
  if (mib < MIN_MEMORY_MIB) {
    throw new Error(
      `PY_RUN_MEMORY="${raw}" quá nhỏ: tối thiểu ${MIN_MEMORY_MIB}m để Python khởi động được`,
    );
  }
  return { mib, flag: formatMemoryFlag(mib) };
}

export interface CapacityInput {
  /** PY_RUN_MAX_CONCURRENT */
  slots: number;
  /** PY_RUN_MEMORY đã đổi sang MiB */
  memoryMiB: number;
  /** NCPU từ `docker info` */
  ncpu: number;
  /** MemTotal (byte) từ `docker info` */
  memTotalBytes: number;
}

export interface CapacityReport {
  /** `insufficient` = RAM không đủ, KHÔNG được chạy. Cảnh báo CPU không đổi trạng thái. */
  status: 'ok' | 'insufficient';
  errors: string[];
  warnings: string[];
}

const gib = (bytes: number) => (bytes / GIB).toFixed(1);

export function checkHostCapacity(input: CapacityInput): CapacityReport {
  const { slots, memoryMiB, ncpu, memTotalBytes } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  const perRun = memoryMiB * MIB;
  const needBytes = slots * perRun + HOST_RESERVE_BYTES;
  if (needBytes > memTotalBytes) {
    const free = memTotalBytes - HOST_RESERVE_BYTES;
    const maxSlots = Math.floor(free / perRun);
    const maxMemory = Math.floor(free / slots / MIB);
    const hints: string[] = [];
    if (maxSlots >= 1) {
      hints.push(
        `giảm PY_RUN_MAX_CONCURRENT xuống tối đa ${maxSlots} (giữ PY_RUN_MEMORY=${formatMemoryFlag(memoryMiB)})`,
      );
    }
    if (maxMemory >= MIN_MEMORY_MIB) {
      hints.push(
        `giảm PY_RUN_MEMORY xuống tối đa ${formatMemoryFlag(maxMemory)} (giữ PY_RUN_MAX_CONCURRENT=${slots})`,
      );
    }
    hints.push('hoặc cấp thêm RAM cho VM / WSL2 / Docker Desktop');
    errors.push(
      `Không đủ RAM: PY_RUN_MAX_CONCURRENT=${slots} × PY_RUN_MEMORY=${formatMemoryFlag(memoryMiB)} = ${gib(slots * perRun)} GiB, ` +
        `cộng ${gib(HOST_RESERVE_BYTES)} GiB chừa cho hệ điều hành và Docker = ${gib(needBytes)} GiB, ` +
        `nhưng máy chạy container chỉ có ${gib(memTotalBytes)} GiB (MemTotal của docker info). ` +
        `Gợi ý: ${hints.join('; ')}.`,
    );
  }

  const cpuLimit = ncpu * CPU_OVERSUBSCRIBE_FACTOR;
  if (slots > cpuLimit) {
    warnings.push(
      `PY_RUN_MAX_CONCURRENT=${slots} lớn hơn ${CPU_OVERSUBSCRIBE_FACTOR} × số nhân (${ncpu} nhân → ${cpuLimit}): ` +
        'mỗi bài được 1 CPU nên các bài sẽ tranh nhau CPU, chạy chậm đi và có thể hết giờ oan.',
    );
  }

  return { status: errors.length ? 'insufficient' : 'ok', errors, warnings };
}
