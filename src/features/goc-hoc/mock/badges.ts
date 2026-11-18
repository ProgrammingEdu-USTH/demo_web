/* 24 huy hiệu, xếp 3 tầng × 8 trên kệ cúp. */
import type { Badge, BadgeSummary, BadgeTier } from "../types";

const B = (glyph: string, name: string, tier: BadgeTier): Badge => ({ glyph, name, tier });

export const badges: readonly Badge[] = [
  B("{ }", "Dòng code đầu tiên", "bronze"), B("if", "Rẽ nhánh đúng", "bronze"), B("for", "Vòng lặp đầu tiên", "bronze"), B("7", "Streak 7 ngày", "silver"),
  B("while", "Thoát vòng lặp vô tận", "silver"), B("//", "Ghi chú rõ ràng", "bronze"), B("f(x)", "Hàm đầu tiên", "bronze"), B("[ ]", "Nhà thám hiểm mảng", "silver"),
  B("100", "Điểm tuyệt đối", "gold"), B("bug", "Gỡ lỗi đầu tiên", "bronze"), B("++", "10 bài liên tiếp", "silver"), B("∑", "Tổng dãy số", "bronze"),
  B("&&", "Logic kép", "bronze"), B("%", "Chia lấy dư", "bronze"), B("1k", "1.000 XP", "silver"), B("5k", "5.000 XP", "gold"),
  B("O(n)", "Tối ưu đầu tiên", "silver"), B("Py", "Xong Python cơ bản", "gold"), B("x²", "Bình phương", "bronze"), B('""', "Xử lý chuỗi", "bronze"),
  B("10k", "10.000 XP", "gold"), B("3", "Top 50 tuần", "silver"), B("?", "Hỏi gợi ý hay", "bronze"), B("14", "Streak 14 ngày", "soon"),
];

/**
 * Tóm tắt ở đầu trang Thành tựu, chép nguyên từ prototype.
 * Lưu ý: đếm theo danh sách trên ra 4 vàng · 7 bạc · 12 đồng, prototype ghi 5 · 7 · 11.
 */
export const badgeSummary: BadgeSummary = {
  owned: 23,
  total: 24,
  next: { name: "Streak 14 ngày", progress: "12/14" },
  gold: 5,
  silver: 7,
  bronze: 11,
};
