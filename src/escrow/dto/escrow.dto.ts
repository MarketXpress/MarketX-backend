export class EscrowDto {
  id: string;
  amount: number;
  userId: string;
  transactionHash?: string | null;
  released: boolean;
  createdAt: Date;
  updatedAt: Date;
}
