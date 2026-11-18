/* #demo: bảng tuỳ chỉnh khung cảnh (giờ trong ngày, cửa sổ, mưa, giảm chuyển động, ghi chú mẫu, màn mở đầu). */
"use client";
import { useSyncExternalStore, type CSSProperties, type Ref } from "react";
import { SERVER_TOD, type TodStore } from "../ambient/useTimeOfDay";
import { clockText } from "./format";
import { Icon } from "./Icons";

const PRESETS = [
  [7, "Sáng"],
  [12.5, "Trưa"],
  [18, "Hoàng hôn"],
  [22, "Đêm"],
] as const;

export interface DemoState {
  tod: TodStore;
  realTime: boolean;
  windowOpen: boolean;
  rain: boolean;
  rm: boolean;
}

interface Props extends DemoState {
  open: boolean;
  style: CSSProperties;
  panelRef: Ref<HTMLDivElement>;
  /** Kéo thanh trượt: đổi giờ ngay */
  onTodInput: (h: number) => void;
  /** Bấm preset: chuyển dần 1,6 giây */
  onPreset: (h: number) => void;
  onToggleReal: () => void;
  onToggleWindow: () => void;
  onToggleRain: () => void;
  onToggleRm: () => void;
  onAddNote: () => void;
  onReplayIntro: () => void;
}

function Toggle({ id, pressed, onClick, children }: { id: string; pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button className="tg" id={id} aria-pressed={pressed} onClick={onClick}>
      {children}
      <span className="sw" />
    </button>
  );
}

export function DemoPanel({ panelRef, ...p }: Props) {
  // đồng hồ chạy theo từng khung hình khi chuyển dần; chỉ bảng này render lại
  const hh = useSyncExternalStore(p.tod.subscribe, p.tod.get, () => SERVER_TOD);
  return (
    <div id="demo" className="glass" hidden={!p.open} style={p.style} ref={panelRef}>
      <h4>Giờ trong ngày</h4>
      <div className="clock">
        <b id="clockT">{clockText(hh)}</b>
        <small id="clockS">{p.realTime ? "theo giờ thật" : "đang chỉnh tay"}</small>
      </div>
      <input
        type="range"
        id="tod"
        min="0"
        max="24"
        step="0.25"
        value={hh}
        aria-label="Giờ trong ngày"
        onChange={(e) => p.onTodInput(+e.target.value)}
      />
      <div className="chips2">
        {PRESETS.map(([h, label]) => (
          <button key={h} data-h={h} onClick={() => p.onPreset(h)}>
            {label}
          </button>
        ))}
      </div>
      <Toggle id="tReal" pressed={p.realTime} onClick={p.onToggleReal}>
        Theo giờ thật
      </Toggle>
      <h4>Khung cảnh</h4>
      <Toggle id="tWin" pressed={p.windowOpen} onClick={p.onToggleWindow}>
        Mở cửa sổ
      </Toggle>
      <Toggle id="tRain" pressed={p.rain} onClick={p.onToggleRain}>
        Mưa ngoài cửa sổ
      </Toggle>
      <Toggle id="tRm" pressed={p.rm} onClick={p.onToggleRm}>
        Giảm chuyển động
      </Toggle>
      <button className="tg" id="tNote" onClick={p.onAddNote}>
        Thêm ghi chú mẫu
        <Icon name="plus" />
      </button>
      <button className="tg" id="tIntro" onClick={p.onReplayIntro}>
        Xem lại màn mở đầu
        <Icon name="play" />
      </button>
      <p>
        Bản thử nghiệm. Bầu trời đổi theo giờ, còn căn phòng chỉ đổi màu ánh sáng trên ảnh hoàng hôn; bản thật sẽ có ảnh riêng cho
        từng buổi. Bảng xếp hạng và ghi chú dùng dữ liệu mẫu.
      </p>
    </div>
  );
}
