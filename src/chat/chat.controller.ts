import { Controller, Get, Param, Query, Req, UseGuards, Patch, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Request } from 'express';
import { ChatParticipantGuard } from './chat-participant.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // GET /chat/history/:listingId?userId=xx
  @UseGuards(ChatParticipantGuard)
  @Get('history/:listingId')
  async getChatHistory(
    @Param('listingId') listingId: string,
    @Query('userId') userId: number,
  ) {
    return this.chatService.getChatHistory(listingId, Number(userId));
  }

  // PATCH /chat/read/:messageId
  @Patch('read/:messageId')
  async markAsRead(
    @Param('messageId') messageId: number,
    @Body('userId') userId: number,
  ) {
    return this.chatService.markAsRead(Number(messageId), Number(userId));
  }
} 