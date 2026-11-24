import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { TX_OPTIONS } from 'src/common/prisma-tx.options';
import { toStudyDate } from 'src/common/streak/streak.service';
import type { Prisma } from 'src/generated/prisma';
import {
  avatarForName,
  displayNameFor,
} from 'src/leaderboard/leaderboard.helpers';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ArenaGraderService,
  MAX_QUEUE,
  TOTAL_TIMEOUT_MS,
  type GradeResult,
} from './arena-grader.service';
import {
  computeOutcome,
  DEFAULT_RATING,
  settleMatch,
  type BestSubmission,
  type EndReason,
} from './arena-scoring';
import { ArenaHttpError } from './arena.errors';
import {
  getProblem,
  PROBLEMS,
  totalTests,
  type ArenaProblem,
} from './problems';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const PRIVATE_WAIT_MS = 10 * 60_000;
export const QUEUE_WAIT_MS = 2 * 60_000;
export const SUBMIT_GAP_MS = 10_000;
export const MAX_SUBMISSIONS = 10;
/**
 * Một lần nộp chưa chấm xong trong ngần này ms vẫn được chờ trước khi chốt hết
 * giờ. Phải bao được thời gian tối đa trong hàng đợi chấm: MAX_QUEUE bài chờ +
 * 1 bài đang chạy, mỗi bài tối đa TOTAL_TIMEOUT_MS, cộng biên 10 s.
 */
export const PENDING_GRACE_MS = (MAX_QUEUE + 1) * TOTAL_TIMEOUT_MS + 10_000;
const MAX_INT4 = 2_147_483_647;

const LOCK_MATCHES = 727001;
const LOCK_SUBMIT = 727002;
const LOCK_FINISH = 727003;

const MATCH_INCLUDE = {
  host: { select: { id: true, name: true } },
  guest: { select: { id: true, name: true } },
} satisfies Prisma.ArenaMatchInclude;

type MatchRow = Prisma.ArenaMatchGetPayload<{ include: typeof MATCH_INCLUDE }>;
type Tx = Prisma.TransactionClient;

interface SubStat {
  userId: number;
  status: string;
  passed: number;
  createdAt: Date;
  id: number;
}

