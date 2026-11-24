/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion -- Prisma giả trong test */
/**
 * Test service với Prisma GIẢ trong bộ nhớ (không DB). Fake chỉ hỗ trợ các
 * truy vấn mà ArenaService dùng.
 */
import { NotFoundException } from '@nestjs/common';
import {
  ArenaGraderService,
  MAX_QUEUE,
  TOTAL_TIMEOUT_MS,
  type GradeResult,
} from './arena-grader.service';
import { ArenaHttpError } from './arena.errors';
import { ArenaService, PENDING_GRACE_MS } from './arena.service';
import { getProblem, PROBLEMS, totalTests } from './problems';

type Row = Record<string, any>;

const eq = (a: any, b: any) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : a === b;

function cmp(v: any, cond: any): boolean {
  if (cond === null) return v === null || v === undefined;
  if (cond instanceof Date || typeof cond !== 'object') return eq(v, cond);
  return Object.entries(cond).every(([op, x]: [string, any]) => {
    const n = (d: any) => (d instanceof Date ? d.getTime() : d);
    switch (op) {
      case 'in':
        return x.some((y: any) => eq(v, y));
      case 'not':
        return x === null ? v !== null && v !== undefined : !eq(v, x);
      case 'lt':
        return n(v) < n(x);
      case 'lte':
        return n(v) <= n(x);
      case 'gt':
        return n(v) > n(x);
      case 'gte':
        return n(v) >= n(x);
      case 'equals':
        return eq(v, x);
      default:
        throw new Error('fake: toán tử chưa hỗ trợ ' + op);
    }
  });
}

function matches(row: Row, where?: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (cond as Row[]).every((w) => matches(row, w));
    if (k === 'NOT') {
      const arr = Array.isArray(cond) ? cond : [cond];
      return !arr.some((w: Row) => matches(row, w));
    }
    return cmp(row[k], cond);
  });
}

class Table {
  rows: Row[] = [];
  seq = 0;
  constructor(
    private readonly db: FakePrisma,
    private readonly includes: Record<string, (r: Row) => any> = {},
  ) {}

  private shape(r: Row, args?: Row): Row {
    let out: Row = { ...r };
    if (args?.include) {
      for (const k of Object.keys(args.include)) {
        out[k] = this.includes[k](r);
      }
    }
    if (args?.select) {
      const sel: Row = {};
      for (const k of Object.keys(args.select)) {
        sel[k] = k in this.includes ? this.includes[k](r) : r[k];
      }
      out = sel;
    }
    return out;
  }

  private sorted(rows: Row[], orderBy?: Row | Row[]) {
    if (!orderBy) return rows;
    const list = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [f, dir] = Object.entries(o)[0] as [string, string];
        const av = a[f] instanceof Date ? a[f].getTime() : a[f];
        const bv = b[f] instanceof Date ? b[f].getTime() : b[f];
        if (av === bv) continue;
        return (av < bv ? -1 : 1) * (dir === 'desc' ? -1 : 1);
      }
      return 0;
    });
  }

  async findUnique(args: Row) {
    const r = this.rows.find((x) => matches(x, args.where));
    return r ? this.shape(r, args) : null;
  }
  async findFirst(args: Row = {}) {
    const r = this.sorted(
      this.rows.filter((x) => matches(x, args.where)),
      args.orderBy,
    )[0];
    return r ? this.shape(r, args) : null;
  }
  async findMany(args: Row = {}) {
    let r = this.sorted(
      this.rows.filter((x) => matches(x, args.where)),
      args.orderBy,
    );
    if (args.take) r = r.slice(0, args.take);
    return r.map((x) => this.shape(x, args));
  }
  async count(args: Row = {}) {
    return this.rows.filter((x) => matches(x, args.where)).length;
  }
  async create(args: Row) {
    const row: Row = { ...args.data };
    if (!('id' in row) && this.autoId) row.id = ++this.seq;
    for (const [k, v] of Object.entries(this.defaults)) {
      if (row[k] === undefined) row[k] = typeof v === 'function' ? v() : v;
    }
    this.rows.push(row);
    return this.shape(row, args);
  }
  private apply(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      if (
        v &&
        typeof v === 'object' &&
        !(v instanceof Date) &&
        'increment' in v
      ) {
        row[k] = (row[k] ?? 0) + (v as Row).increment;
      } else row[k] = v;
    }
  }
  async update(args: Row) {
    const r = this.rows.find((x) => matches(x, args.where));
    if (!r) throw new Error('fake: update không thấy hàng');
    this.apply(r, args.data);
    return this.shape(r, args);
  }
  async updateMany(args: Row) {
    const hit = this.rows.filter((x) => matches(x, args.where));
    hit.forEach((r) => this.apply(r, args.data));
    return { count: hit.length };
  }
  async deleteMany(args: Row) {
    const keep = this.rows.filter((x) => !matches(x, args.where));
    const count = this.rows.length - keep.length;
    this.rows = keep;
    return { count };
  }
  async upsert(args: Row) {
    const r = this.rows.find((x) => matches(x, args.where));
    if (r) {
      this.apply(r, args.update);
      return r;
    }
    return this.create({ data: args.create });
  }
  autoId = true;
  defaults: Row = {};
}

