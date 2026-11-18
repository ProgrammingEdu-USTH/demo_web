// Random có seed: cùng seed → cùng dãy số → chạy lại giống hệt.
export type Rng = () => number;

/** Băm FNV-1a 32 bit của các phần (chuỗi / số) thành seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("\u0001");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: nhanh, đủ tốt cho hiệu ứng. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rngFor = (...parts: (string | number)[]): Rng => mulberry32(hashSeed(...parts));

/** Pha lệch ổn định trong [0, 1) cho một khoá. */
export const phaseOf = (...parts: (string | number)[]): number => hashSeed(...parts) / 4294967296;

/** Băm nội dung ảnh (để so sánh pixel buffer trong test). */
export function hashBytes(data: Uint8ClampedArray): string {
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
