/* Toạ độ phòng (room-space = pixel ảnh gốc 2752×1536). Nguồn: handoff/reference/layout/*.json, không sửa ở đây. */
import itemsData from "@handoff/reference/layout/items_data.json";
import sceneData from "@handoff/reference/layout/scene.json";

export const ROOM_W = 2752;
export const ROOM_H = 1536;

/** Thư mục ảnh trong public/ (bản sao của handoff/assets/). */
export const ASSET_BASE = "/goc-hoc";
export const asset = (path: string) => `${ASSET_BASE}/${path}`;

/** Ảnh cần ngay khi vào (preload trong <head>): ảnh phòng, cánh cửa sổ, lớp trước, mặt nạ trời và mây.
    Ảnh từng đồ vật là <img> trong cảnh nên trình duyệt tự tải. */
export const PRELOAD_ASSETS = [
  "room.webp",
  "sash-l.webp",
  "sash-r.webp",
  "items/sash-l-g.webp",
  "items/sash-r-g.webp",
  "front.webp",
  "swag.png",
] as const;
/** Ảnh dùng làm mask-image trong CSS: trình duyệt tải ở chế độ CORS, nên preload phải kèm crossOrigin mới dùng lại được. */
export const PRELOAD_MASKS = ["sky-mask.png", "cloud-body.png", "cloud-light.png"] as const;

/** Ảnh chỉ dùng khi mở trang con / cầm đồ vật: tải lúc rảnh sau màn mở đầu. */
export const LAZY_ASSETS = [
  "items/held/mug.webp",
  "items/held/cupTop.webp",
  "items/held/cupLow.webp",
  "items/held/medalTop.webp",
  "items/held/medalHang.webp",
  "items/page/board-empty.webp",
  "items/page/book-cover.webp",
  "items/page/book-cover-mask.png",
  "items/page/book-open.webp",
  "items/page/calendar.webp",
  "items/page/notebook-open.webp",
  "items/page/phone-frame.webp",
] as const;

export type Point = readonly [x: number, y: number];
/** [x, y, w, h] */
export type Rect = readonly [x: number, y: number, w: number, h: number];
/** [x0, y0, x1, y1] */
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];
export type Polygon = readonly Point[];
export type Quad = readonly [Point, Point, Point, Point];

/** Mọi đồ vật cắt lớp có trong items_data.json (laptop, mug, book0…, pb0…, tb0…). */
export type ItemKey = keyof typeof itemsData.meta;
/** Các cuốn sách có màu gáy riêng. */
export type BookKey = keyof typeof itemsData.cols;

export interface CalendarGrid {
  /** Ảnh lịch phóng to (items/page/calendar.webp), toạ độ ảnh nguồn. */
  src: {
    w: number;
    h: number;
    cells: readonly Point[];
    labels: readonly Point[];
    cw: number;
    ch: number;
    pic: Box;
  };
  /** Lịch treo trong phòng, toạ độ room-space. */
  room: {
    cells: readonly Point[];
    labels: readonly Point[];
    pic: readonly [Point, Point];
    off: Point;
  };
}

/* TypeScript đọc mảng trong JSON thành number[], nên phải ép qua unknown sang tuple.
   Tên key vẫn lấy từ JSON (ItemKey, BookKey) nên thiếu/thừa đồ vật sẽ lỗi type ở nơi dùng. */

/** Vị trí và kích thước từng lớp đồ vật. */
export const ITEMS = itemsData.meta as unknown as Readonly<Record<ItemKey, Rect>>;
/** Polygon vùng bấm; một đồ vật có thể có nhiều polygon (vd. tb0). */
export const HITS = itemsData.hits as unknown as Readonly<Record<ItemKey, readonly Polygon[]>>;
/** Màu gáy sách. */
export const BOOK_COLORS: Readonly<Record<BookKey, string>> = itemsData.cols;

export const BULBS = sceneData.bulbs as unknown as readonly Point[];
/** Lớp front.webp: [x, y, w, h]. */
export const FRONT = sceneData.front as unknown as Rect;
/** 4 góc màn hình laptop, tương đối với ảnh laptop (trên-trái, trên-phải, dưới-phải, dưới-trái). */
export const LAPTOP_SCREEN = sceneData.screen as unknown as Quad;
export const CALENDAR = sceneData.cal as unknown as CalendarGrid;

/** Giấy note dưới cửa sổ: x của 4 ô dán, đỉnh note, số note tối đa (SLOTS, NOTE_TOP, MAXN). */
export const NOTE_SLOTS = [1387, 1459, 1531, 1603] as const;
export const NOTE_TOP = 1152;
export const MAX_NOTES = 4;

export const isBookKey =(k: string): k is BookKey => /^(book|pb|tb)\d+$/.test(k);
