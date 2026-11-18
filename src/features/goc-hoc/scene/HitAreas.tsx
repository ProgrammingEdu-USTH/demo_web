/* Vùng bấm: mỗi nhóm đồ vật là một <g role="button">, polygon vẽ theo viền ảnh cắt. Cửa sổ đứng đầu DOM để sách và đồ vật nằm trên nó khi hit-test. */
import { memo } from "react";
import { ROOM_H, ROOM_W, type ItemKey } from "../config/scene";
import { GROUPS, groupAriaLabel, groupPolys, WINDOW_LABEL, type ObjectGroup } from "../config/objects";

const ORDERED: readonly ObjectGroup[] = [...GROUPS.filter((G) => G.g === "window"), ...GROUPS.filter((G) => G.g !== "window")];

export interface HitHandlers {
  onEnter: (g: string) => void;
  onLeave: (g: string) => void;
  /** focus bằng bàn phím (:focus-visible) */
  onFocusVisible: (g: string) => void;
  onBlur: (g: string) => void;
  /** Bấm hoặc Enter/Space; key: polygon được bấm */
  onActivate: (g: string, key: ItemKey | null) => void;
}

interface Props extends HitHandlers {
  windowOpen: boolean;
  /** false khi đang ở trang con / chuyển cảnh: vùng bấm ra khỏi thứ tự Tab */
  tabbable: boolean;
}

export const HitAreas = memo(function HitAreas({ windowOpen, tabbable, onEnter, onLeave, onFocusVisible, onBlur, onActivate }: Props) {
  return (
    <svg id="hotHit" viewBox={`0 0 ${ROOM_W} ${ROOM_H}`}>
      {ORDERED.map((G) => (
        <g
          key={G.g}
          className="o"
          tabIndex={tabbable ? 0 : -1}
          role="button"
          aria-label={G.g === "window" ? (windowOpen ? WINDOW_LABEL.open : WINDOW_LABEL.closed) : groupAriaLabel(G)}
          data-g={G.g}
          onPointerEnter={() => onEnter(G.g)}
          onPointerLeave={() => onLeave(G.g)}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && onFocusVisible(G.g)}
          onBlur={() => onBlur(G.g)}
          onClick={(e) => onActivate(G.g, ((e.target as SVGElement).dataset?.k as ItemKey | undefined) ?? null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onActivate(G.g, null);
            }
          }}
        >
          {groupPolys(G).map(([k, p], i) => (
            <polygon key={i} points={p.map((q) => q.join(",")).join(" ")} data-k={k ?? undefined} />
          ))}
        </g>
      ))}
    </svg>
  );
});
