export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export class CreateOrderDto {
  readonly items: Array<{
    productId: string;
    quantity: number;
  }>;

  readonly buyerId: string;
}

export class UpdateOrderStatusDto {
  readonly status: OrderStatus;
}

export class OrderResponseDto {
  readonly id: string;
  readonly totalAmount: number;
  readonly status: OrderStatus;
  readonly trackingNumber?: string;
  readonly items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  readonly buyerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cancelledAt?: Date;
  readonly shippedAt?: Date;
  readonly deliveredAt?: Date;
}