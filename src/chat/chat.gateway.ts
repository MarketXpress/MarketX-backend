import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';
import { Chat } from './chat.entity';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track userId <-> socketId
  private userSocketMap = new Map<number, string>();
  private socketUserMap = new Map<string, number>();

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    // Expect userId as a query param for identification
    const userId = Number(client.handshake.query.userId);
    if (userId) {
      this.userSocketMap.set(userId, client.id);
      this.socketUserMap.set(client.id, userId);
      console.log(`User ${userId} connected with socket ${client.id}`);
      // Optionally emit to all clients that user is online
      this.server.emit('userOnline', { userId });
    } else {
      console.log(`Unknown user connected with socket ${client.id}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUserMap.get(client.id);
    if (userId) {
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(client.id);
      console.log(`User ${userId} disconnected (socket ${client.id})`);
      // Optionally emit to all clients that user is offline
      this.server.emit('userOffline', { userId });
    } else {
      console.log(`Unknown socket disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { listingId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Check if user is a participant in any chat for this listing
    const chats = await this.chatService.getChatHistory(data.listingId, data.userId);
    if (chats.length === 0) {
      client.emit('error', { message: 'You are not a participant in this chat' });
      client.disconnect();
      return;
    }
    const room = `listing-${data.listingId}`;
    client.join(room);
    client.emit('joinedRoom', { room });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: {
      listingId: string;
      senderId: number;
      receiverId: number;
      message: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // Check if sender is a participant
    const chats = await this.chatService.getChatHistory(data.listingId, data.senderId);
    if (chats.length === 0) {
      client.emit('error', { message: 'You are not a participant in this chat' });
      client.disconnect();
      return;
    }
    const chat = await this.chatService.createMessage({
      listingId: data.listingId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      message: data.message,
      status: 'sent',
    });
    const room = `listing-${data.listingId}`;
    this.server.to(room).emit('newMessage', chat);
    return chat;
  }

  @SubscribeMessage('messageDelivered')
  async handleMessageDelivered(
    @MessageBody() data: { messageId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const updated = await this.chatService.updateStatus(data.messageId, 'delivered');
    this.server.emit('messageStatusUpdated', updated);
    return updated;
  }

  @SubscribeMessage('messageRead')
  async handleMessageRead(
    @MessageBody() data: { messageId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const updated = await this.chatService.markAsRead(data.messageId, data.userId);
    this.server.emit('messageStatusUpdated', updated);
    return updated;
  }
} 