import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitPlacementDto } from './dto/placement.dto';
import {
  grade,
  levelFromScore,
  parseQuestions,
  publicView,
  type PlacementQuestion,
} from './placement.logic';

type Active = { id: number; version: number; questions: PlacementQuestion[] };

/** Khách mới mở trang làm bài đều gọi route công khai này; cache ngắn để cả lớp không dội DB. */
const ACTIVE_TTL_MS = 60_000;

@Injectable()
export class PlacementService {
  private active: { at: number; value: Active | null } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async loadActive(): Promise<Active | null> {
    if (this.active && Date.now() - this.active.at < ACTIVE_TTL_MS)
      return this.active.value;
    const row = await this.prisma.questionnaire.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    // Dữ liệu sai hình ném lỗi ở đây (500 có log), không lọt ra thành nút trắng ở FE.
    const value = row
      ? {
          id: row.id,
          version: row.version,
          questions: parseQuestions(row.questionsJson),
        }
      : null;
    this.active = { at: Date.now(), value };
    return value;
  }

  /** Route công khai: câu hỏi KHÔNG kèm đáp án đúng. */
  async getQuestions() {
    const a = await this.loadActive();
    if (!a) throw new NotFoundException('Chưa có bộ câu hỏi đầu vào');
    return {
      ok: true,
      questionnaire_id: a.id,
      version: a.version,
      questions: publicView(a.questions),
    };
  }

  /** Chấm ở server; gửi lại cùng bộ câu hỏi là idempotent (trả lại kết quả lần đầu). */
  async submit(userId: number, dto: SubmitPlacementDto) {
    const a = await this.loadActive();
    if (!a) throw new NotFoundException('Chưa có bộ câu hỏi đầu vào');
    if (dto.questionnaireId !== a.id)
      throw new ConflictException(
        'Bộ câu hỏi đã được cập nhật, hãy tải lại trang',
      );
    const g = grade(a.questions, dto.answers);
    if (!g) throw new BadRequestException('Đáp án không hợp lệ');

    try {
      const row = await this.prisma.placementAttempt.create({
        data: {
          userId,
          questionnaireId: a.id,
          answers: dto.answers,
          score: g.score,
          total: g.total,
        },
      });
      return this.result(row.score, row.total, false);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const prev = await this.prisma.placementAttempt.findUnique({
          where: {
            userId_questionnaireId: { userId, questionnaireId: a.id },
          },
        });
        if (prev) return this.result(prev.score, prev.total, true);
      }
      throw e;
    }
  }

  /** Kết quả gần nhất của chính người dùng (null nếu chưa làm). */
  async getMine(userId: number) {
    const row = await this.prisma.placementAttempt.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return row
      ? this.result(row.score, row.total, true)
      : { ok: true, done: false };
  }

  private result(score: number, total: number, repeated: boolean) {
    return {
      ok: true,
      done: true,
      repeated,
      score,
      total,
      level: levelFromScore(score, total),
    };
  }
}
