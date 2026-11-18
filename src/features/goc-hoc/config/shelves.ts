/* Mỗi kệ trong tủ sách là một khoá, mỗi cuốn sách trên kệ là một bài học (key + chỉ số = ItemKey, vd. book3, pb0). */
import type { LessonState } from "../types";
import { BOOK_COLORS } from "./scene";

export type ShelfKey = "book" | "pb" | "tb";
export type ShelfLesson = readonly [title: string, state: LessonState];

export interface Shelf {
  key: ShelfKey;
  name: string;
  chap: string;
  short: string;
  lessons: readonly ShelfLesson[];
  /** Khung FOCUS khi zoom vào kệ này */
  focus: ShelfKey;
}

/** Kệ trên: C++ Nền tảng · Vòng lặp lồng nhau */
export const LESSONS: readonly ShelfLesson[] = [
  ["Vòng lặp lồng nhau là gì", "done"],
  ["In hình chữ nhật sao", "done"],
  ["Bảng cửu chương", "done"],
  ["Tam giác sao", "cur"],
  ["Tam giác ngược", "lock"],
  ["Đếm cặp số", "lock"],
  ["Duyệt mảng hai chiều", "lock"],
  ["Tối ưu hai vòng lặp", "lock"],
  ["Kiểm tra cuối chặng", "lock"],
];

export const SHELVES: readonly Shelf[] = [
  { key: "book", name: "C++ Nền tảng", chap: "Vòng lặp lồng nhau", short: "C++", lessons: LESSONS, focus: "book" },
  {
    key: "pb",
    name: "Python cơ bản",
    chap: "Đã hoàn thành",
    short: "Python",
    focus: "pb",
    lessons: [
      "Biến và kiểu dữ liệu",
      "Nhập và xuất",
      "Câu lệnh if",
      "if, elif, else",
      "Vòng lặp for",
      "Vòng lặp while",
      "Hàm",
      "List",
      "Dict",
      "Chuỗi",
      "Ôn tập",
    ].map((t): ShelfLesson => [t, "done"]),
  },
  {
    key: "tb",
    name: "Tư duy giải thuật",
    chap: "Đang học",
    short: "Tư duy",
    focus: "tb",
    lessons: [
      ["Chia nhỏ bài toán", "done"],
      ["Viết mã giả", "done"],
      ["Vẽ lưu đồ", "done"],
      ["Tìm quy luật", "done"],
      ["Thử bằng tay", "done"],
      ["Đếm số bước", "cur"],
      ["Thuật toán tham lam", "lock"],
      ["Chia để trị", "lock"],
    ],
  },
];

export interface ShelfStats {
  d: number;
  n: number;
  pct: number;
  sub: string;
}

export function shelfStats(S: Shelf): ShelfStats {
  const d = S.lessons.filter((l) => l[1] === "done").length;
  const n = S.lessons.length;
  const c = S.lessons.findIndex((l) => l[1] === "cur");
  return {
    d,
    n,
    pct: Math.round(((d + (c >= 0 ? 0.4 : 0)) / n) * 100),
    sub: c >= 0 ? `${S.chap} · bài ${c + 1}/${n}` : `Hoàn thành ${d}/${n} bài`,
  };
}

const lighten = (hex: string, t: number) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return "#" + v.map((c) => Math.round(c + (235 - c) * t).toString(16).padStart(2, "0")).join("");
};

/** Màu gáy sách (BOOKCOL), mặc định #3a3040 nếu không có trong items_data.json. */
export const bookColor = (k: string): string => (BOOK_COLORS as Readonly<Record<string, string>>)[k] ?? "#3a3040";
/** Màu bìa sách trên trang Khóa học (COVER): gáy sáng thêm 38%. */
export const coverColor = (k: string) => lighten(bookColor(k), 0.38);
