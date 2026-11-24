import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { QuizzesService, STEP2_CACHE_MAX } from './quizzes.service';

/** `jsonb -> 'step_2'`: khoá con của một object, còn lại là NULL. */
function step2Of(contentJson: unknown): unknown {
  return typeof contentJson === 'object' &&
    contentJson !== null &&
    !Array.isArray(contentJson)
    ? ((contentJson as Record<string, unknown>).step_2 ?? null)
    : null;
}

const SNAPSHOT = [
  { question: 'Q1', options: ['a', 'b'], correct: 0, explanation: 'vì a' },
  { question: 'Q2', options: ['x', 'y'], correct: 1 },
];

/**
 * Hình dạng THẬT của câu hỏi trong content_json của 40 bài PE v3: `correct` nằm
 * ở cấp câu hỏi (nên rơi vào nhánh "dạng 1") NHƯNG mỗi lựa chọn vẫn là object
 * mang theo cờ `correct` và `detail`. Fixture cũ chỉ có chuỗi nên không bao giờ
 * chạm tới đường đi này — đó là lý do lỗ lộ đáp án sống sót qua mọi bài test.
 */
const PE_V3_MCQ = {
  question: 'File "a\\r\\nb\\r\\n" cho lines là gì?',
  options: [
    { text: '["a", "b"]', detail: 'rstrip bỏ cả \\r lẫn \\n.', correct: true },
    { text: '["a\\r", "b\\r"]', detail: 'CR cũng bị bỏ.', correct: false },
    {
      text: '["a", "", "b", ""]',
      detail: 'Mỗi dòng đọc một lần.',
      correct: false,
    },
  ],
  correct: 0,
  explanation: 'rstrip("\\r\\n") bỏ cả \\r lẫn \\n ở cuối.',
};

/**
 * Hình dạng câu hỏi trong SNAPSHOT lưu DB (`quiz.questionsJson`) — bản ĐẦY ĐỦ,
 * còn `correct`/`explanation` để chấm ở server, còn `lessonId`/`courseId` để
 * tính trọng số cho những lần ôn sau.
 *
 * Vì sao khai ở đây: nhiều ca trong file này đọc chính đối số mà service truyền
 * cho `prisma.quiz.create()` để chứng minh "FE không thấy đáp án nhưng DB vẫn
 * còn". Trước đây `prisma` khai `any` nên `mock.calls[0][0].data.questionsJson`
 * là `any`: assert sai tên field (`.questionJson`, `.lesson_id`…) vẫn biên dịch
 * được và chỉ lặng lẽ so `undefined`. Đặt kiểu ở đúng ranh giới này thì lỗi gõ
 * sai field là lỗi biên dịch.
 */
type SavedQuestion = {
  question: string;
  options: string[];
  correct: number | string;
  explanation?: string | null;
  lessonId?: number;
  courseId?: string;
};

/** Đối số `prisma.quiz.create({ data })` mà `persistQuiz()` dựng. */
type QuizCreateArg = {
  data: {
    userId: number;
    courseId: string;
    status: string;
    questionsJson: SavedQuestion[];
  };
};

/**
 * Bài học viết theo hình dạng cũ của `lesson.findMany` (kèm cả `contentJson`).
 * `mockLessons()` đổi nó sang đúng hàng mà SQL của `layStep2()` trả về, để các
 * ca có sẵn giữ nguyên fixture.
 */
type LessonFixture = {
  id?: number;
  courseId?: string;
  title?: string;
  module?: string;
  course?: { title: string };
  contentJson: unknown;
};

/**
 * Một hàm Prisma giả. `Promise<unknown>` cho phần giá trị TRẢ VỀ là đủ — mỗi ca
 * tự `mockResolvedValue()` hình dạng nó cần; phần ĐỐI SỐ mới là chỗ cần kiểu
 * thật, vì test đọc lại `mock.calls`.
 */
type AsyncMock<A extends unknown[] = unknown[]> = jest.Mock<
  Promise<unknown>,
  A
>;

/**
 * `jest.fn()` trần trả `Mock<any, any>`: gán vào một field đã khai kiểu là gán
 * `any`, và `no-unsafe-assignment` bắt đúng chỗ đó. Bọc lại để mỗi mock sinh ra
 * đã mang sẵn kiểu đối số.
 */
const asyncMock = <A extends unknown[] = unknown[]>(): AsyncMock<A> =>
  jest.fn<Promise<unknown>, A>();

/** Chỉ những bảng/hàm mà QuizzesService thật sự gọi. */
type PrismaMock = {
  lessonProgress: { findMany: AsyncMock };
  $queryRaw: AsyncMock<[Prisma.Sql]>;
  quiz: {
    create: AsyncMock<[QuizCreateArg]>;
    findUnique: AsyncMock;
    update: AsyncMock;
    updateMany: AsyncMock;
  };
  reviewQuizResult: {
    findFirst: AsyncMock;
    findMany: AsyncMock;
    create: AsyncMock;
  };
  $transaction: AsyncMock<[(tx: PrismaMock) => Promise<unknown>]>;
};

