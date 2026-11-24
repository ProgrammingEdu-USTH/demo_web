import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { toStudyDate } from 'src/common/streak/streak.service';

/**
 * `content_json` là JSON TỰ DO (quản trị dán vào, hoặc do scripts/pe-v4 sinh),
 * nên mọi bậc đều phải dò chứ không ép kiểu. Trước đây chỗ này ép thẳng
 * `as Record<string, any>`: `any` chảy từ `collectQuestions()` xuống tận
 * `normalizeQuestion()` và sinh 13 lỗi `no-unsafe-*` — tệ hơn, gõ sai tên field
 * (`o.titel`) vẫn biên dịch được và chỉ lặng lẽ cho ra chuỗi rỗng.
 *
 * Giữ ĐÚNG luật cũ `value && typeof value === 'object'`: mảng cũng được coi là
 * record (rồi `.mcq` ra undefined), chỉ `null` bị loại.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

const MIN_POOL = 5;
const SAMPLE_MIN = 5;
const SAMPLE_MAX = 10;
const HISTORY_LIMIT = 50;

/**
 * Trần số bài giữ trong cache `step_2`. Cả hệ thống hiện chỉ vài trăm bài nên
 * trần này gần như không bao giờ chạm; nó chỉ chặn bộ nhớ tăng vô hạn nếu kho
 * bài phình ra. Vượt trần thì bỏ bài vào cache sớm nhất, như `CachedUserService`.
 */
export const STEP2_CACHE_MAX = 5_000;

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number | string;
  explanation?: string;
  /**
   * Bài học sinh ra câu hỏi này. KHÔNG có trong content_json — được gắn thêm
   * lúc gom pool, để quiz ôn tập có trọng số biết câu nào thuộc bài nào.
   * Chỉ backend đọc: `stripAnswers()` không trả field này cho FE.
   */
  lessonId: number;
  /**
   * Khoá chứa bài trên. Cần cho đề ôn HẰNG NGÀY (trộn câu từ nhiều khoá) để
   * biết ghi bản ghi `quizzes` vào khoá nào — cột `course_id` là bắt buộc và
   * có khoá ngoại, không nhận null. Cũng chỉ backend đọc.
   */
  courseId: string;
}

/**
 * Bài học đúng như `collectQuestions()` cần: `contentJson` CHỈ còn `step_2`.
 * Giữ tên field `contentJson` để hàm gom câu chạy nguyên không sửa.
 */
type BaiOnTap = {
  id: number;
  courseId: string;
  title: string | null;
  module: string | null;
  courseTitle: string | null;
  contentJson: { step_2: unknown };
};

@Injectable()
export class QuizzesService {
  /**
   * `step_2` đã đọc, theo id bài. `ver` là `updated_at::text` của bài lúc đọc —
   * chuỗi do Postgres in, giữ đủ micro giây (xem `layStep2()`).
   */
  private readonly step2Cache = new Map<
    number,
    { ver: string; step2: unknown }
  >();

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Task 122-125 ----------
  async generateQuiz(userId: number, courseId: string) {
    // Hành vi KHÔNG đổi: vẫn random đều. Ba bước (gom pool / chọn câu / lưu +
    // strip) tách thành helper dùng chung với generateReviewQuiz() để hai luồng
    // không lệch nhau khi luật gom pool hay khuôn dữ liệu lưu đổi về sau.
    const pool = await this.buildQuestionPool(userId, courseId);
    const picked = this.sample(pool, this.sampleSize(pool.length));
    return this.persistQuiz(userId, courseId, picked);
  }

