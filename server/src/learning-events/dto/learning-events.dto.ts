import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GIOI_HAN } from '../learning-event-kinds';

/**
 * Lô sự kiện: `{ events, sentAt }` — đúng `type Lo` trong
 * frontend/src/lib/learning-events.ts.
 *
 * `events` CỐ Ý là `unknown[]` chứ không phải mảng DTO lồng có
 * `@ValidateNested`: validate lồng sẽ trả 400 cho CẢ LÔ khi một sự kiện hỏng.
 * Từng sự kiện được lọc riêng ở `lamSachLo()` (learning-events.sanitize.ts) —
 * hỏng cái nào bỏ cái đó.
 */
export class GuiLoSuKienDto {
  @IsArray({ message: 'events phải là một mảng' })
  @ArrayMaxSize(GIOI_HAN.suKienMoiLo, {
    message: `Mỗi lô tối đa ${GIOI_HAN.suKienMoiLo} sự kiện`,
  })
  events!: unknown[];

  /** Giờ client lúc GỬI lô (`stm` của Snowplow) — ghi vào `client_sent_at`. */
  @IsOptional()
  @IsString({ message: 'sentAt không hợp lệ' })
  @MaxLength(40, { message: 'sentAt không hợp lệ' })
  sentAt?: string;
}

/** Quyết định đồng ý: `{ granted }` — đúng thân mà `guiQuyetDinhDongY()` gửi. */
export class QuyetDinhDongYDto {
  @IsBoolean({ message: 'granted phải là true hoặc false' })
  granted!: boolean;
}
