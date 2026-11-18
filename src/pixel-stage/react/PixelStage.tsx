"use client";

// Wrapper React mỏng cho engine: tạo stage khi mount, huỷ khi unmount, nạp lại khi đổi script.
// Engine vẫn thuần TypeScript; component này chỉ nối props / sự kiện.
import { useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import { createPixelStage } from "../core/stage";
import type { PixelStage as Stage } from "../core/stage";
import { pixelate } from "../core/transition";
import type { StepEvent } from "../timeline/player";
import type { WorldId } from "../timeline/types";
import type { Speed } from "../tokens/motion";
import { transition } from "../tokens/motion";

export type PixelStageProps = {
  /** Step Script (JSON). Đổi script thì stage nạp lại từ bước đầu. */
  script: unknown;
  seed?: number;
  /** Bước muốn hiển thị (0-based). Bỏ trống để stage tự quản lý. */
  step?: number;
  speed?: Speed;
  overlay?: boolean;
  reducedMotion?: boolean | "auto";
  /** Âm thanh tổng hợp; bật từ cử chỉ người dùng để trình duyệt cho phát. */
  sound?: boolean;
  /** "pixelate": lần nạp đầu, cảnh hiện ra từ khối mosaic thô. */
  intro?: "pixelate" | "none";
  /** Phần thừa quanh khung 320×180: "ink" viền tối, "extend" kéo dài mép cảnh (dùng khi phủ toàn màn hình). Chỉ đọc lúc tạo. */
  fill?: "ink" | "extend";
  onStep?: (e: StepEvent) => void;
  onPlay?: (playing: boolean) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  /** Gọi khi stage đã sẵn sàng (đã nạp xong script lần đầu). */
  onReady?: (stage: Stage) => void;
  /** Nhận API của stage (next, prev, goTo, play, pause…). */
  ref?: Ref<Stage | null>;
  className?: string;
  style?: CSSProperties;
  /** aria-label ban đầu; sau khi nạp, engine đặt lại theo thế giới. */
  ariaLabel?: string;
};

function setRef<T>(ref: Ref<T | null> | undefined, v: T | null) {
  if (typeof ref === "function") ref(v);
  else if (ref) (ref as { current: T | null }).current = v;
}

const worldOf = (script: unknown): WorldId => ((script as { world?: WorldId })?.world ?? "blank");

export function PixelStage(props: PixelStageProps) {
  const { script, seed = 1, step, speed = 1, overlay = true, reducedMotion = "auto", sound = false, intro = "none", fill = "ink", ref, className, style, ariaLabel } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  // tạo / huỷ stage
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const st = createPixelStage(cv, { world: worldOf(script), seed, overlay, reducedMotion, fill });
    stageRef.current = st;
    const offs = [
      st.on("step", (e) => cb.current.onStep?.(e)),
      st.on("play", (e) => cb.current.onPlay?.(e.playing)),
      st.on("end", () => cb.current.onEnd?.()),
    ];
    setRef(ref, st);
    return () => {
      offs.forEach((off) => off());
      st.destroy();
      stageRef.current = null;
      setRef(ref, null);
    };
    // stage chỉ tạo một lần cho mỗi canvas; các prop khác đồng bộ ở effect riêng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // nạp script; intro pixelate chỉ chạy một lần, đánh dấu khi hiệu ứng thật sự bắt đầu
  // (StrictMode chạy effect hai lần ở dev: lần đầu bị huỷ trước khi nạp xong nên không được tính)
  const introDone = useRef(false);
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const withIntro = intro === "pixelate" && !introDone.current;
    let alive = true;
    if (withIntro) st.setMosaic(transition.mosaic[0]);
    st.load(script).then(
      () => {
        if (!alive) return;
        cb.current.onReady?.(st);
        if (withIntro) {
          introDone.current = true;
          void pixelate(st, "in", st.state.reduced);
        }
      },
      (e: unknown) => cb.current.onError?.(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [script, intro, seed]);

  useEffect(() => {
    const st = stageRef.current;
    if (st && step !== undefined && st.state.count > 0 && st.state.index !== step) st.goTo(step);
  }, [step]);
  useEffect(() => stageRef.current?.setSpeed(speed), [speed]);
  useEffect(() => stageRef.current?.setOverlay(overlay), [overlay]);
  useEffect(() => stageRef.current?.setReducedMotion(reducedMotion), [reducedMotion]);
  useEffect(() => stageRef.current?.setSound(sound), [sound]);

  return <canvas ref={canvasRef} className={className} style={style} role="img" aria-label={ariaLabel ?? "Cảnh pixel minh hoạ code đang chạy"} />;
}