class FakePrisma {
  users: Row[] = [
    { id: 1, name: 'Alice', xp: 0 },
    { id: 2, name: 'Bob', xp: 0 },
    { id: 3, name: 'Carol', xp: 0 },
  ];
  private u = (id: any) => {
    const x = this.users.find((y) => y.id === id);
    return x ? { id: x.id, name: x.name } : null;
  };
  arenaMatch = new Table(this, {
    host: (r) => this.u(r.hostId),
    guest: (r) => (r.guestId ? this.u(r.guestId) : null),
  });
  arenaSubmission = new Table(this);
  arenaRating = new Table(this, { user: (r) => this.u(r.userId) });
  userDailyXpLog = new Table(this);
  user = {
    update: async (args: Row) => {
      const x = this.users.find((y) => y.id === args.where.id)!;
      x.xp += args.data.xp.increment;
      return x;
    },
  };
  raw: unknown[][] = [];

  constructor() {
    this.arenaMatch.defaults = {
      isPublic: false,
      status: 'waiting',
      guestId: null,
      winnerId: null,
      endReason: null,
      hostRatingDelta: null,
      guestRatingDelta: null,
      hostXp: null,
      guestXp: null,
      createdAt: () => new Date(),
      startedAt: null,
      deadlineAt: null,
      finishedAt: null,
    };
    this.arenaSubmission.defaults = {
      passed: 0,
      total: 0,
      detail: null,
      message: null,
      createdAt: () => new Date(),
      gradedAt: null,
    };
    this.arenaRating.autoId = false;
    this.arenaRating.defaults = { rating: 1000, wins: 0, losses: 0, draws: 0 };
  }
  $executeRaw = async (...a: unknown[]) => {
    this.raw.push(a);
    return 1;
  };
  $transaction = async (fn: (tx: FakePrisma) => Promise<unknown>) => fn(this);
}

const perfect = (
  total: number,
  p = getProblem('sum-of-evens')!,
): GradeResult => ({
  status: 'graded',
  message: null,
  passed: total,
  total,
  publicResults: p.publicTests.map((_, index) => ({
    index,
    passed: true,
    got: '1',
  })),
  hiddenPassed: p.hiddenTests.length,
  hiddenTotal: p.hiddenTests.length,
});

