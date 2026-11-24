import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() emailNotif?: boolean;
  @IsOptional() @IsBoolean() pushNotif?: boolean;
  @IsOptional() @IsBoolean() studyRemind?: boolean;
  @IsOptional() @IsBoolean() contentUpdate?: boolean;
}
