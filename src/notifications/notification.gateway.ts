import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedClients = new Map<string, string>(); // socketId -> userId

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub || payload.id;

      this.connectedClients.set(client.id, userId);
      client.join(`user:${userId}`);

      this.logger.log(
        `Client connected to notifications: ${client.id} (User: ${userId})`,
      );
    } catch (error) {
      this.logger.error(`Connection rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);
    this.logger.log(
      `Client disconnected from notifications: ${client.id} (User: ${userId})`,
    );
  }

  /**
   * Send a real-time notification to a specific user
   */
  sendNotification(
    userId: string,
    data: { type: string; message: string; payload?: any },
  ) {
    this.server.to(`user:${userId}`).emit('notification', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast to all connected admins
   */
  broadcastToAdmins(data: { type: string; message: string; payload?: any }) {
    // Assuming admins join an 'admins' room upon connection if they have admin role
    this.server.to('admins').emit('admin-notification', data);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): string {
    return 'pong';
  }
}
