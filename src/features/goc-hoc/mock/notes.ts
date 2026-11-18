/* Giấy note dưới cửa sổ. Phòng hiện tối đa 4 tờ, lúc đầu dán 2 tờ đầu tiên. */
import type { StickyNote } from "../types";

export const NOTE_POOL: readonly StickyNote[] = [
  { ic: "↑2", sh: "Hạng 37", l3: "Giải Bạc", k: "Bảng xếp hạng", t: "Bạn vừa tăng 2 bậc", b: "Tuần này bạn đang hạng 37 ở Giải Bạc. Thêm 160 XP nữa là vào top 30.", act: "Xem xếp hạng", go: { route: "phone", tab: "rank" }, c: "--note-b" },
  { ic: "2 ngày", sh: "Đệ quy", l3: "0/5 bài", k: "Thử thách tuần", t: "Còn 2 ngày cho “Đệ quy”", b: "Bạn đã làm 0/5 bài. Hoàn thành cả 5 để nhận huy hiệu Kim cương.", act: "Làm thử thách", go: { route: "practice" }, c: "--note-y" },
  { ic: "+40", sh: "Luyện tập", l3: "2 bài nữa", k: "Nhiệm vụ hôm nay", t: "Còn 2 bài luyện tập", b: "Giải thêm 2 bài trong kho Luyện tập để nhận +40 XP hôm nay.", act: "Mở cuốn sổ", go: { route: "practice" }, c: "--note-g" },
  { ic: "12/14", sh: "Streak", l3: "còn 2 ngày", k: "Huy hiệu sắp mở", t: "Giữ chuỗi thêm 2 ngày", b: "Học ít nhất 1 bài mỗi ngày đến Chủ nhật để mở huy hiệu Streak 14 ngày.", act: "Xem thành tựu", go: { route: "achievements" }, c: "--note-p" },
  { ic: "Bài 5", sh: "Sắp mở", l3: "sau bài 4", k: "Bài học", t: "“Tam giác ngược” đang chờ", b: "Xong Bài 4 là cuốn sách thứ 5 trên kệ sẽ mở khóa.", act: "Học tiếp bài 4", go: { route: "learn" }, c: "--note-y" },
  { ic: "7 phút", sh: "Gợi ý", l3: "20:30?", k: "Mẹo học", t: "Bạn hay học lúc tối", b: "Ba buổi gần nhất bạn học trung bình 7 phút sau 21:00. Thử đặt nhắc lúc 20:30?", act: "Để sau", go: null, c: "--note-b" },
];
