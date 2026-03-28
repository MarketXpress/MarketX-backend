import { IsUUID } from 'class-validator';

export class Enable2FADto {
  @IsUUID()
  userId: string;
}
