export class MessageReceivedEvent {
  constructor(
    public readonly messageId: string,
    public readonly recipientId: string,
    public readonly senderId: string,
    public readonly senderName: string,
    public readonly content: string,
    public readonly conversationId: string,
  ) {}
}