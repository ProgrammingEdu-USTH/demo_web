import { GIOI_HAN, KHOA_CAM_PAYLOAD } from './learning-event-kinds';
import { lamSachLo, lamSachSuKien } from './learning-events.sanitize';

const BAY_GIO = new Date('2026-11-18T10:00:00Z');
const EID = '3f1c2a4e-9b7d-4c1a-8e2f-5a6b7c8d9e0f';

/**
 * Hình dạng THẬT của một sự kiện `Run.Test` — chép từ chỗ frontend dựng nó
 * (`ghiLuotChay` trong frontend/src/lib/learning-events.ts), không tự nghĩ:
 * fixture không giống dữ liệu thật thì test vô dụng (AGENTS.md).
 */
const runTest = (them: Record<string, unknown> = {}) => ({
  eid: EID,
  kind: 'Run.Test',
  courseId: 'python_advanced',
  lessonNo: 3,
  screenKey: 's4-sandbox',
  payload: {
    env: 'browser',
    passed: false,
    total: 4,
    failed: ['TABLE: "python" có 3 process', 'Bảng khác'],
    errorType: 'AssertionError',
    errorMessage: 'AssertionError: 2 != 3',
    sameAsPrev: false,
    editsSinceLastRun: 2,
    machineMs: 41,
    attemptNo: 1,
    sincePrevMs: null,
    newSession: true,
  },
  clientAt: '2026-11-18T09:59:50.000Z',
  ...them,
});

describe('lamSachSuKien — một sự kiện', () => {
  it('sự kiện thật của FE đi qua NGUYÊN VẸN, đổi tên eid → eventId', () => {
    const sk = lamSachSuKien(runTest(), BAY_GIO);
    expect(sk).not.toBeNull();
    expect(sk?.eventId).toBe(EID);
    expect(sk?.kind).toBe('Run.Test');
    expect(sk?.payload).toEqual(runTest().payload);
    expect(sk?.clientAt?.toISOString()).toBe('2026-11-18T09:59:50.000Z');
  });

  it.each(KHOA_CAM_PAYLOAD.map((k) => [k]))(
    'khoá cấm `%s` (mã nguồn / dấu vân tay) làm BỎ CẢ sự kiện, không lặng lẽ gỡ khoá',
    (khoa) => {
      const raw = runTest();
      expect(
        lamSachSuKien(
          { ...raw, payload: { ...raw.payload, [khoa]: 'x = 1' } },
          BAY_GIO,
        ),
      ).toBeNull();
    },
  );

  it('thiếu eid hoặc eid không phải UUID v4: BỎ, không sinh hộ', () => {
    expect(lamSachSuKien(runTest({ eid: undefined }), BAY_GIO)).toBeNull();
    expect(lamSachSuKien(runTest({ eid: 'abc' }), BAY_GIO)).toBeNull();
    // UUID v1 (chữ số phiên bản là 1) cũng không được.
    expect(
      lamSachSuKien(
        runTest({ eid: '3f1c2a4e-9b7d-1c1a-8e2f-5a6b7c8d9e0f' }),
        BAY_GIO,
      ),
    ).toBeNull();
  });

  it('kind ngoài danh sách 10 loại: BỎ', () => {
    expect(lamSachSuKien(runTest({ kind: 'File.Edit' }), BAY_GIO)).toBeNull();
  });

  it('object lồng trong payload (chỗ giấu khoá cấm ở tầng dưới): BỎ', () => {
    expect(
      lamSachSuKien(
        runTest({ payload: { meta: { code: 'print(1)' } } }),
        BAY_GIO,
      ),
    ).toBeNull();
    expect(
      lamSachSuKien(runTest({ payload: { failed: [{ code: 'x' }] } }), BAY_GIO),
    ).toBeNull();
  });

  it(`payload quá ${GIOI_HAN.khoaPayload} khoá: BỎ`, () => {
    const nhieu = Object.fromEntries(
      Array.from({ length: GIOI_HAN.khoaPayload + 1 }, (_, i) => [`k${i}`, i]),
    );
    expect(lamSachSuKien(runTest({ payload: nhieu }), BAY_GIO)).toBeNull();
  });

  it('chuỗi dài và mảng dài bị CẮT chứ không bỏ — dòng traceback dài vẫn là dữ liệu thật', () => {
    const sk = lamSachSuKien(
      runTest({
        payload: {
          errorMessage: 'E'.repeat(GIOI_HAN.kyTuChuoi + 100),
          failed: Array.from({ length: 20 }, (_, i) => `ca ${i}`),
        },
      }),
      BAY_GIO,
    );
    expect(sk?.payload?.errorMessage).toHaveLength(GIOI_HAN.kyTuChuoi);
    expect(sk?.payload?.failed).toHaveLength(GIOI_HAN.phanTuMang);
  });

  it('clientAt lệch quá 7 ngày hoặc hỏng thì thành null — KHÔNG bỏ sự kiện', () => {
    expect(
      lamSachSuKien(runTest({ clientAt: '2097-01-01T00:00:00Z' }), BAY_GIO)
        ?.clientAt,
    ).toBeNull();
    expect(
      lamSachSuKien(runTest({ clientAt: 'hôm qua' }), BAY_GIO)?.clientAt,
    ).toBeNull();
  });

  it('lessonNo không phải số nguyên dương, courseId quá dài: BỎ', () => {
    expect(lamSachSuKien(runTest({ lessonNo: 0 }), BAY_GIO)).toBeNull();
    expect(lamSachSuKien(runTest({ lessonNo: '3' }), BAY_GIO)).toBeNull();
    expect(
      lamSachSuKien(
        runTest({ courseId: 'c'.repeat(GIOI_HAN.kyTuCourseId + 1) }),
        BAY_GIO,
      ),
    ).toBeNull();
  });

  it('payload null (vd X-Lesson.Open không kèm dữ liệu) là hợp lệ', () => {
    expect(
      lamSachSuKien(runTest({ kind: 'X-Lesson.Open', payload: null }), BAY_GIO)
        ?.payload,
    ).toBeNull();
  });
});

describe('lamSachLo — cả lô', () => {
  it('một sự kiện xấu chỉ bỏ RIÊNG nó, không làm mất cả lô', () => {
    const tot2 = runTest({ eid: 'a1c2e3f4-1111-4222-9333-444455556666' });
    const { sach, dropped } = lamSachLo(
      [runTest(), { kind: 'Run.Test' }, tot2],
      BAY_GIO,
    );
    expect(sach).toHaveLength(2);
    expect(dropped).toBe(1);
  });

  it('eid trùng NGAY TRONG một lô: giữ bản đầu, bản sau tính là dropped', () => {
    const { sach, dropped } = lamSachLo([runTest(), runTest()], BAY_GIO);
    expect(sach).toHaveLength(1);
    expect(dropped).toBe(1);
  });
});
