// Bảng màu duy nhất của engine. Mọi màu ở nơi khác phải tham chiếu tới đây (kiểm tra: npm run check:pixel-tokens).
export const base = {
  ink: "#1b1626", ink2: "#2e2540", shade: "#4a3b66", mid: "#6e5a92", lav: "#a08bd0", pale: "#d9cdf2", paper: "#fff6e8",
  skin1: "#ffd8b8", skin2: "#f2b38f", skin3: "#c97f63",
  wood1: "#d49a5c", wood2: "#a8673f", wood3: "#7a4a32",
  amber1: "#ffcf6b", amber2: "#ffa94d",
  gray1: "#c4bfd0", gray2: "#8a8499",
  ok: "#57cc99", err: "#ff4d6d", uiBg: "#231c33",
} as const;

export const accents = {
  kitchen: { a1: "#ff7a45", a2: "#e8453c", a3: "#ffd166", a4: "#8fd694" },
  city: { a1: "#ffd23f", a2: "#3a86ff", a3: "#1c2a4a", a4: "#ff5d8f" },
  memory: { a1: "#2ec4b6", a2: "#8ecae6", a3: "#b5835a", a4: "#f4a259" },
  dungeon: { a1: "#7b2cbf", a2: "#57cc99", a3: "#c77dff", a4: "#ff4d6d" },
  dj: { a1: "#ff3cac", a2: "#2de2e6", a3: "#f9f871", a4: "#261447" },
  // thế giới trống để thử engine: mượn màu gốc
  blank: { a1: base.amber2, a2: base.err, a3: base.amber1, a4: base.ok },
} as const;

export type BaseKey = keyof typeof base;
export type AccentKey = "a1" | "a2" | "a3" | "a4";
export type AccentSet = Record<AccentKey, string>;
/** Màu tham chiếu trong script: tên màu gốc ("amber1") hoặc màu nhấn của thế giới ("a1"). */
export type ColorRef = BaseKey | AccentKey;

export function resolveColor(ref: ColorRef, acc: AccentSet): string {
  return ref in acc ? acc[ref as AccentKey] : base[ref as BaseKey];
}

export function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
