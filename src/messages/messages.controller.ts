import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Request } from 'express';

@Controller('orders/:orderId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('orderId') orderId: string,
    @Body() body: SendMessageDto,
    @Req() req: Request,
  ) {
    // Extract user ID from request (assuming it's added by auth middleware)
    const userId = (req['user'] as any)?.id || 1; // Fallback to a test user ID
    
    // Create a new DTO with the route param orderId
    const sendMessageDto: SendMessageDto = {
      ...body,
      orderId: parseInt(orderId, 10),
    };
    
    return await this.messagesService.sendMessage(sendMessageDto, userId);
  }

  @Get()
  async getMessages(
    @Param('orderId') orderId: number,
    @Req() req: Request,
  ) {
    // Extract user ID from request (assuming it's added by auth middleware)
    const userId = (req['user'] as any)?.id || 1; // Fallback to a test user ID
    
    return await this.messagesService.getMessagesByOrderId(Number(orderId), userId);
  }
}