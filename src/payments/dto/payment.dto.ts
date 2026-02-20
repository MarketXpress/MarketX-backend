export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  REFUNDED = 'refunded',
}

export enum PaymentCurrency {
  XLM = 'XLM',
  USDC = 'USDC',
  USD = 'USD',
}

export class CreatePaymentDto {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly buyerWalletPublicKey?: string;
}

export class InitiatePaymentDto {
  readonly orderId: string;
  readonly currency: PaymentCurrency;
  readonly timeoutMinutes?: number;
}

export class PaymentWebhookDto {
  readonly transactionHash: string;
  readonly sourceAccount: string;
  readonly destinationAccount: string;
  readonly amount: string;
  readonly asset_code?: string;
  readonly ledger: number;
  readonly created_at: string;
}

export class PaymentResponseDto {
  readonly id: string;
  readonly orderId: string;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly status: PaymentStatus;
  readonly stellarTransactionId?: string;
  readonly destinationWalletAddress: string;
  readonly sourceWalletAddress?: string;
  readonly confirmationCount: number;
  readonly createdAt: Date;
  readonly confirmedAt?: Date;
  readonly failedAt?: Date;
  readonly expiresAt: Date;
}

export class PaymentStatusDto {
  readonly id: string;
  readonly orderId: string;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly currency: PaymentCurrency;
  readonly confirmationCount: number;
  readonly stellarTransactionId?: string;
  readonly createdAt: Date;
  readonly confirmedAt?: Date;
}
