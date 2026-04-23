export class BaseOrderDto {
  @IsUUID()
  buyerId: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class RefundDto {
  @IsUUID()
  orderId: string;

  @IsString()
  reason: string;
}

export type OrderActionDto = BaseOrderDto | RefundDto;
