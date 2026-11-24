import { IsInt, Max, Min } from 'class-validator';

export class QuizAnswerDto {
  @IsInt({ message: 'index phải là số nguyên' })
  @Min(0, { message: 'index tối thiểu là 0' })
  @Max(19, { message: 'index quá lớn' })
  index!: number;

  @IsInt({ message: 'choice phải là số nguyên' })
  @Min(0, { message: 'choice tối thiểu là 0' })
  @Max(3, { message: 'choice tối đa là 3' })
  choice!: number;
}
