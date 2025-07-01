import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: '/analytics' })
export class AnalyticsGateway {
  @WebSocketServer()
  server: Server;

  emitUserAnalyticsUpdate(userId: string, data: any) {
    this.server.to(`user-${userId}`).emit('userAnalyticsUpdate', data);
  }

  emitPlatformAnalyticsUpdate(data: any) {
    this.server.emit('platformAnalyticsUpdate', data);
  }
} 