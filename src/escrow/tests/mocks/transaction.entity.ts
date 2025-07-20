export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export class Transaction {
  id: string;
  amount: number;
  buyerAddress: string;
  sellerAddress: string;
  buyerSignature: string;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.id = '';
    this.amount = 0;
    this.buyerAddress = '';
    this.sellerAddress = '';
    this.buyerSignature = '';
    this.status = TransactionStatus.PENDING;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}