@Injectable()
export class ArenaService {
  private readonly logger = new Logger(ArenaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grader: ArenaGraderService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async lock(tx: Tx, key: number): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::bigint)`;
  }

  private async lockPair(tx: Tx, a: number, b: number): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${a}::int, ${b}::int)`;
  }

  private notFoundMatch(): ArenaHttpError {
    return new ArenaHttpError(
      HttpStatus.NOT_FOUND,
      'MATCH_NOT_FOUND',
      'Không tìm thấy trận',
    );
  }

  private alreadyInMatch(): ArenaHttpError {
    return new ArenaHttpError(
      HttpStatus.CONFLICT,
      'ALREADY_IN_MATCH',
      'Bạn đang ở trong một trận khác',
    );
  }

  private randomCode(): string {
    let s = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      s += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    return s;
  }

  private pickProblem(problemId?: string): ArenaProblem {
    if (problemId !== undefined && problemId !== '') {
      const p = getProblem(problemId);
      if (!p) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Đề không tồn tại',
          code: 'INVALID_PROBLEM',
        });
      }
      return p;
    }
    return PROBLEMS[randomInt(PROBLEMS.length)];
  }

  private mineWhere(userId: number): Prisma.ArenaMatchWhereInput {
    return {
      status: { in: ['waiting', 'active'] },
      OR: [{ hostId: userId }, { guestId: userId }],
    };
  }

  /** Huỷ lười mọi trận waiting đã hết hạn (gọi trong giao dịch có khoá). */
  private async expireWaiting(tx: Tx, now: Date): Promise<void> {
    await tx.arenaMatch.updateMany({
      where: {
        status: 'waiting',
        OR: [
          {
            isPublic: true,
            createdAt: { lt: new Date(now.getTime() - QUEUE_WAIT_MS) },
          },
          {
            isPublic: false,
            createdAt: { lt: new Date(now.getTime() - PRIVATE_WAIT_MS) },
          },
        ],
      },
      data: { status: 'cancelled', finishedAt: now },
    });
  }

  private waitExpired(m: { isPublic: boolean; createdAt: Date }, now: Date) {
    const limit = m.isPublic ? QUEUE_WAIT_MS : PRIVATE_WAIT_MS;
    return now.getTime() - m.createdAt.getTime() > limit;
  }

  private bestFor(subs: SubStat[], userId: number, deadline: Date | null) {
    let best: BestSubmission | null = null;
    for (const s of subs) {
      if (s.userId !== userId || s.status !== 'graded') continue;
      if (deadline && s.createdAt.getTime() > deadline.getTime()) continue;
      if (
        !best ||
        s.passed > best.passed ||
        (s.passed === best.passed &&
          (s.createdAt.getTime() < best.createdAt.getTime() ||
            (s.createdAt.getTime() === best.createdAt.getTime() &&
              s.id < best.id)))
      ) {
        best = { passed: s.passed, createdAt: s.createdAt, id: s.id };
      }
    }
    return best;
  }

  // ------------------------------------------------------- lazy settlement

  /**
   * Chốt lười, idempotent, dùng chung cho GET match / GET current / submit /
   * forfeit: huỷ phòng chờ quá hạn, chốt trận active quá hạn. Trả bản ghi mới.
   */
  async finalizeIfExpired(m: MatchRow, now = new Date()): Promise<MatchRow> {
    if (m.status === 'waiting' && this.waitExpired(m, now)) {
      await this.prisma.arenaMatch.updateMany({
        where: { id: m.id, status: 'waiting' },
        data: { status: 'cancelled', finishedAt: now },
      });
      return this.reload(m.id);
    }
    if (
      m.status === 'active' &&
      m.deadlineAt &&
      now.getTime() > m.deadlineAt.getTime()
    ) {
      await this.finish(m.id, 'timeout', {}, now);
      return this.reload(m.id);
    }
    return m;
  }

  private async reload(id: number): Promise<MatchRow> {
    const m = await this.prisma.arenaMatch.findUnique({
      where: { id },
      include: MATCH_INCLUDE,
    });
    if (!m) throw this.notFoundMatch();
    return m;
  }

  /**
   * Kết thúc trận active. Chốt bằng updateMany({status:'active'}) trong giao
   * dịch; chỉ khi count === 1 mới đổi rating/XP. Trả true nếu lần gọi này chốt.
   */
  async finish(
    matchId: number,
    reason: EndReason,
    ctx: { solverId?: number; forfeiterId?: number },
    now = new Date(),
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockPair(tx, LOCK_FINISH, matchId);
      const m = await tx.arenaMatch.findUnique({ where: { id: matchId } });
      if (!m || m.status !== 'active' || m.guestId === null || !m.deadlineAt) {
        return false;
      }
      if (reason === 'timeout') {
        // Có lần nộp nhận trước hạn mà đang chấm dở: chờ nó xong rồi mới chốt.
        const pending = await tx.arenaSubmission.count({
          where: {
            matchId,
            gradedAt: null,
            createdAt: {
              lte: m.deadlineAt,
              gt: new Date(now.getTime() - PENDING_GRACE_MS),
            },
          },
        });
        if (pending > 0) return false;
      }
      const subs = await tx.arenaSubmission.findMany({
        where: { matchId, status: 'graded' },
        select: {
          id: true,
          userId: true,
          status: true,
          passed: true,
          createdAt: true,
        },
      });
      const hostBest = this.bestFor(subs, m.hostId, m.deadlineAt);
      const guestBest = this.bestFor(subs, m.guestId, m.deadlineAt);
      const outcome = computeOutcome({
        reason,
        hostId: m.hostId,
        guestId: m.guestId,
        hostBest,
        guestBest,
        solverId: ctx.solverId,
        forfeiterId: ctx.forfeiterId,
        startedAt: m.startedAt,
        now,
      });
      const ratings = await tx.arenaRating.findMany({
        where: { userId: { in: [m.hostId, m.guestId] } },
      });
      const hostRating =
        ratings.find((r) => r.userId === m.hostId)?.rating ?? DEFAULT_RATING;
      const guestRating =
        ratings.find((r) => r.userId === m.guestId)?.rating ?? DEFAULT_RATING;
      const s = settleMatch({
        ...outcome,
        hostId: m.hostId,
        hostRating,
        guestRating,
        hostPassed: hostBest?.passed ?? 0,
        guestPassed: guestBest?.passed ?? 0,
      });

      const claimed = await tx.arenaMatch.updateMany({
        where: { id: matchId, status: 'active' },
        data: {
          status: 'finished',
          winnerId: outcome.winnerId,
          endReason: reason,
          hostRatingDelta: s.hostDelta,
          guestRatingDelta: s.guestDelta,
          hostXp: s.hostXp,
          guestXp: s.guestXp,
          finishedAt: now,
        },
      });
      if (claimed.count !== 1) return false;

      const sides = [
        {
          userId: m.hostId,
          result: s.hostResult,
          rating: s.hostNewRating,
          xp: s.hostXp,
        },
        {
          userId: m.guestId,
          result: s.guestResult,
          rating: s.guestNewRating,
          xp: s.guestXp,
        },
      ];
      for (const side of sides) {
        if (side.result !== 'none') {
          await tx.arenaRating.upsert({
            where: { userId: side.userId },
            create: {
              userId: side.userId,
              rating: side.rating,
              wins: side.result === 'win' ? 1 : 0,
              losses: side.result === 'loss' ? 1 : 0,
              draws: side.result === 'draw' ? 1 : 0,
            },
            update: {
              rating: side.rating,
              wins: { increment: side.result === 'win' ? 1 : 0 },
              losses: { increment: side.result === 'loss' ? 1 : 0 },
              draws: { increment: side.result === 'draw' ? 1 : 0 },
            },
          });
        }
        if (side.xp > 0) await this.addXp(tx, side.userId, side.xp, now);
      }
      return true;
    }, TX_OPTIONS);
  }

  /** Cộng XP vào users.xp + user_daily_xp_logs (mẫu: stats.service.ts). */
  private async addXp(tx: Tx, userId: number, xp: number, now: Date) {
    await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: xp } },
    });
    const logDate = toStudyDate(now);
    const existing = await tx.userDailyXpLog.findFirst({
      where: { userId, logDate },
    });
    if (existing) {
      await tx.userDailyXpLog.update({
        where: { id: existing.id },
        data: { xpEarned: { increment: xp } },
      });
    } else {
      await tx.userDailyXpLog.create({
        data: { userId, logDate, xpEarned: xp },
      });
    }
  }

  /** Áp chốt lười lên trận waiting/active hiện tại của người dùng (nếu có). */
  private async settleCurrent(userId: number): Promise<MatchRow | null> {
    const m = await this.prisma.arenaMatch.findFirst({
      where: this.mineWhere(userId),
      orderBy: { id: 'desc' },
      include: MATCH_INCLUDE,
    });
    if (!m) return null;
    return this.finalizeIfExpired(m);
  }

  // ----------------------------------------------------------------- views

  private async toMatchView(m: MatchRow, userId: number) {
    const isHost = m.hostId === userId;
    const opp = isHost ? m.guest : m.host;
    const meUser = isHost ? m.host : m.guest;
    const ids = [m.hostId, ...(m.guestId ? [m.guestId] : [])];
    const [ratings, subs] = await Promise.all([
      this.prisma.arenaRating.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, rating: true },
      }),
      this.prisma.arenaSubmission.findMany({
        where: { matchId: m.id },
        select: {
          id: true,
          userId: true,
          status: true,
          passed: true,
          createdAt: true,
        },
      }),
    ]);
    const ratingOf = (id: number) =>
      ratings.find((r) => r.userId === id)?.rating ?? DEFAULT_RATING;
    const mine = subs.filter((s) => s.userId === userId);
    const theirs = subs.filter((s) => s.userId !== userId);
    const myBest = this.bestFor(subs, userId, m.deadlineAt)?.passed ?? 0;
    const oppId = opp?.id;
    const oppBest =
      oppId !== undefined
        ? (this.bestFor(subs, oppId, m.deadlineAt)?.passed ?? 0)
        : 0;

    const problem = getProblem(m.problemId);
    const showProblem =
      problem && (m.status === 'active' || m.status === 'finished');

    return {
      id: m.id,
      code: m.code,
      status: m.status,
      isPublic: m.isPublic,
      role: isHost ? 'host' : 'guest',
      createdAt: m.createdAt.toISOString(),
      startedAt: m.startedAt?.toISOString() ?? null,
      deadlineAt: m.deadlineAt?.toISOString() ?? null,
      finishedAt: m.finishedAt?.toISOString() ?? null,
      me: {
        id: userId,
        name: displayNameFor(meUser?.name, userId),
        rating: ratingOf(userId),
      },
      opponent: opp
        ? {
            id: opp.id,
            name: displayNameFor(opp.name, opp.id),
            rating: ratingOf(opp.id),
            submissionCount: theirs.length,
            bestPassed: oppBest,
          }
        : null,
      mySubmissionCount: mine.length,
      myBestPassed: myBest,
      problem: showProblem
        ? {
            id: problem.id,
            title: problem.title,
            difficulty: problem.difficulty,
            durationSec: problem.durationSec,
            statement: problem.statement,
            signature: problem.signature,
            starterCode: problem.starterCode,
            // chỉ test công khai; test ẩn KHÔNG BAO GIỜ rời server
            examples: problem.publicTests.map((t) => ({
              args: t.args,
              expected: t.expected,
            })),
            testCount: totalTests(problem),
          }
        : null,
      result:
        m.status === 'finished'
          ? {
              winnerId: m.winnerId,
              isDraw: m.winnerId === null,
              endReason: m.endReason,
              myRatingDelta:
                (isHost ? m.hostRatingDelta : m.guestRatingDelta) ?? 0,
              opponentRatingDelta:
                (isHost ? m.guestRatingDelta : m.hostRatingDelta) ?? 0,
              myXp: (isHost ? m.hostXp : m.guestXp) ?? 0,
              myBestPassed: myBest,
              opponentBestPassed: oppBest,
            }
          : null,
    };
  }

  private async envelope(m: MatchRow, userId: number) {
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      match: await this.toMatchView(m, userId),
    };
  }

  private toSubmissionView(s: {
    id: number;
    matchId: number;
    status: string;
    passed: number;
    total: number;
    detail: unknown;
    message: string | null;
    createdAt: Date;
  }) {
    const d = (s.detail && typeof s.detail === 'object' ? s.detail : {}) as {
      public?: unknown;
      hiddenPassed?: unknown;
      hiddenTotal?: unknown;
    };
    const publicResults = Array.isArray(d.public)
      ? d.public.map((r: Record<string, unknown>) => ({
          index: Number(r.index),
          passed: r.passed === true,
          ...(typeof r.got === 'string' ? { got: r.got } : {}),
          ...(typeof r.error === 'string' ? { error: r.error } : {}),
        }))
      : [];
    return {
      id: s.id,
      matchId: s.matchId,
      status: s.status,
      passed: s.passed,
      total: s.total,
      publicResults,
      hiddenPassed: Number(d.hiddenPassed ?? 0),
      hiddenTotal: Number(d.hiddenTotal ?? 0),
      message: s.message,
      createdAt: s.createdAt.toISOString(),
    };
  }

  // ------------------------------------------------------------- read-only

  listProblems() {
    return {
      ok: true,
      problems: PROBLEMS.map((p) => ({
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        durationSec: p.durationSec,
      })),
    };
  }

  /** Chi tiết một đề để xem trước khi vào phòng: chỉ test công khai, test ẩn không rời server. */
  getProblemDetail(id: string) {
    const p = getProblem(id);
    if (!p) throw new NotFoundException('Đề không tồn tại');
    const sampleTests = p.publicTests.map((t) => ({
      args: t.args,
      expected: t.expected,
    }));
    return {
      ok: true,
      problem: {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        durationSec: p.durationSec,
        statement: p.statement,
        signature: p.signature,
        starterCode: p.starterCode,
        sampleTests,
        testCount: totalTests(p),
      },
    };
  }

  private async rankOf(r: {
    userId: number;
    rating: number;
    wins: number;
  }): Promise<number> {
    const above = await this.prisma.arenaRating.count({
      where: {
        NOT: { wins: 0, losses: 0, draws: 0 },
        OR: [
          { rating: { gt: r.rating } },
          { rating: r.rating, wins: { gt: r.wins } },
          { rating: r.rating, wins: r.wins, userId: { lt: r.userId } },
        ],
      },
    });
    return above + 1;
  }

  async getMe(userId: number) {
    const r = await this.prisma.arenaRating.findUnique({ where: { userId } });
    if (!r) {
      return {
        ok: true,
        rating: DEFAULT_RATING,
        wins: 0,
        losses: 0,
        draws: 0,
        rank: null,
      };
    }
    const played = r.wins + r.losses + r.draws > 0;
    return {
      ok: true,
      rating: r.rating,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      rank: played ? await this.rankOf(r) : null,
    };
  }

  async getCurrent(userId: number) {
    const m = await this.settleCurrent(userId);
    const live = m && (m.status === 'waiting' || m.status === 'active');
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      match: live ? await this.toMatchView(m, userId) : null,
    };
  }

  private async participantMatch(
    userId: number,
    id: number,
  ): Promise<MatchRow> {
    if (!Number.isInteger(id) || id < 1 || id > MAX_INT4) {
      throw this.notFoundMatch();
    }
    const m = await this.prisma.arenaMatch.findUnique({
      where: { id },
      include: MATCH_INCLUDE,
    });
    if (!m || (m.hostId !== userId && m.guestId !== userId)) {
      throw this.notFoundMatch();
    }
    return m;
  }

  async getMatch(userId: number, id: number) {
    const m = await this.finalizeIfExpired(
      await this.participantMatch(userId, id),
    );
    return this.envelope(m, userId);
  }

  async listSubmissions(userId: number, id: number) {
    await this.finalizeIfExpired(await this.participantMatch(userId, id));
    // KHÔNG select `code`.
    const rows = await this.prisma.arenaSubmission.findMany({
      where: { matchId: id, userId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        matchId: true,
        status: true,
        passed: true,
        total: true,
        detail: true,
        message: true,
        createdAt: true,
      },
    });
    return { ok: true, submissions: rows.map((r) => this.toSubmissionView(r)) };
  }

  async history(userId: number, limit = 20, before?: number) {
    const take = Math.min(50, Math.max(1, limit));
    const rows = await this.prisma.arenaMatch.findMany({
      where: {
        status: 'finished',
        OR: [{ hostId: userId }, { guestId: userId }],
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: take + 1,
      include: MATCH_INCLUDE,
    });
    const page = rows.slice(0, take);
    const items = page.map((m) => {
      const isHost = m.hostId === userId;
      const opp = isHost ? m.guest : m.host;
      return {
        id: m.id,
        problemId: m.problemId,
        problemTitle: getProblem(m.problemId)?.title ?? m.problemId,
        opponentName: opp ? displayNameFor(opp.name, opp.id) : '—',
        outcome:
          m.winnerId === null ? 'draw' : m.winnerId === userId ? 'win' : 'loss',
        ratingDelta: (isHost ? m.hostRatingDelta : m.guestRatingDelta) ?? 0,
        xp: (isHost ? m.hostXp : m.guestXp) ?? 0,
        endReason: m.endReason,
        finishedAt: (m.finishedAt ?? m.createdAt).toISOString(),
      };
    });
    return {
      ok: true,
      nextBefore:
        rows.length > take && page.length > 0 ? page[page.length - 1].id : null,
      items,
    };
  }

  async leaderboard(userId: number) {
    const played: Prisma.ArenaRatingWhereInput = {
      NOT: { wins: 0, losses: 0, draws: 0 },
    };
    const top = await this.prisma.arenaRating.findMany({
      where: played,
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { userId: 'asc' }],
      take: 20,
      include: { user: { select: { id: true, name: true } } },
    });
    const entry = (r: (typeof top)[number], rank: number) => {
      const name = displayNameFor(r.user.name, r.userId);
      return {
        id: r.userId,
        name,
        avatar: avatarForName(name),
        value: r.rating,
        rank,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        is_me: r.userId === userId,
      };
    };
    const entries = top.map((r, i) => entry(r, i + 1));
    let me = entries.find((e) => e.is_me) ?? null;
    if (!me) {
      const mine = await this.prisma.arenaRating.findFirst({
        where: { userId, ...played },
        include: { user: { select: { id: true, name: true } } },
      });
      if (mine) me = entry(mine, await this.rankOf(mine));
    }
    return { ok: true, entries, me };
  }

  // ------------------------------------------------------- matchmaking

  async createRoom(userId: number, problemId?: string) {
    const problem = this.pickProblem(problemId);
    await this.settleCurrent(userId);
    const id = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, LOCK_MATCHES);
      await this.expireWaiting(tx, new Date());
      if (await tx.arenaMatch.findFirst({ where: this.mineWhere(userId) })) {
        throw this.alreadyInMatch();
      }
      let code = this.randomCode();
      // Đang giữ khoá nên không có đua; chỉ cần tránh trùng mã đã tồn tại.
      for (let i = 0; i < 20; i++) {
        if (!(await tx.arenaMatch.findUnique({ where: { code } }))) break;
        code = this.randomCode();
      }
      const created = await tx.arenaMatch.create({
        data: { code, isPublic: false, problemId: problem.id, hostId: userId },
        select: { id: true },
      });
      return created.id;
    }, TX_OPTIONS);
    return this.envelope(await this.reload(id), userId);
  }

  async joinRoom(userId: number, rawCode: string) {
    const code = String(rawCode ?? '')
      .trim()
      .toUpperCase();
    if (!new RegExp(`^[${ROOM_CODE_ALPHABET}]{4,8}$`).test(code)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Mã phòng sai định dạng',
        code: 'INVALID_CODE',
      });
    }
    await this.settleCurrent(userId);
    const id = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.lock(tx, LOCK_MATCHES);
      await this.expireWaiting(tx, now);
      const room = await tx.arenaMatch.findUnique({ where: { code } });
      if (
        !room ||
        room.isPublic ||
        room.status !== 'waiting' ||
        room.guestId !== null
      ) {
        throw new ArenaHttpError(
          HttpStatus.NOT_FOUND,
          'ROOM_NOT_FOUND',
          'Không tìm thấy phòng',
        );
      }
      if (room.hostId === userId) {
        throw new ArenaHttpError(
          HttpStatus.CONFLICT,
          'CANNOT_JOIN_OWN_ROOM',
          'Không thể vào phòng của chính mình',
        );
      }
      if (await tx.arenaMatch.findFirst({ where: this.mineWhere(userId) })) {
        throw this.alreadyInMatch();
      }
      await this.activate(tx, room.id, room.problemId, userId, now);
      return room.id;
    }, TX_OPTIONS);
    return this.envelope(await this.reload(id), userId);
  }

  private async activate(
    tx: Tx,
    matchId: number,
    problemId: string,
    guestId: number,
    now: Date,
  ) {
    const duration = getProblem(problemId)?.durationSec ?? 600;
    const res = await tx.arenaMatch.updateMany({
      where: { id: matchId, status: 'waiting', guestId: null },
      data: {
        guestId,
        status: 'active',
        startedAt: now,
        deadlineAt: new Date(now.getTime() + duration * 1000),
      },
    });
    if (res.count !== 1) {
      throw new ArenaHttpError(
        HttpStatus.NOT_FOUND,
        'ROOM_NOT_FOUND',
        'Không tìm thấy phòng',
      );
    }
  }

  async queue(userId: number) {
    await this.settleCurrent(userId);
    const { id, queueStatus } = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.lock(tx, LOCK_MATCHES);
      await this.expireWaiting(tx, now);
      const mine = await tx.arenaMatch.findFirst({
        where: this.mineWhere(userId),
        orderBy: { id: 'desc' },
      });
      if (mine) {
        if (mine.status === 'waiting' && mine.isPublic) {
          return { id: mine.id, queueStatus: 'waiting' as const };
        }
        throw this.alreadyInMatch();
      }
      const candidate = await tx.arenaMatch.findFirst({
        where: {
          status: 'waiting',
          isPublic: true,
          guestId: null,
          hostId: { not: userId },
          createdAt: { gte: new Date(now.getTime() - QUEUE_WAIT_MS) },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (candidate) {
        await this.activate(tx, candidate.id, candidate.problemId, userId, now);
        return { id: candidate.id, queueStatus: 'matched' as const };
      }
      let code = this.randomCode();
      for (let i = 0; i < 20; i++) {
        if (!(await tx.arenaMatch.findUnique({ where: { code } }))) break;
        code = this.randomCode();
      }
      const created = await tx.arenaMatch.create({
        data: {
          code,
          isPublic: true,
          problemId: this.pickProblem().id,
          hostId: userId,
        },
        select: { id: true },
      });
      return { id: created.id, queueStatus: 'waiting' as const };
    }, TX_OPTIONS);
    return {
      queueStatus,
      match: await this.toMatchView(await this.reload(id), userId),
    };
  }

  async cancel(userId: number, id: number) {
    await this.participantMatch(userId, id); // 404 nếu không thuộc trận
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, LOCK_MATCHES);
      await this.expireWaiting(tx, new Date());
      const m = await tx.arenaMatch.findUnique({ where: { id } });
      if (!m || m.hostId !== userId) throw this.notFoundMatch();
      if (m.status === 'cancelled') return;
      if (m.status !== 'waiting') {
        throw new ArenaHttpError(
          HttpStatus.CONFLICT,
          'MATCH_NOT_WAITING',
          'Trận đã bắt đầu hoặc đã kết thúc',
        );
      }
      const res = await tx.arenaMatch.updateMany({
        where: { id, status: 'waiting' },
        data: { status: 'cancelled', finishedAt: new Date() },
      });
      if (res.count !== 1) {
        throw new ArenaHttpError(
          HttpStatus.CONFLICT,
          'MATCH_NOT_WAITING',
          'Trận đã bắt đầu hoặc đã kết thúc',
        );
      }
    }, TX_OPTIONS);
    return this.envelope(await this.reload(id), userId);
  }

  async forfeit(userId: number, id: number) {
    let m = await this.finalizeIfExpired(
      await this.participantMatch(userId, id),
    );
    if (m.status === 'finished') return this.envelope(m, userId);
    if (m.status !== 'active') {
      throw new ArenaHttpError(
        HttpStatus.CONFLICT,
        'MATCH_NOT_ACTIVE',
        'Trận không ở trạng thái đang diễn ra',
      );
    }
    await this.finish(id, 'forfeit', { forfeiterId: userId });
    m = await this.reload(id);
    return this.envelope(m, userId);
  }

  // ---------------------------------------------------------- submissions

  async submit(userId: number, id: number, code: string) {
    this.grader.assertAvailable();
    const receivedAt = new Date();
    const m = await this.finalizeIfExpired(
      await this.participantMatch(userId, id),
    );
    if (
      m.status !== 'active' ||
      !m.deadlineAt ||
      receivedAt.getTime() > m.deadlineAt.getTime()
    ) {
      throw new ArenaHttpError(
        HttpStatus.CONFLICT,
        'MATCH_NOT_ACTIVE',
        'Trận không còn nhận bài',
      );
    }
    const problem = getProblem(m.problemId);
    if (!problem) throw new InternalServerErrorException('Đề không tồn tại');

    // Giữ chỗ lần nộp dưới khoá theo người dùng để hai request song song không
    // cùng lọt qua giới hạn tần suất.
    const sub = await this.prisma.$transaction(async (tx) => {
      await this.lockPair(tx, LOCK_SUBMIT, userId);
      // Cùng khoá với finish(): bài nộp và việc chốt trận không đan xen nhau.
      await this.lockPair(tx, LOCK_FINISH, id);
      const cur = await tx.arenaMatch.findUnique({
        where: { id },
        select: { status: true, deadlineAt: true },
      });
      if (
        !cur ||
        cur.status !== 'active' ||
        !cur.deadlineAt ||
        receivedAt.getTime() > cur.deadlineAt.getTime()
      ) {
        throw new ArenaHttpError(
          HttpStatus.CONFLICT,
          'MATCH_NOT_ACTIVE',
          'Trận không còn nhận bài',
        );
      }
      const mine = await tx.arenaSubmission.findMany({
        where: { matchId: id, userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (mine.length >= MAX_SUBMISSIONS) {
        throw new ArenaHttpError(
          HttpStatus.TOO_MANY_REQUESTS,
          'SUBMIT_LIMIT',
          `Mỗi trận chỉ được nộp tối đa ${MAX_SUBMISSIONS} lần`,
        );
      }
      if (mine.length > 0) {
        const wait =
          SUBMIT_GAP_MS - (receivedAt.getTime() - mine[0].createdAt.getTime());
        if (wait > 0) {
          throw new ArenaHttpError(
            HttpStatus.TOO_MANY_REQUESTS,
            'SUBMIT_TOO_FAST',
            'Nộp bài quá nhanh, hãy chờ giây lát',
            Math.ceil(wait / 1000),
          );
        }
      }
      return tx.arenaSubmission.create({
        data: {
          matchId: id,
          userId,
          code,
          status: 'error',
          message: 'Đang chấm',
          total: totalTests(problem),
          createdAt: receivedAt,
        },
        select: { id: true },
      });
    }, TX_OPTIONS);

    let result: GradeResult;
    try {
      result = await this.grader.grade(code, problem);
    } catch (e) {
      if (e instanceof ArenaHttpError) {
        // Bận/tắt: không tính vào giới hạn nộp.
        await this.prisma.arenaSubmission.deleteMany({ where: { id: sub.id } });
        throw e;
      }
      this.logger.error(`Chấm bài lỗi (match ${id}): ${String(e)}`);
      result = {
        status: 'error',
        message: 'Hệ thống chấm gặp sự cố',
        passed: 0,
        total: totalTests(problem),
        publicResults: [],
        hiddenPassed: 0,
        hiddenTotal: problem.hiddenTests.length,
      };
    }

    const detail = {
      public: result.publicResults,
      hiddenPassed: result.hiddenPassed,
      hiddenTotal: result.hiddenTotal,
    };
    const gradedAt = new Date();
    const message = result.message ? result.message.slice(0, 300) : null;
    await this.prisma.arenaSubmission.update({
      where: { id: sub.id },
      data: {
        status: result.status,
        passed: result.passed,
        total: result.total,
        detail: detail as unknown as Prisma.InputJsonValue,
        message,
        gradedAt,
      },
    });

    if (
      result.status === 'graded' &&
      result.total > 0 &&
      result.passed === result.total &&
      receivedAt.getTime() <= m.deadlineAt.getTime()
    ) {
      await this.finish(id, 'solved', { solverId: userId });
    }
    // Chốt lười nếu trận đã quá hạn trong lúc chấm (và chưa chốt vì chờ bài này).
    const fresh = await this.finalizeIfExpired(await this.reload(id));
    const now = new Date();
    return {
      serverTime: now.toISOString(),
      submission: this.toSubmissionView({
        id: sub.id,
        matchId: id,
        status: result.status,
        passed: result.passed,
        total: result.total,
        detail,
        message,
        createdAt: receivedAt,
      }),
      match: await this.toMatchView(fresh, userId),
    };
  }
}
