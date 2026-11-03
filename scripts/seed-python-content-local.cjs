/**
 * seed-python-content-local.cjs — đổ nội dung PE v3 vào 40 bài stub của khoá `python` (CHỈ DB local).
 *
 * Vì sao: DB local chỉ có 40 dòng bài Python không có content_json nên không chấm thử được.
 * Ghép theo sort_order (giữ nguyên lesson_code `python-N` và id, nên tiến độ đã seed không đổi);
 * chỉ cập nhật title/module/subtitle/xp/content_json. Idempotent.
 * Chạy: NODE_OPTIONS="--require D:/EDU/redesign-team/devstack/neon-local-preload.cjs" node scripts/seed-python-content-local.cjs
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaNeon } = require('@prisma/adapter-neon');

// Chốt an toàn: không bao giờ chạy lên DB thật.
if (!String(process.env.DATABASE_URL || '').includes('127.0.0.1:55433')) {
  console.error('Từ chối: DATABASE_URL không phải DB local 55433.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

(async () => {
  const { lessons } = JSON.parse(readFileSync(join(__dirname, 'pe-v3', 'out', 'lessons.json'), 'utf8'));
  let n = 0;
  for (const r of lessons) {
    const res = await prisma.lesson.updateMany({
      where: { courseId: 'python', sortOrder: r.sort_order },
      data: {
        module: r.module, title: r.title, subtitle: r.subtitle,
        estimatedMinutes: r.estimated_minutes ?? null, xpReward: r.xp_reward, contentJson: r.content_json,
      },
    });
    n += res.count;
  }
  console.log(`Đã cập nhật ${n}/${lessons.length} bài.`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
