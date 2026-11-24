import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

import {
  CASCADE_REFS,
  DELETE_ORDER,
  GUARDED_REFS,
  isGuestEmail,
  lastActivity,
  parseOlderThan,
  parseProgressOlderThan,
  selectStaleGuests,
  splitRef,
  unknownUserRefs,
  type GuestCandidate,
  type SelectOptions,
} from './guest-cleanup';

const DAY = 86_400_000;
const NOW = new Date('2026-11-02T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

// Đúng hình dạng AuthService.guest() tạo (AGENTS.md: fixture không giống dữ liệu thật
// thì test vô dụng): email guest_<uuid>@guest.local, password '', không OAuth.
const guest = (over: Partial<GuestCandidate> = {}): GuestCandidate => ({
  id: 1,
  email: `guest_${randomUUID()}@guest.local`,
  password: '',
  oauthProvider: null,
  createdAt: daysAgo(90),
  lastStudyDate: null,
  xp: 0,
  liveSessions: 0,
  progressCount: 0,
  lastProgressAt: null,
  lastXpLogDate: null,
  posts: 0,
  comments: 0,
  instructedCourses: 0,
  ...over,
});

const OPTS: SelectOptions = {
  now: NOW,
  olderThanDays: 30,
  includeWithProgress: false,
};
const reasonOf = (c: GuestCandidate, opts = OPTS) => {
  const sel = selectStaleGuests([c], opts);
  return sel.toDelete.length ? 'xoa' : sel.skipped[0].reason;
};

// Mọi khoá ngoại trong migration thật, dạng { from: 'bảng.cột', to: 'bảng' }.
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');
const FKS = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const sql = readFileSync(join(MIGRATIONS, d.name, 'migration.sql'), 'utf8');
    return [
      // \s+ chứ không phải dấu cách đơn: migration viết tay (vd learning_event_consents)
      // xuống dòng giữa các mệnh đề, regex cũ bỏ sót nó và spec đạt vô nghĩa.
      ...sql.matchAll(
        /ALTER\s+TABLE\s+"(\w+)"\s+ADD\s+CONSTRAINT\s+"\w+"\s+FOREIGN\s+KEY\s+\("(\w+)"\)\s+REFERENCES\s+"(\w+)"/g,
      ),
    ].map((m) => ({ from: `${m[1]}.${m[2]}`, to: m[3] }));
  });

describe('isGuestEmail', () => {
  it('nhận đúng email do guest() sinh', () => {
    expect(isGuestEmail(`guest_${randomUUID()}@guest.local`)).toBe(true);
  });

  it.each([
    'abc@guest.local',
    'guest_x@guest.local',
    `guest_${randomUUID()}@guest.local.vn`,
    `xguest_${randomUUID()}@guest.local`,
    `guest_${randomUUID().toUpperCase()}@guest.local`,
  ])('từ chối %s', (email) => {
    expect(isGuestEmail(email)).toBe(false);
  });
});

