import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from 'src/generated/prisma';
import { PlacementService } from './placement.service';
import {
  grade,
  levelFromScore,
  parseQuestions,
  publicView,
} from './placement.logic';

// Hình dạng THẬT của bộ câu hỏi (file mẫu cũng là file load-questionnaire.ts đọc).
const raw: unknown = JSON.parse(
  readFileSync(
    join(__dirname, '../../scripts/placement/questions.sample.json'),
    'utf8',
  ),
);
const questions = parseQuestions(raw);

describe('placement.logic', () => {
  it('publicView không bao giờ chứa đáp án đúng', () => {
    const json = JSON.stringify(publicView(questions));
    expect(json).not.toContain('correctIndex');
    expect(publicView(questions)[0]).toMatchObject({
      id: 1,
      options: ['[0, 2, 4]', '[2, 4, 6]', '[0, 1, 2]', '[1, 2, 3]'],
    });
  });

  it('chấm theo thứ tự câu, -1 là bỏ qua', () => {
    expect(grade(questions, [0, 0, 0, 0, 0])).toEqual({ score: 5, total: 5 });
    expect(grade(questions, [1, 0, -1, 0, 3])).toEqual({ score: 2, total: 5 });
  });

  it('từ chối đáp án sai độ dài hoặc ngoài khoảng', () => {
    expect(grade(questions, [0, 0])).toBeNull();
    expect(grade(questions, [0, 0, 0, 0, 9])).toBeNull();
    expect(grade(questions, [0, 0, 0, 0, -2])).toBeNull();
    expect(grade(questions, [0, 0, 0, 0, 1.5])).toBeNull();
  });

  it('parseQuestions bắt dữ liệu sai hình, nói rõ câu nào', () => {
    expect(() => parseQuestions([])).toThrow(/ít nhất 1 câu/);
    expect(() =>
      parseQuestions([
        { id: 1, question: 'q', options: ['a', 'b'], correctIndex: 2 },
      ]),
    ).toThrow(/Câu #1.*correctIndex/);
    expect(() =>
      parseQuestions([
        { id: 1, question: 'q', options: ['a'], correctIndex: 0 },
      ]),
    ).toThrow(/options/);
    const dup = { id: 1, question: 'q', options: ['a', 'b'], correctIndex: 0 };
    expect(() => parseQuestions([dup, dup])).toThrow(/Câu #2.*id/);
  });

  it('ngưỡng cấp độ', () => {
    expect(levelFromScore(1, 5)).toBe('beginner');
    expect(levelFromScore(3, 5)).toBe('intermediate');
    expect(levelFromScore(5, 5)).toBe('advanced');
  });
});

describe('PlacementService', () => {
  type Mock = {
    questionnaire: { findFirst: jest.Mock };
    placementAttempt: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  const make = () => {
    const prisma: Mock = {
      questionnaire: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 7, version: 1, questionsJson: raw }),
      },
      placementAttempt: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    return { prisma, svc: new PlacementService(prisma as never) };
  };

  it('getQuestions: không lộ đáp án và cache bản đang bật', async () => {
    const { prisma, svc } = make();
    const a = await svc.getQuestions();
    await svc.getQuestions();
    expect(JSON.stringify(a)).not.toContain('correctIndex');
    expect(prisma.questionnaire.findFirst).toHaveBeenCalledTimes(1);
  });

  it('submit: server tự chấm, bỏ qua điểm do client gửi', async () => {
    const { prisma, svc } = make();
    prisma.placementAttempt.create.mockImplementation(
      ({ data }: { data: { score: number; total: number } }) =>
        Promise.resolve(data),
    );
    const r = await svc.submit(1, {
      questionnaireId: 7,
      answers: [0, 0, 0, 1, 1],
      score: 5,
    } as never);
    expect(r).toMatchObject({
      score: 3,
      total: 5,
      level: 'intermediate',
      repeated: false,
    });
    expect(
      (prisma.placementAttempt.create.mock.calls as [{ data: unknown }][])[0][0]
        .data,
    ).toMatchObject({
      userId: 1,
      questionnaireId: 7,
      score: 3,
    });
  });

  it('submit: bộ câu hỏi đã đổi thì 409, đáp án sai độ dài thì 400', async () => {
    const { svc } = make();
    await expect(
      svc.submit(1, { questionnaireId: 99, answers: [0, 0, 0, 0, 0] }),
    ).rejects.toThrow(/tải lại/);
    await expect(
      svc.submit(1, { questionnaireId: 7, answers: [0] }),
    ).rejects.toThrow(/không hợp lệ/);
  });

  it('submit: gửi lại (P2002) trả kết quả lần đầu, không chấm lại', async () => {
    const { prisma, svc } = make();
    prisma.placementAttempt.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    prisma.placementAttempt.findUnique.mockResolvedValue({
      score: 5,
      total: 5,
    });
    const r = await svc.submit(1, {
      questionnaireId: 7,
      answers: [3, 3, 3, 3, 3],
    });
    expect(r).toMatchObject({ score: 5, repeated: true, level: 'advanced' });
  });

  it('getMine: chưa làm thì done=false', async () => {
    const { prisma, svc } = make();
    prisma.placementAttempt.findFirst.mockResolvedValue(null);
    expect(await svc.getMine(1)).toEqual({ ok: true, done: false });
  });
});
