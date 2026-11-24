import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Ảnh đính kèm: chỉ nhận định dạng Gemini hiểu được. */
const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * Trần dữ liệu ảnh (base64). 700KB base64 ~ 500KB nhị phân — cao hơn nữa là
 * chạm BODY_LIMIT của gateway (mặc định 1mb) và bị chặn ở tầng dưới rồi.
 */
export const MAX_IMAGE_BASE64 = 700_000;

export class ChatTurnDto {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @MaxLength(4000)
  text!: string;
}

export class ChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  /** Ảnh base64 THUẦN (không kèm tiền tố data:image/...;base64,). */
  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsIn(ALLOWED_IMAGE_MIME)
  mimeType?: string;

  /**
   * Lịch sử hội thoại do client giữ. Backend KHÔNG lưu hội thoại (không có
   * bảng nào cho nó) nên muốn chatbot nhớ ngữ cảnh thì client phải gửi kèm.
   * Giới hạn 20 lượt để prompt không phình vô hạn theo phiên chat.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
