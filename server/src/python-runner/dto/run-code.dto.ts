import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_CODE_BYTES } from '../sandbox/docker-sandbox';

export class RunCodeDto {
  // MaxLength đếm ký tự UTF-16, không phải byte — chữ có dấu tiếng Việt tới 3
  // byte/ký tự nên 20.480 ký tự vẫn có thể vượt 20 KB. Đây chỉ là chặn sớm rẻ
  // tiền; phép kiểm byte chính xác nằm ở assertCodeSize().
  @IsString({ message: 'Mã nguồn phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã nguồn không được để trống' })
  @MaxLength(MAX_CODE_BYTES, { message: 'Mã nguồn tối đa 20 KB' })
  code!: string;
}