describe('ArenaService (Prisma giả)', () => {
  let db: FakePrisma;
  let grader: { assertAvailable: jest.Mock; grade: jest.Mock };
  let svc: ArenaService;
  const evens = getProblem('sum-of-evens')!;

  beforeEach(() => {
    db = new FakePrisma();
    grader = { assertAvailable: jest.fn(), grade: jest.fn() };
    svc = new ArenaService(db as any, grader as unknown as ArenaGraderService);
  });

  async function startMatch(problemId = 'sum-of-evens') {
    const room = await svc.createRoom(1, problemId);
    const joined = await svc.joinRoom(2, room.match.code.toLowerCase());
    return joined.match.id;
  }
  const code = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      return (e as ArenaHttpError).arenaCode ?? (e as any).getResponse?.().code;
    }
    throw new Error('mong đợi lỗi nhưng không có');
  };
  /** Lùi mọi mốc thời gian của trận để giả lập đã quá hạn. */
  const expire = (id: number) => {
    const m = db.arenaMatch.rows.find((r) => r.id === id)!;
    m.deadlineAt = new Date(Date.now() - 60_000);
    m.startedAt = new Date(Date.now() - 700_000);
  };

  /** Cho `userId` một bài graded passed>=1 và lùi startedAt để forfeit được tính điểm. */
  const armForfeit = (id: number, userId: number) => {
    db.arenaMatch.rows.find((r) => r.id === id)!.startedAt = new Date(
      Date.now() - 120_000,
    );
    db.arenaSubmission.rows.push({
      id: 900 + db.arenaSubmission.rows.length,
      matchId: id,
      userId,
      status: 'graded',
      passed: 1,
      total: 10,
      createdAt: new Date(Date.now() - 60_000),
      gradedAt: new Date(),
    });
  };

  describe('phòng riêng và hàng đợi', () => {
    it('tạo phòng: waiting, có mã hợp lệ, không có đề', async () => {
      const r = await svc.createRoom(1);
      expect(r.ok).toBe(true);
      expect(r.match.status).toBe('waiting');
      expect(r.match.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(r.match.problem).toBeNull();
      expect(r.match.opponent).toBeNull();
      expect(r.match.role).toBe('host');
      expect(db.raw.length).toBeGreaterThan(0); // đã lấy khoá tư vấn
    });

    it('problemId lạ -> 400; không có -> chọn ngẫu nhiên trong danh sách', async () => {
      await expect(svc.createRoom(1, 'khong-co')).rejects.toMatchObject({
        status: 400,
      });
      await svc.createRoom(1);
      const m = db.arenaMatch.rows[0];
      expect(PROBLEMS.map((p) => p.id)).toContain(m.problemId);
    });

    it('một người một trận: tạo lần hai -> ALREADY_IN_MATCH', async () => {
      await svc.createRoom(1);
      expect(await code(() => svc.createRoom(1))).toBe('ALREADY_IN_MATCH');
      expect(await code(() => svc.queue(1).then(() => undefined))).toBe(
        'ALREADY_IN_MATCH',
      );
    });

    it('vào phòng: active, deadline = start + durationSec, có đề, không test ẩn', async () => {
      const room = await svc.createRoom(1, 'sum-of-evens');
      const j = await svc.joinRoom(2, room.match.code);
      expect(j.match.status).toBe('active');
      expect(j.match.role).toBe('guest');
      const start = Date.parse(j.match.startedAt!);
      expect(Date.parse(j.match.deadlineAt!) - start).toBe(600_000);
      expect(j.match.problem?.examples).toHaveLength(3);
      expect(j.match.problem?.testCount).toBe(10);
      expect(j.match.opponent?.name).toBe('Alice');
    });

    it('vào phòng của chính mình / mã sai / đã đủ người / sai định dạng', async () => {
      const room = await svc.createRoom(1);
      expect(await code(() => svc.joinRoom(1, room.match.code))).toBe(
        'CANNOT_JOIN_OWN_ROOM',
      );
      expect(await code(() => svc.joinRoom(2, 'ZZZZZZ'))).toBe(
        'ROOM_NOT_FOUND',
      );
      await svc.joinRoom(2, room.match.code);
      expect(await code(() => svc.joinRoom(3, room.match.code))).toBe(
        'ROOM_NOT_FOUND',
      );
      await expect(svc.joinRoom(3, 'abc')).rejects.toMatchObject({
        status: 400,
      });
      await expect(svc.joinRoom(3, 'AB!DEF')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('người đang trong trận khác không vào được phòng', async () => {
      const a = await svc.createRoom(1);
      await svc.createRoom(3);
      await svc.joinRoom(2, a.match.code);
      const c = db.arenaMatch.rows.find((r) => r.hostId === 3)!;
      expect(await code(() => svc.joinRoom(2, c.code))).toBe(
        'ALREADY_IN_MATCH',
      );
    });

    it('phòng riêng hết hạn 10 phút -> bị huỷ lười, không vào được', async () => {
      const room = await svc.createRoom(1);
      db.arenaMatch.rows[0].createdAt = new Date(Date.now() - 11 * 60_000);
      expect(await code(() => svc.joinRoom(2, room.match.code))).toBe(
        'ROOM_NOT_FOUND',
      );
      expect(db.arenaMatch.rows[0].status).toBe('cancelled');
    });

    it('queue: người 1 chờ (idempotent), người 2 ghép -> active', async () => {
      const a = await svc.queue(1);
      expect(a.queueStatus).toBe('waiting');
      expect(a.match.isPublic).toBe(true);
      const again = await svc.queue(1);
      expect(again.match.id).toBe(a.match.id);
      expect(db.arenaMatch.rows).toHaveLength(1);
      const b = await svc.queue(2);
      expect(b.queueStatus).toBe('matched');
      expect(b.match.id).toBe(a.match.id);
      expect(b.match.status).toBe('active');
      expect(await code(() => svc.queue(1).then(() => undefined))).toBe(
        'ALREADY_IN_MATCH',
      );
    });

    it('trận hàng đợi không vào được bằng mã; hàng đợi quá 2 phút bị bỏ qua', async () => {
      const a = await svc.queue(1);
      expect(await code(() => svc.joinRoom(2, a.match.code))).toBe(
        'ROOM_NOT_FOUND',
      );
      db.arenaMatch.rows[0].createdAt = new Date(Date.now() - 3 * 60_000);
      const b = await svc.queue(2);
      expect(b.queueStatus).toBe('waiting');
      expect(db.arenaMatch.rows[0].status).toBe('cancelled');
    });

    it('cancel: chủ phòng huỷ được (idempotent); trận active -> MATCH_NOT_WAITING', async () => {
      const room = await svc.createRoom(1);
      const c = await svc.cancel(1, room.match.id);
      expect(c.match.status).toBe('cancelled');
      expect((await svc.cancel(1, room.match.id)).match.status).toBe(
        'cancelled',
      );
      const id = await startMatch();
      expect(await code(() => svc.cancel(1, id))).toBe('MATCH_NOT_WAITING');
      expect(await code(() => svc.cancel(3, id))).toBe('MATCH_NOT_FOUND');
    });

    it('getCurrent: trận đang dở; null khi không có', async () => {
      expect((await svc.getCurrent(1)).match).toBeNull();
      const room = await svc.createRoom(1);
      const cur = await svc.getCurrent(1);
      expect(cur.match?.id).toBe(room.match.id);
      await svc.cancel(1, room.match.id);
      expect((await svc.getCurrent(1)).match).toBeNull();
    });
  });

  describe('quyền truy cập', () => {
    it('người ngoài trận nhận MATCH_NOT_FOUND ở mọi route theo id', async () => {
      const id = await startMatch();
      expect(await code(() => svc.getMatch(3, id))).toBe('MATCH_NOT_FOUND');
      expect(await code(() => svc.listSubmissions(3, id))).toBe(
        'MATCH_NOT_FOUND',
      );
      expect(await code(() => svc.forfeit(3, id))).toBe('MATCH_NOT_FOUND');
      expect(await code(() => svc.submit(3, id, 'x = 1'))).toBe(
        'MATCH_NOT_FOUND',
      );
      expect(await code(() => svc.getMatch(1, 99999))).toBe('MATCH_NOT_FOUND');
      expect(await code(() => svc.getMatch(1, 2 ** 40))).toBe(
        'MATCH_NOT_FOUND',
      );
    });
  });

  describe('kết thúc trận', () => {
    it('hết giờ: bên nhiều test đạt hơn thắng, rating/XP/thống kê đúng, idempotent', async () => {
      const id = await startMatch();
      const t0 = Date.now() - 300_000;
      db.arenaSubmission.rows.push(
        {
          id: 1,
          matchId: id,
          userId: 1,
          status: 'graded',
          passed: 3,
          total: 10,
          createdAt: new Date(t0),
          gradedAt: new Date(t0),
        },
        {
          id: 2,
          matchId: id,
          userId: 2,
          status: 'graded',
          passed: 6,
          total: 10,
          createdAt: new Date(t0),
          gradedAt: new Date(t0),
        },
      );
      db.arenaSubmission.seq = 2;
      expire(id);
      const r = await svc.getMatch(1, id);
      expect(r.match.status).toBe('finished');
      expect(r.match.result).toMatchObject({
        winnerId: 2,
        isDraw: false,
        endReason: 'timeout',
        myRatingDelta: -16,
        opponentRatingDelta: 16,
        myXp: 10,
        myBestPassed: 3,
        opponentBestPassed: 6,
      });
      const again = await svc.getMatch(2, id);
      expect(again.match.result).toMatchObject({
        winnerId: 2,
        myXp: 50,
        myRatingDelta: 16,
      });
      const rat = (u: number) =>
        db.arenaRating.rows.find((x) => x.userId === u)!;
      expect(rat(1)).toMatchObject({
        rating: 984,
        wins: 0,
        losses: 1,
        draws: 0,
      });
      expect(rat(2)).toMatchObject({ rating: 1016, wins: 1, losses: 0 });
      expect(db.users.find((u) => u.id === 2)!.xp).toBe(50);
      expect(db.users.find((u) => u.id === 1)!.xp).toBe(10);
      expect(db.userDailyXpLog.rows).toHaveLength(2);
      // gọi thêm lần nữa không cộng lần hai
      await svc.getMatch(1, id);
      await svc.getCurrent(1);
      expect(rat(2).rating).toBe(1016);
      expect(db.users.find((u) => u.id === 2)!.xp).toBe(50);
    });

    it('hết giờ, không ai nộp -> hoà, không đổi rating/XP/thống kê', async () => {
      const id = await startMatch();
      expire(id);
      const r = await svc.getCurrent(1);
      expect(r.match).toBeNull();
      const m = await svc.getMatch(1, id);
      expect(m.match.result).toMatchObject({
        isDraw: true,
        winnerId: null,
        myRatingDelta: 0,
        myXp: 0,
      });
      expect(db.arenaRating.rows).toHaveLength(0);
      expect(db.users.every((u) => u.xp === 0)).toBe(true);
    });

    it('bằng điểm: nộp sớm hơn thắng; lần nộp sau hạn không tính', async () => {
      const id = await startMatch();
      const now = Date.now();
      db.arenaSubmission.rows.push(
        {
          id: 1,
          matchId: id,
          userId: 1,
          status: 'graded',
          passed: 4,
          total: 10,
          createdAt: new Date(now - 200_000),
          gradedAt: new Date(),
        },
        {
          id: 2,
          matchId: id,
          userId: 2,
          status: 'graded',
          passed: 4,
          total: 10,
          createdAt: new Date(now - 100_000),
          gradedAt: new Date(),
        },
        {
          id: 3,
          matchId: id,
          userId: 2,
          status: 'graded',
          passed: 9,
          total: 10,
          createdAt: new Date(now + 5_000),
          gradedAt: new Date(),
        },
      );
      expire(id);
      const m = await svc.getMatch(2, id);
      expect(m.match.result?.winnerId).toBe(1);
      expect(m.match.result?.opponentBestPassed).toBe(4);
    });

    it('bài đang chấm dở (nhận trước hạn) -> chưa chốt hết giờ', async () => {
      const id = await startMatch();
      db.arenaSubmission.rows.push({
        id: 1,
        matchId: id,
        userId: 1,
        status: 'error',
        passed: 0,
        total: 10,
        createdAt: new Date(Date.now() - 12_000),
        gradedAt: null,
      });
      db.arenaMatch.rows.find((r) => r.id === id)!.deadlineAt = new Date(
        Date.now() - 10_000,
      );
      const m = await svc.getMatch(1, id);
      expect(m.match.status).toBe('active');
      // quá thời gian chờ chấm -> chốt
      db.arenaSubmission.rows[0].createdAt = new Date(
        Date.now() - PENDING_GRACE_MS - 20_000,
      );
      db.arenaMatch.rows.find((r) => r.id === id)!.deadlineAt = new Date(
        Date.now() - PENDING_GRACE_MS - 10_000,
      );
      expect((await svc.getMatch(1, id)).match.status).toBe('finished');
    });

    it('đầu hàng: đối thủ thắng, endReason=forfeit; gọi lại idempotent', async () => {
      const id = await startMatch();
      armForfeit(id, 2);
      const r = await svc.forfeit(1, id);
      expect(r.match.status).toBe('finished');
      expect(r.match.result).toMatchObject({
        winnerId: 2,
        endReason: 'forfeit',
        myRatingDelta: -16,
      });
      const again = await svc.forfeit(1, id);
      expect(again.match.status).toBe('finished');
      expect(db.arenaRating.rows.find((x) => x.userId === 2)!.wins).toBe(1);
    });

    it('đầu hàng sớm hoặc người thắng chưa có bài: có winner nhưng không tính điểm', async () => {
      const id = await startMatch();
      armForfeit(id, 2);
      db.arenaMatch.rows.find((r) => r.id === id)!.startedAt = new Date(
        Date.now() - 10_000,
      );
      const r = await svc.forfeit(1, id);
      expect(r.match.status).toBe('finished');
      expect(r.match.result).toMatchObject({
        winnerId: 2,
        endReason: 'forfeit',
        myRatingDelta: 0,
      });
      expect(db.arenaRating.rows).toHaveLength(0);
      const row = db.arenaMatch.rows.find((x) => x.id === id)!;
      expect([row.hostXp, row.guestXp, row.hostRatingDelta]).toEqual([0, 0, 0]);

      const id2 = await startMatch(); // không bài nào, đã đủ 60 s
      db.arenaMatch.rows.find((x) => x.id === id2)!.startedAt = new Date(
        Date.now() - 120_000,
      );
      await svc.forfeit(2, id2);
      const row2 = db.arenaMatch.rows.find((x) => x.id === id2)!;
      expect(row2.winnerId).toBe(1);
      expect(db.arenaRating.rows).toHaveLength(0);
      expect(row2.hostXp).toBe(0);
    });

    it('đầu hàng khi waiting -> MATCH_NOT_ACTIVE', async () => {
      const room = await svc.createRoom(1);
      expect(await code(() => svc.forfeit(1, room.match.id))).toBe(
        'MATCH_NOT_ACTIVE',
      );
    });

    it('hai finish song song: chỉ một lần cập nhật rating', async () => {
      const id = await startMatch();
      armForfeit(id, 2);
      const [a, b] = await Promise.all([
        svc.finish(id, 'forfeit', { forfeiterId: 1 }),
        svc.finish(id, 'forfeit', { forfeiterId: 1 }),
      ]);
      expect([a, b].filter(Boolean)).toHaveLength(1);
      expect(db.arenaRating.rows.find((x) => x.userId === 2)!.wins).toBe(1);
    });
  });

  describe('nộp bài', () => {
    it('đạt 100% -> thắng ngay (solved); trả submission + match đã finished', async () => {
      const id = await startMatch();
      grader.grade.mockResolvedValue(perfect(10));
      const r = await svc.submit(2, id, 'def solve(nums): return 0');
      expect(grader.grade).toHaveBeenCalledWith(
        'def solve(nums): return 0',
        evens,
      );
      expect(r.submission).toMatchObject({
        status: 'graded',
        passed: 10,
        total: 10,
        hiddenPassed: 7,
        hiddenTotal: 7,
      });
      expect(r.match.status).toBe('finished');
      expect(r.match.result).toMatchObject({
        winnerId: 2,
        endReason: 'solved',
        myXp: 50,
        myRatingDelta: 16,
      });
      expect(await code(() => svc.submit(1, id, 'x = 1'))).toBe(
        'MATCH_NOT_ACTIVE',
      );
    });

    it('một phần: trận vẫn active, đếm số lần nộp và bài tốt nhất', async () => {
      const id = await startMatch();
      grader.grade.mockResolvedValue({ ...perfect(10), passed: 4 });
      const r = await svc.submit(1, id, 'def solve(nums): return 0');
      expect(r.match.status).toBe('active');
      expect(r.match.mySubmissionCount).toBe(1);
      expect(r.match.myBestPassed).toBe(4);
      const other = await svc.getMatch(2, id);
      expect(other.match.opponent).toMatchObject({
        submissionCount: 1,
        bestPassed: 4,
      });
    });

    it('cách nhau < 10 s -> SUBMIT_TOO_FAST kèm retryAfterSec', async () => {
      const id = await startMatch();
      grader.grade.mockResolvedValue({ ...perfect(10), passed: 1 });
      await svc.submit(1, id, 'a = 1');
      let err: ArenaHttpError | undefined;
      try {
        await svc.submit(1, id, 'a = 2');
      } catch (e) {
        err = e as ArenaHttpError;
      }
      expect(err?.arenaCode).toBe('SUBMIT_TOO_FAST');
      expect(err?.getStatus()).toBe(429);
      expect(err?.retryAfterSec).toBeGreaterThan(0);
      expect(err!.retryAfterSec).toBeLessThanOrEqual(10);
      expect(grader.grade).toHaveBeenCalledTimes(1);
    });

    it('tối đa 10 lần/trận -> SUBMIT_LIMIT (kể cả rejected)', async () => {
      const id = await startMatch();
      grader.grade.mockResolvedValue({
        status: 'rejected',
        message: 'x',
        passed: 0,
        total: 10,
        publicResults: [],
        hiddenPassed: 0,
        hiddenTotal: 7,
      });
      for (let i = 0; i < 10; i++) {
        await svc.submit(1, id, `a = ${i}`);
        db.arenaSubmission.rows.forEach((r) => {
          r.createdAt = new Date(r.createdAt.getTime() - 20_000);
        });
      }
      expect(await code(() => svc.submit(1, id, 'a = 11'))).toBe(
        'SUBMIT_LIMIT',
      );
    });

    it('nộp sau hạn -> chốt hết giờ rồi MATCH_NOT_ACTIVE', async () => {
      const id = await startMatch();
      expire(id);
      expect(await code(() => svc.submit(1, id, 'a = 1'))).toBe(
        'MATCH_NOT_ACTIVE',
      );
      expect(db.arenaMatch.rows[0].status).toBe('finished');
      expect(grader.grade).not.toHaveBeenCalled();
    });

    it('BE-2: trận bị chốt xen giữa kiểm tra và chèn bài -> 409, không chấm', async () => {
      const id = await startMatch();
      // Giả lập finish() chen vào ngay trước giao dịch chèn bài.
      const orig = db.$transaction.bind(db);
      let first = true;
      db.$transaction = async (fn: any) => {
        if (first) {
          first = false;
          db.arenaMatch.rows.find((r) => r.id === id)!.status = 'finished';
        }
        return orig(fn);
      };
      expect(await code(() => svc.submit(1, id, 'a = 1'))).toBe(
        'MATCH_NOT_ACTIVE',
      );
      expect(db.arenaSubmission.rows).toHaveLength(0);
      expect(grader.grade).not.toHaveBeenCalled();
    });

    it('BE-2: quá hạn ngay trong giao dịch chèn bài -> 409', async () => {
      const id = await startMatch();
      const orig = db.$transaction.bind(db);
      db.$transaction = async (fn: any) => {
        db.arenaMatch.rows.find((r) => r.id === id)!.deadlineAt = new Date(
          Date.now() - 1,
        );
        return orig(fn);
      };
      expect(await code(() => svc.submit(1, id, 'a = 1'))).toBe(
        'MATCH_NOT_ACTIVE',
      );
      expect(grader.grade).not.toHaveBeenCalled();
    });

    it('nộp khi waiting -> MATCH_NOT_ACTIVE', async () => {
      const room = await svc.createRoom(1);
      expect(await code(() => svc.submit(1, room.match.id, 'a = 1'))).toBe(
        'MATCH_NOT_ACTIVE',
      );
    });

    it('grader bận -> lỗi 503 và KHÔNG tính vào giới hạn nộp', async () => {
      const id = await startMatch();
      grader.grade.mockRejectedValueOnce(
        new ArenaHttpError(503, 'GRADER_BUSY', 'bận'),
      );
      expect(await code(() => svc.submit(1, id, 'a = 1'))).toBe('GRADER_BUSY');
      expect(db.arenaSubmission.rows).toHaveLength(0);
      grader.assertAvailable.mockImplementationOnce(() => {
        throw new ArenaHttpError(503, 'GRADER_DISABLED', 'tắt');
      });
      expect(await code(() => svc.submit(1, id, 'a = 1'))).toBe(
        'GRADER_DISABLED',
      );
    });

    it('lỗi bất ngờ của grader -> submission error, không sập', async () => {
      const id = await startMatch();
      grader.grade.mockRejectedValueOnce(new Error('boom'));
      const r = await svc.submit(1, id, 'a = 1');
      expect(r.submission.status).toBe('error');
      expect(r.match.status).toBe('active');
    });

    it('createdAt của submission = lúc nhận request (trước khi chấm)', async () => {
      const id = await startMatch();
      let during: Date | undefined;
      grader.grade.mockImplementation(async () => {
        during = db.arenaSubmission.rows[0].createdAt;
        await new Promise((r) => setTimeout(r, 30));
        return { ...perfect(10), passed: 2 };
      });
      const before = Date.now();
      const r = await svc.submit(1, id, 'a = 1');
      expect(during!.getTime()).toBeGreaterThanOrEqual(before);
      expect(Date.parse(r.submission.createdAt)).toBe(during!.getTime());
      expect(db.arenaSubmission.rows[0].gradedAt.getTime()).toBeGreaterThan(
        during!.getTime(),
      );
    });

    it('BE-3: listSubmissions chốt lười trận đã quá hạn', async () => {
      const id = await startMatch();
      expire(id);
      await svc.listSubmissions(1, id);
      expect(db.arenaMatch.rows.find((r) => r.id === id)!.status).toBe(
        'finished',
      );
    });

    it('BE-1: ân hạn bao được hàng đợi chấm đầy', () => {
      expect(PENDING_GRACE_MS).toBeGreaterThanOrEqual(
        (MAX_QUEUE + 1) * TOTAL_TIMEOUT_MS,
      );
    });

    it('BE-1: bài đứng cuối hàng đợi (nhận trước hạn 90 s) vẫn được chờ', async () => {
      const id = await startMatch();
      db.arenaSubmission.rows.push({
        id: 1,
        matchId: id,
        userId: 1,
        status: 'error',
        passed: 0,
        total: 10,
        createdAt: new Date(Date.now() - 100_000),
        gradedAt: null,
      });
      db.arenaMatch.rows.find((r) => r.id === id)!.deadlineAt = new Date(
        Date.now() - 90_000,
      );
      expect((await svc.getMatch(2, id)).match.status).toBe('active');
    });

    it('listSubmissions: chỉ của tôi, mới nhất trước, không có mã nguồn', async () => {
      const id = await startMatch();
      grader.grade.mockResolvedValue({ ...perfect(10), passed: 2 });
      await svc.submit(1, id, 'SECRET_MINE = 1');
      await svc.submit(2, id, 'SECRET_THEIRS = 1');
      db.arenaSubmission.rows.forEach((r) => {
        r.createdAt = new Date(r.createdAt.getTime() - 20_000);
      });
      await svc.submit(1, id, 'SECRET_MINE = 2');
      const list = await svc.listSubmissions(1, id);
      expect(list.submissions).toHaveLength(2);
      expect(list.submissions[0].id).toBeGreaterThan(list.submissions[1].id);
      const text = JSON.stringify(list);
      expect(text).not.toMatch(/SECRET_/);
      expect(text).not.toContain('"code"');
    });
  });

  describe('không rò rỉ test ẩn / đáp án / mã đối thủ', () => {
    it('mọi response không chứa test ẩn hay mã nguồn', async () => {
      const prob = getProblem('fizzbuzz')!;
      const id = await startMatch('fizzbuzz');
      grader.grade.mockResolvedValue({ ...perfect(10, prob), passed: 5 });
      const seen: unknown[] = [];
      seen.push(await svc.getMatch(1, id));
      seen.push(
        await svc.submit(1, id, '# OPP_SECRET_MARKER\ndef solve(n): return []'),
      );
      seen.push(await svc.getMatch(2, id));
      seen.push(await svc.getCurrent(2));
      seen.push(await svc.listSubmissions(1, id));
      seen.push(await svc.listSubmissions(2, id));
      expire(id);
      seen.push(await svc.getMatch(2, id)); // finished
      seen.push(await svc.history(2));
      seen.push(await svc.history(1));
      seen.push(await svc.leaderboard(1));
      seen.push(await svc.getMe(1));

      const publicStrings = new Set(
        prob.publicTests.flatMap((t) => [
          JSON.stringify(t.args),
          JSON.stringify(t.expected),
        ]),
      );
      const secrets = prob.hiddenTests
        .flatMap((t) => [JSON.stringify(t.args), JSON.stringify(t.expected)])
        .filter((s) => s.length >= 6 && !publicStrings.has(s));
      expect(secrets.length).toBeGreaterThan(5);
      for (const resp of seen) {
        const text = JSON.stringify(resp);
        for (const s of secrets) expect(text).not.toContain(s);
        expect(text).not.toContain('OPP_SECRET_MARKER');
      }
      // người chơi 2 không bao giờ thấy mã của 1
      const asTwo = JSON.stringify([seen[2], seen[3], seen[5], seen[6]]);
      expect(asTwo).not.toContain('OPP_SECRET_MARKER');
    });

    it('đề chỉ có khi active/finished', async () => {
      const room = await svc.createRoom(1, 'sum-of-evens');
      expect(room.match.problem).toBeNull();
      const j = await svc.joinRoom(2, room.match.code);
      expect(j.match.problem).not.toBeNull();
      expect(Object.keys(j.match.problem!).sort()).toEqual(
        [
          'difficulty',
          'durationSec',
          'examples',
          'id',
          'signature',
          'starterCode',
          'statement',
          'testCount',
          'title',
        ].sort(),
      );
      const p = j.match.problem!;
      expect(p.testCount).toBe(totalTests(evens));
      expect(p.examples).toEqual(evens.publicTests);
    });
  });

  describe('hồ sơ, lịch sử, bảng xếp hạng', () => {
    async function finishedFor(winner: 'host' | 'guest') {
      const id = await startMatch();
      armForfeit(id, winner === 'host' ? 1 : 2);
      await svc.forfeit(winner === 'host' ? 2 : 1, id);
      return id;
    }

    it('getMe mặc định 1000, rank null khi chưa đấu', async () => {
      expect(await svc.getMe(1)).toEqual({
        ok: true,
        rating: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        rank: null,
      });
    });

    it('sau trận: thắng/thua, hạng, lịch sử, bảng xếp hạng', async () => {
      await finishedFor('host');
      const a = await svc.getMe(1);
      const b = await svc.getMe(2);
      expect(a).toMatchObject({ rating: 1016, wins: 1, rank: 1 });
      expect(b).toMatchObject({ rating: 984, losses: 1, rank: 2 });

      const h = await svc.history(1);
      expect(h.items).toHaveLength(1);
      expect(h.items[0]).toMatchObject({
        problemTitle: 'Tổng các số chẵn',
        opponentName: 'Bob',
        outcome: 'win',
        ratingDelta: 16,
        xp: 50,
        endReason: 'forfeit',
      });
      expect(h.nextBefore).toBeNull();
      expect((await svc.history(2)).items[0]).toMatchObject({
        outcome: 'loss',
        ratingDelta: -16,
      });

      const lb = await svc.leaderboard(2);
      expect(lb.entries.map((e) => [e.id, e.rank, e.value])).toEqual([
        [1, 1, 1016],
        [2, 2, 984],
      ]);
      expect(lb.entries[1].is_me).toBe(true);
      expect(lb.me).toMatchObject({ id: 2, rank: 2 });
      expect((await svc.leaderboard(3)).me).toBeNull();
    });

    it('phân trang lịch sử bằng before/limit', async () => {
      for (let i = 0; i < 3; i++) await finishedFor('host');
      const p1 = await svc.history(1, 2);
      expect(p1.items).toHaveLength(2);
      expect(p1.nextBefore).not.toBeNull();
      const p2 = await svc.history(1, 2, p1.nextBefore!);
      expect(p2.items).toHaveLength(1);
      expect(p2.nextBefore).toBeNull();
    });
  });

  it('listProblems chỉ có metadata', () => {
    const r = svc.listProblems();
    expect(r.problems).toHaveLength(5);
    expect(Object.keys(r.problems[0]).sort()).toEqual([
      'difficulty',
      'durationSec',
      'id',
      'title',
    ]);
  });

  it('getProblemDetail trả test mẫu công khai, không lộ test ẩn', () => {
    const r = svc.getProblemDetail('fizzbuzz');
    const p = r.problem;
    const src = getProblem('fizzbuzz')!;
    expect(p.sampleTests).toEqual(src.publicTests);
    expect(p.sampleTests.length).toBeGreaterThan(0);
    expect(p.testCount).toBe(src.publicTests.length + src.hiddenTests.length);
    expect(p.testCount).toBeGreaterThan(p.sampleTests.length);
    expect(JSON.stringify(r)).not.toContain('hiddenTests');
    expect(() => svc.getProblemDetail('khong-co')).toThrow(NotFoundException);
  });
});
