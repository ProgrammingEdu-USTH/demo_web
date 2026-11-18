/* Bảng đồ vật: tương đương GROUPS, KIND, ORIGIN, FOCUS, ROUTES, NAMES, HELD_IMG trong prototype. */
import type { LessonState, Route } from "../types";
import { HITS, isBookKey, type BookKey, type Box, type ItemKey, type Polygon } from "./scene";
import { SHELVES } from "./shelves";

/**
 * - zoom: camera zoom vào đồ vật rồi trang hiện ra từ đó
 * - pick: đồ vật được nhấc lên, bay về phía người xem rồi biến thành trang
 * - toggle: mở/đóng cửa sổ
 * - peek: xem lịch, không đổi trang
 * - sip: nhấp một ngụm cà phê, không đổi trang
 */
export type Interaction = "pick" | "zoom" | "toggle" | "peek" | "sip";

/** Kiểu hover, ứng với class .k-{kind} trong CSS. */
export type HoverKind =
  | "laptop"
  | "notebook"
  | "phone"
  | "mug"
  | "calendar"
  | "corkboard"
  | "bookcase"
  | "trophy"
  | "medal"
  | "book";

export type GroupRoute = Route | "calendar" | "mug" | "window" | "book";

export const KIND: Readonly<Record<Exclude<ItemKey, BookKey> | "bookcase", HoverKind>> = {
  laptop: "laptop",
  notebook: "notebook",
  phone: "phone",
  mug: "mug",
  calendar: "calendar",
  corkboard: "corkboard",
  bookcase: "bookcase",
  cupTop: "trophy",
  cupLow: "trophy",
  medalTop: "medal",
  medalLow: "medal",
  medalHang: "medal",
};

export const hoverKind = (k: ItemKey): HoverKind => (isBookKey(k) ? "book" : KIND[k]);

export const ORIGIN: Readonly<Partial<Record<ItemKey, string>>> = {
  calendar: "126px 38px",
  mug: "50% 85%",
  medalTop: "50% 22%",
  medalLow: "50% 20%",
  medalHang: "50% 14%",
  corkboard: "50% 0",
  phone: "50% 50%",
  notebook: "50% 80%",
};

/** transform-origin của lớp đồ vật, mặc định đáy giữa. */
export const originOf = (k: ItemKey) => ORIGIN[k] ?? "50% 100%";

/** Ảnh cầm trên tay (items/held/*.webp) cho đồ vật khác ảnh trong phòng. medalLow dùng chung ảnh medalTop. */
export const HELD_IMG: Readonly<Partial<Record<ItemKey, string>>> = {
  mug: "mug",
  cupTop: "cupTop",
  cupLow: "cupLow",
  medalTop: "medalTop",
  medalLow: "medalTop",
  medalHang: "medalHang",
};

export interface ObjectGroup {
  g: string;
  route: GroupRoute;
  /** Trang mở ra; null nếu không đổi trang */
  target: Route | null;
  interaction: Interaction;
  label: string;
  keys: readonly ItemKey[];
  /** Vùng bấm riêng khi nhóm không có lớp cắt (cửa sổ) */
  poly?: readonly Polygon[];
  shelf?: number;
  lesson?: number;
  state?: LessonState;
}

export const WINDOW_LABEL = { closed: "Cửa sổ · Mở để hóng gió", open: "Cửa sổ · Đóng lại" } as const;

const LOCK_SUFFIX: Readonly<Record<LessonState, string>> = { lock: " · chưa mở", done: " · đã học", cur: " · đang học" };

export const GROUPS: readonly ObjectGroup[] = [
  { g: "learn", route: "learn", target: "learn", interaction: "zoom", label: "Laptop · Học tiếp bài 4", keys: ["laptop"] },
  { g: "roadmap", route: "roadmap", target: "roadmap", interaction: "zoom", label: "Bảng ghim · Lộ trình", keys: ["corkboard"] },
  { g: "calendar", route: "calendar", target: null, interaction: "peek", label: "Lịch · Chuỗi 12 ngày", keys: ["calendar"] },
  { g: "practice", route: "practice", target: "practice", interaction: "pick", label: "Cuốn sổ · Luyện tập", keys: ["notebook"] },
  { g: "phone", route: "phone", target: "phone", interaction: "pick", label: "Điện thoại · Hồ sơ và xếp hạng", keys: ["phone"] },
  { g: "mug", route: "mug", target: null, interaction: "sip", label: "Cốc cà phê · Nghỉ 5 phút", keys: ["mug"] },
  {
    g: "achievements",
    route: "achievements",
    target: "achievements",
    interaction: "pick",
    label: "Kệ cúp · Thành tựu",
    keys: ["cupTop", "medalTop", "medalHang", "cupLow", "medalLow"],
  },
  {
    g: "window",
    route: "window",
    target: null,
    interaction: "toggle",
    label: WINDOW_LABEL.closed,
    keys: [],
    poly: [[[1036, 158], [1842, 158], [1842, 1088], [1036, 1088]]],
  },
  ...SHELVES.flatMap((S, s) =>
    S.lessons.map(
      (l, i): ObjectGroup => ({
        g: S.key + i,
        route: "book",
        target: "learn",
        interaction: "pick",
        label: `${S.short} · Bài ${i + 1}: ${l[0]}`,
        keys: [`${S.key}${i}` as ItemKey],
        shelf: s,
        lesson: i,
        state: l[1],
      }),
    ),
  ),
];

