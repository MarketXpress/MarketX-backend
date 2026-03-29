import { IsUUID, IsNumber, Min } from 'class-validator';

export class ReleasePartialDto {
  @IsUUID()
  escrowId: string;

  @IsNumber()
  @Min(1)
  releasedAmount: number;
}
