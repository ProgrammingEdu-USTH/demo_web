// Token giao diện quanh canvas (màn "chạy từng dòng" toàn cảnh): màu lấy từ palette, thời lượng từ motion.
import { base } from "./palette";
import { dur } from "./motion";

export const ui = {
  /** Dòng code phía trên "gõ" ra từng ký tự: ms mỗi ký tự, tối đa cả dòng. */
  typePerChar: 16,
  typeMax: 560,
  /** Đang chạy mà chuột / bàn phím đứng yên bao lâu thì ẩn thanh điều khiển (caption và dòng code vẫn hiện). */
  idleHide: 2600,
} as const;

/** Biến CSS cho StepPlayer: màu giao diện, màu tô cú pháp Python, thời lượng. */
export const playerVars: Record<string, string> = {
  "--ps-bg": base.ink,
  "--ps-panel": base.uiBg,
  "--ps-panel2": base.ink2,
  "--ps-line": base.shade,
  "--ps-mid": base.mid,
  "--ps-text": base.paper,
  "--ps-muted": base.gray1,
  "--ps-accent": base.amber1,
  "--ps-accent2": base.amber2,
  "--ps-ok": base.ok,
  "--ps-err": base.err,
  // tô cú pháp
  "--ps-kw": base.lav,
  "--ps-str": base.ok,
  "--ps-num": base.amber2,
  "--ps-com": base.gray2,
  "--ps-fn": base.amber1,
  "--ps-bi": base.skin2,
  // thời lượng
  "--ps-dur-xs": `${dur.xs}ms`,
  "--ps-dur-sm": `${dur.sm}ms`,
  "--ps-dur-md": `${dur.md}ms`,
  "--ps-dur-lg": `${dur.lg}ms`,
};
