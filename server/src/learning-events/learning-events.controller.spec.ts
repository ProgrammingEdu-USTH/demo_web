import { PayloadTooLargeException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from 'src/app.module';
import { GIOI_HAN } from './learning-event-kinds';
import { LearningEventsController } from './learning-events.controller';
import { LearningEventsModule } from './learning-events.module';
import type { LearningEventsService } from './learning-events.service';

/**
 * Ba đường mà frontend đã gọi trong khi nhánh test chưa có module — nên trước
 * đây cả ba trả 404. Ca đầu canh đúng nguyên nhân đó: module có viết mà quên
 * đăng ký vào AppModule thì vẫn 404 y như cũ.
 */
describe('LearningEventsController', () => {
  it('module được đăng ký trong AppModule (không có dòng này là 404 như trước)', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    expect(imports).toContain(LearningEventsModule);
  });

  it('đúng ba đường FE gọi: POST /events, GET /events/consent, POST /events/consent', () => {
    const proto = LearningEventsController.prototype;
    const duong = (ten: keyof LearningEventsController) => {
      // Lấy hàm qua descriptor để không tách method khỏi object (unbound-method).
      const ham = Object.getOwnPropertyDescriptor(proto, ten)?.value as object;
      return {
        path: Reflect.getMetadata(PATH_METADATA, ham) as string,
        method: Reflect.getMetadata(METHOD_METADATA, ham) as RequestMethod,
      };
    };
    // Gateway gắn `/api`; controller chỉ viết `events` (AGENTS.md).
    expect(Reflect.getMetadata(PATH_METADATA, LearningEventsController)).toBe(
      'events',
    );
    expect(duong('ghiLo')).toEqual({ path: '/', method: RequestMethod.POST });
    expect(duong('layDongY')).toEqual({
      path: 'consent',
      method: RequestMethod.GET,
    });
    expect(duong('ghiDongY')).toEqual({
      path: 'consent',
      method: RequestMethod.POST,
    });
  });

  it(`lô vượt ${GIOI_HAN.byteMoiLo} byte: 413, không chạm service`, () => {
    const ghiLo = jest.fn();
    const ctrl = new LearningEventsController({
      ghiLo,
    } as unknown as LearningEventsService);
    const to = {
      events: [{ payload: { errorMessage: 'x'.repeat(GIOI_HAN.byteMoiLo) } }],
    };
    expect(() => ctrl.ghiLo(7, to)).toThrow(PayloadTooLargeException);
    expect(ghiLo).not.toHaveBeenCalled();
  });
});
