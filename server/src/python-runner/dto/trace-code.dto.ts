import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_CODE_BYTES } from '../sandbox/docker-sandbox';

/**
 * Thân của POST /python/trace.
 *
 * Cố ý KHÔNG đặt trần nhỏ hơn /python/run ở đây: trần thật của "xem từng bước"
 * phụ thuộc vào mã NÉN ĐƯỢC BAO NHIÊU (tracer phải đi kèm trong cùng một file
 * 20 KB — xem tracer/trace-program.ts). Mã Python thường nén 3-4 lần nên gần
 * như mọi chương trình vừa trần editor đều vừa; trường hợp không nén được thì
 * service đo kích thước THẬT sau khi dựng và trả 400 kèm con số. Đặt một trần
 * cứng nhỏ ở đây sẽ từ chối oan những chương trình hoàn toàn chạy được.
 */
export class TraceCodeDto {
  @IsString({ message: 'Mã nguồn phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã nguồn không được để trống' })
  @MaxLength(MAX_CODE_BYTES, { message: 'Mã nguồn tối đa 20 KB' })
  code!: string;
}
