const VI = new Intl.NumberFormat("vi-VN");

/** Số theo kiểu Việt Nam: 18450 → "18.450" (fmt trong prototype). */
export const fmt = (n: number) => VI.format(n);

/** Thời gian còn lại "5 ngày 14 giờ" (cd() trong prototype). */
export function remaining(ms: number) {
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return `${d} ngày ${h} giờ`;
}

/** Giờ thập phân → "18:00". */
export function clockText(hh: number) {
  const H = Math.floor(hh);
  const M = Math.round((hh - H) * 60) % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
}