  // ---------- Task 136 ----------
  /**
   * Quiz ôn tập CÓ TRỌNG SỐ: ưu tiên câu thuộc bài học viên hay sai trong khóa
   * này, nhưng bài nào cũng còn cơ hội được chọn (trọng số tối thiểu 1) nên vẫn
   * lẫn một phần câu từ bài đã làm đúng hết.
   *
   * Khác `generateQuiz()` DUY NHẤT ở bước chọn câu — pool, khuôn bản ghi lưu DB
   * và định dạng trả về đều giống hệt, nên submit/getQuiz/history dùng chung.
   */
  async generateReviewQuiz(userId: number, courseId: string) {
    const pool = await this.buildQuestionPool(userId, courseId);

    const history = await this.prisma.reviewQuizResult.findMany({
      where: { userId, quiz: { courseId } },
      select: { answersJson: true },
    });

    const { totalByLesson, wrongByLesson } =
      this.tallyMistakesByLesson(history);

    // weight ∈ [1, 2]: bài chưa từng làm hoặc luôn đúng = 1; bài luôn sai = 2.
    // Không bao giờ bằng 0 nên không bài nào bị loại hẳn khỏi vòng chọn.
    const weights = pool.map((q) => {
      const total = totalByLesson.get(q.lessonId) ?? 0;
      const wrong = wrongByLesson.get(q.lessonId) ?? 0;
      return 1 + (total > 0 ? wrong / total : 0);
    });

    const picked = this.weightedSampleWithoutReplacement(
      pool,
      weights,
      this.sampleSize(pool.length),
    );
    return this.persistQuiz(userId, courseId, picked);
  }

