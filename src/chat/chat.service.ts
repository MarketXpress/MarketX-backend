import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
  ) {}

  async createMessage(data: Partial<Chat>): Promise<Chat> {
    const message = this.chatRepository.create(data);
    return this.chatRepository.save(message);
  }

  async getChatHistory(listingId: string, userId: number): Promise<Chat[]> {
    // Only allow participants to fetch chat
    const chats = await this.chatRepository.find({
      where: [
        { listingId, senderId: userId },
        { listingId, receiverId: userId },
      ],
      order: { timestamp: 'ASC' },
    });
    return chats;
  }

  async markAsRead(messageId: number, userId: number): Promise<Chat> {
    const message = await this.chatRepository.findOne({ where: { id: messageId } });
    if (!message) throw new ForbiddenException('Message not found');
    if (message.receiverId !== userId) throw new ForbiddenException('Not allowed');
    message.isRead = true;
    message.status = 'read';
    return this.chatRepository.save(message);
  }

  async updateStatus(messageId: number, status: 'sent' | 'delivered' | 'read'): Promise<Chat> {
    const message = await this.chatRepository.findOne({ where: { id: messageId } });
    if (!message) throw new ForbiddenException('Message not found');
    message.status = status;
    return this.chatRepository.save(message);
  }
} 