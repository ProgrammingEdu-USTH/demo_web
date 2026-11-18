/* Nhãn đồ vật (.tag) đặt bằng w2s() ở giữa cạnh trên bounding box của nhóm (placeUI). */
import { memo } from "react";
import { GROUPS, groupBox, WINDOW_LABEL } from "../config/objects";
import { useLitGroups } from "../hover";
import { w2s, type Cam, type RoomLayout } from "../scene/layout";

const STATE_TEXT = { done: "✓ đã học", cur: "đang học", lock: "chưa mở" } as const;
const BOX = new Map(GROUPS.map((G) => [G.g, groupBox(G)]));
/** Nhãn hạng cạnh điện thoại, sáng lên cùng phoneGlow. */
const RANK_AT = [1765, 1290] as const;

interface Props {
  layout: RoomLayout | null;
  cam: Cam;
  /** Đang chuyển cảnh / ở trang con / xem lịch: không hiện nhãn nào */
  frozen: boolean;
  windowOpen: boolean;
  rankText: string;
  rankOn?: boolean;
}

const NONE: ReadonlySet<string> = new Set();

/* memo + đọc nhóm đang sáng từ HoverStore: chỉ render lại khi hover đổi nhóm, không theo mỗi lần app render */
export const Tags = memo(function Tags({ layout, cam, frozen, windowOpen, rankText, rankOn }: Props) {
  const lit = useLitGroups();
  const on = frozen ? NONE : lit;
  const at = (x: number, y: number) => {
    if (!layout) return undefined;
    const [left, top] = w2s(layout, x, y, cam);
    return { left, top };
  };
  return (
    <div id="tags">
      {GROUPS.map((G) => {
        const b = BOX.get(G.g)!;
        const label = G.g === "window" ? (windowOpen ? WINDOW_LABEL.open : WINDOW_LABEL.closed) : G.label;
        return (
          <div key={G.g} className={`tag${on.has(G.g) ? " on" : ""}`} style={at((b[0] + b[2]) / 2, b[1])}>
            {label}
            {G.state && <i>{STATE_TEXT[G.state]}</i>}
          </div>
        );
      })}
      <div className={`tag${rankOn ? " on" : ""}`} style={at(RANK_AT[0], RANK_AT[1])}>
        {rankText}
      </div>
    </div>
  );
});
