import { IsUUID, IsString, Length } from 'class-validator';

export class Verify2FADto {
  @IsUUID()
  userId: string;

  @IsString()
  @Length(6, 6)
  code: string; // 6-digit TOTP
}
