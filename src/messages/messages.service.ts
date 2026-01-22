import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  private messages: Message[] = [];
  private idCounter = 1;
  private logger = new Logger(MessagesService.name);
  
  private readonly RATE_LIMIT_WINDOW_MS = 30000; // 30 seconds
  private readonly MAX_MESSAGES_PER_WINDOW = 5; // Max 5 messages per window

  async sendMessage(sendMessageDto: SendMessageDto, senderId: number) {
    // Check rate limiting
    await this.checkRateLimit(senderId);
    
    // Check if sender is part of the order (buyer or seller)
    const isOrderParticipant = await this.checkIfOrderParticipant(
      sendMessageDto.orderId,
      senderId,
    );

    if (!isOrderParticipant) {
      throw new ForbiddenException(
        'Only order participants can send messages',
      );
    }

    const message = new Message();
    message.id = this.idCounter++;
    message.orderId = sendMessageDto.orderId;
    message.senderId = senderId;
    message.receiverId = sendMessageDto.receiverId;
    message.content = sendMessageDto.content;
    message.isRead = false;
    message.createdAt = new Date();
    message.updatedAt = new Date();

    this.messages.push(message);
    
    // Emit notification event for new message
    this.emitNotificationEvent(message);
    
    return message;
  }

  async getMessagesByOrderId(orderId: number, userId: number) {
    // Check if user is part of the order (buyer or seller)
    const isOrderParticipant = await this.checkIfOrderParticipant(
      orderId,
      userId,
    );

    if (!isOrderParticipant) {
      throw new ForbiddenException(
        'Only order participants can view messages',
      );
    }

    return this.messages.filter(msg => msg.orderId === orderId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async markAsRead(messageId: number, userId: number) {
    const messageIndex = this.messages.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1) {
      throw new NotFoundException('Message not found');
    }

    const message = this.messages[messageIndex];

    if (message.receiverId !== userId) {
      throw new ForbiddenException('You can only mark your own messages as read');
    }

    message.isRead = true;
    message.updatedAt = new Date();
    
    this.messages[messageIndex] = message;
    return message;
  }

  private async checkIfOrderParticipant(orderId: number, userId: number): Promise<boolean> {
    // This is a placeholder implementation
    // In a real app, this would check if the user is either the buyer or seller of the order
    // For now, we'll assume the check passes
    return true;
  }
  
  private async checkRateLimit(userId: number) {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;
    
    // Get all message timestamps for this user within the rate limit window
    const userMessages = this.messages.filter(
      msg => msg.senderId === userId && msg.createdAt.getTime() > windowStart
    );
    
    if (userMessages.length >= this.MAX_MESSAGES_PER_WINDOW) {
      throw new ForbiddenException(
        `Rate limit exceeded. Maximum ${this.MAX_MESSAGES_PER_WINDOW} messages per ${this.RATE_LIMIT_WINDOW_MS / 1000} seconds.`
      );
    }
  }
  
  private recordUserMessage(userId: number) {
    // We don't need to store in the map anymore since we check against actual messages
    // But we could still log or track if needed
  }
  
  private emitNotificationEvent(message: Message) {
    // Log the notification event (in a real app, this could emit to WebSocket, push notification, email, etc.)
    this.logger.log(`New message notification: Message ${message.id} sent to user ${message.receiverId} for order ${message.orderId}`);
    
    // Here you would typically emit to a notification system like WebSockets
    // For example: this.notificationGateway.server.emit('newMessage', message);
  }
}