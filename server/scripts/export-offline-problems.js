/**
 * Xuất kho đề Arena (cả test ẩn) cho chế độ "Đấu với máy" chạy offline trên trình duyệt:
 *   npm --prefix server run build && node server/scripts/export-offline-problems.js
 * → web/src/arena/offline-problems.json
 *
 * Nguồn duy nhất vẫn là server/src/arena/problems/*.ts. Bản offline không có máy chủ giữ bí mật nên
 * test ẩn nằm trong bundle — chấp nhận được vì trận với máy không tính Elo. Trận online vẫn chấm trên server.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist', 'arena', 'problems', 'index.js');
if (!fs.existsSync(dist)) {
  console.error('Chưa có bản build: chạy `npm --prefix server run build` trước.');
  process.exit(1);
}
const { PROBLEMS } = require(dist);
const out = path.join(__dirname, '..', '..', 'web', 'src', 'arena', 'offline-problems.json');
const data = PROBLEMS.map((p) => ({
  id: p.id, title: p.title, difficulty: p.difficulty, durationSec: p.durationSec,
  statement: p.statement, signature: p.signature, starterCode: p.starterCode,
  publicTests: p.publicTests, hiddenTests: p.hiddenTests, perTestMs: p.perTestMs,
}));
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`Đã ghi ${data.length} đề → ${path.relative(process.cwd(), out)}`);
