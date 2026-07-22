import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEscrowDto {
  @ApiProperty({
    description: 'Amount of XLM to hold in escrow',
    example: 100.0,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'UUID of the buyer initiating the escrow',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsNotEmpty()
  buyerId: string;

  @ApiProperty({
    description: 'UUID of the seller who will receive the funds on release',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsUUID()
  @IsNotEmpty()
  sellerId: string;
}
