"use client";
/* Cảnh căn phòng: #cam (camera) chứa #room 2752×1536. Thứ tự lớp trong #room giữ đúng prototype. */
import { Bulbs, DustMotes, RainDrops, Stars, SteamWisps } from "../ambient/AmbientLayers";
import type { ReactNode } from "react";
import { asset, FRONT, type ItemKey } from "../config/scene";
import type { CodeToken } from "../types";
import { useLitWindow } from "../hover";
import { HitAreas, type HitHandlers } from "./HitAreas";
import { LaptopScreen } from "./LaptopScreen";
import { roomTransform, type RoomLayout } from "./layout";
import { Glow, Item, ITEM_KEYS, LaptopTints } from "./RoomItems";
import { WallCalendar } from "./WallCalendar";

/** Khung kính của mỗi cánh cửa sổ: [trái, phải] theo cánh, [trên, dưới] theo hàng. */
const PANE_X = { l: [11, 379], r: [23, 395] } as const;
const PANE_ROWS = [[2, 279], [297, 613], [631, 928]] as const;
/** Đèn thành phố ngoài cửa sổ: [cx, cy, w, h]. */
const CITY = [[1112, 722, 34, 48], [1282, 990, 130, 100], [1748, 902, 150, 110], [1535, 920, 30, 40], [1580, 745, 28, 38]] as const;
const [fx, fy, fw, fh] = FRONT;

const ROOM_ALT =
  "Góc học: bàn học trước cửa sổ, có laptop, cốc cà phê, cuốn sổ, điện thoại, bảng ghim lộ trình, lịch treo tường, kệ sách và kệ cúp";

function Sash({ side }: { side: "l" | "r" }) {
  const on = useLitWindow();
  const [a, b] = PANE_X[side];
  return (
    <div className={`sash ${side}`} id={side === "l" ? "sashL" : "sashR"}>
      <div className="tex" />
      {PANE_ROWS.map(([t, u], i) => (
        <div key={i} className="pane" style={{ left: a, top: t, width: b - a, height: u - t }} />
      ))}
      <img className={`gl glowi${on ? " on" : ""}`} data-g="window" src={asset(`items/sash-${side}-g.webp`)} alt="" />
    </div>
  );
}

export interface RoomStageProps {
  layout: RoomLayout | null;
  laptop: { code: readonly (readonly CodeToken[])[]; file: string; caption: string };
  streak: number;
  windowOpen: boolean;
  hit: HitHandlers;
  /** Vùng bấm nhận Tab (false khi đang ở trang con) */
  tabbable: boolean;
  /** Laptop dừng gõ */
  typingPaused: boolean;
  /** Hơi cà phê bốc mạnh (hover cốc) */
  steamPuff: boolean;
  /** Điện thoại sáng lên (nhịp 23 giây) */
  phonePing: boolean;
  /** Điện thoại rung khi có ghi chú mới */
  phoneBuzz: boolean;
  /** Các tờ note dán dưới cửa sổ (lớp #notes, room-space) */
  notes: ReactNode;
}

/* Trạng thái sáng do hover không đi qua đây (Item, Glow, Sash tự đọc HoverStore), nên rê chuột không render lại cảnh.
   Các phần nặng bên trong (đồ vật, viền sáng, vùng bấm, laptop, lịch, lớp chuyển động) đều memo riêng. */
export function RoomStage({ layout, laptop, streak, windowOpen, hit, typingPaused, steamPuff, phonePing, phoneBuzz, notes, tabbable }: RoomStageProps) {
  const renderItem = (k: ItemKey) => (
    <Item key={k} k={k} extra={k === "phone" && phoneBuzz ? "buzz" : undefined}>
      {k === "calendar" && <WallCalendar streak={streak} />}
    </Item>
  );

  return (
    // transform của #cam do engine chuyển cảnh đặt trực tiếp (tween từng khung hình), React không đụng tới
    <div id="cam">
      <div
        id="room"
        style={layout ? { transform: roomTransform(layout) } : { visibility: "hidden" }}
      >
        <img id="roomImg" src={asset("room.webp")} alt={ROOM_ALT} decoding="async" />
        <div id="items">{ITEM_KEYS.filter((k) => k !== "laptop").map(renderItem)}</div>
        <div id="tMul" />
        <div id="tDim" />
        <div id="tScr" />
        <div id="skyWrap" aria-hidden="true">
          <div id="sgrad" />
          <div id="sun" />
          <div id="stars">
            <Stars />
          </div>
          <div id="moon" />
          <div className="cl" id="clB" />
          <div className="cl" id="clR" />
        </div>
        <svg id="rainSvg" viewBox="0 0 2752 1536" aria-hidden="true">
          <defs>
            <clipPath id="clipOpen">
              <rect x="1046" y="160" width="788" height="926" />
            </clipPath>
          </defs>
          <g clipPath="url(#clipOpen)">
            <rect x="1040" y="150" width="800" height="950" fill="#27305e" opacity=".22" />
            <g id="dropG">
              <RainDrops />
            </g>
          </g>
        </svg>
        <div id="win" aria-hidden="true">
          <Sash side="l" />
          <Sash side="r" />
        </div>
        <img id="swag" src={asset("swag.png")} alt="" />
        {/* laptop đứng trước kính cửa sổ nên nằm trên lớp sash, mang theo tint riêng */}
        <div id="itemsTop">
          <Item k="laptop">
            <LaptopTints />
            <LaptopScreen code={laptop.code} file={laptop.file} caption={laptop.caption} paused={typingPaused} />
          </Item>
        </div>
        <img id="front" src={asset("front.webp")} alt="" decoding="async" style={{ left: fx, top: fy, width: fw, height: fh }} />
        <div id="cityG">
          {CITY.map(([x, y, w, h], i) => (
            <div
              key={i}
              className="city"
              style={{ left: x - w / 2, top: y - h / 2, width: w, height: h, animationDelay: `${-i * 2.3}s` }}
            />
          ))}
        </div>
        <div id="steamG" className={steamPuff ? "puff" : undefined}>
          <SteamWisps />
        </div>
        <div id="dustG">
          <DustMotes />
        </div>
        <div id="dark" />
        <div id="lampPool" />
        <div id="lampHalo" />
        <div id="bulbG">
          <Bulbs />
        </div>
        <div id="phoneGlow" className={phonePing ? "ping" : undefined} />
        <div id="leafG" />
        <img id="blurHole" className="blurL" src={asset("room-blur.webp")} alt="" decoding="async" />
        <img id="blurFull" className="blurL" src={asset("room-blur.webp")} alt="" decoding="async" />
        <div id="glows">
          {ITEM_KEYS.map((k) => (
            <Glow key={k} k={k} />
          ))}
        </div>
        <HitAreas windowOpen={windowOpen} tabbable={tabbable} {...hit} />
        <div id="notes" aria-label="Ghi chú thông báo">
          {notes}
        </div>
      </div>
    </div>
  );
}
