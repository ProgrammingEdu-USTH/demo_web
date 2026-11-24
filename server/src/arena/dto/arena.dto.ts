import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsOptional()
  @IsString({ message: 'problemId phải là văn bản' })
  @MaxLength(64, { message: 'problemId quá dài' })
  problemId?: string;
}

export class JoinRoomDto {
  @IsString({ message: 'Mã phòng phải là văn bản' })
  @MinLength(4, { message: 'Mã phòng quá ngắn' })
  @MaxLength(8, { message: 'Mã phòng quá dài' })
  code!: string;
}

export class SubmitCodeDto {
  @IsString({ message: 'Mã nguồn phải là văn bản' })
  @MinLength(1, { message: 'Mã nguồn không được để trống' })
  @MaxLength(10000, { message: 'Mã nguồn tối đa 10000 ký tự' })
  // eslint-disable-next-line no-control-regex -- cố ý cấm ký tự NUL
  @Matches(/^[^\u0000]*$/, { message: 'Mã nguồn chứa ký tự không hợp lệ' })
  code!: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(50, { message: 'limit tối đa là 50' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'before phải là số nguyên' })
  @Min(1, { message: 'before tối thiểu là 1' })
  @Max(2147483647, { message: 'before quá lớn' })
  before?: number;
}