  // ---------- Task 138 ----------
  /**
   * Đề ôn HẰNG NGÀY của thẻ "Ôn tập hôm nay" ở Bảng điều khiển.
   *
   * Khác hai method trên ở hai điểm:
   *  · Pool trộn câu từ MỌI khoá học viên đã học, không bó trong một khoá.
   *  · Mỗi ngày học chỉ được một đề — đã nộp hôm nay thì chặn, để nhịp ôn rải
   *    đều thay vì dồn một hôm.
   *
   * Vẫn dùng chung trọng số "hay sai thì hay gặp lại" như generateReviewQuiz().
   */
  async generateDailyReviewQuiz(userId: number) {
    // Chặn theo NGÀY HỌC (múi giờ nghiệp vụ), giống hệt cách tính của thẻ ở
    // Bảng điều khiển, để giao diện và backend không bao giờ nói khác nhau.
    const latest = await this.prisma.reviewQuizResult.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });
    if (
      latest &&
      toStudyDate(latest.submittedAt).getTime() === toStudyDate().getTime()
    ) {
      throw new BadRequestException(
        'Hôm nay bạn đã ôn tập rồi, quay lại vào ngày mai nhé',
      );
    }

    const pool = await this.buildAllCoursesPool(userId);

    // Lịch sử TOÀN BỘ (không lọc theo khoá) vì đề này cũng trộn mọi khoá.
    const history = await this.prisma.reviewQuizResult.findMany({
      where: { userId },
      select: { answersJson: true },
    });
    const { totalByLesson, wrongByLesson } =
      this.tallyMistakesByLesson(history);

    const weights = pool.map((q) => {
      const total = totalByLesson.get(q.lessonId) ?? 0;
      const wrong = wrongByLesson.get(q.lessonId) ?? 0;
      return 1 + (total > 0 ? wrong / total : 0);
    });

    const picked = this.weightedSampleWithoutReplacement(
      pool,
      weights,
      this.sampleSize(pool.length),
    );

    // Cột `quizzes.course_id` là NOT NULL kèm khoá ngoại nên đề trộn nhiều khoá
    // vẫn phải chọn một khoá để ghi. Lấy khoá đóng góp nhiều câu nhất — đó cũng
    // là khoá đề này nói về nhiều nhất, nên lịch sử theo khoá vẫn đọc được.
    return this.persistQuiz(userId, this.dominantCourseId(picked), picked);
  }

  // ---------- Task 139 ----------
  /**
   * Bộ đếm "hôm nay bạn đã học gì": liệt kê các bài HOÀN THÀNH TRONG NGÀY HỌC
   * hôm nay, kèm số câu hỏi rút được từ đúng những bài đó.
   *
   * `questions_available` cho giao diện biết TRƯỚC là có ôn được không, thay vì
   * để người dùng bấm nút rồi mới nhận lỗi "chưa đủ câu hỏi" — đúng cái màn hình
   * cụt hiện tại.
   */
  async getTodayLessons(userId: number) {
    const rows = await this.todayProgressRows(userId);

    if (rows.length === 0) {
      return {
        ok: true,
        count: 0,
        questions_available: 0,
        min_questions: MIN_POOL,
        can_quiz: false,
        lessons: [],
      };
    }

    const lessons = await this.layStep2(rows.map((r) => r.lessonId));

    const pool = this.collectQuestions(lessons);
    const byLesson = new Map<number, number>();
    for (const q of pool) {
      byLesson.set(q.lessonId, (byLesson.get(q.lessonId) ?? 0) + 1);
    }

    // Giữ thứ tự học trong ngày: bài xong sau đứng trước cho dễ nhớ.
    const doneAt = new Map(rows.map((r) => [r.lessonId, r.completedAt]));
    const list = lessons
      .map((l) => ({
        id: l.id,
        title: l.title ?? l.module ?? `Bài ${l.id}`,
        course_id: l.courseId,
        course_title: l.courseTitle ?? l.courseId,
        completed_at: doneAt.get(l.id) ?? null,
        question_count: byLesson.get(l.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          (b.completed_at?.getTime() ?? 0) - (a.completed_at?.getTime() ?? 0),
      );

    return {
      ok: true,
      count: list.length,
      questions_available: pool.length,
      min_questions: MIN_POOL,
      can_quiz: pool.length >= MIN_POOL,
      lessons: list,
    };
  }

  // ---------- BE14 ----------
  /**
   * Trạng thái đề ôn của MỘT khoá, cho ô đề ôn sau bài (ReviewQuiz.tsx) quyết
   * định hiện nút hay hiện câu "còn thiếu mấy bài" — thay vì để người học bấm
   * rồi mới nhận 400 của `generateReviewQuiz()`.
   *
   * Cùng pool với `buildQuestionPool()` (cùng bộ lọc, cùng `layStep2`), nên
   * `can_quiz` nói đúng điều mà lần bấm kế tiếp sẽ gặp. Khác ở chỗ KHÔNG ném lỗi
   * khi thiếu câu: thiếu câu là một trạng thái hợp lệ để hiển thị.
   *
   * `lessons_counted` là số bài THỰC SỰ góp câu, không phải số bài đã xong: FE
   * chia `questions_available / lessons_counted` ra "mỗi bài mấy câu" để nói còn
   * thiếu mấy BÀI (MIN_POOL đếm theo câu, mỗi bài ~3 câu — xem AGENTS.md).
   */
  async getCourseQuizStatus(userId: number, courseId: string) {
    const done = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId, status: 'completed' },
      select: { lessonId: true },
    });

    const lessons = await this.layStep2(
      done.map((d) => d.lessonId),
      courseId,
    );
    const pool = this.collectQuestions(lessons);

    return {
      ok: true,
      lessons_completed: done.length,
      lessons_counted: new Set(pool.map((q) => q.lessonId)).size,
      questions_available: pool.length,
      min_questions: MIN_POOL,
      can_quiz: pool.length >= MIN_POOL,
    };
  }

  // ---------- Task 140 ----------
  /**
   * Đề tổng hợp từ ĐÚNG những bài đã học trong ngày hôm nay.
   *
   * Khác `generateDailyReviewQuiz()`: bên kia trộn mọi bài từng học và chỉ cho
   * một đề mỗi ngày (ôn dàn trải); bên này bó gọn vào bài vừa học xong hôm nay
   * và KHÔNG giới hạn số lần — nó là công cụ củng cố ngay sau buổi học, làm lại
   * nhiều lần là có ích chứ không phải gian lận.
   */
  async generateTodayQuiz(userId: number) {
    const rows = await this.todayProgressRows(userId);
    if (rows.length === 0) {
      throw new BadRequestException(
        'Hôm nay bạn chưa hoàn thành bài học nào để ôn',
      );
    }

    const lessons = await this.layStep2(rows.map((r) => r.lessonId));

    const pool = this.collectQuestions(lessons);
    if (pool.length < MIN_POOL) {
      throw new BadRequestException(
        'Các bài học hôm nay chưa đủ câu hỏi để tạo đề, học thêm một bài nữa nhé',
      );
    }

    const picked = this.sample(pool, this.sampleSize(pool.length));
    return this.persistQuiz(userId, this.dominantCourseId(picked), picked);
  }

  // ---------- Task 126-128 ----------
  async submitQuiz(userId: number, quizId: number, answers: unknown[]) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Không tìm thấy quiz');

    // Bước 1: chỉ chủ sở hữu, và chỉ nộp được 1 lần.
    if (quiz.userId !== userId) {
      throw new ForbiddenException('Không có quyền truy cập quiz này');
    }
    if (quiz.status === 'submitted') {
      throw new ConflictException('Quiz này đã được nộp');
    }

    // Bước 2: chấm điểm theo SNAPSHOT trong DB, KHÔNG tin dữ liệu client gửi.
    const questions = quiz.questionsJson as unknown as QuizQuestion[];
    let score = 0;
    const detail = questions.map((q, i) => {
      const given = answers?.[i];
      const correct = this.isCorrect(q.correct, given);
      if (correct) score += 1;
      return {
        question: q.question,
        given: given ?? null,
        correct: q.correct,
        is_correct: correct,
        explanation: q.explanation ?? null,
        // Chỉ đi vào answersJson lưu DB — nguồn để generateReviewQuiz() đếm
        // số câu sai theo từng bài. Không phải đáp án nên không vi phạm
        // nguyên tắc "không lộ correct/explanation" mà spec đang assert.
        lesson_id: q.lessonId,
      };
    });

    // Bước 3: lưu kết quả + đổi trạng thái trong CÙNG transaction.
    // Kiểm tra `status === 'submitted'` ở Bước 1 chỉ là chặn nhanh — hai
    // request song song (bấm đúp) đều đọc ra 'generated' rồi CẢ HAI cùng ghi
    // kết quả. Dùng compare-and-set như completeLesson: chỉ request đổi được
    // trạng thái generated -> submitted mới được ghi, request thua rollback.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.quiz.updateMany({
        where: { id: quizId, status: 'generated' },
        data: { status: 'submitted' },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Quiz này đã được nộp');
      }
      await tx.reviewQuizResult.create({
        data: {
          quizId,
          userId,
          score,
          total: questions.length,
          answersJson: detail,
        },
      });
    });

    return { ok: true, score, total: questions.length, detail };
  }

  // ---------- Task 129 ----------
  async getQuiz(userId: number, quizId: number) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    // 404 (không phải 403) cho quiz của người khác — không tiết lộ quiz đó tồn tại.
    if (!quiz || quiz.userId !== userId) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    const questions = quiz.questionsJson as unknown as QuizQuestion[];

    if (quiz.status !== 'submitted') {
      // CHƯA nộp -> vẫn phải giấu đáp án.
      return {
        ok: true,
        quiz_id: quiz.id,
        status: quiz.status,
        questions: this.stripAnswers(questions),
      };
    }

    const result = await this.prisma.reviewQuizResult.findFirst({
      where: { quizId, userId },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      ok: true,
      quiz_id: quiz.id,
      status: quiz.status,
      score: result?.score ?? 0,
      total: result?.total ?? questions.length,
      detail: result?.answersJson ?? [],
    };
  }

  // ---------- Task 130 ----------
  async getQuizHistory(userId: number, courseId: string) {
    const rows = await this.prisma.reviewQuizResult.findMany({
      where: { userId, quiz: { courseId } },
      orderBy: { submittedAt: 'desc' },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        quizId: true,
        score: true,
        total: true,
        submittedAt: true,
      },
    });
    return { ok: true, history: rows };
  }

  // ---------- helpers ----------

  /**
   * Pool câu hỏi lấy từ các bài ĐÃ hoàn thành trong khóa (kèm lessonId).
   * Dùng chung cho cả quiz random lẫn quiz ôn tập có trọng số — giữ nguyên hai
   * thông báo lỗi tiếng Việt vốn có để FE không phải đổi gì.
   */
  private async buildQuestionPool(
    userId: number,
    courseId: string,
  ): Promise<QuizQuestion[]> {
    // Bước 1: chỉ lấy bài ĐÃ hoàn thành và có nội dung step_2.
    const done = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId, status: 'completed' },
      select: { lessonId: true },
    });
    if (done.length === 0) {
      throw new BadRequestException(
        'Bạn cần hoàn thành ít nhất một bài học trước khi làm quiz',
      );
    }

    const lessons = await this.layStep2(
      done.map((d) => d.lessonId),
      courseId,
    );

    // Bước 2: gom pool câu hỏi, hỗ trợ 2 dạng cấu trúc.
    const pool = this.collectQuestions(lessons);
    if (pool.length < MIN_POOL) {
      throw new BadRequestException(
        'Chưa đủ câu hỏi để tạo quiz, hãy hoàn thành thêm bài học',
      );
    }
    return pool;
  }

  /**
   * Pool trộn câu từ MỌI khoá học viên đã học — dùng cho đề ôn hằng ngày.
   * Cùng luật gom câu với `buildQuestionPool()`, chỉ bỏ điều kiện lọc theo khoá.
   */
  private async buildAllCoursesPool(userId: number): Promise<QuizQuestion[]> {
    const done = await this.prisma.lessonProgress.findMany({
      where: { userId, status: 'completed' },
      select: { lessonId: true },
    });
    if (done.length === 0) {
      throw new BadRequestException(
        'Bạn cần hoàn thành ít nhất một bài học trước khi làm quiz',
      );
    }

    const lessons = await this.layStep2(done.map((d) => d.lessonId));

    const pool = this.collectQuestions(lessons);
    if (pool.length < MIN_POOL) {
      throw new BadRequestException(
        'Chưa đủ câu hỏi để tạo quiz, hãy hoàn thành thêm bài học',
      );
    }
    return pool;
  }

  /**
   * Các bản ghi tiến độ hoàn thành TRONG NGÀY HỌC hôm nay.
   *
   * Lọc thô 48 giờ ở SQL rồi so ngày trong JS bằng `toStudyDate()` — cùng hàm
   * mà logic chuỗi ngày và cờ "đã ôn hôm nay" đang dùng. Làm vậy để khỏi tự
   * tính mốc nửa đêm theo múi giờ (dễ lệch một tiếng khi đổi giờ), mà "hôm nay"
   * ở mọi chỗ trong hệ thống vẫn là cùng một định nghĩa.
   */
  private async todayProgressRows(userId: number) {
    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        status: 'completed',
        completedAt: { gte: new Date(Date.now() - 48 * 3_600_000) },
      },
      select: { lessonId: true, completedAt: true },
    });

    const today = toStudyDate().getTime();
    return rows.filter((r) => toStudyDate(r.completedAt).getTime() === today);
  }

  /** Khoá đóng góp nhiều câu nhất trong đề (hoà thì lấy khoá gặp trước). */
  private dominantCourseId(picked: QuizQuestion[]): string {
    const count = new Map<string, number>();
    for (const q of picked) {
      count.set(q.courseId, (count.get(q.courseId) ?? 0) + 1);
    }
    let best = picked[0].courseId;
    let bestN = 0;
    for (const [id, n] of count) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    return best;
  }

  /** Số câu mỗi đề — kẹp trong [SAMPLE_MIN, SAMPLE_MAX] theo cỡ pool. */
  private sampleSize(poolLength: number): number {
    return Math.min(
      SAMPLE_MAX,
      Math.max(SAMPLE_MIN, Math.min(poolLength, SAMPLE_MAX)),
    );
  }

  /**
   * Lưu SNAPSHOT (kèm đáp án) vào DB rồi trả về bản ĐÃ STRIP cho FE.
   * Bảng `quizzes` không phân biệt đề random hay đề có trọng số.
   */
  private async persistQuiz(
    userId: number,
    courseId: string,
    picked: QuizQuestion[],
  ) {
    const quiz = await this.prisma.quiz.create({
      data: {
        userId,
        courseId,
        status: 'generated',
        questionsJson: picked as unknown as Prisma.InputJsonValue,
      },
    });

    // STRIP đáp án trước khi trả FE (Sheet 3: lộ đáp án = gian lận điểm).
    return {
      ok: true,
      quiz_id: quiz.id,
      questions: this.stripAnswers(picked),
    };
  }

  /**
   * Đếm số câu đã làm và số câu sai theo từng bài, từ `answersJson` của các
   * lần nộp trước. Bản ghi cũ (trước khi có `lesson_id`) bị bỏ qua thay vì
   * tính nhầm vào bài nào đó.
   */
  private tallyMistakesByLesson(
    history: Array<{ answersJson: Prisma.JsonValue }>,
  ) {
    const totalByLesson = new Map<number, number>();
    const wrongByLesson = new Map<number, number>();

    for (const row of history) {
      const detail = row.answersJson;
      if (!Array.isArray(detail)) continue;

      for (const raw of detail) {
        const item = raw as { lesson_id?: unknown; is_correct?: unknown };
        if (typeof item?.lesson_id !== 'number') continue;

        const id = item.lesson_id;
        totalByLesson.set(id, (totalByLesson.get(id) ?? 0) + 1);
        if (item.is_correct === false) {
          wrongByLesson.set(id, (wrongByLesson.get(id) ?? 0) + 1);
        }
      }
    }
    return { totalByLesson, wrongByLesson };
  }

  /**
   * Bốc `n` phần tử KHÔNG lặp lại, xác suất tỉ lệ với trọng số: mỗi vòng cộng
   * dồn trọng số rồi bắn một số ngẫu nhiên vào dải đó, chọn được phần tử nào
   * thì loại luôn khỏi vòng sau.
   * Cỡ pool chỉ vài chục câu nên O(n·m) là thoải mái, không cần tối ưu.
   */
  private weightedSampleWithoutReplacement<T>(
    pool: T[],
    weights: number[],
    n: number,
  ): T[] {
    const items = [...pool];
    const w = [...weights];
    const picked: T[] = [];

    while (picked.length < n && items.length > 0) {
      const sum = w.reduce((a, b) => a + b, 0);
      // Trọng số luôn ≥ 1 nên sum > 0; guard chỉ để phòng khi có ai đổi công
      // thức weight về 0 sau này — khi đó rơi về bốc phần tử đầu còn lại.
      let r = sum > 0 ? Math.random() * sum : 0;

      let idx = items.length - 1;
      for (let i = 0; i < items.length; i++) {
        r -= w[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }

      picked.push(items[idx]);
      items.splice(idx, 1);
      w.splice(idx, 1);
    }
    return picked;
  }

  /**
   * Đọc riêng `step_2` của các bài, thay cho `lesson.findMany` kèm cả
   * `content_json`.
   *
   * Ôn tập chỉ cần câu trắc nghiệm ở `step_2`, nhưng bản cũ kéo NGUYÊN
   * `content_json` của mọi bài đã học: đo trong BE1 là ~1,38 MB mỗi request với
   * người đã học 172 bài, trong khi `step_2` chỉ là một phần nhỏ của nó.
   * Prisma không chọn được một khoá con trong cột JSONB, nên phải dùng SQL thô
   * (tham số hoá bằng `Prisma.sql`, như `LeaderboardService`).
   *
   * JOIN `courses` ngay trong câu này: `getTodayLessons()` cần tên khoá, và
   * quan hệ lồng của Prisma là một vòng tuần tự riêng tới Neon.
   *
   * CACHE theo (id bài, `updated_at`) mà vẫn đúng MỘT vòng: gửi kèm những bài
   * đã có trong cache cùng `ver` của chúng, để chính Postgres so và chỉ trả
   * `step_2` cho bài chưa có hoặc đã sửa. Kiểm `updated_at` bằng một truy vấn
   * riêng thì mỗi request lại thêm một vòng tới Neon, đúng thứ BE3 vừa bớt.
   *
   * So bằng `updated_at::text` chứ không bằng `Date`: cột là `timestamptz(6)`
   * (micro giây) còn `Date` của JS chỉ giữ mili giây, nên gửi lại một `Date`
   * thì không bài nào khớp và cache không bao giờ trúng.
   *
   * Cột `hit` phải tách riêng: `step2` NULL vừa có thể là "đã có trong cache"
   * vừa có thể là "bài này không có step_2".
   *
   * Chỗ CHƯA chặn được: bài sửa bằng đường KHÔNG chạm `updated_at` (SQL tay, bản
   * Django cũ) sẽ dùng `step_2` cũ tới khi máy chủ khởi động lại. Các đường sửa
   * qua Prisma (`CourseAdminService`, `scripts/update-lesson-content.ts`) đều tự
   * đặt `@updatedAt`.
   */
  private async layStep2(
    ids: number[],
    courseId?: string,
  ): Promise<BaiOnTap[]> {
    if (ids.length === 0) return [];

    // Chụp lại TRƯỚC khi chờ DB: request khác có thể đẩy mục ra khỏi cache
    // trong lúc chờ, mà Postgres đã trả `hit = true` cho đúng `ver` gửi đi.
    const known = new Map<number, { ver: string; step2: unknown }>();
    for (const id of ids) {
      const c = this.step2Cache.get(id);
      if (c) known.set(id, c);
    }
    const cachedIds = [...known.keys()];
    const cachedVers = [...known.values()].map((c) => c.ver);

    const rows = await this.prisma.$queryRaw<
      Array<
        Omit<BaiOnTap, 'contentJson'> & {
          ver: string;
          hit: boolean;
          step2: unknown;
        }
      >
    >(Prisma.sql`
      SELECT l.id, l.course_id AS "courseId", l.title, l.module,
             co.title AS "courseTitle", l.updated_at::text AS ver,
             (c.ver IS NOT DISTINCT FROM l.updated_at::text) AS hit,
             CASE WHEN c.ver IS DISTINCT FROM l.updated_at::text
                  THEN l.content_json->'step_2' END AS step2
      FROM lessons l
      JOIN courses co ON co.id = l.course_id
      LEFT JOIN unnest(${cachedIds}::int[], ${cachedVers}::text[]) AS c(id, ver)
        ON c.id = l.id
      WHERE l.id = ANY(${ids}::int[])
      ${courseId === undefined ? Prisma.empty : Prisma.sql`AND l.course_id = ${courseId}`}
    `);

    return rows.map(({ ver, hit, step2, ...r }) => {
      const cached = hit ? known.get(r.id) : undefined;
      if (!cached) this.ghiStep2(r.id, { ver, step2 });
      return { ...r, contentJson: { step_2: cached ? cached.step2 : step2 } };
    });
  }

  private ghiStep2(id: number, entry: { ver: string; step2: unknown }) {
    this.step2Cache.delete(id);
    if (this.step2Cache.size >= STEP2_CACHE_MAX) {
      // Map giữ thứ tự chèn: phần tử đầu là bài vào cache sớm nhất.
      for (const oldest of this.step2Cache.keys()) {
        this.step2Cache.delete(oldest);
        break;
      }
    }
    this.step2Cache.set(id, entry);
  }

  /**
   * Hỗ trợ 2 dạng: { mcq: [...] } hoặc câu hỏi đơn nằm thẳng trong step_2.
   * Nhận nguyên bản ghi lesson (không chỉ content_json) để gắn `lessonId` cho
   * từng câu — cả hai nhánh đều gắn id của lesson đang duyệt.
   */
  private collectQuestions(
    lessons: Array<{ id: number; courseId: string; contentJson: unknown }>,
  ): QuizQuestion[] {
    const pool: QuizQuestion[] = [];

    for (const lesson of lessons) {
      const step2 = asRecord(asRecord(lesson.contentJson)?.step_2);
      if (!step2) continue;

      const tag = { lessonId: lesson.id, courseId: lesson.courseId };
      const list: unknown[] = Array.isArray(step2.mcq) ? step2.mcq : [step2];
      for (const raw of list) {
        const q = this.normalizeQuestion(raw);
        if (q) pool.push({ ...q, ...tag });
      }
    }
    return pool;
  }

  /**
   * Đưa một câu hỏi trong content_json về dạng chuẩn, hoặc null nếu không dùng
   * được. Hỗ trợ HAI cách viết vì nội dung do quản trị dán vào:
   *
   *  1. Dạng chuẩn — `correct` ở CẤP CÂU HỎI:
   *       { question, options: ['a','b'], correct: 0 }
   *
   *  2. Dạng tác giả hay dùng — mỗi lựa chọn tự mang cờ đúng/sai:
   *       { question, options: [{ id, text, correct: true|false, explanation }] }
   *     Đây chính là dạng của toàn bộ nội dung bài học đang có trong dự án.
   *     Trước đây bộ lọc chỉ nhận dạng 1 nên loại sạch dạng 2 -> pool luôn rỗng.
   *
   * Dạng 2 được QUY ĐỔI về dạng 1: `options` thành mảng chuỗi, `correct` thành
   * VỊ TRÍ của lựa chọn đúng. Việc đổi này còn bịt một lỗ lộ đáp án: nếu giữ
   * nguyên object, `stripAnswers()` sẽ gửi thẳng cờ `correct: true/false` của
   * từng lựa chọn về trình duyệt.
   */
  private normalizeQuestion(
    raw: unknown,
  ): Omit<QuizQuestion, 'lessonId' | 'courseId'> | null {
    const x = asRecord(raw);
    if (!x || typeof x.question !== 'string' || !Array.isArray(x.options)) {
      return null;
    }
    // Sau `Array.isArray`, TS mới biết đây là mảng; phần tử vẫn là JSON tự do.
    const rawOptions: unknown[] = x.options;

    // Lựa chọn LUÔN được quy về chuỗi, bất kể `correct` nằm ở đâu. Object lựa
    // chọn mang theo cờ `correct` và lời giải thích của chính nó, mà
    // `stripAnswers()` chỉ bỏ field ở CẤP CÂU HỎI — giữ nguyên object là gửi
    // thẳng đáp án về trình duyệt. Nội dung PE v3 có CẢ HAI (`correct: 0` ở cấp
    // câu hỏi VÀ cờ `correct` trong từng lựa chọn) nên trước đây rơi vào nhánh
    // dạng 1 và lộ sạch đáp án của 60 câu trắc nghiệm.
    // CHÚ Ý: chỉ đọc `text` và `label`. Lựa chọn của khối "dự đoán" do
    // scripts/pe-v4/build.py sinh ra lại dùng khoá `title` — đưa loại câu đó
    // vào kho quiz mà không thêm `?? o.title` thì MỌI lựa chọn thành chuỗi rỗng
    // và không có lỗi nào được ném ra. Giữ nguyên ở đây vì kho quiz hiện chỉ
    // lấy `step_2.mcq`; đổi thì phải đổi cùng lúc với nguồn câu hỏi.
    const options: string[] = rawOptions.map((o) => {
      const opt = asRecord(o);
      // Dữ liệu thật luôn là chuỗi; object lọt tới đây là nội dung hỏng và
      // `String()` cho '[object Object]' — ĐÚNG hành vi cũ (lựa chọn như vậy
      // không khớp đáp án nào), nên chỉ ép kiểu cho TS chứ không đổi luật.
      const text = (opt ? (opt.text ?? opt.label ?? '') : o) as
        string | number | boolean | null;
      return String(text);
    });

    // Dạng 1 — `correct` đã ở cấp câu hỏi; chỉ cần lọc lại `options`.
    if (x.correct !== undefined) {
      return {
        question: x.question,
        // `correct` đi thẳng từ JSON vào snapshot lưu DB, KHÔNG được kiểm lại ở
        // đây (isCorrect() so bằng String() nên số hay chuỗi đều chấm được).
        correct: x.correct as number | string,
        options,
        // Lời giải thích chỉ đi vào bản lưu DB; `stripAnswers()` không trả nó
        // cho FE, và submitQuiz() mới hiện sau khi đã chấm.
        explanation:
          (x.explanation as string | undefined) ??
          (typeof x.correct === 'number'
            ? (asRecord(rawOptions[x.correct])?.explanation as
                string | undefined)
            : undefined),
      };
    }

    // Dạng 2 — tìm lựa chọn được đánh dấu đúng.
    const idx = rawOptions.findIndex((o) => asRecord(o)?.correct === true);
    if (idx < 0) return null;

    return {
      question: x.question,
      options,
      correct: idx,
      // Giải thích của chính đáp án đúng là thứ đáng hiện sau khi chấm.
      explanation:
        (asRecord(rawOptions[idx])?.explanation as string | undefined) ??
        (x.explanation as string | undefined),
    };
  }

  /** Fisher-Yates rồi cắt — tránh sort(() => Math.random()) vốn lệch phân phối. */
  private sample<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  /** Bỏ 'correct' và 'explanation' — dùng ở MỌI nhánh trả câu hỏi cho FE. */
  private stripAnswers(questions: QuizQuestion[]) {
    return questions.map((q, i) => ({
      index: i,
      question: q.question,
      options: q.options,
    }));
  }

  private isCorrect(expected: number | string, given: unknown): boolean {
    if (given === undefined || given === null) return false;
    // `given` là câu trả lời THÔ từ client nên có thể là bất cứ gì. Cách so
    // vẫn là `String()` như trước — object sẽ ra '[object Object]' và không
    // khớp đáp án nào; ép kiểu ở đây chỉ để nói rằng đó là chủ ý.
    const answer = given as string | number | boolean;
    return (
      String(expected).trim().toLowerCase() ===
      String(answer).trim().toLowerCase()
    );
  }
}
