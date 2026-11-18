/* Lớp đồ vật cắt rời (.item) và viền sáng (.glowi), mỗi cái là div absolute theo ITEMS. */
import { memo, type CSSProperties, type ReactNode } from "react";
import { asset, ITEMS, type ItemKey } from "../config/scene";
import { hoverKind, originOf } from "../config/objects";
import { useLit } from "../hover";

export const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];

function boxStyle(k: ItemKey): CSSProperties {
  const [x, y, w, h] = ITEMS[k];
  return { left: x, top: y, width: w, height: h, transformOrigin: originOf(k) };
}

/* memo: engine đổi state nhiều lần mỗi lần chuyển cảnh; đồ vật nào không đổi thì không render lại.
   Trạng thái sáng (hover) đọc thẳng từ HoverStore nên rê chuột chỉ render lại đúng đồ vật đổi trạng thái. */
export const Item = memo(function Item({ k, extra, children }: { k: ItemKey; extra?: string; children?: ReactNode }) {
  const on = useLit(k);
  const kind = hoverKind(k);
  const src = asset(`items/${k}.webp`);
  return (
    <div className={`item k-${kind}${on ? " on" : ""}${extra ? " " + extra : ""}`} data-k={k} style={boxStyle(k)}>
      <img src={src} alt="" decoding="async" />
      {kind === "trophy" && <div className="shine" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />}
      {children}
    </div>
  );
});

export const Glow = memo(function Glow({ k }: { k: ItemKey }) {
  const on = useLit(k);
  return (
    <div className={`glowi k-${hoverKind(k)}${on ? " on" : ""}`} data-k={k} style={boxStyle(k)}>
      <img src={asset(`items/${k}-g.webp`)} alt="" decoding="async" />
    </div>
  );
});

/** 3 lớp tint (multiply, dim, screen) cắt theo hình laptop, để laptop đổi màu theo giờ như phần phòng phía sau. */
export function LaptopTints() {
  const mask = `url(${asset("items/laptop.webp")})`;
  const style: CSSProperties = { WebkitMaskImage: mask, maskImage: mask };
  return (
    <>
      <i className="tl m" style={style} />
      <i className="tl d" style={style} />
      <i className="tl s" style={style} />
    </>
  );
}
