import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Sheet 1 của spec (API #41) quy định body là {mermaid_def} và frontend
 * (main.js savePersonalRoadmap) gửi đúng khoá đó. DTO trước chỉ khai `mermaid`
 * nên nút "Lưu lộ trình" luôn 400.
 */
export class SaveRoadmapDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() nodes?: unknown;
  @IsOptional() edges?: unknown;
  // Sơ đồ Mermaid của lộ trình cá nhân — vài trăm dòng là cùng, 20k ký tự dư dả.
  @IsOptional() @IsString() @MaxLength(20000) mermaid_def?: string;
  /** Bí danh cũ, giữ để không phá client nào đang gửi `mermaid`. */
  @IsOptional() @IsString() @MaxLength(20000) mermaid?: string;
}

export class UpdateRoadmapItemDto {
  @IsString({ message: 'Thiếu roadmap_id' })
  @MaxLength(100)
  roadmap_id!: string;

  @IsOptional() @IsBoolean() done?: boolean;
}
