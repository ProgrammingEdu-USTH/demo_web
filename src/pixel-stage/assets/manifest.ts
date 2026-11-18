// Danh mục spritesheet thật (Phase 4). Khoá "<thế-giới>/<tên sprite>" → đường dẫn file JSON Aseprite trong public/.
// Sprite không có trong danh mục (hoặc tải lỗi / sai hợp đồng) thì dùng placeholder vẽ bằng code, nên có thể thay dần từng sprite.
//
// Ví dụ khi đã có art thật cho đầu bếp:
//   "kitchen/cook": "/pixel-stage/sprites/kitchen/cook.json",
//
// Bộ mẫu đúng khung và tag cho người vẽ nằm ở public/pixel-stage/sprites/ (tạo bằng `npm run export:pixel-sprites`).
export const SPRITE_ASSETS: Readonly<Record<string, string>> = {};
