import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Refresh token đọc từ cookie httpOnly. Field trong body chỉ còn để client cũ
 * (token còn nằm trong localStorage) chuyển sang cookie ở lần refresh đầu tiên.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  refresh?: string;
}

/** Logout: refresh là tuỳ chọn — không gửi vẫn trả ok. */
export class LogoutDto {
  @IsOptional()
  @IsString()
  refresh?: string;
}