describe('selectStaleGuests', () => {
  it('khách mồ côi, rỗng, quá 30 ngày thì xoá', () => {
    expect(reasonOf(guest())).toBe('xoa');
  });

  it('email đúng định dạng nhưng có mật khẩu hoặc OAuth là người thật — không xoá', () => {
    expect(reasonOf(guest({ password: 'scrypt:32768:8:1$abc$def' }))).toBe(
      'khong-phai-khach',
    );
    expect(reasonOf(guest({ oauthProvider: 'google' }))).toBe(
      'khong-phai-khach',
    );
    expect(reasonOf(guest({ email: 'abc@guest.local' }))).toBe(
      'khong-phai-khach',
    );
  });

  it('còn phiên refresh sống thì không xoá, dù tạo đã lâu', () => {
    expect(reasonOf(guest({ liveSessions: 1 }))).toBe('con-phien');
  });

  it('ranh giới: đúng 30 ngày thì giữ, quá 30 ngày thì xoá', () => {
    expect(reasonOf(guest({ createdAt: daysAgo(30) }))).toBe('moi-hoat-dong');
    expect(
      reasonOf(guest({ createdAt: new Date(daysAgo(30).getTime() - 1) })),
    ).toBe('xoa');
  });

  it('mốc hoạt động lấy mốc MUỘN NHẤT, không phải created_at', () => {
    const c = guest({
      createdAt: daysAgo(200),
      progressCount: 3,
      xp: 60,
      lastProgressAt: daysAgo(1),
      lastStudyDate: daysAgo(100),
    });
    expect(lastActivity(c)).toEqual(daysAgo(1));
    expect(reasonOf(c, { ...OPTS, includeWithProgress: true })).toBe(
      'moi-hoat-dong',
    );
    expect(reasonOf(guest({ lastXpLogDate: daysAgo(2) }))).toBe(
      'moi-hoat-dong',
    );
  });

  it('khách đã học chỉ bị xoá khi bật includeWithProgress', () => {
    const learned = guest({
      progressCount: 2,
      xp: 40,
      lastProgressAt: daysAgo(60),
    });
    expect(reasonOf(learned)).toBe('co-tien-do');
    expect(reasonOf(guest({ xp: 10 }))).toBe('co-tien-do');
    expect(reasonOf(learned, { ...OPTS, includeWithProgress: true })).toBe(
      'xoa',
    );
  });

  it('chính sách 30/180: khách đã học giữ 180 ngày kể từ lần học cuối, khách chưa học 30 ngày', () => {
    const policy = { ...OPTS, progressOlderThanDays: 180 };
    const learned = (ago: number) =>
      guest({
        createdAt: daysAgo(400),
        progressCount: 2,
        xp: 40,
        lastProgressAt: daysAgo(ago),
      });
    expect(reasonOf(guest({ createdAt: daysAgo(31) }), policy)).toBe('xoa');
    expect(reasonOf(guest({ createdAt: daysAgo(29) }), policy)).toBe(
      'moi-hoat-dong',
    );
    // 100 ngày: qua mốc 30 nhưng chưa tới mốc 180 của người đã học.
    expect(reasonOf(learned(100), policy)).toBe('moi-hoat-dong');
    expect(reasonOf(learned(181), policy)).toBe('xoa');
    // Không truyền mốc thì vẫn giữ nguyên hành vi cũ: khách đã học không bị đụng.
    expect(reasonOf(learned(181))).toBe('co-tien-do');
    // Mốc 180 không mở đường cho người thật, khách còn phiên hay khách có bài viết.
    expect(reasonOf({ ...learned(181), password: 'scrypt:x' }, policy)).toBe(
      'khong-phai-khach',
    );
    expect(reasonOf({ ...learned(181), liveSessions: 1 }, policy)).toBe(
      'con-phien',
    );
    expect(reasonOf({ ...learned(181), posts: 1 }, policy)).toBe('co-bai-viet');
  });

  it('có bài viết/bình luận hoặc là giảng viên thì bỏ qua, kể cả khi bật includeWithProgress', () => {
    const all = { ...OPTS, includeWithProgress: true };
    expect(reasonOf(guest({ posts: 1 }), all)).toBe('co-bai-viet');
    expect(reasonOf(guest({ comments: 2 }), all)).toBe('co-bai-viet');
    expect(reasonOf(guest({ instructedCourses: 1 }), all)).toBe(
      'la-giang-vien',
    );
  });

  it('chia đúng một danh sách lẫn lộn', () => {
    const sel = selectStaleGuests(
      [guest({ id: 1 }), guest({ id: 2, liveSessions: 1 }), guest({ id: 3 })],
      OPTS,
    );
    expect(sel.toDelete.map((c) => c.id)).toEqual([1, 3]);
    expect(sel.skipped).toEqual([{ id: 2, reason: 'con-phien' }]);
  });
});

describe('parseProgressOlderThan', () => {
  it('thiếu cờ → undefined, có cờ → số ngày, sai → ném lỗi', () => {
    expect(parseProgressOlderThan([])).toBeUndefined();
    expect(parseProgressOlderThan(['--progress-older-than=180d'])).toBe(180);
    expect(() => parseProgressOlderThan(['--progress-older-than=0d'])).toThrow(
      '--progress-older-than',
    );
    expect(() =>
      parseProgressOlderThan(['--progress-older-than=180']),
    ).toThrow();
  });
});

describe('parseOlderThan', () => {
  it('mặc định 30, đọc được --older-than=7d', () => {
    expect(parseOlderThan([])).toBe(30);
    expect(parseOlderThan(['--older-than=7d'])).toBe(7);
  });

  it.each(['30', '0d', '-1d', '1.5d', 'abc'])(
    'từ chối --older-than=%s',
    (v) => {
      expect(() => parseOlderThan([`--older-than=${v}`])).toThrow(
        '--older-than',
      );
    },
  );
});

describe('danh sách khoá ngoại tới users', () => {
  const userRefs = FKS.filter((fk) => fk.to === 'users').map((fk) => fk.from);

  it('đọc được migration (nếu không, các ca dưới đạt vô nghĩa)', () => {
    expect(userRefs.length).toBeGreaterThanOrEqual(20);
  });

  it('mọi khoá ngoại tới users đều nằm trong DELETE_ORDER, CASCADE_REFS hoặc GUARDED_REFS', () => {
    // Thêm bảng trỏ vào users mà quên thêm vào đây thì DELETE users sẽ vỡ giữa chừng.
    expect(unknownUserRefs(userRefs)).toEqual([]);
  });

  it('ba danh sách không chồng nhau và không có ref thừa', () => {
    const all = [...DELETE_ORDER, ...CASCADE_REFS, ...GUARDED_REFS];
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((r) => !userRefs.includes(r))).toEqual([]);
  });

  it('DELETE_ORDER xoá bảng con trước bảng cha', () => {
    const tables = DELETE_ORDER.map((r) => splitRef(r)[0]);
    const firstIndex = (t: string) => tables.indexOf(t);
    const lastIndex = (t: string) => tables.lastIndexOf(t);
    const wrong = FKS.filter((fk) => {
      const child = splitRef(fk.from)[0];
      return (
        tables.includes(child) &&
        tables.includes(fk.to) &&
        lastIndex(child) > firstIndex(fk.to)
      );
    });
    expect(wrong).toEqual([]);
  });

  it('unknownUserRefs báo bảng chưa khai', () => {
    expect(
      unknownUserRefs(['posts.user_id', 'django_admin_log.user_id']),
    ).toEqual(['django_admin_log.user_id']);
  });
});