describe('QuizzesService', () => {
  let service: QuizzesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      lessonProgress: { findMany: asyncMock() },
      $queryRaw: asyncMock<[Prisma.Sql]>(),
      quiz: {
        create: asyncMock<[QuizCreateArg]>(),
        findUnique: asyncMock(),
        update: asyncMock(),
        // CAS generated -> submitted trong submitQuiz; mặc định giành được quyền.
        updateMany: asyncMock().mockResolvedValue({ count: 1 }),
      },
      reviewQuizResult: {
        findFirst: asyncMock(),
        findMany: asyncMock(),
        create: asyncMock(),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: PrismaMock) => Promise<unknown>]
      >((cb) => cb(prisma)),
    };

    const mod = await Test.createTestingModule({
      providers: [QuizzesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(QuizzesService);
  });

  /** Mô phỏng `content_json->'step_2'`: DB chỉ trả phần `step_2`. */
  const mockLessons = (rows: LessonFixture[]) =>
    prisma.$queryRaw.mockResolvedValue(
      rows.map((r) => ({
        id: r.id,
        courseId: r.courseId,
        title: r.title ?? null,
        module: r.module ?? null,
        courseTitle: r.course?.title ?? null,
        ver: 'v1',
        hit: false,
        step2: step2Of(r.contentJson),
      })),
    );

  /** Câu SQL của lần gọi `$queryRaw` thứ `i`. */
  const sqlCall = (i = 0) => prisma.$queryRaw.mock.calls[i][0];

  // ---------- Task 135 ----------
  describe('KHÔNG BAO GIỜ lộ đáp án ở mọi nhánh', () => {
    it('generateQuiz: response không chứa correct/explanation, nhưng DB có', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 1 }]);
      mockLessons([
        {
          contentJson: {
            step_2: { mcq: [...SNAPSHOT, ...SNAPSHOT, ...SNAPSHOT] },
          },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 9 });

      const res = await service.generateQuiz(1, 'c1');

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('explanation');
      // Nhưng snapshot lưu DB PHẢI còn đáp án để chấm điểm server-side.
      const saved = JSON.stringify(
        prisma.quiz.create.mock.calls[0][0].data.questionsJson,
      );
      expect(saved).toContain('correct');
    });

    it('câu hỏi PE v3 (correct ở cấp câu hỏi + cờ trong từng lựa chọn) không lộ gì', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 1 }]);
      mockLessons([
        {
          id: 1,
          courseId: 'python',
          contentJson: {
            step_2: {
              mcq: [PE_V3_MCQ, PE_V3_MCQ, PE_V3_MCQ, PE_V3_MCQ, PE_V3_MCQ],
            },
          },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 9 });

      const res = await service.generateQuiz(1, 'python');

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('detail');
      expect(serialized).not.toContain('explanation');
      // Lựa chọn phải tới FE dưới dạng chuỗi thuần, giữ nguyên thứ tự.
      expect(res.questions[0].options).toEqual([
        '["a", "b"]',
        '["a\\r", "b\\r"]',
        '["a", "", "b", ""]',
      ]);
      // Bản lưu DB vẫn phải đủ đáp án để chấm điểm ở server.
      const saved = prisma.quiz.create.mock.calls[0][0].data.questionsJson;
      expect(saved[0].correct).toBe(0);
    });

    it('getQuiz khi CHƯA nộp: vẫn giấu đáp án', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 9,
        userId: 1,
        status: 'generated',
        questionsJson: SNAPSHOT,
      });

      const res = await service.getQuiz(1, 9);
      expect(JSON.stringify(res)).not.toContain('correct');
    });
  });

  describe('submitQuiz', () => {
    it('chấm theo SNAPSHOT trong DB, bỏ qua điểm client gửi', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 9,
        userId: 1,
        status: 'generated',
        questionsJson: SNAPSHOT,
      });

      // Client trả lời: câu 1 đúng (0), câu 2 sai (0 thay vì 1).
      const res = await service.submitQuiz(1, 9, [0, 0]);

      expect(res.score).toBe(1);
      expect(res.total).toBe(2);
      expect(prisma.reviewQuizResult.create).toHaveBeenCalled();
    });

    it('quiz của người khác -> 403', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 9,
        userId: 999,
        status: 'generated',
        questionsJson: SNAPSHOT,
      });
      await expect(service.submitQuiz(1, 9, [])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('hai request song song cùng nộp -> request thua CAS nhận 409, không ghi kết quả', async () => {
      // Cả hai đều đọc ra status 'generated' (race), nhưng CAS trong
      // transaction chỉ cho MỘT request đổi được trạng thái.
      prisma.quiz.findUnique.mockResolvedValue({
        id: 9,
        userId: 1,
        status: 'generated',
        questionsJson: SNAPSHOT,
      });
      prisma.quiz.updateMany.mockResolvedValue({ count: 0 }); // thua CAS

      await expect(service.submitQuiz(1, 9, [0, 1])).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.reviewQuizResult.create).not.toHaveBeenCalled();
    });

    it('đã nộp rồi -> 409, không ghi kết quả lần 2', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 9,
        userId: 1,
        status: 'submitted',
        questionsJson: SNAPSHOT,
      });
      await expect(service.submitQuiz(1, 9, [])).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.reviewQuizResult.create).not.toHaveBeenCalled();
    });
  });

  // ---------- Task 136 ----------
  describe('generateReviewQuiz (đề ôn tập có trọng số)', () => {
    // Pool 2 bài: bài 1 (hay sai) 6 câu, bài 2 (luôn đúng) 6 câu — đủ vượt
    // MIN_POOL để không rơi vào nhánh "chưa đủ câu hỏi".
    const q = (n: string) => ({
      question: n,
      options: ['a', 'b'],
      correct: 0,
      explanation: 'vì a',
    });
    const mockPool = () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1 },
        { lessonId: 2 },
      ]);
      mockLessons([
        {
          id: 1,
          contentJson: {
            step_2: {
              mcq: [q('L1a'), q('L1b'), q('L1c'), q('L1d'), q('L1e'), q('L1f')],
            },
          },
        },
        {
          id: 2,
          contentJson: {
            step_2: {
              mcq: [q('L2a'), q('L2b'), q('L2c'), q('L2d'), q('L2e'), q('L2f')],
            },
          },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 21 });
    };

    it('không lộ đáp án, cũng không lộ lessonId; snapshot DB vẫn đủ dữ liệu', async () => {
      mockPool();
      // Bài 1 sai 2/2, bài 2 đúng 2/2.
      prisma.reviewQuizResult.findMany.mockResolvedValue([
        {
          answersJson: [
            { lesson_id: 1, is_correct: false },
            { lesson_id: 1, is_correct: false },
            { lesson_id: 2, is_correct: true },
            { lesson_id: 2, is_correct: true },
          ],
        },
      ]);

      const res = await service.generateReviewQuiz(1, 'c1');

      expect(res.ok).toBe(true);
      expect(res.quiz_id).toBe(21);
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('explanation');
      // lessonId chỉ để tính trọng số ở backend, không được lộ ra FE.
      expect(serialized).not.toContain('lessonId');
      // Giữ đúng hợp đồng với FE: {index, question, options}.
      // `expect.any()` khai kiểu trả về là `any` trong @types/jest; ép về đúng
      // kiểu của field nó so sánh để chỗ này không mở lại một lỗ `any`.
      expect(res.questions[0]).toEqual({
        index: 0,
        question: expect.any(String) as string,
        options: ['a', 'b'],
      });

      // Snapshot lưu DB PHẢI còn đáp án + lessonId để chấm và để tính trọng số
      // cho những lần ôn sau.
      const saved = JSON.stringify(
        prisma.quiz.create.mock.calls[0][0].data.questionsJson,
      );
      expect(saved).toContain('correct');
      expect(saved).toContain('lessonId');
    });

    it('chưa có lịch sử làm bài -> không chia cho 0, vẫn ra đề bình thường', async () => {
      mockPool();
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);

      const res = await service.generateReviewQuiz(1, 'c1');

      expect(res.ok).toBe(true);
      expect(res.questions).toHaveLength(10); // SAMPLE_MAX, pool 12 câu
      expect(res.questions.every((x) => Number.isFinite(x.index))).toBe(true);
    });

    it('bỏ qua bản ghi cũ thiếu lesson_id thay vì tính nhầm', async () => {
      mockPool();
      prisma.reviewQuizResult.findMany.mockResolvedValue([
        // dữ liệu từ trước khi có lesson_id
        { answersJson: [{ is_correct: false }, { is_correct: false }] },
        { answersJson: 'không phải mảng' },
        { answersJson: [{ lesson_id: 1, is_correct: false }] },
      ]);

      const res = await service.generateReviewQuiz(1, 'c1');
      expect(res.ok).toBe(true);
      expect(res.questions).toHaveLength(10);
    });

    it('nghiêng về bài hay sai (đo trên nhiều lần chạy)', async () => {
      // Trọng số bài 1 = 2, bài 2 = 1 -> kỳ vọng bài 1 chiếm nhiều hơn.
      // Chạy 200 lần rồi so tổng, tránh phụ thuộc một lần random may rủi.
      let fromL1 = 0;
      let fromL2 = 0;
      for (let i = 0; i < 200; i++) {
        mockPool();
        prisma.reviewQuizResult.findMany.mockResolvedValue([
          {
            answersJson: [
              { lesson_id: 1, is_correct: false },
              { lesson_id: 2, is_correct: true },
            ],
          },
        ]);
        await service.generateReviewQuiz(1, 'c1');
        const saved =
          prisma.quiz.create.mock.calls.at(-1)![0].data.questionsJson;
        // Đề 10 câu trên pool 12 câu nên chênh lệch bị nén lại, nhưng hướng
        // nghiêng vẫn phải thấy được: đếm câu bài 1 lọt vào đề.
        fromL1 += saved.filter((x) => x.lessonId === 1).length;
        fromL2 += saved.filter((x) => x.lessonId === 2).length;
      }
      expect(fromL1).toBeGreaterThan(fromL2);
    });
  });

  // ---------- Task 138 ----------
  describe('generateDailyReviewQuiz (đề ôn hằng ngày, gộp mọi khoá)', () => {
    const q = (n: string) => ({
      question: n,
      options: ['a', 'b'],
      correct: 0,
      explanation: 'vì a',
    });
    // Khoá 'python' 8 câu, khoá 'cpp' 4 câu -> python là khoá áp đảo.
    const mockPool = () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1 },
        { lessonId: 2 },
      ]);
      mockLessons([
        {
          id: 1,
          courseId: 'python',
          contentJson: {
            step_2: {
              mcq: [
                q('P1'),
                q('P2'),
                q('P3'),
                q('P4'),
                q('P5'),
                q('P6'),
                q('P7'),
                q('P8'),
              ],
            },
          },
        },
        {
          id: 2,
          courseId: 'cpp',
          contentJson: {
            step_2: { mcq: [q('C1'), q('C2'), q('C3'), q('C4')] },
          },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 31 });
    };

    it('chưa ôn hôm nay -> ra đề, trộn câu từ NHIỀU khoá', async () => {
      mockPool();
      // Lần nộp gần nhất là hôm kia -> không chặn.
      prisma.reviewQuizResult.findFirst.mockResolvedValue({
        submittedAt: new Date(Date.now() - 2 * 86_400_000),
      });
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);

      const res = await service.generateDailyReviewQuiz(1);

      expect(res.ok).toBe(true);
      expect(res.quiz_id).toBe(31);
      expect(res.questions).toHaveLength(10);

      const saved = prisma.quiz.create.mock.calls[0][0].data.questionsJson;
      const courses = new Set(saved.map((x) => x.courseId));
      expect(courses.size).toBeGreaterThan(1); // thật sự gộp khoá

      // Không lộ gì thừa ra FE.
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('courseId');
      expect(serialized).not.toContain('lessonId');
    });

    it('đề trộn khoá vẫn ghi vào khoá đóng góp nhiều câu nhất', async () => {
      mockPool();
      prisma.reviewQuizResult.findFirst.mockResolvedValue(null);
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);

      await service.generateDailyReviewQuiz(1);

      // Pool 12 câu (8 python / 4 cpp), lấy 10 -> python luôn chiếm đa số.
      expect(prisma.quiz.create.mock.calls[0][0].data.courseId).toBe('python');
    });

    it('đã nộp trong ngày hôm nay -> chặn, không tạo đề mới', async () => {
      mockPool();
      prisma.reviewQuizResult.findFirst.mockResolvedValue({
        submittedAt: new Date(),
      });

      await expect(service.generateDailyReviewQuiz(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.quiz.create).not.toHaveBeenCalled();
    });

    it('chưa từng ôn lần nào -> vẫn ra đề bình thường', async () => {
      mockPool();
      prisma.reviewQuizResult.findFirst.mockResolvedValue(null);
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);

      const res = await service.generateDailyReviewQuiz(1);
      expect(res.ok).toBe(true);
      expect(res.questions).toHaveLength(10);
    });
  });

  // ---------- Task 139-140 ----------
  describe('Bộ đếm + đề "bài học hôm nay"', () => {
    const q = (n: string) => ({
      question: n,
      options: ['a', 'b'],
      correct: 0,
      explanation: 'vì a',
    });
    const HOM_NAY = new Date();
    const HOM_KIA = new Date(Date.now() - 2 * 86_400_000);

    /** 2 bài xong HÔM NAY (6 câu) + 1 bài xong hôm kia (phải bị loại). */
    const mockToday = () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1, completedAt: HOM_NAY },
        { lessonId: 2, completedAt: HOM_NAY },
        { lessonId: 9, completedAt: HOM_KIA },
      ]);
      mockLessons([
        {
          id: 1,
          courseId: 'python',
          title: 'Vòng lặp for',
          module: 'M1',
          course: { title: 'Python' },
          contentJson: { step_2: { mcq: [q('A1'), q('A2'), q('A3')] } },
        },
        {
          id: 2,
          courseId: 'cpp',
          title: 'Con trỏ',
          module: 'M1',
          course: { title: 'C/C++' },
          contentJson: { step_2: { mcq: [q('B1'), q('B2'), q('B3')] } },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 41 });
    };

    it('chỉ đếm bài hoàn thành HÔM NAY, bỏ bài hôm kia', async () => {
      mockToday();
      const res = await service.getTodayLessons(1);

      // lessonProgress trả 3 dòng nhưng chỉ 2 dòng là của hôm nay -> chỉ 2
      // lessonId được đưa vào truy vấn lesson.
      expect(sqlCall().values).toContainEqual([1, 2]);

      expect(res.count).toBe(2);
      expect(res.questions_available).toBe(6);
      expect(res.can_quiz).toBe(true);
      expect(res.lessons.map((l) => l.title).sort()).toEqual([
        'Con trỏ',
        'Vòng lặp for',
      ]);
      expect(res.lessons[0].course_title).toBeTruthy();
      expect(res.lessons[0].question_count).toBe(3);
    });

    it('chưa học bài nào hôm nay -> đếm 0, không gọi tới bảng lessons', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 9, completedAt: HOM_KIA },
      ]);

      const res = await service.getTodayLessons(1);
      expect(res.count).toBe(0);
      expect(res.can_quiz).toBe(false);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('sinh đề chỉ từ bài hôm nay, không lộ đáp án', async () => {
      mockToday();
      const res = await service.generateTodayQuiz(1);

      expect(res.ok).toBe(true);
      expect(res.quiz_id).toBe(41);
      // pool 6 câu, sampleSize kẹp trong [5,10] -> lấy trọn cả 6
      expect(res.questions).toHaveLength(6);

      const saved = prisma.quiz.create.mock.calls[0][0].data.questionsJson;
      // Không câu nào được lấy từ bài học hôm kia.
      expect(saved.every((x) => x.lessonId === 1 || x.lessonId === 2)).toBe(
        true,
      );

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('lessonId');
    });

    it('hôm nay chưa học bài nào -> 400 với lời nhắc riêng', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([]);
      await expect(service.generateTodayQuiz(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.quiz.create).not.toHaveBeenCalled();
    });

    it('bài hôm nay có nhưng chưa đủ câu -> 400, không tạo đề', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1, completedAt: HOM_NAY },
      ]);
      mockLessons([
        {
          id: 1,
          courseId: 'python',
          contentJson: { step_2: { mcq: [q('A1'), q('A2')] } }, // 2 < MIN_POOL
        },
      ]);

      await expect(service.generateTodayQuiz(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.quiz.create).not.toHaveBeenCalled();
    });
  });

  // ---------- Task 144 ----------
  describe('Đọc được câu hỏi dạng "correct nằm ở từng lựa chọn"', () => {
    // Đây là dạng của TOÀN BỘ nội dung bài học có sẵn trong dự án
    // (lesson_content*.js): mỗi option tự mang cờ correct + explanation,
    // KHÔNG có `correct` ở cấp câu hỏi.
    const qOptLevel = (n: string, dungO: number) => ({
      question: n,
      options: ['A', 'B', 'C', 'D'].map((t, i) => ({
        id: t.toLowerCase(),
        text: t + ' — ' + n,
        correct: i === dungO,
        explanation: i === dungO ? 'vì đây đúng' : 'sai vì...',
      })),
    });

    it('quy đổi sang dạng chuẩn: options thành chuỗi, correct thành vị trí', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 1 }]);
      mockLessons([
        {
          id: 1,
          courseId: 'db_design',
          contentJson: {
            step_2: {
              mcq: [
                qOptLevel('C1', 1),
                qOptLevel('C2', 0),
                qOptLevel('C3', 3),
                qOptLevel('C4', 2),
                qOptLevel('C5', 1),
              ],
            },
          },
        },
      ]);
      prisma.quiz.create.mockResolvedValue({ id: 55 });

      const res = await service.generateQuiz(1, 'db_design');
      expect(res.questions).toHaveLength(5);

      // FE nhận options là mảng CHUỖI, không phải object.
      expect(res.questions[0].options.every((o) => typeof o === 'string')).toBe(
        true,
      );

      const saved = prisma.quiz.create.mock.calls[0][0].data.questionsJson;
      // Snapshot lưu DB có `correct` là VỊ TRÍ lựa chọn đúng.
      for (const q of saved) {
        expect(typeof q.correct).toBe('number');
        expect(q.options[q.correct]).toContain(q.question);
      }
      // Không rò cờ correct/explanation của từng lựa chọn ra FE.
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('correct');
      expect(serialized).not.toContain('explanation');
    });

    it('chấm điểm khớp: gửi vị trí lựa chọn đúng -> tính điểm', async () => {
      const snapshot = [
        { question: 'C1', options: ['A', 'B'], correct: 1, lessonId: 1 },
        { question: 'C2', options: ['A', 'B'], correct: 0, lessonId: 1 },
      ];
      prisma.quiz.findUnique.mockResolvedValue({
        id: 7,
        userId: 1,
        status: 'generated',
        questionsJson: snapshot,
      });

      const res = await service.submitQuiz(1, 7, [1, 1]);
      expect(res.score).toBe(1); // câu 1 đúng, câu 2 sai
      expect(res.total).toBe(2);
    });

    it('câu không có lựa chọn nào đánh dấu đúng -> bỏ qua, không nhận bừa', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 1 }]);
      mockLessons([
        {
          id: 1,
          courseId: 'db_design',
          contentJson: {
            step_2: {
              mcq: [
                { question: 'Hỏng', options: [{ text: 'A' }, { text: 'B' }] },
              ],
            },
          },
        },
      ]);

      await expect(service.generateQuiz(1, 'db_design')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('getQuiz của người khác -> 404 (không tiết lộ quiz tồn tại)', async () => {
    prisma.quiz.findUnique.mockResolvedValue({
      id: 9,
      userId: 999,
      status: 'generated',
      questionsJson: SNAPSHOT,
    });
    await expect(service.getQuiz(1, 9)).rejects.toThrow(NotFoundException);
  });

  // ---------- BE4 ----------
  describe('BE4: cache step_2 theo (id bài, updated_at), vẫn một vòng', () => {
    const q = (n: string) => ({
      question: n,
      options: ['a', 'b'],
      correct: 0,
      explanation: 'vì a',
    });
    /** Một hàng đúng như SQL của `layStep2()` trả về. */
    const row = (id: number, ver: string, hit: boolean, step2: unknown) => ({
      id,
      courseId: 'python',
      title: `Bài ${id}`,
      module: null,
      courseTitle: 'Python',
      ver,
      hit,
      step2,
    });
    const BA_CAU = { mcq: [q('A'), q('B'), q('C')] };
    const hocHomNay = (...ids: number[]) =>
      prisma.lessonProgress.findMany.mockResolvedValue(
        ids.map((lessonId) => ({ lessonId, completedAt: new Date() })),
      );

    it('lần sau gửi kèm (id, ver) đã có; DB trả hit thì dùng step_2 trong cache', async () => {
      hocHomNay(1, 2);
      prisma.$queryRaw.mockResolvedValueOnce([
        row(1, 'v1', false, BA_CAU),
        row(2, 'v1', false, BA_CAU),
      ]);
      const lan1 = await service.getTodayLessons(1);

      // Lần 1 cache rỗng: không gửi bài nào.
      expect(sqlCall(0).values).toContainEqual([]);

      // Lần 2 DB nói "khớp ver" và KHÔNG gửi lại step_2.
      prisma.$queryRaw.mockResolvedValueOnce([
        row(1, 'v1', true, null),
        row(2, 'v1', true, null),
      ]);
      const lan2 = await service.getTodayLessons(1);

      expect(sqlCall(1).values).toContainEqual([1, 2]);
      expect(sqlCall(1).values).toContainEqual(['v1', 'v1']);
      expect(lan2.questions_available).toBe(6);
      expect(lan2.questions_available).toBe(lan1.questions_available);
      expect(lan2.lessons.map((l) => l.question_count)).toEqual(
        lan1.lessons.map((l) => l.question_count),
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('bài đã sửa (ver đổi) -> dùng step_2 MỚI và nhớ ver mới', async () => {
      hocHomNay(1);
      prisma.$queryRaw.mockResolvedValueOnce([row(1, 'v1', false, BA_CAU)]);
      await service.getTodayLessons(1);

      prisma.$queryRaw.mockResolvedValueOnce([
        row(1, 'v2', false, { mcq: [q('Mới')] }),
      ]);
      const sau = await service.getTodayLessons(1);
      expect(sau.questions_available).toBe(1);

      prisma.$queryRaw.mockResolvedValueOnce([row(1, 'v2', true, null)]);
      const lanBa = await service.getTodayLessons(1);
      expect(sqlCall(2).values).toContainEqual(['v2']);
      expect(lanBa.questions_available).toBe(1);
    });

    it('bài không có step_2 cũng được nhớ, và hit sau đó vẫn ra 0 câu', async () => {
      hocHomNay(1, 2);
      prisma.$queryRaw.mockResolvedValueOnce([
        row(1, 'v1', false, BA_CAU),
        row(2, 'v1', false, null),
      ]);
      await service.getTodayLessons(1);

      prisma.$queryRaw.mockResolvedValueOnce([
        row(1, 'v1', true, null),
        row(2, 'v1', true, null),
      ]);
      const res = await service.getTodayLessons(1);
      expect(sqlCall(1).values).toContainEqual([1, 2]);
      expect(res.questions_available).toBe(3);
    });

    it(`vượt ${STEP2_CACHE_MAX} bài thì bỏ bài vào cache sớm nhất`, async () => {
      const ids = Array.from({ length: STEP2_CACHE_MAX + 1 }, (_, i) => i + 1);
      hocHomNay(...ids);
      prisma.$queryRaw.mockResolvedValueOnce(
        ids.map((id) => row(id, 'v1', false, null)),
      );
      await service.getTodayLessons(1);

      prisma.$queryRaw.mockResolvedValueOnce([]);
      await service.getTodayLessons(1);
      const daGui = sqlCall(1).values.find(
        (v): v is number[] => Array.isArray(v) && v.length === STEP2_CACHE_MAX,
      );
      expect(daGui).toBeDefined();
      expect(daGui).not.toContain(1);
      expect(daGui).toContain(STEP2_CACHE_MAX + 1);
    });
  });

  describe('BE4: ôn tập chỉ đọc step_2, không kéo cả content_json', () => {
    const q = (n: string) => ({
      question: n,
      options: ['a', 'b'],
      correct: 0,
      explanation: 'vì a',
    });
    const NAM_CAU = {
      step_2: { mcq: [q('1'), q('2'), q('3'), q('4'), q('5')] },
    };

    it('SQL chỉ lấy content_json->step_2, không lấy nguyên cột', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 7 }]);
      mockLessons([{ id: 7, courseId: 'python', contentJson: NAM_CAU }]);
      prisma.quiz.create.mockResolvedValue({ id: 1 });

      await service.generateQuiz(1, 'python');

      const sql = sqlCall().sql;
      expect(sql).toContain(`content_json->'step_2'`);
      // Bỏ đúng chỗ đọc step_2 đi thì không được còn chỗ nào nhắc tới cột này.
      expect(sql.replaceAll(`content_json->'step_2'`, '')).not.toContain(
        'content_json',
      );
    });

    it('đề theo khoá vẫn lọc course_id; đề hằng ngày thì không', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 7 }]);
      mockLessons([{ id: 7, courseId: 'python', contentJson: NAM_CAU }]);
      prisma.quiz.create.mockResolvedValue({ id: 1 });
      prisma.reviewQuizResult.findFirst.mockResolvedValue(null);
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);

      await service.generateQuiz(1, 'python');
      await service.generateDailyReviewQuiz(1);

      expect(sqlCall(0).sql).toContain('l.course_id =');
      expect(sqlCall(0).values).toContain('python');
      expect(sqlCall(1).sql).not.toContain('l.course_id =');
      expect(sqlCall(1).values).not.toContain('python');
    });

    it('bài không có step_2 (DB trả NULL) -> không sinh câu, không vỡ', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1, completedAt: new Date() },
        { lessonId: 2, completedAt: new Date() },
      ]);
      mockLessons([
        { id: 1, courseId: 'python', contentJson: NAM_CAU },
        { id: 2, courseId: 'python', contentJson: { step_1: {} } },
      ]);

      const res = await service.getTodayLessons(1);
      expect(res.questions_available).toBe(5);
      expect(res.lessons.map((l) => l.question_count).sort()).toEqual([0, 5]);
    });

    it('tên khoá lấy từ JOIN courses trong cùng câu SQL', async () => {
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 1, completedAt: new Date() },
      ]);
      mockLessons([
        {
          id: 1,
          courseId: 'python_advanced',
          course: { title: 'Python nâng cao' },
          contentJson: NAM_CAU,
        },
      ]);

      const res = await service.getTodayLessons(1);
      expect(res.lessons[0].course_title).toBe('Python nâng cao');
      expect(sqlCall().sql).toContain('JOIN courses');
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('trên 48 bài thật: chỉ đưa step_2 cho ra ĐÚNG bộ câu như cả content_json', () => {
      // Hình dạng thật đang seed vào DB (xem AGENTS.md: fixture phải giống thật).
      const dir = join(__dirname, '../../scripts/pe-v4/out-advanced/lessons');
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);

      type Bai = { id: number; courseId: string; contentJson: unknown };
      const svc = service as unknown as {
        collectQuestions(l: Bai[]): unknown[];
      };
      const gom = (l: Bai[]) => svc.collectQuestions(l);

      let tong = 0;
      files.forEach((f, i) => {
        const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
          content_json: unknown;
        };
        const ca = { id: i + 1, courseId: 'python_advanced' };
        const cu = gom([{ ...ca, contentJson: raw.content_json }]);
        const moi = gom([
          { ...ca, contentJson: { step_2: step2Of(raw.content_json) } },
        ]);
        expect(moi).toEqual(cu);
        tong += cu.length;
      });
      // 46 bài 3 câu + 2 bài 4 câu (AGENTS.md) — chặn trường hợp cả hai bên
      // cùng rỗng mà vẫn "bằng nhau".
      expect(tong).toBeGreaterThanOrEqual(files.length * 3);
    });
  });

  // ---------- BE14 ----------
  describe('BE14: GET /courses/:id/quiz/status', () => {
    const KHOA = 'python_advanced';

    /** Bài THẬT thứ `i` (0-based) của gói đang seed — fixture phải giống thật. */
    const baiThat = (i: number): LessonFixture => {
      const dir = join(__dirname, '../../scripts/pe-v4/out-advanced/lessons');
      const f = readdirSync(dir)
        .filter((x) => x.endsWith('.json'))
        .sort()[i];
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        content_json: unknown;
      };
      return { id: i + 1, courseId: KHOA, contentJson: raw.content_json };
    };
    const soCau = (b: LessonFixture) =>
      (step2Of(b.contentJson) as { mcq: unknown[] }).mcq.length;

    const daXong = (...ids: number[]) =>
      prisma.lessonProgress.findMany.mockResolvedValue(
        ids.map((lessonId) => ({ lessonId })),
      );

    it('chưa xong bài nào: 0 câu, ngưỡng MIN_POOL, không ném lỗi, không đọc lessons', async () => {
      daXong();
      const res = await service.getCourseQuizStatus(1, KHOA);

      expect(res).toEqual({
        ok: true,
        lessons_completed: 0,
        lessons_counted: 0,
        questions_available: 0,
        min_questions: 5,
        can_quiz: false,
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('xong 1 bài thật (3 câu): chưa mở đề — MIN_POOL đếm theo câu', async () => {
      const b1 = baiThat(0);
      daXong(1);
      mockLessons([b1]);

      const res = await service.getCourseQuizStatus(1, KHOA);
      expect(soCau(b1)).toBeLessThan(5);
      expect(res.lessons_completed).toBe(1);
      expect(res.lessons_counted).toBe(1);
      expect(res.questions_available).toBe(soCau(b1));
      expect(res.can_quiz).toBe(false);
    });

    it('xong 2 bài thật: mở đề, đếm đúng số câu; chỉ lọc bài của chính khoá và chính người đó', async () => {
      const b1 = baiThat(0);
      const b2 = baiThat(1);
      daXong(1, 2);
      mockLessons([b1, b2]);

      const res = await service.getCourseQuizStatus(7, KHOA);
      expect(res.lessons_completed).toBe(2);
      expect(res.lessons_counted).toBe(2);
      expect(res.questions_available).toBe(soCau(b1) + soCau(b2));
      expect(res.can_quiz).toBe(true);

      expect(prisma.lessonProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 7, courseId: KHOA, status: 'completed' },
        }),
      );
      expect(sqlCall().values).toContain(KHOA);
    });

    it('lessons_counted chỉ đếm bài THỰC SỰ góp câu, không đếm bài xong mà không có trắc nghiệm', async () => {
      daXong(1, 2);
      mockLessons([baiThat(0), { id: 2, courseId: KHOA, contentJson: {} }]);

      const res = await service.getCourseQuizStatus(1, KHOA);
      expect(res.lessons_completed).toBe(2);
      expect(res.lessons_counted).toBe(1);
    });

    it('chỉ trả số đếm: không lộ câu hỏi, đáp án hay lời giải thích', async () => {
      daXong(1, 2);
      mockLessons([baiThat(0), baiThat(1)]);

      const res = await service.getCourseQuizStatus(1, KHOA);
      expect(Object.keys(res).sort()).toEqual([
        'can_quiz',
        'lessons_completed',
        'lessons_counted',
        'min_questions',
        'ok',
        'questions_available',
      ]);
    });

    it('can_quiz nói đúng điều generateReviewQuiz sẽ làm ở lần bấm kế tiếp', async () => {
      prisma.reviewQuizResult.findMany.mockResolvedValue([]);
      prisma.quiz.create.mockResolvedValue({ id: 1 });

      for (const bai of [[baiThat(0)], [baiThat(0), baiThat(1)]]) {
        daXong(...bai.map((b) => b.id ?? 0));
        mockLessons(bai);
        const { can_quiz } = await service.getCourseQuizStatus(1, KHOA);
        const de = service.generateReviewQuiz(1, KHOA);
        if (can_quiz) await expect(de).resolves.toMatchObject({ ok: true });
        else await expect(de).rejects.toThrow(BadRequestException);
      }
    });
  });
});
