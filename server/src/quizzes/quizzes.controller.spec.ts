import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { QuizzesController } from './quizzes.controller';
import type { QuizzesService } from './quizzes.service';

/**
 * ReviewQuiz.tsx gọi `GET /api/courses/:id/quiz/status` trong khi BE chưa có
 * route này, nên ô đề ôn sau bài nhận 404. Canh đúng nguyên nhân đó: đổi path
 * hay method là FE lại 404 mà test service vẫn xanh.
 */
describe('QuizzesController', () => {
  it('BE14: GET courses/:id/quiz/status (gateway gắn /api)', () => {
    const ham = Object.getOwnPropertyDescriptor(
      QuizzesController.prototype,
      'status',
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, ham)).toBe(
      'courses/:id/quiz/status',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, ham)).toBe(RequestMethod.GET);
  });

  it('BE14: chuyển đúng userId và courseId xuống service', async () => {
    const getCourseQuizStatus = jest.fn().mockResolvedValue({ ok: true });
    const ctrl = new QuizzesController({
      getCourseQuizStatus,
    } as unknown as QuizzesService);

    await ctrl.status(7, 'python_advanced');
    expect(getCourseQuizStatus).toHaveBeenCalledWith(7, 'python_advanced');
  });
});
