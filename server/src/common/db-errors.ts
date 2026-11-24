/**
 * Phân loại lỗi hạ tầng DB tạm thời. Phải so theo THÔNG ĐIỆP vì driver adapter Neon ném Error
 * thường, không phải PrismaClientKnownRequestError có mã lỗi.
 *
 * Tách 3 loại vì mỗi loại cần câu nói và cách xử lý khác nhau (trước đây cả ba đều bị báo
 * "Hệ thống đang quá tải", kể cả khi nguyên nhân là Neon cắt socket idle):
 *  · pool-timeout       — pool đầy, request xếp hàng quá hạn. Thử lại NGAY chỉ xếp hàng thêm.
 *  · connection-dropped — socket đã mở bị cắt giữa chừng (Neon autosuspend / proxy). Thử lại
 *                         một lần thường qua vì pool sẽ mở connection mới.
 *  · unreachable        — không tới được máy chủ DB.
 */
export type DbErrorKind = 'pool-timeout' | 'connection-dropped' | 'unreachable';

const PATTERNS: Array<[DbErrorKind, string[]]> = [
  [
    'pool-timeout',
    ['timeout exceeded when trying to connect', 'Connection pool timeout'],
  ],
  ['connection-dropped', ['Connection terminated']],
  ['unreachable', ["Can't reach database server", 'ECONNREFUSED', 'ETIMEDOUT']],
];

export function classifyDbError(e: unknown): DbErrorKind | null {
  if (!(e instanceof Error)) return null;
  const msg = e.message ?? '';
  for (const [kind, needles] of PATTERNS) {
    if (needles.some((n) => msg.includes(n))) return kind;
  }
  return null;
}

/** Giây khuyến nghị client chờ trước khi thử lại; `unreachable` cần lâu hơn (Neon thức dậy ~10 s). */
export const RETRY_AFTER_SECONDS: Record<DbErrorKind, number> = {
  'pool-timeout': 3,
  'connection-dropped': 3,
  unreachable: 10,
};

export const DB_ERROR_MESSAGES: Record<DbErrorKind, string> = {
  'pool-timeout':
    'Hệ thống đang có nhiều người dùng cùng lúc, vui lòng thử lại sau vài giây',
  'connection-dropped':
    'Kết nối tới cơ sở dữ liệu vừa bị ngắt, vui lòng thử lại sau vài giây',
  unreachable:
    'Không kết nối được tới cơ sở dữ liệu, vui lòng thử lại sau ít phút',
};
