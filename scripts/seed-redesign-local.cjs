/**
 * seed-redesign-local.cjs — dữ liệu thử cho đội Redesign (CHỈ DB local).
 *
 * Vì sao: sau khi seed khoá học/bài, DB local vẫn thiếu tài khoản đăng nhập, tiến độ, huy hiệu,
 * diễn đàn và dữ liệu Arena nên dashboard/arena/leaderboard hiện trống.
 * Idempotent: upsert theo khoá tự nhiên; dữ liệu Arena/diễn đàn chỉ tạo khi chưa có mã/tiêu đề đó.
 * Chạy (qua agent.sh, DATABASE_URL đã trỏ local):
 *   NODE_OPTIONS="--require D:/EDU/redesign-team/devstack/neon-local-preload.cjs" node scripts/seed-redesign-local.cjs
 * Tài khoản thử (không phải secret thật): xem bus/state/backend.md.
 */
const { randomBytes, scryptSync } = require('crypto');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaNeon } = require('@prisma/adapter-neon');

// Chốt an toàn: không bao giờ chạy lên DB thật.
if (!String(process.env.DATABASE_URL || '').includes('127.0.0.1:55433')) {
  console.error('Từ chối: DATABASE_URL không phải DB local 55433.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// Cùng định dạng hash với src/common/security/werkzeug-scrypt-hasher.ts.
function hash(pw) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:32768:8:1$${salt}$${key.toString('hex')}`;
}

const PASSWORD = 'Redesign#2026';
const day = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const ago = (min) => new Date(Date.now() - min * 60_000);

const USERS = [
  { email: 'hocvien@redesign.test', name: 'Học Viên Thử', role: 'Học viên', xp: 1240, streak: 6, gems: 80 },
  { email: 'admin@redesign.test', name: 'Admin Thử', role: 'admin', xp: 300, streak: 1, gems: 0 },
  { email: 'minh@redesign.test', name: 'Minh Anh', role: 'Học viên', xp: 2100, streak: 12, gems: 120 },
  { email: 'bao@redesign.test', name: 'Gia Bảo', role: 'Học viên', xp: 1650, streak: 4, gems: 60 },
  { email: 'lan@redesign.test', name: 'Thu Lan', role: 'Học viên', xp: 980, streak: 3, gems: 40 },
  { email: 'khoa@redesign.test', name: 'Đăng Khoa', role: 'Học viên', xp: 620, streak: 2, gems: 20 },
];

async function main() {
  const pwHash = hash(PASSWORD);
  const u = {};
  for (const d of USERS) {
    const row = await prisma.user.upsert({
      where: { email: d.email },
      // Cập nhật lại mật khẩu để tài khoản thử luôn đăng nhập được.
      update: { password: pwHash, isVerified: true, role: d.role },
      create: { ...d, password: pwHash, isVerified: true, questionnaireCompleted: true, lastStudyDate: day(0) },
    });
    u[d.email.split('@')[0]] = row;
  }
  const main = u.hocvien;

  // Tiến độ học: học viên chính học python + htmlcss + db_design; vài người khác học python.
  const courses = await prisma.course.findMany({ select: { id: true, lessonCount: true } });
  const cid = new Set(courses.map((c) => c.id));
  const plan = [
    [main, 'python', 8], [main, 'htmlcss', 4], [main, 'db_design', 20],
    [u.minh, 'python', 15], [u.bao, 'python', 10], [u.lan, 'cpp', 6], [u.khoa, 'python', 3],
  ];
  for (const [user, courseId, done] of plan) {
    if (!cid.has(courseId)) continue;
    const lessons = await prisma.lesson.findMany({
      where: { courseId }, orderBy: { sortOrder: 'asc' }, take: done, select: { id: true },
    });
    const total = courses.find((c) => c.id === courseId).lessonCount || 1;
    const completed = lessons.length;
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      update: { completedLessons: completed, progress: Math.round((completed / total) * 100) },
      create: {
        userId: user.id, courseId, completedLessons: completed,
        progress: Math.round((completed / total) * 100),
        status: completed >= total ? 'completed' : 'active', timeSpent: `${(completed * 0.4).toFixed(1)}h`,
      },
    });
    for (const [i, l] of lessons.entries()) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId: l.id } },
        update: {},
        create: {
          userId: user.id, lessonId: l.id, courseId, status: 'completed',
          quizScore: 70 + ((i * 7) % 31), xpEarned: 10, completedAt: ago(i * 1440 + 30),
        },
      });
    }
    await prisma.courseRating.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      update: {}, create: { userId: user.id, courseId, rating: 4 + (user.id % 2) },
    });
  }

  // XP theo ngày TUẦN NÀY (bảng xếp hạng weekly tính từ user_daily_xp_logs).
  for (const [key, base] of [['hocvien', 60], ['minh', 110], ['bao', 90], ['lan', 50], ['khoa', 30]]) {
    const user = u[key];
    for (let n = 0; n < 7; n++) {
      const exists = await prisma.userDailyXpLog.findFirst({ where: { userId: user.id, logDate: day(n) } });
      if (!exists) {
        await prisma.userDailyXpLog.create({
          data: { userId: user.id, logDate: day(n), xpEarned: base + ((n * 13) % 40) },
        });
      }
    }
  }

  // Huy hiệu + thành tựu (điều kiện khớp AchievementMetrics: lesson_count, streak_days, xp_total, course_complete).
  const badges = [
    ['first-lesson', 'Bước đầu tiên', 'lesson_count', 1],
    ['streak-7', 'Chuỗi 7 ngày', 'streak_days', 7],
    ['xp-1000', 'Nghìn XP', 'xp_total', 1000],
  ];
  for (const [code, name, conditionType, conditionValue] of badges) {
    const b = await prisma.badge.upsert({
      where: { code }, update: {}, create: { code, name, conditionType, conditionValue },
    });
    if (conditionValue <= 1000 && code !== 'streak-7') {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: main.id, badgeId: b.id } }, update: {}, create: { userId: main.id, badgeId: b.id },
      });
    }
  }
  const achs = [
    ['lessons-5', 'Chăm học', 'Hoàn thành 5 bài học', '📘', 'lesson_count', 5],
    ['lessons-25', 'Học không ngừng', 'Hoàn thành 25 bài học', '🏅', 'lesson_count', 25],
    ['streak-3', 'Giữ lửa', 'Học 3 ngày liên tiếp', '🔥', 'streak_days', 3],
    ['course-1', 'Hoàn thành khoá', 'Hoàn thành một khoá học', '🎓', 'course_complete', 1],
  ];
  for (const [code, name, description, icon, conditionType, conditionValue] of achs) {
    const a = await prisma.achievement.upsert({
      where: { code }, update: {}, create: { code, name, description, icon, conditionType, conditionValue },
    });
    if (conditionValue <= 5 && conditionType !== 'course_complete') {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: main.id, achievementId: a.id } },
        update: {}, create: { userId: main.id, achievementId: a.id },
      });
    }
  }

  // Diễn đàn: 3 bài + bình luận (chỉ tạo khi chưa có tiêu đề).
  const posts = [
    [u.minh, 'hoi-dap', 'Cách dùng vòng lặp for trong Python?', 'Mình mới học, vòng lặp for với range hoạt động thế nào?'],
    [u.bao, 'chia-se', 'Mẹo học SQL nhanh', 'Mỗi ngày làm 3 câu truy vấn JOIN là quen tay.'],
    [u.lan, 'hoi-dap', 'Con trỏ trong C++ khó hiểu quá', 'Ai có ví dụ dễ nhớ về con trỏ và tham chiếu không?'],
  ];
  for (const [author, category, title, content] of posts) {
    if (await prisma.post.findFirst({ where: { title } })) continue;
    const p = await prisma.post.create({ data: { userId: author.id, category, title, content, likeCount: 0 } });
    await prisma.comment.create({ data: { userId: main.id, postId: p.id, content: 'Cảm ơn bạn đã chia sẻ!' } });
  }

  // Thông báo mẫu cho học viên chính.
  if (!(await prisma.notification.findFirst({ where: { userId: main.id } }))) {
    await prisma.notification.createMany({
      data: [
        { userId: main.id, type: 'system', title: 'Chào mừng bạn!', body: 'Bắt đầu bài học đầu tiên nhé.', refType: 'none', refId: 0 },
        { userId: main.id, type: 'streak', title: 'Chuỗi 6 ngày', body: 'Giữ nhịp học hôm nay để lên 7 ngày.', refType: 'none', refId: 0 },
      ],
    });
  }

  // Arena: xếp hạng + 4 trận đã kết thúc (mã SEED01..04) + bài nộp.
  const ratings = [['hocvien', 1040, 3, 2, 0], ['minh', 1180, 8, 2, 1], ['bao', 1090, 5, 4, 0], ['lan', 980, 2, 3, 0], ['khoa', 940, 1, 4, 0]];
  for (const [key, rating, wins, losses, draws] of ratings) {
    await prisma.arenaRating.upsert({
      where: { userId: u[key].id }, update: { rating, wins, losses, draws }, create: { userId: u[key].id, rating, wins, losses, draws },
    });
  }
  const matches = [
    ['SEED01', 'fizzbuzz', 'hocvien', 'minh', 'minh', 'solved', 600], ['SEED02', 'palindrome', 'hocvien', 'bao', 'hocvien', 'solved', 1500],
    ['SEED03', 'sum-of-evens', 'lan', 'hocvien', 'hocvien', 'timeout', 3000], ['SEED04', 'top-word', 'bao', 'khoa', 'bao', 'forfeit', 4300],
  ];
  for (const [code, problemId, host, guest, winner, endReason, minsAgo] of matches) {
    if (await prisma.arenaMatch.findUnique({ where: { code } })) continue;
    const m = await prisma.arenaMatch.create({
      data: {
        code, problemId, isPublic: true, status: 'finished', hostId: u[host].id, guestId: u[guest].id,
        winnerId: u[winner].id, endReason, hostRatingDelta: host === winner ? 12 : -12, guestRatingDelta: guest === winner ? 12 : -12,
        hostXp: host === winner ? 40 : 10, guestXp: guest === winner ? 40 : 10,
        createdAt: ago(minsAgo + 15), startedAt: ago(minsAgo + 10), deadlineAt: ago(minsAgo - 5), finishedAt: ago(minsAgo),
      },
    });
    await prisma.arenaSubmission.create({
      data: {
        matchId: m.id, userId: u[winner].id, code: 'def solve(*args):\n    return args[0]\n', status: 'graded',
        passed: 5, total: 5, detail: { public: [{ index: 0, passed: true }], hiddenPassed: 3, hiddenTotal: 3 },
        message: 'Đạt tất cả test', createdAt: ago(minsAgo + 2), gradedAt: ago(minsAgo + 1),
      },
    });
  }

  console.log('SEED REDESIGN OK', USERS.length, 'tài khoản, mật khẩu chung:', PASSWORD);
  await prisma.$disconnect();
}

main().catch((e) => { console.error('SEED ERR', e); process.exit(1); });
