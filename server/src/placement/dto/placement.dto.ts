import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';
import { MAX_OPTIONS } from '../placement.logic';

export class SubmitPlacementDto {
  @IsInt({ message: 'Thiếu questionnaireId' })
  questionnaireId!: number;

  /** answers[i] = chỉ số lựa chọn cho câu thứ i của bản câu hỏi; -1 = bỏ qua. */
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(-1, { each: true })
  @Max(MAX_OPTIONS - 1, { each: true })
  answers!: number[];
}
