import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

@Injectable()
export class ChatParticipantGuard implements CanActivate {
  constructor(private readonly chatService: ChatService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const listingId = request.params.listingId || request.body.listingId || request.query.listingId;
    if (!userId || !listingId) {
      throw new ForbiddenException('Missing user or listing information');
    }
    // Check if user is a participant in any chat for this listing
    const chats = await this.chatService.getChatHistory(listingId, userId);
    if (chats.length === 0) {
      throw new ForbiddenException('You are not a participant in this chat');
    }
    return true;
  }
} 