import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

const MAX_CONTENT = 10_000;

const MAX_TITLE = 300;

const MAX_CATEGORY = 50;

export class CreatePostDto {
  @IsString({ message: 'Nội dung bài viết không được để trống' })
  @MaxLength(MAX_CONTENT, {
    message: `Nội dung không được vượt quá ${MAX_CONTENT} ký tự`,
  })
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE, {
    message: `Tiêu đề không được vượt quá ${MAX_TITLE} ký tự`,
  })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CATEGORY, {
    message: `Danh mục không được vượt quá ${MAX_CATEGORY} ký tự`,
  })
  category?: string;
}

// Cùng trần độ dài với CreatePostDto: không giới hạn thì route PUT trở thành
// đường vòng để nhét nội dung quá khổ vào DB.
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT, {
    message: `Nội dung không được vượt quá ${MAX_CONTENT} ký tự`,
  })
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TITLE, {
    message: `Tiêu đề không được vượt quá ${MAX_TITLE} ký tự`,
  })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CATEGORY, {
    message: `Danh mục không được vượt quá ${MAX_CATEGORY} ký tự`,
  })
  category?: string;
}

/**
 * Sheet 1 của spec (API #51, #54) quy định body là {reaction} — frontend gửi
 * đúng như vậy. DTO trước đây chỉ khai `type` nên MỌI lượt thả cảm xúc đều bị
 * 400 (FE lại cập nhật DOM lạc quan nên người dùng tưởng đã thả được).
 * Vẫn chấp nhận `type` để không phá client cũ nào đang gửi khoá đó.
 */
export class ReactDto {
  @IsOptional()
  @IsString({ message: 'Loại cảm xúc không hợp lệ' })
  reaction?: string;

  @IsOptional()
  @IsString({ message: 'Loại cảm xúc không hợp lệ' })
  type?: string;
}

export class CreateCommentDto {
  @IsString({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(MAX_CONTENT, {
    message: `Bình luận không được vượt quá ${MAX_CONTENT} ký tự`,
  })
  content!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parent_comment_id?: number;
}

export class UpdateCommentDto {
  @IsString({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(MAX_CONTENT, {
    message: `Bình luận không được vượt quá ${MAX_CONTENT} ký tự`,
  })
  content!: string;
}
