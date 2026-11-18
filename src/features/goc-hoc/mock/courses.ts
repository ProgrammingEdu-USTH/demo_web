/* 3 khoá đầu là 3 kệ trong phòng (xem config/shelves.ts), 2 khoá sau chưa có trên kệ. */
import { SHELVES } from "../config/shelves";
import type { Course } from "../types";

export const courses: readonly Course[] = [
  ...SHELVES.map((_, s) => ({ shelf: s })),
  { name: "Cấu trúc dữ liệu", sub: "Chưa bắt đầu · 10 bài", titles: ["Mảng", "Danh sách liên kết", "Ngăn xếp", "Hàng đợi", "Bảng băm", "Cây", "Cây nhị phân", "Heap", "Đồ thị", "Ôn tập"], col: ["#4f56a3", "#5f66b3", "#3f4693"] },
  { name: "Lập trình hướng đối tượng", sub: "Mở ở Lv. 16", titles: ["Lớp", "Đối tượng", "Đóng gói", "Kế thừa", "Đa hình", "Ôn tập"], locked: true, col: ["#b07a3a", "#c08a4a"] },
];
