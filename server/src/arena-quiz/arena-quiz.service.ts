import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TX_OPTIONS } from 'src/common/prisma-tx.options';
import { toStudyDate } from 'src/common/streak/streak.service';
import { Prisma } from 'src/generated/prisma';
import {
  avatarForName,
  displayNameFor,
} from 'src/leaderboard/leaderboard.helpers';
import { PrismaService } from 'src/prisma/prisma.service';
import { ArenaHttpError, type ArenaErrorCode } from 'src/arena/arena.errors';
import {
  COUNTDOWN_MS,
  DEFAULT_QUIZ_RATING,
  HOST_SEEN_MS,
  OPTIONS_PER_QUESTION,
  QUESTIONS_PER_MATCH,
  WAIT_TTL_MS,
  endAt,
  getQuizItem,
  phaseAt,
  pickQuestions,
  pointsFor,
  settleQuiz,
  timeline,
  type AnswerRec,
  type MatchQuestion,
  type QuestionSlot,
} from './quiz-logic';

const MAX_INT4 = 2_147_483_647;
const LOCK_QUEUE = 727101;
const LOCK_FINISH = 727102;

const INCLUDE = {
  host: { select: { id: true, name: true } },
  guest: { select: { id: true, name: true } },
  answers: true,
} satisfies Prisma.ArenaQuizMatchInclude;
type Row = Prisma.ArenaQuizMatchGetPayload<{ include: typeof INCLUDE }>;
type Tx = Prisma.TransactionClient;

const err = (status: HttpStatus, code: ArenaErrorCode, message: string) =>
  new ArenaHttpError(status, code, message);

/**
 * Arena · Đoán output, đấu online 1v1. Như module Arena (đấu code), mọi thứ được "chốt lười":
 * không có job nền — mỗi lần đọc trận, server tự huỷ phòng chờ quá hạn và chốt trận đã hết giờ.
 */
@Injectable()
export class ArenaQuizService {
  private readonly logger = new Logger(ArenaQuizService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- helpers

  private async lock(tx: Tx, key: number, id?: number): Promise<void> {
    if (id === undefined) await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::bigint)`;
    else await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::int, ${id}::int)`;
  }

  private notFound() {
    return err(HttpStatus.NOT_FOUND, 'MATCH_NOT_FOUND', 'Không tìm thấy trận');
  }

  private questionsOf(m: Row): MatchQuestion[] {
    return Array.isArray(m.questions) ? (m.questions as unknown as MatchQuestion[]) : [];
  }

  private recs(m: Row): AnswerRec[] {
    return m.answers.map((a) => ({
      userId: a.userId,
      qIndex: a.qIndex,
      choice: a.choice,
      correct: a.correct,
      points: a.points,
      at: a.createdAt.getTime(),
    }));
  }

  private slotsOf(m: Row): QuestionSlot[] {
    if (!m.startedAt || !m.guestId) return [];
    return timeline(
      m.startedAt.getTime(),
      this.recs(m),
      [m.hostId, m.guestId],
      this.questionsOf(m).length || QUESTIONS_PER_MATCH,
    );
  }

  private liveWhere(userId: number): Prisma.ArenaQuizMatchWhereInput {
    return {
      status: { in: ['waiting', 'active'] },
      OR: [{ hostId: userId }, { guestId: userId }],
    };
  }

  private load(id: number) {
    return this.prisma.arenaQuizMatch.findUnique({ where: { id }, include: INCLUDE });
  }

  private async participant(userId: number, id: number): Promise<Row> {
    if (!Number.isInteger(id) || id < 1 || id > MAX_INT4) throw this.notFound();
    const m = await this.load(id);
    if (!m || (m.hostId !== userId && m.guestId !== userId)) throw this.notFound();
    return m;
  }

  /** Chốt lười: phòng chờ quá hạn → huỷ; trận đã qua câu cuối → chốt kết quả. */
  private async settle(m: Row, now = Date.now()): Promise<Row> {
    if (m.status === 'waiting' && now - m.createdAt.getTime() >= WAIT_TTL_MS) {
      await this.prisma.arenaQuizMatch.updateMany({
        where: { id: m.id, status: 'waiting' },
        data: { status: 'cancelled', finishedAt: new Date(now) },
      });
      return (await this.load(m.id)) ?? m;
    }
    if (m.status === 'active' && now >= endAt(this.slotsOf(m))) {
      await this.finish(m.id, null);
      return (await this.load(m.id)) ?? m;
    }
    return m;
  }

