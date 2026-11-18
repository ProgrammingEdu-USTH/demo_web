/* Bọc Web Animations API như prototype: easing chung EASE, nhánh giảm chuyển động (RM) rút còn 1ms. */

export const EASE = "cubic-bezier(.22,1,.36,1)";

export function animate(
  el: Element | null | undefined,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  opts: KeyframeAnimationOptions & { duration: number },
  rm = false,
): Animation | null {
  if (!el) return null;
  return el.animate(keyframes, { easing: EASE, ...opts, ...(rm ? { duration: 1, delay: 0 } : null) });
}
