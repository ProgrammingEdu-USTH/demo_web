/**
 * Phần THUẦN (không DB) của `scripts/cleanup-guest-accounts.ts`: chọn tài khoản khách
 * nào được xoá, và xoá các bảng con theo thứ tự nào.
 *
 * Vì sao cần: mỗi trình duyệt mới vào /lesson/* là `POST /auth/guest` tạo một hàng
 * `users` (AuthService.guest), nên bot và người mở trang một lần làm bảng phình mãi.
 * Chú thích cũ gợi ý `DELETE ... WHERE email LIKE '%@guest.local'` — câu đó KHÔNG chạy
 * được (22 khoá ngoại tới `users` là ON DELETE RESTRICT) và lọc quá rộng (ai đăng ký
 * bằng email đuôi đó cũng dính). Luật ở đây để Jest kiểm được mà không cần DB.
 *
 * "Không hoạt động" đo bằng gì: khách có password = '' nên chỉ vào lại được bằng refresh
 * token, và RefreshTokenService.pruneExpired() xoá phiên hết hạn quá 24h. Khách không
 * còn phiên sống thì KHÔNG AI vào lại được tài khoản đó nữa — nó đã mồ côi. Thêm ngưỡng
 * N ngày từ mốc hoạt động cuối để chừa biên cho access token còn hạn và lệch đồng hồ.
 */

/** Đúng định dạng AuthService.guest() sinh: `guest_${randomUUID()}@guest.local`. */
export const GUEST_EMAIL_RE =
  /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@guest\.local$/;

/** Bộ lọc thô cho SQL (dùng index email); GUEST_EMAIL_RE lọc lại cho chặt. */
export const GUEST_EMAIL_LIKE = 'guest\\_%@guest.local';

export const DEFAULT_OLDER_THAN_DAYS = 30;

/**
 * Chính sách (DB6, ghi trong AGENTS.md): khách CHƯA có tiến độ xoá sau 30 ngày; khách CÓ
 * tiến độ giữ 180 ngày kể từ lần học cuối rồi mới xoá; người đăng nhập thật giữ không hạn
 * (không phải khách nên `skipReason` luôn bỏ qua họ).
 */
export const DEFAULT_PROGRESS_OLDER_THAN_DAYS = 180;

export const isGuestEmail = (email: string): boolean =>
  GUEST_EMAIL_RE.test(email);

/** Một khoá ngoại trỏ vào `users`, viết `bảng.cột`. */
export type UserRef = `${string}.${string}`;

/**
 * Thứ tự xoá bảng con. Không chỉ "con trước users" mà còn con trước cha GIỮA các bảng
 * con: roadmap_progress → roadmaps → surveys (roadmaps.generated_from_survey_id).
 * Spec đọc migration và đỏ nếu thứ tự này ngược một khoá ngoại nào.
 * Hàng của NGƯỜI KHÁC mà trỏ vào hàng của khách (vd. roadmap_progress của user khác trỏ
 * roadmap của khách) thì DELETE ném lỗi khoá ngoại và cả transaction huỷ — hỏng an toàn.
 */
export const DELETE_ORDER: readonly UserRef[] = [
  'auth_sessions.user_id',
  'email_verifications.user_id',
  'user_oauth_accounts.user_id',
  'enrollments.user_id',
  'lesson_progress.user_id',
  'lesson_progress_archive.user_id',
  'course_ratings.user_id',
  'missions.user_id',
  'roadmap_progress.user_id',
  'roadmaps.user_id',
  'surveys.user_id',
  'user_daily_xp_logs.user_id',
  'user_badges.user_id',
  'notification_settings.user_id',
  'notifications.user_id',
  'post_likes.user_id',
  'comment_likes.user_id',
  'user_achievements.user_id',
  'user_follows.follower_id',
  'user_follows.followee_id',
];

/** ON DELETE CASCADE — Postgres tự xoá theo hàng `users`, chỉ cần đưa vào sao lưu. */
export const CASCADE_REFS: readonly UserRef[] = [
  'quizzes.user_id',
  'review_quiz_results.user_id',
  // Migration 20261028000000_learning_events (nhánh main): ON DELETE CASCADE.
  'learning_events.user_id',
  // Migration 20261028020000_learning_event_consents: ON DELETE CASCADE. Có trong sao
  // lưu của script dọn khách (bản ghi đồng ý của người học bị xoá theo user).
  'learning_event_consents.user_id',
  // Migration 20261115030000_learning_time_daily: ON DELETE CASCADE.
  'learning_time_daily.user_id',
  // Migration 20261121000000_placement_attempts: ON DELETE CASCADE (bài kiểm tra đầu vào của khách).
  'placement_attempts.user_id',
];

/**
 * Có hàng ở đây thì BỎ QUA khách, không xoá: xoá bài viết/bình luận kéo theo bình
 * luận, lượt thích của người khác; xoá khoá học kéo theo cả bài học.
 */
export const GUARDED_REFS: readonly UserRef[] = [
  'posts.user_id',
  'comments.user_id',
  'courses.instructor_id',
];

/**
 * Khoá ngoại tới `users` chưa nằm trong danh sách nào ở trên. Spec gọi hàm này với mọi
 * khoá ngoại đọc từ prisma/migrations: thêm bảng trỏ vào `users` mà quên khai ở đây thì
 * DELETE users trong script sẽ vỡ giữa chừng vì RESTRICT.
 */