  /** Chốt trận (hết câu hoặc đầu hàng): điểm, người thắng, Elo, XP — một lần duy nhất. */
  private async finish(id: number, forfeiterId: number | null): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, LOCK_FINISH, id);
      const m = await tx.arenaQuizMatch.findUnique({ where: { id }, include: INCLUDE });
      if (!m || m.status !== 'active' || !m.guestId) return false;
      const now = Date.now();
      const slots = this.slotsOf(m);
      const sum = (uid: number, key: 'points' | 'correct') =>
        m.answers
          .filter((a) => a.userId === uid)
          .reduce((s, a) => s + (key === 'points' ? a.points : a.correct ? 1 : 0), 0);
      const hostScore = sum(m.hostId, 'points'), guestScore = sum(m.guestId, 'points');
      // đầu hàng trước khi câu đầu tiên kết thúc: không tính điểm (tránh "đầu hàng ngay" để phá Elo)
      const unscored = !!forfeiterId && (!slots.length || now < slots[0].revealUntil);
      const ratings = await tx.arenaQuizRating.findMany({
        where: { userId: { in: [m.hostId, m.guestId] } },
      });
      const ratingOf = (uid: number) =>
        ratings.find((r) => r.userId === uid)?.rating ?? DEFAULT_QUIZ_RATING;
      const st = settleQuiz({
        hostId: m.hostId,
        guestId: m.guestId,
        hostRating: ratingOf(m.hostId),
        guestRating: ratingOf(m.guestId),
        hostScore,
        guestScore,
        hostCorrect: sum(m.hostId, 'correct'),
        guestCorrect: sum(m.guestId, 'correct'),
        forfeiterId,
        unscored,
      });
      const claimed = await tx.arenaQuizMatch.updateMany({
        where: { id, status: 'active' },
        data: {
          status: 'finished',
          finishedAt: new Date(now),
          endReason: forfeiterId ? 'forfeit' : 'completed',
          unscored: unscored || st.hostResult === 'none',
          winnerId: st.winnerId,
          hostScore,
          guestScore,
          hostRatingDelta: st.hostDelta,
          guestRatingDelta: st.guestDelta,
          hostXp: st.hostXp,
          guestXp: st.guestXp,
        },
      });
      if (claimed.count !== 1) return false;
      const sides = [
        { userId: m.hostId, delta: st.hostDelta, res: st.hostResult, xp: st.hostXp },
        { userId: m.guestId, delta: st.guestDelta, res: st.guestResult, xp: st.guestXp },
      ];
      for (const s of sides) {
        if (s.res !== 'none') {
          const inc = {
            wins: s.res === 'win' ? 1 : 0,
            losses: s.res === 'loss' ? 1 : 0,
            draws: s.res === 'draw' ? 1 : 0,
          };
          await tx.arenaQuizRating.upsert({
            where: { userId: s.userId },
            create: { userId: s.userId, rating: ratingOf(s.userId) + s.delta, ...inc },
            update: {
              rating: { increment: s.delta },
              wins: { increment: inc.wins },
              losses: { increment: inc.losses },
              draws: { increment: inc.draws },
            },
          });
        }
        if (s.xp > 0) await this.addXp(tx, s.userId, s.xp, new Date(now));
      }
      return true;
    }, TX_OPTIONS);
  }

  /** Cộng XP vào users.xp + user_daily_xp_logs (cùng cách với ArenaService). */
  private async addXp(tx: Tx, userId: number, xp: number, now: Date) {
    await tx.user.update({ where: { id: userId }, data: { xp: { increment: xp } } });
    const logDate = toStudyDate(now);
    const existing = await tx.userDailyXpLog.findFirst({ where: { userId, logDate } });
    if (existing) {
      await tx.userDailyXpLog.update({
        where: { id: existing.id },
        data: { xpEarned: { increment: xp } },
      });
    } else {
      await tx.userDailyXpLog.create({ data: { userId, logDate, xpEarned: xp } });
    }
  }

  // ----------------------------------------------------------------- views

  private async view(m: Row, userId: number) {
    const now = Date.now();
    const isHost = m.hostId === userId;
    const opp = isHost ? m.guest : m.host;
    const meUser = isHost ? m.host : m.guest;
    const ids = [m.hostId, ...(m.guestId ? [m.guestId] : [])];
    const ratings = await this.prisma.arenaQuizRating.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, rating: true },
    });
    const ratingOf = (id: number) =>
      ratings.find((r) => r.userId === id)?.rating ?? DEFAULT_QUIZ_RATING;

    const qs = this.questionsOf(m);
    const slots = this.slotsOf(m);
    const finished = m.status === 'finished';
    const { phase, slot } = finished
      ? { phase: 'done' as const, slot: null }
      : m.status === 'active'
        ? phaseAt(slots, now)
        : { phase: null, slot: null };
    const oppId = opp?.id;
    const ans = (uid: number | undefined, i: number) =>
      uid === undefined ? undefined : m.answers.find((a) => a.userId === uid && a.qIndex === i);
    // câu đã đóng: lộ đáp án + lựa chọn của đối thủ; câu đang mở: chỉ biết đối thủ đã trả lời hay chưa
    const shown = slots.filter((s) => finished || s.openAt <= now);
    const questions = shown.map((s) => {
      const q = qs[s.index];
      const item = getQuizItem(q?.qid ?? '');
      const closed = finished || now >= s.closeAt;
      const mine = ans(userId, s.index), theirs = ans(oppId, s.index);
      return {
        index: s.index,
        code: item?.code ?? '',
        lesson: item?.lesson ?? '',
        opts: q?.opts ?? [],
        openAt: new Date(s.openAt).toISOString(),
        closeAt: new Date(s.closeAt).toISOString(),
        revealUntil: new Date(s.revealUntil).toISOString(),
        closed,
        answer: closed ? (q?.answer ?? null) : null,
        myChoice: mine?.choice ?? null,
        myPoints: closed ? (mine?.points ?? 0) : null,
        oppAnswered: !!theirs,
        oppChoice: closed ? (theirs?.choice ?? null) : null,
        oppPoints: closed ? (theirs?.points ?? 0) : null,
      };
    });
    const closedSum = (uid: number | undefined) =>
      questions.filter((q) => q.closed).reduce((s, q) => s + ((uid === userId ? q.myPoints : q.oppPoints) ?? 0), 0);
    return {
      id: m.id,
      status: m.status,
      role: isHost ? 'host' : 'guest',
      createdAt: m.createdAt.toISOString(),
      startedAt: m.startedAt?.toISOString() ?? null,
      endsAt: slots.length ? new Date(endAt(slots)).toISOString() : null,
      finishedAt: m.finishedAt?.toISOString() ?? null,
      total: qs.length,
      phase,
      current: slot ? slot.index : null,
      me: { id: userId, name: displayNameFor(meUser?.name, userId), rating: ratingOf(userId) },
      opponent: opp ? { id: opp.id, name: displayNameFor(opp.name, opp.id), rating: ratingOf(opp.id) } : null,
      myScore: finished ? (isHost ? m.hostScore : m.guestScore) : closedSum(userId),
      oppScore: finished ? (isHost ? m.guestScore : m.hostScore) : closedSum(oppId),
      questions,
      result: finished
        ? {
            winnerId: m.winnerId,
            isDraw: m.winnerId === null,
            endReason: m.endReason,
            unscored: m.unscored,
            myRatingDelta: (isHost ? m.hostRatingDelta : m.guestRatingDelta) ?? 0,
            myXp: (isHost ? m.hostXp : m.guestXp) ?? 0,
          }
        : null,
    };
  }

  private async envelope(m: Row, userId: number) {
    return { ok: true, serverTime: new Date().toISOString(), match: await this.view(m, userId) };
  }

  // ------------------------------------------------------------- endpoints

  async getMatch(userId: number, id: number) {
    let m = await this.participant(userId, id);
    if (m.status === 'waiting' && m.hostId === userId) {
      // chủ phòng còn trên trang: chỉ ghép với phòng có chủ vừa poll
      await this.prisma.arenaQuizMatch.updateMany({
        where: { id: m.id, status: 'waiting' },
        data: { hostSeenAt: new Date() },
      });
    }
    m = await this.settle(m);
    return this.envelope(m, userId);
  }

  private async settleCurrent(userId: number): Promise<Row | null> {
    const m = await this.prisma.arenaQuizMatch.findFirst({
      where: this.liveWhere(userId),
      orderBy: { id: 'desc' },
      include: INCLUDE,
    });
    return m ? this.settle(m) : null;
  }

  async getCurrent(userId: number) {
    const m = await this.settleCurrent(userId);
    const live = m && (m.status === 'waiting' || m.status === 'active');
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      match: live ? (await this.view(m, userId)) : null,
    };
  }

  /** Vào hàng chờ: gặp phòng công khai còn người chờ thì vào luôn, không thì mở phòng mới. */
  async queue(userId: number) {
    await this.settleCurrent(userId); // trận cũ đã hết giờ thì chốt trước
    const { id, matched } = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, LOCK_QUEUE);
      const mine = await tx.arenaQuizMatch.findFirst({
        where: this.liveWhere(userId),
        orderBy: { id: 'desc' },
      });
      if (mine) return { id: mine.id, matched: mine.status === 'active' }; // bấm lại: trả trận đang có
      const now = Date.now();
      const cand = await tx.arenaQuizMatch.findFirst({
        where: {
          status: 'waiting',
          guestId: null,
          hostId: { not: userId },
          createdAt: { gt: new Date(now - WAIT_TTL_MS) },
          hostSeenAt: { gt: new Date(now - HOST_SEEN_MS) },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (cand) {
        const r = await tx.arenaQuizMatch.updateMany({
          where: { id: cand.id, status: 'waiting', guestId: null },
          data: { guestId: userId, status: 'active', startedAt: new Date(now + COUNTDOWN_MS) },
        });
        if (r.count === 1) return { id: cand.id, matched: true };
      }
      const created = await tx.arenaQuizMatch.create({
        data: {
          hostId: userId,
          questions: pickQuestions() as unknown as Prisma.InputJsonValue,
        },
      });
      return { id: created.id, matched: false };
    }, TX_OPTIONS);
    const m = await this.load(id);
    if (!m) throw this.notFound();
    return { queueStatus: matched ? 'matched' : 'waiting', ...(await this.envelope(m, userId)) };
  }

  async cancel(userId: number, id: number) {
    const m = await this.participant(userId, id);
    if (m.status !== 'waiting' || m.hostId !== userId) {
      throw err(HttpStatus.CONFLICT, 'MATCH_NOT_WAITING', 'Trận đã bắt đầu hoặc kết thúc, không thể huỷ');
    }
    await this.prisma.arenaQuizMatch.updateMany({
      where: { id, status: 'waiting' },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
    return this.envelope((await this.load(id)) ?? m, userId);
  }

  async forfeit(userId: number, id: number) {
    const m = await this.settle(await this.participant(userId, id));
    if (m.status !== 'active') {
      throw err(HttpStatus.CONFLICT, 'MATCH_NOT_ACTIVE', 'Trận không còn diễn ra');
    }
    await this.finish(id, userId);
    return this.envelope((await this.load(id)) ?? m, userId);
  }

  async answer(userId: number, id: number, index: number, choice: number) {
    // Giờ trả lời = lúc request tới server, TRƯỚC các lượt đọc DB (Neon mất 1–2 s/lượt): không để độ trễ DB
    // ăn vào điểm "nhanh" hay làm câu trả lời kịp giờ bị coi là hết giờ.
    const now = Date.now();
    const m = await this.settle(await this.participant(userId, id), now);
    if (m.status !== 'active') {
      throw err(HttpStatus.CONFLICT, 'MATCH_NOT_ACTIVE', 'Trận không còn diễn ra');
    }
    const { phase, slot } = phaseAt(this.slotsOf(m), now);
    if (phase !== 'question' || !slot || slot.index !== index) {
      throw err(HttpStatus.CONFLICT, 'QUESTION_CLOSED', 'Câu này đã hết giờ trả lời');
    }
    if (!Number.isInteger(choice) || choice < 0 || choice >= OPTIONS_PER_QUESTION) {
      throw err(HttpStatus.BAD_REQUEST, 'INVALID_CHOICE', 'Lựa chọn không hợp lệ');
    }
    const q = this.questionsOf(m)[index];
    const correct = choice === q?.answer;
    try {
      await this.prisma.arenaQuizAnswer.create({
        data: {
          matchId: id,
          userId,
          qIndex: index,
          choice,
          correct,
          points: pointsFor(correct, now - slot.openAt),
          createdAt: new Date(now),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw err(HttpStatus.CONFLICT, 'ALREADY_ANSWERED', 'Bạn đã trả lời câu này');
      }
      throw e;
    }
    return this.envelope((await this.load(id)) ?? m, userId);
  }

  // ------------------------------------------------------------- hồ sơ / bảng

  private async rankOf(r: { userId: number; rating: number; wins: number }) {
    const above = await this.prisma.arenaQuizRating.count({
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
    const r = await this.prisma.arenaQuizRating.findUnique({ where: { userId } });
    if (!r) return { ok: true, rating: DEFAULT_QUIZ_RATING, wins: 0, losses: 0, draws: 0, rank: null };
    const played = r.wins + r.losses + r.draws > 0;
    return { ok: true, rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws, rank: played ? await this.rankOf(r) : null };
  }

  async leaderboard(userId: number) {
    const played: Prisma.ArenaQuizRatingWhereInput = { NOT: { wins: 0, losses: 0, draws: 0 } };
    const top = await this.prisma.arenaQuizRating.findMany({
      where: played,
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { userId: 'asc' }],
      take: 20,
      include: { user: { select: { id: true, name: true } } },
    });
    const entry = (r: (typeof top)[number], rank: number) => {
      const name = displayNameFor(r.user.name, r.userId);
      return { id: r.userId, name, avatar: avatarForName(name), value: r.rating, rank, wins: r.wins, losses: r.losses, draws: r.draws, is_me: r.userId === userId };
    };
    const entries = top.map((r, i) => entry(r, i + 1));
    let me = entries.find((e) => e.is_me) ?? null;
    if (!me) {
      const mine = await this.prisma.arenaQuizRating.findFirst({
        where: { userId, ...played },
        include: { user: { select: { id: true, name: true } } },
      });
      if (mine) me = entry(mine, await this.rankOf(mine));
    }
    return { ok: true, entries, me };
  }
}
