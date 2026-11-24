import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Sheet 1 của spec (API #41) quy định body là {mermaid_def} và frontend
 * (main.js savePersonalRoadmap) gửi đúng khoá đó. DTO trước chỉ khai `mermaid`
 * nên nút "Lưu lộ trình" luôn 400.
 */
export class SaveRoadmapDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() nodes?: unknown;
  @IsOptional() edges?: unknown;
  @IsOptional() @IsString() mermaid_def?: string;
  /** Bí danh cũ, giữ để không phá client nào đang gửi `mermaid`. */
  @IsOptional() @IsString() mermaid?: string;
}

export class UpdateRoadmapItemDto {
  @IsString({ message: 'Thiếu roadmap_id' })
  roadmap_id!: string;

  @IsOptional() @IsBoolean() done?: boolean;
}
