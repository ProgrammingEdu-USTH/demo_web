"use client";

/* Màn "Chạy từng dòng" của bài học: hộp thoại phủ toàn màn hình chứa <StepPlayer /> (Pixel Stage).
   Vào: cảnh pixel hiện ra từ khối mosaic thô (pixelate). Ra (nút đóng / Esc): cảnh vỡ lại thành khối rồi mờ đi.
   Chuyển bài (nav): cảnh vỡ thành khối, nạp bài mới, rồi mịn dần lại.
   Phần dưới (#app) được đặt inert trong lúc mở để bàn phím và trình đọc màn hình chỉ ở trong hộp thoại. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SCRIPTS, pixelate } from "@/pixel-stage";
import type { PixelStage } from "@/pixel-stage";
import { exposeStage, StepPlayer } from "@/pixel-stage/react";
import type { StepNav } from "@/pixel-stage/react";
import { transition } from "@/pixel-stage/tokens/motion";
import { animate } from "../anim";
import s from "./StepRunner.module.css";

interface Props {
  scriptId: string;
  title: string;
  /** giảm chuyển động của Góc học (hệ thống hoặc công tắc trong phòng) */
  rm: boolean;
  /** gọi sau khi hiệu ứng thoát chạy xong */
  onClosed: () => void;
  closeLabel?: string;
  /** chuyển sang bài khác trong khóa; StepRunner tự chạy hiệu ứng pixelate ra / vào quanh lần chuyển */
  nav?: StepNav;
}

export function StepRunner({ scriptId, title, rm, onClosed, closeLabel = "Quay lại bài học", nav }: Props) {
  const entry = SCRIPTS.find((x) => x.id === scriptId);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<PixelStage | null>(null);
  const [closing, setClosing] = useState(false);
  const switching = useRef(false);
  const offStep = useRef<(() => void) | null>(null);

  useEffect(() => {
    const app = document.getElementById("app");
    app?.setAttribute("inert", "");
    box.current?.focus({ preventScroll: true });
    animate(box.current, [{ opacity: 0 }, { opacity: 1 }], { duration: transition.zoom, fill: "backwards" }, rm);
    return () => {
      app?.removeAttribute("inert");
      offStep.current?.();
    };
    // chỉ chạy khi mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = async () => {
    if (closing) return;
    setClosing(true);
    stage.current?.pause();
    if (stage.current) await pixelate(stage.current, "out", rm);
    await animate(box.current, [{ opacity: 1 }, { opacity: 0 }], { duration: transition.zoom, fill: "forwards" }, rm)?.finished;
    onClosed();
  };

  // bài mới nạp xong (stage phát bước 0) thì cảnh mịn dần lại
  const onStage = (st: PixelStage | null) => {
    offStep.current?.();
    offStep.current = null;
    stage.current = st;
    exposeStage(st);
    if (!st) return;
    offStep.current = st.on("step", (e) => {
      if (e.index !== 0 || !switching.current) return;
      switching.current = false;
      void pixelate(st, "in", rm);
    });
  };
  const switchTo = async (go: () => void) => {
    const st = stage.current;
    if (!st || switching.current || closing) return;
    switching.current = true;
    st.pause();
    await pixelate(st, "out", rm);
    go();
  };
  const { prev, next } = nav ?? {};
  const wrapped: StepNav | undefined = nav && {
    ...nav,
    prev: prev && (() => void switchTo(prev)),
    next: next && (() => void switchTo(next)),
  };

  if (!entry) return null;
  return createPortal(
    <div ref={box} className={s.runner} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-testid="step-runner">
      <StepPlayer
        script={entry.raw}
        title={title}
        intro="pixelate"
        reducedMotion={rm}
        onClose={close}
        closeLabel={closeLabel}
        nav={wrapped}
        onStage={onStage}
      />
    </div>,
    document.body,
  );
}
