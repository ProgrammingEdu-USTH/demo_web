-- DB (19/11/2026): autovacuum dọn sớm hơn cho hai bảng có nhiều xoá/đổi hàng.
--
-- Vì sao: mặc định Postgres chỉ vacuum khi dead tuple vượt 20% bảng (+50 hàng). Với bảng nhỏ
-- chẳng sao, nhưng:
--   · learning_events: mỗi ngày job rollup xoá cả loạt Heartbeat > 7 ngày (ước ~145 MB/ngày ở
--     10.000 người học, xem AGENTS.md). Bảng hàng chục triệu hàng thì 20% = hàng triệu hàng chết
--     tích lại mới được dọn → bảng và chỉ mục phình, truy vấn chậm dần.
--   · auth_sessions: mỗi lần refresh token là INSERT một hàng mới + đánh dấu hàng cũ đã thu hồi,
--     rồi pruneExpired xoá mỗi giờ; churn cao so với số hàng sống.
-- Ngưỡng thấp hơn = vacuum thường hơn nhưng mỗi lần nhẹ hơn (ít hàng chết/lần), không khoá ghi.
--
-- Chỉ đổi THAM SỐ LƯU TRỮ của bảng (ALTER TABLE … SET): không đổi cột, kiểu, chỉ mục hay dữ
-- liệu, bản Django dùng chung không bị ảnh hưởng. Lệnh chỉ cần khoá SHARE UPDATE EXCLUSIVE, chạy
-- tức thì. Prisma không theo dõi tham số này nên `migrate diff` vẫn rỗng.
--
-- Hoàn tác (không mất dữ liệu):
--   ALTER TABLE "learning_events" RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);
--   ALTER TABLE "auth_sessions"   RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);

ALTER TABLE "learning_events" SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE "auth_sessions"   SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
