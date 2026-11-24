/**
 * Lọc một LÔ sự kiện trước khi chạm DB — hàm thuần, không đụng DB.
 *
 * Client (frontend/src/lib/learning-events.ts) đã tự cắt trước khi gửi, nhưng
 * OWASP API4:2023 nói validate ở SERVER mọi thứ client gửi: một client đã sửa
 * thì không còn đo hộ ai nữa. Mọi trần dẫn về `GIOI_HAN`/`KHOA_CAM_PAYLOAD` của
 * learning-event-kinds.ts, KHÔNG gõ lại con số ở đây.
 *
 * Luật chung: một sự kiện xấu thì BỎ RIÊNG NÓ (đếm vào `dropped`), không trả 400
 * cho cả lô. Một lô gom tới 50 sự kiện của 10 giây học; một trường hỏng không
 * được làm mất 49 cái còn lại.
 *
 * Hai mức xử lý, có chủ đích:
 *  · BỎ CẢ SỰ KIỆN khi nó sai HỢP ĐỒNG: thiếu/sai `eid`, `kind` lạ, khoá cấm
 *    (mã nguồn), object lồng trong payload, quá nhiều khoá. Ghi một phần của
 *    nó là ghi một thứ không ai định gửi.
 *  · CẮT khi nó chỉ DÀI: chuỗi quá 500 ký tự, mảng quá 12 phần tử. Dòng
 *    traceback dài vẫn là dữ liệu thật, chỉ không cần nguyên văn.
 */
import {
  GIOI_HAN,
  KHOA_CAM_PAYLOAD,
  RE_UUID_V4,
  laKindHopLe,
  type LearningEventKind,
} from './learning-event-kinds';

/** Một sự kiện đã sạch, đúng các cột của `learning_events`. */
export type SuKienSach = {
  eventId: string;
  kind: LearningEventKind;
  courseId: string | null;
  lessonNo: number | null;
  screenKey: string | null;
  payload: Record<string, GiaTriPayload> | null;
  clientAt: Date | null;
};

type NguyenThuy = string | number | boolean | null;
export type GiaTriPayload = NguyenThuy | NguyenThuy[];

const TAP_CAM: ReadonlySet<string> = new Set(KHOA_CAM_PAYLOAD);

/** `lessons.sort_order` thật nằm ở 1–999; bài lưu trữ ≥ 1000. Trần rộng để không bỏ nhầm. */
const TRAN_LESSON_NO = 100_000;

function laObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function catChuoi(s: string): string {
  return s.length > GIOI_HAN.kyTuChuoi ? s.slice(0, GIOI_HAN.kyTuChuoi) : s;
}

/** Nguyên thuỷ hợp lệ (chuỗi đã cắt), hoặc `undefined` nếu không phải nguyên thuỷ. */
function nguyenThuy(v: unknown): NguyenThuy | undefined {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return catChuoi(v);
  return undefined;
}

/** `null` = payload làm hỏng cả sự kiện; object (có thể rỗng) = payload đã sạch. */
function lamSachPayload(
  raw: unknown,
): Record<string, GiaTriPayload> | null | 'bo' {
  if (raw === null || raw === undefined) return null;
  if (!laObject(raw)) return 'bo';
  const khoa = Object.keys(raw);
  if (khoa.length > GIOI_HAN.khoaPayload) return 'bo';

  const sach: Record<string, GiaTriPayload> = {};
  for (const k of khoa) {
    // Tên khoá nói nó chở mã nguồn (hoặc dấu vân tay của mã) → bỏ CẢ sự kiện,
    // không lặng lẽ gỡ khoá: `dropped` nhảy lên là cách duy nhất để một bản
    // sửa FE đưa `codeHash` trở lại bị nhìn thấy (xem QUYẾT ĐỊNH 2).
    if (TAP_CAM.has(k)) return 'bo';
    const v = raw[k];
    if (Array.isArray(v)) {
      const mang: NguyenThuy[] = [];
      for (const x of v.slice(0, GIOI_HAN.phanTuMang)) {
        const p = nguyenThuy(x);
        if (p === undefined) return 'bo'; // mảng chứa object: không có ở hợp đồng FE
        mang.push(p);
      }
      sach[k] = mang;
      continue;
    }
    const p = nguyenThuy(v);
    // Object lồng nhau KHÔNG có trong hợp đồng FE, và là chỗ giấu được khoá cấm
    // ở tầng dưới — bỏ cả sự kiện thay vì đi kiểm đệ quy.
    if (p === undefined) return 'bo';
    sach[k] = p;
  }
  return sach;
}