/** aria-label của vùng bấm: nhãn + trạng thái bài (nếu là sách). */
export const groupAriaLabel = (G: ObjectGroup) => G.label + (G.state ? LOCK_SUFFIX[G.state] : "");

/** Các polygon vùng bấm của nhóm, kèm key đồ vật (null với cửa sổ). */
export const groupPolys = (G: ObjectGroup): readonly (readonly [ItemKey | null, Polygon])[] =>
  G.poly ? G.poly.map((p) => [null, p] as const) : G.keys.flatMap((k) => HITS[k].map((p) => [k, p] as const));

/** Hộp bao [x0, y0, x1, y1] của mọi polygon trong nhóm (G.box). */
export function groupBox(G: ObjectGroup): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  groupPolys(G).forEach(([, p]) => p.forEach(([x, y]) => (xs.push(x), ys.push(y))));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Đồ vật được nhấc lên khi bấm một nhóm kiểu pick: cúp/huy chương nào được bấm thì nhấc cái đó. */
export const pickKeyOf = (G: ObjectGroup, clicked?: ItemKey | null): ItemKey | null =>
  G.interaction !== "pick" ? null : clicked && G.keys.includes(clicked) ? clicked : G.keys[0];

/** Mục menu được làm sáng khi hover một nhóm (menuKey). */
export const menuRouteOf = (G: ObjectGroup): GroupRoute => (G.route === "book" ? "courses" : G.route);

/** Các nhóm sáng lên khi hover mục menu r (lightRoute). */
export const groupsLitBy = (r: GroupRoute) =>
  GROUPS.filter(
    (G) => G.route === r || (r === "learn" && G.g === "book3") || (r === "courses" && G.route === "book" && G.state !== "lock"),
  );

/** Đồ vật nhấc lên khi mở trang từ menu thay vì bấm trong phòng. */
export const MENU_PICK: Readonly<Partial<Record<Route, ItemKey>>> = { phone: "phone", practice: "notebook" };

export interface ObjectInfo {
  key: ItemKey;
  group: string;
  route: GroupRoute;
  target: Route | null;
  label: string;
  interaction: Interaction;
  origin: string;
  hover: HoverKind;
}

/** Tra cứu theo từng đồ vật (39 lớp trong items_data.json). */
export const OBJECTS = Object.fromEntries(
  GROUPS.flatMap((G) =>
    G.keys.map((k): [ItemKey, ObjectInfo] => [
      k,
      { key: k, group: G.g, route: G.route, target: G.target, label: G.label, interaction: G.interaction, origin: originOf(k), hover: hoverKind(k) },
    ]),
  ),
) as Readonly<Record<ItemKey, ObjectInfo>>;

export type FocusKey = Route | "book" | "pb" | "tb" | "calendar";

/** Khung camera zoom vào, [x0, y0, x1, y1] room-space. */
export const FOCUS: Readonly<Record<FocusKey, Box>> = {
  learn: [806, 1050, 1126, 1300],
  roadmap: [462, 388, 725, 1040],
  book: [1955, 495, 2335, 716],
  practice: [1280, 1265, 1625, 1385],
  achievements: [1920, 360, 2170, 950],
  phone: [1683, 1300, 1845, 1386],
  pb: [1990, 990, 2350, 1230],
  tb: [1990, 1255, 2350, 1505],
  courses: [1945, 480, 2400, 1520],
  calendar: [745, 520, 960, 800],
};

export const ROUTES: readonly Route[] = ["learn", "roadmap", "courses", "practice", "achievements", "phone"];

export const ROUTE_NAMES: Readonly<Record<Route, string>> = {
  learn: "Học tiếp",
  roadmap: "Lộ trình",
  courses: "Khóa học",
  practice: "Luyện tập",
  achievements: "Thành tựu",
  phone: "Điện thoại",
};
