import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const SNIPPET_LANGUAGES = ['python', 'web', 'sql'] as const;
// Giới hạn theo ký tự; 100KB ASCII. Service kiểm thêm theo byte UTF-8.
export const MAX_CODE_BYTES = 100 * 1024;

export class SnippetDto {
  @IsString({ message: 'Tiêu đề phải là văn bản' })
  @MinLength(1, { message: 'Tiêu đề không được để trống' })
  @MaxLength(120, { message: 'Tiêu đề tối đa 120 ký tự' })
  title!: string;

  @IsIn(SNIPPET_LANGUAGES, {
    message: 'Ngôn ngữ phải là python, web hoặc sql',
  })
  language!: (typeof SNIPPET_LANGUAGES)[number];

  @IsString({ message: 'Mã nguồn phải là văn bản' })
  @MaxLength(MAX_CODE_BYTES, { message: 'Mã nguồn tối đa 100KB' })
  // eslint-disable-next-line no-control-regex -- cố ý cấm ký tự NUL (Postgres từ chối)
  @Matches(/^[^\u0000]*$/, { message: 'Mã nguồn chứa ký tự không hợp lệ' })
  code!: string;
}
