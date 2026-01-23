export class SendMessageDto {
  readonly orderId: number;
  readonly receiverId: number;
  readonly content: string;
}