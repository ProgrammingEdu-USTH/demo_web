import type { PracticePage, PracticeSummary } from "../types";

/** Số liệu kho Luyện tập hiện ở menu bên phải. */
export const practiceSummary: PracticeSummary = { total: 128, suggestedToday: 3 };

/** Trang Luyện tập (cuốn sổ mở): gợi ý hôm nay bên trái, kho bài bên phải. */
export const practicePage: PracticePage = {
  head: "128 bài trong kho · 3 gợi ý hợp với bài bạn đang học",
  suggestions: [
    { title: "In bảng cửu chương 2 đến 9", level: "e" },
    { title: "Vẽ hình chữ nhật rỗng bằng dấu #", level: "m" },
    { title: "Đếm cặp (i, j) có tổng bằng k", level: "m" },
  ],
  questNote: "Giải 2 bài nữa để xong nhiệm vụ hôm nay (+40 XP)",
  topics: [
    { name: "Vòng lặp", active: true },
    { name: "Mảng" },
    { name: "Chuỗi" },
    { name: "Đệ quy" },
  ],
  problems: [
    { title: "Tổng các số từ 1 đến n", meta: "Vòng lặp · Dễ", xp: 10, status: "d" },
    { title: "In tam giác số Pascal", meta: "Vòng lặp lồng nhau · Vừa", xp: 20, status: "w" },
    { title: "Bảng cửu chương 2 đến 9", meta: "Vòng lặp lồng nhau · Dễ", xp: 15, status: "" },
    { title: "Hình chữ nhật rỗng", meta: "Vòng lặp lồng nhau · Vừa", xp: 20, status: "" },
    { title: "Đếm cặp có tổng bằng k", meta: "Vòng lặp lồng nhau · Vừa", xp: 25, status: "" },
  ],
};