export function unknownUserRefs(refs: readonly string[]): string[] {
  const known = new Set<string>([
    ...DELETE_ORDER,
    ...CASCADE_REFS,
    ...GUARDED_REFS,
  ]);
  return [...new Set(refs)].filter((r) => !known.has(r)).sort();
}

function parseDaysFlag(
  argv: readonly string[],
  flag: string,
): number | undefined {
  const raw = argv
    .find((a) => a.startsWith(`${flag}=`))
    ?.slice(flag.length + 1);
  if (raw === undefined) return undefined;
  const m = /^(\d+)d$/.exec(raw);
  // Dưới 1 ngày thì vào thẳng vùng khách vừa rời trang — thường là gõ nhầm.
  if (!m || Number(m[1]) < 1) {
    throw new Error(
      `${flag} phải dạng <số ngày>d, tối thiểu 1d (nhận "${raw}").`,
    );
  }
  return Number(m[1]);
}

/** `--older-than=30d` → 30. Thiếu cờ thì lấy mặc định; sai định dạng thì ném lỗi. */
export function parseOlderThan(argv: readonly string[]): number {
  return parseDaysFlag(argv, '--older-than') ?? DEFAULT_OLDER_THAN_DAYS;
}

/** `--progress-older-than=180d` → 180; thiếu cờ → undefined (khách có tiến độ được giữ). */
export function parseProgressOlderThan(
  argv: readonly string[],
): number | undefined {
  return parseDaysFlag(argv, '--progress-older-than');
}

/** Bản tóm tắt một khách, đúng các cột câu SQL gom trong script trả về. */
export interface GuestCandidate {
  id: number;
  email: string;
  password: string;
  oauthProvider: string | null;
  createdAt: Date;
  lastStudyDate: Date | null;
  xp: number;
  /** Phiên chưa thu hồi và chưa hết hạn (expires_at NULL cũng tính là còn sống). */
  liveSessions: number;
  progressCount: number;
  lastProgressAt: Date | null;
  lastXpLogDate: Date | null;
  posts: number;
  comments: number;
  instructedCourses: number;
}

export type SkipReason =
  | 'khong-phai-khach'
  | 'con-phien'
  | 'moi-hoat-dong'
  | 'co-tien-do'
  | 'co-bai-viet'
  | 'la-giang-vien';

export interface SelectOptions {
  now: Date;
  olderThanDays: number;
  /** Mặc định false: giữ số liệu buổi test của khách đã học. */
  includeWithProgress: boolean;
  /**
   * Có giá trị ⇒ khách đã học cũng bị xoá, nhưng chỉ khi mốc hoạt động cuối cũ hơn ngần này
   * ngày (thường 180, dài hơn `olderThanDays`): một lần chạy áp được cả hai mốc của chính
   * sách. Không có giá trị thì `includeWithProgress` dùng chung `olderThanDays` như trước.
   */
  progressOlderThanDays?: number;
}

export interface Selection {
  toDelete: GuestCandidate[];
  skipped: { id: number; reason: SkipReason }[];
}

/** Mốc hoạt động cuối = mốc MUỘN NHẤT trong mọi dấu vết, không phải created_at. */
export function lastActivity(c: GuestCandidate): Date {
  const times = [
    c.createdAt,
    c.lastStudyDate,
    c.lastProgressAt,
    c.lastXpLogDate,
  ]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return new Date(Math.max(...times));
}

function skipReason(
  c: GuestCandidate,
  cutoff: number,
  opts: SelectOptions,
): SkipReason | null {
  // Kiểm cả password và oauth: email khớp mà có mật khẩu/OAuth là người thật dùng
  // trùng định dạng, xoá là mất tài khoản đăng nhập được.
  if (!isGuestEmail(c.email) || c.password !== '' || c.oauthProvider)
    return 'khong-phai-khach';
  if (c.liveSessions > 0) return 'con-phien';
  if (lastActivity(c).getTime() >= cutoff) return 'moi-hoat-dong';
  if (c.progressCount > 0 || c.xp > 0) {
    if (!opts.includeWithProgress && opts.progressOlderThanDays === undefined) {
      return 'co-tien-do';
    }
    // Khách đã học giữ lâu hơn khách chưa học: tiến độ là thứ họ quay lại tìm.
    const progressCutoff =
      opts.now.getTime() -
      (opts.progressOlderThanDays ?? opts.olderThanDays) * 86_400_000;
    if (lastActivity(c).getTime() >= progressCutoff) return 'moi-hoat-dong';
  }
  if (c.posts > 0 || c.comments > 0) return 'co-bai-viet';
  if (c.instructedCourses > 0) return 'la-giang-vien';
  return null;
}

export function selectStaleGuests(
  candidates: readonly GuestCandidate[],
  opts: SelectOptions,
): Selection {
  const cutoff = opts.now.getTime() - opts.olderThanDays * 86_400_000;
  const out: Selection = { toDelete: [], skipped: [] };
  for (const c of candidates) {
    const reason = skipReason(c, cutoff, opts);
    if (reason) out.skipped.push({ id: c.id, reason });
    else out.toDelete.push(c);
  }
  return out;
}

/** `"posts.user_id"` → `["posts", "user_id"]`. */
export const splitRef = (ref: string): [string, string] => {
  const [table, column] = ref.split('.');
  return [table, column];
};