/** `null` = không gửi; `undefined` = gửi sai (bỏ cả sự kiện); chuỗi = hợp lệ. */
function chuoiTuyChon(v: unknown, tran: number): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.length > tran) return undefined;
  return v;
}

/**
 * Mốc thời gian do client gửi. Hỏng hoặc lệch quá `lechClientAtMs` so với giờ
 * máy chủ thì thành `null` — KHÔNG bỏ sự kiện: đồng hồ máy người học lệch là
 * chuyện thường, còn một mốc năm 2097 thì phá mọi câu `BETWEEN`.
 */
export function mocClient(v: unknown, bayGio: Date): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.abs(t - bayGio.getTime()) > GIOI_HAN.lechClientAtMs ? null : d;
}

export function lamSachSuKien(raw: unknown, bayGio: Date): SuKienSach | null {
  if (!laObject(raw)) return null;
  // Thiếu `eid` thì BỎ, không sinh hộ: sinh hộ là hàng không khử trùng được mà
  // `duplicates` vẫn trông như đáng tin (xem chú thích RE_UUID_V4).
  if (typeof raw.eid !== 'string' || !RE_UUID_V4.test(raw.eid)) return null;
  if (!laKindHopLe(raw.kind)) return null;

  const courseId = chuoiTuyChon(raw.courseId, GIOI_HAN.kyTuCourseId);
  const screenKey = chuoiTuyChon(raw.screenKey, GIOI_HAN.kyTuScreenKey);
  if (courseId === undefined || screenKey === undefined) return null;

  let lessonNo: number | null = null;
  if (raw.lessonNo !== null && raw.lessonNo !== undefined) {
    const n = raw.lessonNo;
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > TRAN_LESSON_NO
    ) {
      return null;
    }
    lessonNo = n;
  }

  const payload = lamSachPayload(raw.payload);
  if (payload === 'bo') return null;

  return {
    eventId: raw.eid.toLowerCase(),
    kind: raw.kind,
    courseId,
    lessonNo,
    screenKey,
    payload,
    clientAt: mocClient(raw.clientAt, bayGio),
  };
}

/**
 * Lọc cả lô. `eid` trùng NGAY TRONG một lô cũng bị bỏ (đếm vào `dropped`), vì
 * `skipDuplicates` chỉ khử trùng với hàng ĐÃ có trong DB; hai bản cùng `eid`
 * trong một lệnh `createMany` thì tuỳ Postgres, đừng để may rủi quyết.
 */
export function lamSachLo(
  events: readonly unknown[],
  bayGio: Date,
): { sach: SuKienSach[]; dropped: number } {
  const sach: SuKienSach[] = [];
  const daThay = new Set<string>();
  let dropped = 0;
  for (const raw of events.slice(0, GIOI_HAN.suKienMoiLo)) {
    const sk = lamSachSuKien(raw, bayGio);
    if (!sk || daThay.has(sk.eventId)) {
      dropped++;
      continue;
    }
    daThay.add(sk.eventId);
    sach.push(sk);
  }
  // Phần vượt trần số lượng (DTO đã chặn, đây là lớp thứ hai) cũng là bị bỏ.
  dropped += Math.max(0, events.length - GIOI_HAN.suKienMoiLo);
  return { sach, dropped };
}
