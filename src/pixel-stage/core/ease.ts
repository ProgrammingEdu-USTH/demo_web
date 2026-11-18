// Easing tối giản theo token: ease.move = sine in-out, ease.pop = back-out nhẹ (vượt ≤ 1px logic).
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const sineInOut = (t: number): number => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

const backOut = (t: number, s = 1.4): number => {
  const u = clamp01(t) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/** Tỉ lệ phóng khi xuất hiện, phần vượt quá chỉ được ≤ 1px với vật cỡ `sizePx`. */
export const popScale = (t: number, sizePx: number): number => Math.min(backOut(t), 1 + 1 / sizePx);

export const moveEase = sineInOut;
